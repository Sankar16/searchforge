"""
SearchForge FastAPI backend.

Run from project root:
    uvicorn api.main:app --reload --port 8000
"""

import sys
import os
import csv
import io
import json
import asyncio
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

from fastapi import FastAPI, Query, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.catalog_agent.graph import build_catalog_intelligence_graph
from src.search.retriever import search_catalog
from src.search.semantic_retriever import get_or_build_index, semantic_search
import src.search.semantic_retriever as _sem_mod
from src.crosssell_agent.llm_agent import get_cross_sell_with_explanation
from pydantic_ai import Agent

app = FastAPI(title="SearchForge API", version="1.0.0")

jobs: dict = {}  # job_id -> {status, result, error, created_at}
executor = ThreadPoolExecutor(max_workers=2)

analytics: dict = {
    "searches": [],
    "gap_analyses": [],
    "analyses_run": 0,
    "descriptions_approved": 0,
    "descriptions_rejected": 0,
}


class GapAnalysis(BaseModel):
    gap_summary: str
    likely_intent: str
    hidden_matches: list[dict]
    suggested_keywords: list[str]
    description_suggestion: str | None = None


gap_agent = Agent(
    "anthropic:claude-haiku-4-5-20251001",
    output_type=GapAnalysis,
    system_prompt=(
        "You are a B2B eCommerce merchandising expert. "
        "When a customer search finds no results, analyze the closest candidate products "
        "and explain the gap, identify likely intent, surface hidden matches, "
        "and suggest keywords and description improvements."
    ),
)


@app.on_event("startup")
async def startup_event():
    import asyncio
    import concurrent.futures

    def build_indexes():
        try:
            get_or_build_index("messy")
            get_or_build_index("clean")
            print("Search indexes built successfully")
        except Exception as e:
            print(f"Index build failed (non-fatal): {e}")

    loop = asyncio.get_event_loop()
    executor = concurrent.futures.ThreadPoolExecutor()
    loop.run_in_executor(executor, build_indexes)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Column name normalisation map for CSV upload
# ---------------------------------------------------------------------------
COL_MAP = {
    "sku": "sku", "product id": "sku", "product_id": "sku",
    "name": "name", "product name": "name", "product_name": "name", "title": "name",
    "category": "category", "type": "category",
    "description": "description", "desc": "description",
    "price": "price", "cost": "price",
    "brand": "brand", "manufacturer": "brand",
    "specs": "specs", "specifications": "specs",
}
REQUIRED = {"sku", "name", "category", "description"}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/api/catalog/upload")
async def upload_catalog(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    content = await file.read()
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    # Normalise column names
    raw_fields = reader.fieldnames or []
    col_lookup = {}
    for raw in raw_fields:
        key = raw.strip().lower()
        if key in COL_MAP:
            col_lookup[raw] = COL_MAP[key]

    detected_normalised = set(col_lookup.values())
    missing = REQUIRED - detected_normalised
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(sorted(missing))}",
        )

    products = []
    for row in reader:
        norm = {}
        for raw_key, val in row.items():
            mapped = col_lookup.get(raw_key)
            if mapped:
                norm[mapped] = val.strip() if val else ""

        product = {
            "sku": norm.get("sku", ""),
            "name": norm.get("name", ""),
            "category": norm.get("category", ""),
            "description": norm.get("description", ""),
            "brand": norm.get("brand") or None,
            "price": None,
            "specs": {},
            "search_terms": [],
        }
        if norm.get("price"):
            try:
                product["price"] = float(norm["price"])
            except ValueError:
                pass
        if norm.get("specs"):
            try:
                product["specs"] = json.loads(norm["specs"])
            except Exception:
                pass
        if product["sku"]:
            products.append(product)

    out_path = PROJECT_ROOT / "data" / "catalog_uploaded.json"
    with open(out_path, "w") as f:
        json.dump(products, f, indent=2)

    missing_optional = [c for c in ("price", "brand", "specs") if c not in detected_normalised]

    return {
        "success": True,
        "total_products": len(products),
        "columns_detected": list(detected_normalised),
        "preview": products[:5],
        "missing_optional": missing_optional,
    }


