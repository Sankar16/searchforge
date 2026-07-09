"""
SearchForge FastAPI backend.

Run from project root:
    uvicorn api.main:app --reload --port 8000
Or from the api/ directory:
    uvicorn main:app --reload --port 8000
"""

import sys
import os
from pathlib import Path

# Add project root to path so src.* imports work from either cwd.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)  # file paths like "data/..." resolve from project root

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.catalog_agent.graph import build_catalog_intelligence_graph
from src.search.retriever import search_catalog
from src.crosssell_agent.llm_agent import get_cross_sell_with_explanation

import json

app = FastAPI(title="SearchForge API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/api/catalog/analyze")
def analyze_catalog():
    graph = build_catalog_intelligence_graph()
    initial_state = {
        "input_path": str(PROJECT_ROOT / "data" / "catalog_messy.json"),
        "output_path": str(PROJECT_ROOT / "data" / "catalog_clean.json"),
    }
    state = graph.invoke(initial_state)

    report = state.get("health_report", {})
    evals = state.get("description_evaluations", [])
    dupes = state.get("duplicate_candidates", [])
    weak_before = len(state.get("messy_description_issues", []))
    weak_after = len(state.get("final_description_issues", []))

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


@app.get("/api/search")
def search(
    q: str = Query(..., description="Search query"),
    mode: str = Query("clean", description="'messy' or 'clean'"),
):
    if mode not in ("messy", "clean"):
        raise HTTPException(status_code=400, detail="mode must be 'messy' or 'clean'")

    catalog_path = PROJECT_ROOT / "data" / f"catalog_{mode}.json"
    if not catalog_path.exists():
        raise HTTPException(status_code=404, detail=f"Catalog not found: {catalog_path.name}")

    with open(catalog_path) as f:
        catalog = json.load(f)

    results = search_catalog(catalog, q, top_k=5)
    return {
        "query": q,
        "mode": mode,
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


@app.get("/api/crosssell/{sku}")
async def crosssell(sku: str):
    result = await get_cross_sell_with_explanation(sku)
    if not result.get("cart_product"):
        raise HTTPException(status_code=404, detail=f"Product not found: {sku}")
    return result
