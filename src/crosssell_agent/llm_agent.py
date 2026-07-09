"""
LLM-powered cross-sell agent.

Uses the MCP catalog client to fetch product + compatibility data,
then calls Claude to generate a natural explanation for each recommendation.
"""

import asyncio
import os

from dotenv import load_dotenv
from pydantic import BaseModel
from pydantic_ai import Agent

load_dotenv()

from src.mcp_server.catalog_client import CatalogMCPClient


class CrossSellExplanation(BaseModel):
    explanation: str
    specs_referenced: list[str]


explanation_agent = Agent(
    "anthropic:claude-haiku-4-5-20251001",
    output_type=CrossSellExplanation,
    system_prompt=(
        "You explain why two B2B industrial products go together for a procurement buyer. "
        "Be specific and technical. Do NOT invent specs or measurements not present in the provided data. "
        "Plain text only — no markdown formatting or headings. Keep it to 1-2 sentences."
    ),
)


def _spec_summary(specs: dict) -> str:
    if not specs:
        return "no spec data available"
    parts = []
    for k, v in list(specs.items())[:6]:
        key_label = k.replace("_", " ")
        parts.append(f"{key_label}: {v}")
    return ", ".join(parts)


async def _explain_one(
    cart_name: str,
    cart_specs: str,
    rec_name: str,
    relationship: str,
    original_reason: str,
) -> str:
    prompt = (
        f"Cart product: {cart_name}\n"
        f"Cart product specs: {cart_specs}\n\n"
        f"Recommended product: {rec_name}\n"
        f"Relationship type: {relationship}\n"
        f"Existing graph note: {original_reason}"
    )
    result = await explanation_agent.run(prompt)
    return result.data.explanation.strip()


async def get_cross_sell_with_explanation(cart_sku: str) -> dict:
    """
    Returns cross-sell recommendations enriched with Claude-generated explanations.
    """
    async with CatalogMCPClient() as mcp:
        cart_product = await mcp.get_product(cart_sku)
        recs = await mcp.get_compatibility(cart_sku)

    if not cart_product:
        return {"cart_sku": cart_sku, "cart_product": None, "recommendations": []}

    if not recs:
        return {
            "cart_sku": cart_sku,
            "cart_product": cart_product,
            "recommendations": [],
        }

    cart_name = cart_product.get("name", cart_sku)
    cart_specs = _spec_summary(cart_product.get("specs", {}))

    async def enrich(rec: dict) -> dict:
        try:
            explanation = await _explain_one(
                cart_name=cart_name,
                cart_specs=cart_specs,
                rec_name=rec.get("name") or rec["sku"],
                relationship=rec.get("relationship", ""),
                original_reason=rec.get("reason", ""),
            )
        except Exception:
            explanation = rec.get("reason", "")

        return {
            "sku": rec["sku"],
            "name": rec.get("name"),
            "relationship": rec.get("relationship"),
            "confidence": rec.get("confidence"),
            "llm_explanation": explanation,
            "original_reason": rec.get("reason"),
            "price": rec.get("price"),
        }

    enriched = await asyncio.gather(*[enrich(r) for r in recs])

    return {
        "cart_sku": cart_sku,
        "cart_product": cart_product,
        "recommendations": list(enriched),
    }