def calculate_completeness_score(catalog_before: list, pipeline_result: dict) -> dict:
    total_products = len(catalog_before)
    if total_products == 0:
        return {"before": 0, "after": 0, "breakdown": {}}

    weak_before = pipeline_result.get("weak_descriptions_before", 0)
    weak_after = pipeline_result.get("weak_descriptions_after", 0)
    spec_issues_before = pipeline_result.get("spec_issues_before", 0)
    spec_issues_after = pipeline_result.get("spec_issues_after", 0)
    duplicate_pairs = pipeline_result.get("duplicate_pairs", 0)

    desc_deduction_before = min(30, int((weak_before / total_products) * 30))
    spec_deduction_before = min(25, int((spec_issues_before / total_products) * 25))
    dup_deduction = min(15, duplicate_pairs * 3)

    score_before = max(0, 100 - desc_deduction_before - spec_deduction_before - dup_deduction)

    desc_deduction_after = min(30, int((weak_after / total_products) * 30))
    spec_deduction_after = min(25, int((spec_issues_after / total_products) * 25))
    score_after = max(0, 100 - desc_deduction_after - spec_deduction_after - dup_deduction)

    return {
        "before": score_before,
        "after": score_after,
        "breakdown": {
            "vague_descriptions": {"before": weak_before, "after": weak_after, "max_deduction": 30},
            "missing_specs": {"before": spec_issues_before, "after": spec_issues_after, "max_deduction": 25},
            "duplicate_listings": {"count": duplicate_pairs, "max_deduction": 15},
        },
    }


def run_catalog_pipeline(source: str) -> dict:
    uploaded_path = PROJECT_ROOT / "data" / "catalog_uploaded.json"
    if source == "uploaded" and uploaded_path.exists():
        input_path = str(uploaded_path)
    else:
        input_path = str(PROJECT_ROOT / "data" / "catalog_messy.json")

    with open(input_path) as f:
        catalog_before = json.load(f)

    graph = build_catalog_intelligence_graph()
    initial_state = {
        "input_path": input_path,
        "output_path": str(PROJECT_ROOT / "data" / "catalog_clean.json"),
    }
    state = graph.invoke(initial_state)

    report = state.get("health_report", {})
    evals = state.get("description_evaluations", [])
    dupes = state.get("duplicate_candidates", [])
    weak_before = len(state.get("messy_description_issues", []))
    weak_after = len(state.get("final_description_issues", []))

    raw_by_sku = {p.sku: p for p in state.get("raw_products", [])}
    rewritten_by_sku = {p.sku: p for p in state.get("rewritten_products", [])}
    weak_skus = state.get("weak_skus", set()) or set()
    repaired_skus = {e.get("sku") for e in state.get("initial_failed_description_evaluations", [])}

    description_rewrites = []
    for sku in weak_skus:
        raw = raw_by_sku.get(sku)
        rewritten = rewritten_by_sku.get(sku)
        if raw and rewritten:
            description_rewrites.append({
                "sku": sku,
                "name": raw.name,
                "original_description": raw.description,
                "optimized_description": rewritten.description,
                "was_repaired": sku in repaired_skus,
            })

    passing = [e for e in evals if e.get("passes_quality_gate")]
    scores = [e["judge_score"] for e in evals if "judge_score" in e]
    avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0

    result = {
        "total_products": report.get("total_products", 0),
        "spec_issues_before": report.get("messy_spec_issues", 0),
        "spec_issues_after": report.get("normalized_spec_issues", 0),
        "uom_issues_fixed": report.get("uom_issues_fixed", 0),
        "weak_descriptions_before": weak_before,
        "weak_descriptions_after": weak_after,
        "descriptions_evaluated": len(evals),
        "descriptions_passing_judge": len(passing),
        "avg_judge_score": avg_score,
        "duplicate_pairs": len(dupes),
        "total_issues": report.get("total_current_issues", 0),
        "description_rewrites": description_rewrites,
        "description_evaluations": [
            {
                "sku": e.get("sku"),
                "accuracy": e.get("accuracy"),
                "searchability": e.get("searchability"),
                "specificity": e.get("specificity"),
                "clarity": e.get("clarity"),
                "judge_score": e.get("judge_score"),
                "hallucination_risk": e.get("hallucination_risk"),
                "passes_quality_gate": e.get("passes_quality_gate"),
                "notes": e.get("notes"),
            }
            for e in evals
        ],
        "duplicate_candidates": [
            {
                "sku_a": d.get("sku_1"),
                "sku_b": d.get("sku_2"),
                "similarity": round(d.get("similarity_score", 0), 1),
            }
            for d in dupes
        ],
    }
    result["completeness_score"] = calculate_completeness_score(catalog_before, result)

    catalog_after_path = PROJECT_ROOT / "data" / "catalog_clean.json"
    try:
        from src.crosssell_agent.graph_generator import generate_knowledge_graph
        with open(catalog_after_path) as f:
            catalog_after = json.load(f)
        graph_result = asyncio.run(generate_knowledge_graph(catalog_after))
        if graph_result.total_edges > 0:
            with open(PROJECT_ROOT / "data" / "generated_graph.json", "w") as f:
                json.dump(graph_result.edges, f, indent=2)
        result["knowledge_graph"] = {
            "total_edges": graph_result.total_edges,
            "total_candidates": graph_result.total_candidates,
        }
    except Exception as e:
        print(f"Graph generation failed (non-fatal): {e}")
        result["knowledge_graph"] = {"total_edges": 0, "total_candidates": 0}

    return result


