from typing import TypedDict, List, Dict, Any, Set

from src.schemas import Product, CatalogIssue


class CatalogAgentState(TypedDict):
    """
    Shared state for the Catalog Intelligence LangGraph workflow.
    Every graph node reads from this state and writes updated values back.
    """

    input_path: str
    output_path: str

    raw_products: List[Product]
    normalized_products: List[Product]
    rewritten_products: List[Product]

    messy_spec_issues: List[CatalogIssue]
    normalized_spec_issues: List[CatalogIssue]

    messy_description_issues: List[CatalogIssue]
    normalized_description_issues: List[CatalogIssue]
    final_description_issues: List[CatalogIssue]
    description_evaluations: List[Dict[str, Any]]

    weak_skus: Set[str]

    duplicate_candidates: List[Dict[str, Any]]
    health_report: Dict[str, Any]