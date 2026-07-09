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
from concurrent.futures import ThreadPoolExecutor
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
from src.utils.claude_retry import claude_call_with_retry

app = FastAPI(title="SearchForge API", version="1.0.0")

jobs: dict = {}  # job_id -> {status, result, error, created_at}
executor = ThreadPoolExecutor(max_workers=2)


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


def run_catalog_pipeline(source: str) -> dict:
    uploaded_path = PROJECT_ROOT / "data" / "catalog_uploaded.json"
    if source == "uploaded" and uploaded_path.exists():
        input_path = str(uploaded_path)
    else:
        input_path = str(PROJECT_ROOT / "data" / "catalog_messy.json")

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

    return {
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


def run_pipeline_in_background(job_id: str, source: str):
    try:
        jobs[job_id]["status"] = "running"
        result = run_catalog_pipeline(source)
        jobs[job_id]["status"] = "complete"
        jobs[job_id]["result"] = result
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
        import anthropic as _anthropic
        client = _anthropic.AsyncAnthropic()
        message = await claude_call_with_retry(
            client,
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown fences if Claude wraps the JSON
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        return result
    except Exception as exc:
        print(f"Gap analysis LLM failed: {exc}")
        return fallback


@app.get("/api/crosssell/{sku}")
async def crosssell(sku: str):
    result = await get_cross_sell_with_explanation(sku)
    if not result.get("cart_product"):
        raise HTTPException(status_code=404, detail=f"Product not found: {sku}")
    return result