def run_pipeline_in_background(job_id: str, source: str):
    try:
        jobs[job_id]["status"] = "running"
        result = run_catalog_pipeline(source)
        jobs[job_id]["status"] = "complete"
        jobs[job_id]["result"] = result
        analytics["analyses_run"] += 1
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)


@app.post("/api/catalog/analyze")
async def analyze_catalog(source: str = Query("sample")):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "pending", "result": None, "error": None}
    loop = asyncio.get_event_loop()
    loop.run_in_executor(executor, run_pipeline_in_background, job_id, source)
    return {"job_id": job_id, "status": "pending"}


@app.get("/api/catalog/status/{job_id}")
def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    job = jobs[job_id]
    return {
        "job_id": job_id,
        "status": job["status"],
        "result": job["result"],
        "error": job["error"],
    }


class ApplyChangesRequest(BaseModel):
    approved_skus: list[str]
    edited_descriptions: dict[str, str] = {}


@app.post("/api/catalog/apply-changes")
def apply_changes(body: ApplyChangesRequest):
    clean_path = PROJECT_ROOT / "data" / "catalog_clean.json"
    if not clean_path.exists():
        raise HTTPException(status_code=404, detail="No analysis has been run yet.")

    with open(clean_path) as f:
        clean_catalog = json.load(f)

    # Load original catalog for reverts
    uploaded_path = PROJECT_ROOT / "data" / "catalog_uploaded.json"
    orig_path = uploaded_path if uploaded_path.exists() else PROJECT_ROOT / "data" / "catalog_messy.json"
    with open(orig_path) as f:
        orig_catalog = json.load(f)
    orig_by_sku = {p["sku"]: p for p in orig_catalog}

    approved_set = set(body.approved_skus)
    applied = 0
    reverted = 0
    final = []

    for product in clean_catalog:
        sku = product["sku"]
        p = dict(product)
        if sku in approved_set:
            # Use edited description if provided, otherwise keep clean rewrite
            if sku in body.edited_descriptions:
                p["description"] = body.edited_descriptions[sku]
            applied += 1
        else:
            # Revert to original description
            orig = orig_by_sku.get(sku)
            if orig:
                p["description"] = orig["description"]
            reverted += 1
        final.append(p)

    final_path = PROJECT_ROOT / "data" / "catalog_final.json"
    with open(final_path, "w") as f:
        json.dump(final, f, indent=2)

    # Clear search indexes so the next search picks up the updated catalog
    _sem_mod._indexes.clear()

    analytics["descriptions_approved"] += applied
    analytics["descriptions_rejected"] += reverted

    return {
        "success": True,
        "applied": applied,
        "reverted": reverted,
        "output_file": "catalog_final.json",
    }


