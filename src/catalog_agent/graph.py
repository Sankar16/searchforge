import json
from typing import Any, Dict

from langgraph.graph import StateGraph, START, END

from src.schemas import Product
from src.catalog_agent.state import CatalogAgentState
from src.catalog_agent.spec_checker import check_missing_specs
from src.catalog_agent.uom import normalize_catalog_uom
from src.catalog_agent.description_quality import check_description_quality
from src.catalog_agent.llm_description_rewriter import rewrite_weak_descriptions_with_llm
from src.catalog_agent.dedup import find_duplicate_candidates
from src.catalog_agent.report import build_catalog_health_report


def load_catalog_node(state: CatalogAgentState) -> Dict[str, Any]:
    with open(state["input_path"], "r") as f:
        raw_catalog = json.load(f)

    products = [Product(**item) for item in raw_catalog]

    return {
        "raw_products": products,
    }


def check_specs_before_node(state: CatalogAgentState) -> Dict[str, Any]:
    issues = check_missing_specs(state["raw_products"])

    return {
        "messy_spec_issues": issues,
    }


def normalize_uom_node(state: CatalogAgentState) -> Dict[str, Any]:
    normalized_products = normalize_catalog_uom(state["raw_products"])

    return {
        "normalized_products": normalized_products,
    }


def check_specs_after_node(state: CatalogAgentState) -> Dict[str, Any]:
    issues = check_missing_specs(state["normalized_products"])

    return {
        "normalized_spec_issues": issues,
    }


def check_descriptions_node(state: CatalogAgentState) -> Dict[str, Any]:
    messy_description_issues = check_description_quality(state["raw_products"])
    normalized_description_issues = check_description_quality(
        state["normalized_products"]
    )

    weak_skus = {issue.sku for issue in normalized_description_issues}

    return {
        "messy_description_issues": messy_description_issues,
        "normalized_description_issues": normalized_description_issues,
        "weak_skus": weak_skus,
    }


def rewrite_descriptions_node(state: CatalogAgentState) -> Dict[str, Any]:
    rewritten_products = rewrite_weak_descriptions_with_llm(
        products=state["normalized_products"],
        weak_skus=state["weak_skus"],
    )

    final_description_issues = check_description_quality(rewritten_products)

    return {
        "rewritten_products": rewritten_products,
        "final_description_issues": final_description_issues,
    }


def detect_duplicates_node(state: CatalogAgentState) -> Dict[str, Any]:
    duplicate_candidates = find_duplicate_candidates(
        state["rewritten_products"],
        threshold=88,
    )

    return {
        "duplicate_candidates": duplicate_candidates,
    }


def generate_report_node(state: CatalogAgentState) -> Dict[str, Any]:
    report = build_catalog_health_report(
        products=state["raw_products"],
        messy_spec_issues=state["messy_spec_issues"],
        normalized_spec_issues=state["normalized_spec_issues"],
        description_issues=state["final_description_issues"],
    )

    return {
        "health_report": report,
    }


def save_clean_catalog_node(state: CatalogAgentState) -> Dict[str, Any]:
    with open(state["output_path"], "w") as f:
        json.dump(
            [product.model_dump() for product in state["rewritten_products"]],
            f,
            indent=2,
        )

    return {}


def build_catalog_intelligence_graph():
    graph = StateGraph(CatalogAgentState)

    graph.add_node("load_catalog", load_catalog_node)
    graph.add_node("check_specs_before", check_specs_before_node)
    graph.add_node("normalize_uom", normalize_uom_node)
    graph.add_node("check_specs_after", check_specs_after_node)
    graph.add_node("check_descriptions", check_descriptions_node)
    graph.add_node("rewrite_descriptions", rewrite_descriptions_node)
    graph.add_node("detect_duplicates", detect_duplicates_node)
    graph.add_node("generate_report", generate_report_node)
    graph.add_node("save_clean_catalog", save_clean_catalog_node)

    graph.add_edge(START, "load_catalog")
    graph.add_edge("load_catalog", "check_specs_before")
    graph.add_edge("check_specs_before", "normalize_uom")
    graph.add_edge("normalize_uom", "check_specs_after")
    graph.add_edge("check_specs_after", "check_descriptions")
    graph.add_edge("check_descriptions", "rewrite_descriptions")
    graph.add_edge("rewrite_descriptions", "detect_duplicates")
    graph.add_edge("detect_duplicates", "generate_report")
    graph.add_edge("generate_report", "save_clean_catalog")
    graph.add_edge("save_clean_catalog", END)

    return graph.compile()