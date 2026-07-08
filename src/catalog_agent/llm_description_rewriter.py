import os
import json
from typing import List
from copy import deepcopy

from dotenv import load_dotenv
from anthropic import Anthropic

from src.schemas import Product
from src.catalog_agent.description_rewriter import rewrite_description


load_dotenv()


def get_anthropic_client() -> Anthropic | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        return None

    return Anthropic(api_key=api_key)


def product_to_prompt_context(product: Product) -> str:
    return json.dumps(
        {
            "sku": product.sku,
            "name": product.name,
            "category": product.category,
            "brand": product.brand,
            "specs": product.specs,
            "current_description": product.description,
        },
        indent=2,
    )


def rewrite_description_with_claude(product: Product) -> str:
    """
    Rewrites a weak product description using Claude.

    Important safety rule:
    Claude must not invent specs. It can only use product name, category, brand, and specs.
    """

    client = get_anthropic_client()

    if client is None:
        return rewrite_description(product)

    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")

    prompt = f"""
You are rewriting B2B industrial product descriptions for an eCommerce catalog.

Rules:
1. Use only the product data provided.
2. Do not invent technical specifications.
3. Keep the description factual and concise.
4. Include important specs when available.
5. Write 1-2 professional sentences.
6. Do not mention missing data.
7. Do not use marketing fluff like "best", "premium", or "world-class".

Product data:
{product_to_prompt_context(product)}

Return only the rewritten description.
"""

    try:
        response = client.messages.create(
            model=model,
            max_tokens=220,
            temperature=0.2,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        )

        text = response.content[0].text.strip()

        if not text:
            return rewrite_description(product)

        return text

    except Exception:
        return rewrite_description(product)


def rewrite_weak_descriptions_with_llm(
    products: List[Product],
    weak_skus: set[str],
) -> List[Product]:
    updated_products = []

    for product in products:
        updated_product = deepcopy(product)

        if product.sku in weak_skus:
            updated_product.description = rewrite_description_with_claude(product)

        updated_products.append(updated_product)

    return updated_products