@app.get("/api/catalog/download")
def download_catalog():
    final_path = PROJECT_ROOT / "data" / "catalog_final.json"
    clean_path = PROJECT_ROOT / "data" / "catalog_clean.json"
    path = final_path if final_path.exists() else clean_path
    if not path.exists():
        raise HTTPException(status_code=404, detail="No catalog available for download.")

    with open(path) as f:
        products = json.load(f)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["SKU", "Name", "Category", "Description", "Price", "Brand"],
        extrasaction="ignore",
    )
    writer.writeheader()
    for p in products:
        writer.writerow({
            "SKU": p.get("sku", ""),
            "Name": p.get("name", ""),
            "Category": p.get("category", ""),
            "Description": p.get("description", ""),
            "Price": p.get("price", ""),
            "Brand": p.get("brand", ""),
        })

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=optimized_catalog.csv"},
    )


@app.post("/api/search/reindex")
def reindex():
    """Clear and rebuild semantic search indexes for messy and clean catalogs."""
    _sem_mod._indexes.clear()
    try:
        get_or_build_index("messy")
        get_or_build_index("clean")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reindex failed: {e}")
    return {"success": True, "message": "Indexes rebuilt"}


@app.get("/api/search")
def search(
    q: str = Query(..., description="Search query"),
    mode: str = Query("clean", description="'messy' or 'clean'"),
    search_type: str = Query("semantic", description="'semantic' or 'keyword'"),
):
    if mode not in ("messy", "clean"):
        raise HTTPException(status_code=400, detail="mode must be 'messy' or 'clean'")

    if search_type == "semantic":
        try:
            collection = get_or_build_index(mode)
            results = semantic_search(collection, q, top_k=5)
            analytics["searches"].append({
                "query": q,
                "mode": mode,
                "result_count": len(results),
                "timestamp": datetime.utcnow().isoformat(),
                "top_match_score": results[0]["score"] if results else 0,
            })
            return {
                "query": q,
                "mode": mode,
                "search_type": "semantic",
                "results": [
                    {
                        "sku": r["sku"],
                        "name": r["name"],
                        "category": r["category"],
                        "description": r["description"],
                        "price": float(r["price"]) if r.get("price") else None,
                        "score": r.get("score", 0),
                        "match_label": r.get("match_label", ""),
                    }
                    for r in results
                ],
            }
        except Exception as e:
            # Fall through to keyword search if semantic fails
            print(f"Semantic search failed, falling back to keyword: {e}")

    # Keyword fallback
    catalog_path = PROJECT_ROOT / "data" / f"catalog_{mode}.json"
    if not catalog_path.exists():
        raise HTTPException(status_code=404, detail=f"Catalog not found: {catalog_path.name}")

    with open(catalog_path) as f:
        catalog = json.load(f)

    results = search_catalog(catalog, q, top_k=5)
    analytics["searches"].append({
        "query": q,
        "mode": mode,
        "result_count": len(results),
        "timestamp": datetime.utcnow().isoformat(),
        "top_match_score": results[0]["score"] if results else 0,
    })
    return {
        "query": q,
        "mode": mode,
        "search_type": "keyword",
        "results": [
            {
                "sku": r["sku"],
                "name": r["name"],
                "category": r["category"],
                "description": r["description"],
                "price": r.get("price"),
                "score": r.get("score", 0),
            }
            for r in results
        ],
    }


class GapAnalysisRequest(BaseModel):
    query: str


