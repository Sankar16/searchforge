from copy import deepcopy
from typing import List
from src.schemas import Product


def format_spec_key(key: str) -> str:
    return key.replace("_", " ")


def format_specs(specs: dict, max_specs: int = 5) -> str:
    important_specs = []

    skip_keys = {
        "search_terms",
        "compatible_materials",
        "included_items",
    }

    for key, value in specs.items():
        if key in skip_keys:
            continue

        if value in [None, "", []]:
            continue

        clean_key = format_spec_key(key)

        if isinstance(value, list):
            clean_value = ", ".join(str(item) for item in value)
        else:
            clean_value = str(value)

        important_specs.append(f"{clean_key}: {clean_value}")

        if len(important_specs) >= max_specs:
            break

    return "; ".join(important_specs)


def rewrite_description(product: Product) -> str:
    specs_text = format_specs(product.specs)

    if specs_text:
        return (
            f"{product.name} is a {product.category.lower()} product with "
            f"{specs_text}. Suitable for B2B industrial, maintenance, repair, "
            f"and equipment assembly applications."
        )

    return (
        f"{product.name} is a {product.category.lower()} product for B2B "
        f"industrial, maintenance, repair, and equipment assembly applications."
    )


def rewrite_weak_descriptions(
    products: List[Product],
    weak_skus: set[str],
) -> List[Product]:
    updated_products = []

    for product in products:
        updated_product = deepcopy(product)

        if product.sku in weak_skus:
            updated_product.description = rewrite_description(product)

        updated_products.append(updated_product)

    return updated_products