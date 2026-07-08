from copy import deepcopy
from typing import List, Any
from src.schemas import Product


INCH_TO_MM = 25.4


def inch_to_mm(value: Any) -> float | None:
    try:
        return round(float(value) * INCH_TO_MM, 2)
    except (TypeError, ValueError):
        return None


def normalize_product_uom(product: Product) -> Product:
    """
    Converts common inch-based specs into mm-based specs.
    Keeps original specs also, but adds normalized mm fields.
    """

    normalized = deepcopy(product)
    specs = normalized.specs

    conversions = {
        "inner_diameter_in": "inner_diameter_mm",
        "outer_diameter_in": "outer_diameter_mm",
        "width_in": "width_mm",
        "diameter_in": "diameter_mm",
        "length_in": "length_mm",
        "bore_diameter_in": "bore_diameter_mm",
        "shaft_diameter_in": "shaft_diameter_mm",
    }

    for inch_key, mm_key in conversions.items():
        if inch_key in specs and mm_key not in specs:
            converted = inch_to_mm(specs[inch_key])
            if converted is not None:
                specs[mm_key] = converted

    normalized.uom = "normalized"

    return normalized


def normalize_catalog_uom(products: List[Product]) -> List[Product]:
    return [normalize_product_uom(product) for product in products]