@app.post("/api/search/gap-analysis")
async def search_gap_analysis(body: GapAnalysisRequest):
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    fallback = {
        "gap_summary": f"No products found matching '{query}'",
        "likely_intent": f"Products related to {query}",
        "hidden_matches": [],
        "suggested_keywords": [query],
        "description_suggestion": None,
    }

    # Collect remotely related products from both catalogs at a low threshold
    seen_skus: set = set()
    candidate_products = []
    for mode in ("clean", "messy"):
        try:
            collection = get_or_build_index(mode)
            hits = semantic_search(collection, query, top_k=5, min_score=15)
            for r in hits:
                if r["sku"] not in seen_skus:
                    seen_skus.add(r["sku"])
                    candidate_products.append(r)
        except Exception as exc:
            print(f"Gap analysis index error ({mode}): {exc}")

    if not candidate_products:
        return fallback

    products_json = json.dumps(
        [
            {
                "sku": p["sku"],
                "name": p["name"],
                "category": p["category"],
                "description": p.get("description", ""),
                "score": p.get("score", 0),
            }
            for p in candidate_products[:8]
        ],
        indent=2,
    )

    prompt = (
        f'A customer searched for "{query}" in a B2B product catalog and found no results.\n\n'
        f"Here are the closest products we found (below normal relevance threshold):\n{products_json}\n\n"
        "You are a B2B eCommerce merchandising expert.\n\n"
        "Respond in JSON only, no markdown:\n"
        "{\n"
        '  "gap_summary": "One sentence explaining why this search finds nothing",\n'
        '  "likely_intent": "What the customer is probably looking for",\n'
        '  "hidden_matches": [\n'
        "    {\n"
        '      "sku": "SKU here",\n'
        '      "name": "Product name",\n'
        '      "reason": "Why this product probably matches the customer\'s intent even though the description doesn\'t say so"\n'
        "    }\n"
        "  ],\n"
        '  "suggested_keywords": ["keyword1", "keyword2", "keyword3"],\n'
        '  "description_suggestion": "Example of how to rewrite one product description to capture this search"\n'
        "}"
    )

    try:
        run = await gap_agent.run(prompt)
        result = run.output
        analytics["gap_analyses"].append({
            "query": query,
            "hidden_match_count": len(result.hidden_matches),
            "timestamp": datetime.utcnow().isoformat(),
        })
        return result.model_dump()
    except Exception as exc:
        print(f"Gap analysis LLM failed: {exc}")
        return fallback


@app.get("/api/crosssell/{sku}")
async def crosssell(sku: str):
    result = await get_cross_sell_with_explanation(sku)
    if not result.get("cart_product"):
        raise HTTPException(status_code=404, detail=f"Product not found: {sku}")
    return result


@app.get("/api/search/suggestions")
async def get_search_suggestions(mode: str = "clean"):
    """Returns 5 suggested search queries based on the current catalog."""
    data_dir = PROJECT_ROOT / "data"
    if mode == "clean" and (data_dir / "catalog_clean.json").exists():
        catalog_path = data_dir / "catalog_clean.json"
    elif (data_dir / "catalog_uploaded.json").exists():
        catalog_path = data_dir / "catalog_uploaded.json"
    else:
        catalog_path = data_dir / "catalog_messy.json"

    with open(catalog_path) as f:
        catalog = json.load(f)

    if not catalog:
        return {"suggestions": []}

    def score_product(p):
        return len(p.get("description", "")) + (50 if p.get("specs") else 0)

    sorted_products = sorted(catalog, key=score_product, reverse=True)
    seen_categories: set = set()
    suggestions = []
    key_specs = ["inner_diameter_mm", "bore", "size_inch", "diameter_mm", "voltage", "port_size_inch"]
    for product in sorted_products:
        category = product.get("category", "").lower()
        if category not in seen_categories and len(suggestions) < 5:
            seen_categories.add(category)
            name = product.get("name", "")
            specs = product.get("specs", {})
            if specs:
                for sk in key_specs:
                    if sk in specs:
                        unit = "mm" if "_mm" in sk else ""
                        suggestions.append(f"{name.lower()} {specs[sk]}{unit}")
                        break
                else:
                    suggestions.append(name.lower())
            else:
                suggestions.append(name.lower())

    categories = list({p.get("category", "") for p in catalog})
    for cat in categories:
        if len(suggestions) >= 5:
            break
        q = f"{cat.lower()} products"
        if q not in suggestions:
            suggestions.append(q)

    return {"suggestions": suggestions[:5]}


