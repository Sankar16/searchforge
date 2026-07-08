import os
import json
import asyncio
from typing import List
from copy import deepcopy

from dotenv import load_dotenv
from anthropic import Anthropic, AsyncAnthropic

from src.schemas import Product
from src.catalog_agent.description_rewriter import rewrite_description


load_dotenv()


def get_anthropic_client() -> Anthropic | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        return None

    return Anthropic(api_key=api_key)


def get_async_anthropic_client() -> AsyncAnthropic | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        return None

    return AsyncAnthropic(api_key=api_key)


def get_llm_concurrency() -> int:
    try:
        return int(os.getenv("LLM_CONCURRENCY", "5"))
    except ValueError:
        return 5


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


def build_rewrite_prompt(product: Product) -> str:
    return f"""
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


def rewrite_description_with_claude(product: Product) -> str:
    """
    Sync version. Useful for simple scripts or fallback use.
    """

    client = get_anthropic_client()

    if client is None:
        return rewrite_description(product)

    model = os.getenv("ANTHROPIC_REWRITE_MODEL", "claude-sonnet-4-5")

    try:
        response = client.messages.create(
            model=model,
            max_tokens=220,
            temperature=0.2,
            messages=[
                {
                    "role": "user",
                    "content": build_rewrite_prompt(product),
                }
            ],
        )

        text = response.content[0].text.strip()

        if not text:
            return rewrite_description(product)

        return text

    except Exception:
        return rewrite_description(product)


async def rewrite_description_with_claude_async(
    product: Product,
    client: AsyncAnthropic | None,
    semaphore: asyncio.Semaphore,
) -> str:
    """
    Async bounded rewrite call.
    If Claude fails for one product, only that product falls back to the rule-based rewriter.
    """

    if client is None:
        return rewrite_description(product)

    model = os.getenv("ANTHROPIC_REWRITE_MODEL", "claude-sonnet-4-5")

    async with semaphore:
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=220,
                temperature=0.2,
                messages=[
                    {
                        "role": "user",
                        "content": build_rewrite_prompt(product),
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
    """
    Sync wrapper kept for compatibility.
    """

    updated_products = []

    for product in products:
        updated_product = deepcopy(product)

        if product.sku in weak_skus:
            updated_product.description = rewrite_description_with_claude(product)

        updated_products.append(updated_product)

    return updated_products


async def rewrite_weak_descriptions_with_llm_async(
    products: List[Product],
    weak_skus: set[str],
) -> List[Product]:
    """
    Async parallel version with bounded concurrency.
    Preserves original product order.
    """

    client = get_async_anthropic_client()
    semaphore = asyncio.Semaphore(get_llm_concurrency())

    tasks = []

    for product in products:
        if product.sku in weak_skus:
            tasks.append(
                rewrite_description_with_claude_async(
                    product=product,
                    client=client,
                    semaphore=semaphore,
                )
            )
        else:
            tasks.append(asyncio.sleep(0, result=product.description))

    rewritten_descriptions = await asyncio.gather(*tasks)

    updated_products = []

    for product, rewritten_description in zip(products, rewritten_descriptions):
        updated_product = deepcopy(product)
        updated_product.description = rewritten_description
        updated_products.append(updated_product)

    return updated_products