import re
from typing import List, Dict, Any, Set
from rapidfuzz import fuzz
from src.schemas import Product, CatalogIssue
from src.catalog_agent.spec_checker import infer_product_type


GENERIC_TOKENS = {
    "product",
    "products",
    "industrial",
    "maintenance",
    "repair",
    "equipment",
    "assembly",
    "applications",
    "suitable",
    "b2b",
    "high",
    "quality",
    "good",
    "reliable",
    "strong",
    "useful",
    "with",
    "for",
    "and",
    "the",
    "inch",
    "mm",
    "in",
}


def normalize_text(text: str) -> str:
    text = text.lower()
    text = text.replace("-", " ")
    text = text.replace("/", " ")
    text = text.replace("x", " ")
    text = re.sub(r"[^a-z0-9.\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def tokens_from_text(text: str) -> Set[str]:
    tokens = set(normalize_text(text).split())
    return {token for token in tokens if token not in GENERIC_TOKENS and len(token) > 1}


def extract_identifiers(product: Product) -> Set[str]:
    """
    Extracts technical identifiers from name/specs.
    Examples:
    - 6205
    - UC205
    - P205
    - M8
    - 25
    - 40
    - 1/2
    - 4
    """
    text = " ".join(
        [
            product.sku,
            product.name,
            " ".join(str(v) for v in product.specs.values()),
        ]
    ).lower()

    identifiers = set()

    patterns = [
        r"\b\d{4}\b",          # 6205, 6303, 30205 partially catches 30205? no, below catches
        r"\b\d{5}\b",          # 30205
        r"\buc\d+\b",          # uc205
        r"\bp\d+\b",           # p205
        r"\bfl\d+\b",          # fl205
        r"\bm\d+\b",           # m8, m10
        r"\b\d+mm\b",          # 25mm
        r"\b\d+\s*mm\b",       # 25 mm
        r"\b\d+\/\d+\b",       # 1/2, 3/8
        r"\b\d+\.\d+\b",       # 0.5, 0.375
        r"\b\d+\b",            # 25, 40, 4
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            identifiers.add(match.replace(" ", ""))

    return identifiers


def important_spec_text(product: Product) -> str:
    """
    Uses specs more than description because descriptions may contain generic rewritten text.
    """
    important_parts = []

    for key, value in product.specs.items():
        key_lower = key.lower()

        if key_lower in {
            "inner_diameter_mm",
            "outer_diameter_mm",
            "width_mm",
            "diameter_mm",
            "length_mm",
            "diameter",
            "length",
            "size",
            "size_inch",
            "size_mm",
            "thread",
            "thread_type",
            "material",
            "seal",
            "seal_type",
            "bearing_type",
            "valve_type",
            "mount",
            "mount_type",
            "compatible_bearing",
            "compatible_bearing_series",
            "shaft_size",
            "shaft_diameter_mm",
            "connection",
            "pressure",
            "pressure_rating_psi",
            "voltage",
        }:
            important_parts.append(f"{key} {value}")

    return normalize_text(" ".join(important_parts))


def product_match_text(product: Product) -> str:
    """
    Main duplicate matching text.
    Notice: we do NOT use full description here.
    """
    return normalize_text(
        " ".join(
            [
                product.name,
                product.category,
                important_spec_text(product),
            ]
        )
    )


def has_shared_identifier(p1: Product, p2: Product) -> bool:
    ids1 = extract_identifiers(p1)
    ids2 = extract_identifiers(p2)

    shared = ids1.intersection(ids2)

    # Avoid saying two products are duplicates only because both have tiny generic numbers like 1 or 2
    meaningful_shared = {
        item for item in shared
        if item not in {"1", "2", "3", "4", "5", "10"}
    }

    return len(meaningful_shared) > 0


def is_comparable_product_type(p1: Product, p2: Product) -> bool:
    type1 = infer_product_type(p1)
    type2 = infer_product_type(p2)

    if type1 == type2:
        return True

    compatible_type_groups = [
        {"bolt", "hardware_kit"},
        {"pipe_elbow", "pipe_adapter", "pipe_coupling", "pipe_reducer"},
        {"pillow_block_housing", "flange_housing"},
    ]

    for group in compatible_type_groups:
        if type1 in group and type2 in group:
            return True

    return False


def get_spec_value(product: Product, possible_keys: list[str]) -> str:
    for key in possible_keys:
        value = product.specs.get(key)
        if value not in [None, "", []]:
            return str(value).lower()
    return ""


def passes_type_specific_checks(p1: Product, p2: Product) -> bool:
    type1 = infer_product_type(p1)
    type2 = infer_product_type(p2)

    # Valves should not be duplicates unless valve type matches.
    if type1 == "valve" and type2 == "valve":
        valve_type_1 = get_spec_value(p1, ["valve_type"])
        valve_type_2 = get_spec_value(p2, ["valve_type"])

        # If both have valve type and they differ, reject.
        if valve_type_1 and valve_type_2 and valve_type_1 != valve_type_2:
            return False

    # Pipe adapters should not be duplicates unless fitting type is similar.
    if type1 == "pipe_adapter" and type2 == "pipe_adapter":
        fitting_type_1 = get_spec_value(p1, ["fitting_type"])
        fitting_type_2 = get_spec_value(p2, ["fitting_type"])

        if fitting_type_1 and fitting_type_2 and fitting_type_1 != fitting_type_2:
            return False

    return True

def find_duplicate_candidates(
    products: List[Product],
    threshold: int = 88,
) -> List[Dict[str, Any]]:
    duplicates = []

    for i in range(len(products)):
        for j in range(i + 1, len(products)):
            p1 = products[i]
            p2 = products[j]

            if not is_comparable_product_type(p1, p2):
                continue

            if not has_shared_identifier(p1, p2):
                continue

            if not passes_type_specific_checks(p1, p2):
                continue

            if not has_shared_identifier(p1, p2):
                continue

            text1 = product_match_text(p1)
            text2 = product_match_text(p2)

            name_score = fuzz.token_set_ratio(
                normalize_text(p1.name),
                normalize_text(p2.name),
            )

            spec_score = fuzz.token_set_ratio(text1, text2)

            final_score = round((name_score * 0.7) + (spec_score * 0.3), 2)

            if final_score >= threshold:
                duplicates.append(
                    {
                        "sku_1": p1.sku,
                        "name_1": p1.name,
                        "sku_2": p2.sku,
                        "name_2": p2.name,
                        "similarity_score": final_score,
                        "product_type_1": infer_product_type(p1),
                        "product_type_2": infer_product_type(p2),
                        "shared_identifiers": sorted(
                            extract_identifiers(p1).intersection(extract_identifiers(p2))
                        ),
                        "reason": "Same/similar product type, shared technical identifier, and high name/spec similarity",
                    }
                )

    return sorted(
        duplicates,
        key=lambda item: item["similarity_score"],
        reverse=True,
    )


def duplicate_candidates_to_issues(
    duplicate_candidates: List[Dict[str, Any]],
) -> List[CatalogIssue]:
    issues = []

    for candidate in duplicate_candidates:
        issues.append(
            CatalogIssue(
                sku=candidate["sku_1"],
                issue_type="possible_duplicate",
                message=(
                    f"Possible duplicate with {candidate['sku_2']} "
                    f"({candidate['similarity_score']} similarity)"
                ),
                severity="medium",
            )
        )

    return issues
