import json
from typing import Dict, Any, List
from src.crosssell_agent.knowledge_graph import (
    build_compatibility_graph,
    get_graph_recommendations,
)


def load_catalog(path: str = "data/catalog_clean.json") -> Dict[str, Dict[str, Any]]:
    with open(path, "r") as f:
        products = json.load(f)

    return {product["sku"]: product for product in products}


def enrich_recommendations(
    recommendations: List[Dict[str, Any]],
    catalog_by_sku: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    enriched = []

    for rec in recommendations:
        target_product = catalog_by_sku.get(rec["target_sku"])

        if not target_product:
            continue

        enriched.append(
            {
                **rec,
                "recommended_name": target_product.get("name"),
                "recommended_category": target_product.get("category"),
                "recommended_description": target_product.get("description"),
                "recommended_specs": target_product.get("specs", {}),
                "recommended_price": target_product.get("price"),
            }
        )

    return enriched


def recommend_cross_sell(
    cart_sku: str,
    catalog_path: str = "data/catalog_clean.json",
) -> List[Dict[str, Any]]:
    catalog_by_sku = load_catalog(catalog_path)
    graph = build_compatibility_graph()

    raw_recommendations = get_graph_recommendations(graph, cart_sku)

    return enrich_recommendations(
        recommendations=raw_recommendations,
        catalog_by_sku=catalog_by_sku,
    )