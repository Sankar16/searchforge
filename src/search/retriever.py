import re
from typing import List, Dict, Any


def tokenize(text: str) -> List[str]:
    """
    Converts query/product text into searchable tokens.
    Example: "25mm sealed bearing" -> ["25mm", "sealed", "bearing"]
    """
    return re.findall(r"\w+", text.lower())


def normalize_token_variants(tokens: List[str]) -> List[str]:
    """
    Adds simple token variants.
    Example:
    - 25mm becomes 25
    - 1/2 is not fully handled yet, but we keep this simple for now
    """
    expanded = set(tokens)

    for token in tokens:
        # 25mm -> 25
        if token.endswith("mm"):
            expanded.add(token.replace("mm", ""))

        # 24v -> 24
        if token.endswith("v"):
            expanded.add(token.replace("v", ""))

    return list(expanded)


def field_text(value: Any) -> str:
    """
    Converts any field value into searchable text.
    Handles strings, lists, and dictionaries.
    """
    if value is None:
        return ""

    if isinstance(value, list):
        return " ".join(str(item) for item in value)

    if isinstance(value, dict):
        parts = []

        for key, val in value.items():
            parts.append(str(key))

            if isinstance(val, list):
                parts.extend(str(item) for item in val)
            else:
                parts.append(str(val))

        return " ".join(parts)

    return str(value)


def score_field(field_value: Any, query_tokens: List[str], weight: int) -> int:
    """
    Scores one product field.
    A match in name should matter more than a match in description/specs.
    """
    text = field_text(field_value).lower()
    score = 0

    for token in query_tokens:
        if token in text:
            score += weight

    return score


def search_catalog(
    catalog: List[Dict[str, Any]],
    query: str,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Weighted keyword search.

    Field weights:
    - name: strongest signal
    - search_terms: strong curated signal
    - category: medium signal
    - description: medium/low signal
    - specs: low but useful signal
    """
    query_tokens = tokenize(query)
    query_tokens = normalize_token_variants(query_tokens)

    results = []

    for product in catalog:
        score = 0

        score += score_field(product.get("name", ""), query_tokens, weight=5)
        score += score_field(product.get("search_terms", []), query_tokens, weight=4)
        score += score_field(product.get("category", ""), query_tokens, weight=3)
        score += score_field(product.get("description", ""), query_tokens, weight=2)
        score += score_field(product.get("specs", {}), query_tokens, weight=1)

        if score > 0:
            results.append(
                {
                    "sku": product.get("sku"),
                    "name": product.get("name"),
                    "category": product.get("category"),
                    "description": product.get("description"),
                    "score": score,
                }
            )

    return sorted(results, key=lambda x: x["score"], reverse=True)[:top_k]