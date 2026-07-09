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

    api_key = os.getenv("ANTHROPIC_API_KEY")
    semaphore = asyncio.Semaphore(get_llm_concurrency())

    if not api_key:
        client = None

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

    else:
        async with AsyncAnthropic(api_key=api_key) as client:
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

async def repair_failed_rewrites_with_llm_async(
    original_products: List[Product],
    rewritten_products: List[Product],
    failed_evaluations: List[dict],
) -> List[Product]:
    """
    Repairs only descriptions that failed or were flagged by the LLM judge.
    Products that passed remain unchanged.
    """

    api_key = os.getenv("ANTHROPIC_API_KEY")
    semaphore = asyncio.Semaphore(get_llm_concurrency())

    failed_skus = {item["sku"] for item in failed_evaluations}

    failed_notes_by_sku = {
        item["sku"]: item.get("notes", [])
        for item in failed_evaluations
    }

    async def repair_one_product(
        original_product: Product,
        current_rewritten_product: Product,
    ) -> str:
        if original_product.sku not in failed_skus:
            return current_rewritten_product.description

        if client is None:
            return rewrite_description(original_product)

        model = os.getenv("ANTHROPIC_REWRITE_MODEL", "claude-sonnet-4-5")
        judge_notes = failed_notes_by_sku.get(original_product.sku, [])

        repair_prompt = f"""
You are repairing a rewritten B2B industrial product description that was flagged by an LLM judge.

The previous rewrite may have included unsupported claims or weak grounding.

Rules:
1. Use only explicitly provided product data.
2. Do not infer applications, suitability, materials, brands, or performance claims unless directly present in the product data.
3. Do not invent missing specs.
4. Keep the description factual and concise.
5. Write 1-2 sentences.
6. Return only the repaired description.

Product data:
{product_to_prompt_context(original_product)}

Current rewritten description:
{current_rewritten_product.description}

Judge notes:
{json.dumps(judge_notes, indent=2)}

Return only the repaired description.
"""

        async with semaphore:
            try:
                response = await client.messages.create(
                    model=model,
                    max_tokens=220,
                    temperature=0.1,
                    messages=[
                        {
                            "role": "user",
                            "content": repair_prompt,
                        }
                    ],
                )

                text = response.content[0].text.strip()

                if not text:
                    return rewrite_description(original_product)

                return text

            except Exception:
                return rewrite_description(original_product)

    if not api_key:
        client = None

        tasks = [
            repair_one_product(original, rewritten)
            for original, rewritten in zip(original_products, rewritten_products)
        ]

        repaired_descriptions = await asyncio.gather(*tasks)

    else:
        async with AsyncAnthropic(api_key=api_key) as client:
            tasks = [
                repair_one_product(original, rewritten)
                for original, rewritten in zip(original_products, rewritten_products)
            ]

            repaired_descriptions = await asyncio.gather(*tasks)

    repaired_products = []

    for product, repaired_description in zip(rewritten_products, repaired_descriptions):
        updated_product = deepcopy(product)
        updated_product.description = repaired_description
        repaired_products.append(updated_product)

    return repaired_products