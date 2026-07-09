"""
SearchForge MCP catalog server.

Run as:
    python src/mcp_server/catalog_server.py

Exposes 4 tools over stdio transport:
    search_products, get_product, get_compatibility, get_catalog_health
"""

import json
import sys
import os
from pathlib import Path

# Resolve project root so imports work regardless of cwd.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from mcp.server.fastmcp import FastMCP
from src.search.retriever import search_catalog
from src.crosssell_agent.recommender import recommend_cross_sell

CATALOG_PATH = PROJECT_ROOT / "data" / "catalog_clean.json"

mcp = FastMCP("SearchForge Catalog")


def _load_catalog() -> list[dict]:
    with open(CATALOG_PATH, "r") as f:
        return json.load(f)


@mcp.tool()
def search_products(query: str, top_k: int = 5) -> str:
    """Search the product catalog by keyword query."""
    catalog = _load_catalog()
    results = search_catalog(catalog, query, top_k=top_k)
    output = [
        {
            "sku": r["sku"],
            "name": r["name"],
            "category": r["category"],
            "description": r["description"],
            "price": r.get("price"),
        }
        for r in results
    ]
    return json.dumps(output)


@mcp.tool()
def get_product(sku: str) -> str:
    """Return the full product record for the given SKU."""
    catalog = _load_catalog()
    for product in catalog:
        if product["sku"] == sku:
            return json.dumps(product)
    return json.dumps({"error": f"Product not found: {sku}"})


@mcp.tool()
def get_compatibility(sku: str) -> str:
    """Return cross-sell recommendations for the given SKU."""
    recs = recommend_cross_sell(sku)
    output = [
        {
            "sku": r["target_sku"],
            "name": r.get("recommended_name"),
            "relationship": r.get("relationship"),
            "reason": r.get("reason"),
            "confidence": r.get("confidence"),
            "price": r.get("recommended_price"),
        }
        for r in recs
    ]
    return json.dumps(output)


@mcp.tool()
def get_catalog_health() -> str:
    """Return summary health stats for the clean catalog."""
    catalog = _load_catalog()
    categories = sorted({p.get("category", "") for p in catalog if p.get("category")})
    prices = [p["price"] for p in catalog if p.get("price") is not None]
    avg_price = round(sum(prices) / len(prices), 2) if prices else 0.0
    return json.dumps(
        {
            "total_products": len(catalog),
            "categories": categories,
            "avg_price": avg_price,
        }
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