@app.get("/api/catalog/sample-skus")
async def get_sample_skus():
    """Returns 5 representative SKUs from the current catalog."""
    data_dir = PROJECT_ROOT / "data"
    if (data_dir / "catalog_clean.json").exists():
        with open(data_dir / "catalog_clean.json") as f:
            catalog = json.load(f)
    else:
        with open(data_dir / "catalog_messy.json") as f:
            catalog = json.load(f)

    if not catalog:
        return {"skus": []}

    try:
        from src.crosssell_agent.knowledge_graph import build_compatibility_graph
        G = build_compatibility_graph()
        graph_skus = list(G.nodes())
        catalog_skus = {p["sku"] for p in catalog}
        valid = [s for s in graph_skus if s in catalog_skus]
        if len(valid) >= 5:
            result = []
            for sku in valid[:5]:
                product = next((p for p in catalog if p["sku"] == sku), None)
                if product:
                    result.append({"sku": sku, "name": product.get("name", sku)})
            return {"skus": result}
    except Exception:
        pass

    return {"skus": [{"sku": p["sku"], "name": p.get("name", p["sku"])} for p in catalog[:5]]}


class SynonymRequest(BaseModel):
    query: str
    suggested_keywords: list[str] = []


@app.post("/api/search/synonyms")
async def generate_synonyms(body: SynonymRequest):
    """Given a zero-result query, generate synonym rules using Claude Haiku."""
    from pydantic import BaseModel as PydanticBase
    from pydantic_ai import Agent as PydAgent

    class SynonymRule(PydanticBase):
        trigger: str
        synonyms: list[str]
        rationale: str

    class SynonymResponse(PydanticBase):
        rules: list[SynonymRule]

    synonym_agent = PydAgent(
        "anthropic:claude-haiku-4-5-20251001",
        output_type=SynonymResponse,
        system_prompt=(
            "You are a B2B eCommerce search specialist. "
            "Generate synonym rules for a search platform. "
            "When a customer searches for X, they should also find results for Y. "
            "Focus on B2B industrial product terminology."
        ),
    )

    try:
        result = await synonym_agent.run(
            f'The customer searched for: "{body.query}"\n\n'
            f"The catalog uses these related keywords: {body.suggested_keywords}\n\n"
            "Generate 2-3 synonym rules. Each rule maps a customer search term "
            "to catalog terminology that would find matching products.\n\n"
            "Keep synonyms specific to B2B industrial terminology."
        )
        return {
            "query": body.query,
            "synonyms": [
                {"trigger": r.trigger, "synonyms": r.synonyms, "rationale": r.rationale}
                for r in result.output.rules
            ],
        }
    except Exception as e:
        return {"query": body.query, "synonyms": [], "error": str(e)}


@app.get("/api/catalog/spec-requirements")
async def get_spec_requirements(category: str = Query(...), name: str = Query("")):
    """Infer required specs for a product category using Claude Haiku."""
    from src.catalog_agent.spec_checker import infer_required_specs_for_category
    return await infer_required_specs_for_category(category=category, product_name=name)


@app.get("/api/analytics")
def get_analytics():
    searches = analytics["searches"]
    gap_analyses = analytics["gap_analyses"]

    total_searches = len(searches)
    zero_result_searches = sum(1 for s in searches if s["result_count"] == 0)
    zero_result_rate = round(zero_result_searches / total_searches * 100, 1) if total_searches else 0

    query_counts = Counter(s["query"] for s in searches)
    top_queries = [{"query": q, "count": c} for q, c in query_counts.most_common(10)]

    scores = [s["top_match_score"] for s in searches if s["result_count"] > 0]
    avg_top_score = round(sum(scores) / len(scores), 1) if scores else 0

    total_decisions = analytics["descriptions_approved"] + analytics["descriptions_rejected"]
    approval_rate = round(
        analytics["descriptions_approved"] / total_decisions * 100, 1
    ) if total_decisions else 0

    recent_searches = sorted(searches, key=lambda s: s["timestamp"], reverse=True)[:20]
    recent_gaps = sorted(gap_analyses, key=lambda g: g["timestamp"], reverse=True)[:10]

    return {
        "searches": {
            "total": total_searches,
            "zero_result_rate": zero_result_rate,
            "avg_top_score": avg_top_score,
            "top_queries": top_queries,
            "recent": recent_searches,
        },
        "gap_analyses": {
            "total": len(gap_analyses),
            "recent": recent_gaps,
        },
        "catalog": {
            "analyses_run": analytics["analyses_run"],
            "descriptions_approved": analytics["descriptions_approved"],
            "descriptions_rejected": analytics["descriptions_rejected"],
            "approval_rate": approval_rate,
        },
    }
