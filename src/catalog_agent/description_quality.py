from typing import List
from src.schemas import Product, CatalogIssue


WEAK_PHRASES = [
    "good",
    "high quality",
    "reliable",
    "strong",
    "useful",
    "for many uses",
    "product",
]


def has_specs_in_description(product: Product) -> bool:
    """
    Checks whether important spec values appear inside the description.
    Example: if specs contain 25mm or M8, description should ideally mention it.
    """

    description = product.description.lower()

    for key, value in product.specs.items():
        if value is None:
            continue

        value_text = str(value).lower()

        if value_text in description:
            return True

    return False


def score_description(product: Product) -> int:
    """
    Simple score from 0 to 5.
    Higher score means better search-friendly description.
    """

    description = product.description.strip().lower()
    score = 5

    # Very short descriptions are weak
    if len(description.split()) < 6:
        score -= 2

    # Generic marketing words reduce quality
    for phrase in WEAK_PHRASES:
        if phrase in description:
            score -= 1

    # Description should include some product specs
    if not has_specs_in_description(product):
        score -= 1

    # Description should mention product name or category context
    name_tokens = product.name.lower().split()
    if not any(token in description for token in name_tokens):
        score -= 1

    return max(score, 0)


def check_description_quality(products: List[Product]) -> List[CatalogIssue]:
    issues = []

    for product in products:
        score = score_description(product)

        if score <= 2:
            issues.append(
                CatalogIssue(
                    sku=product.sku,
                    issue_type="weak_description",
                    message=f"Description quality score is low: {score}/5",
                    severity="medium",
                )
            )

    return issues