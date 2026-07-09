"""
SearchForge Cross-Sell Agent demo (MCP-powered).

Usage:
    python run_mcp_crosssell_demo.py [SKU]

Default SKU: BRG-6205-2RS
"""

import asyncio
import sys

from src.crosssell_agent.llm_agent import get_cross_sell_with_explanation


def _fmt_specs(specs: dict) -> str:
    if not specs:
        return "no specs"
    return ", ".join(f"{k.replace('_', ' ')}: {v}" for k, v in list(specs.items())[:6])


async def main(sku: str) -> None:
    print("\n=== SearchForge Cross-Sell Agent (MCP-powered) ===\n")
    print(f"Fetching recommendations for: {sku} ...\n")

    result = await get_cross_sell_with_explanation(sku)

    cart = result["cart_product"]
    if not cart:
        print(f"Product not found: {sku}")
        return

    print(f"Cart Item: {cart['name']} ({sku})")
    print(f"Specs: {_fmt_specs(cart.get('specs', {}))}")

    recs = result["recommendations"]
    if not recs:
        print("\nNo cross-sell recommendations found for this SKU.")
        return

    print(f"\nRecommendations:\n")
    for i, rec in enumerate(recs, 1):
        print(f"{i}. {rec['name']} ({rec['sku']})")
        print(f"   Relationship: {rec['relationship']}")
        print(f"   Confidence:   {rec['confidence']}")
        if rec.get("price") is not None:
            print(f"   Price:        ${rec['price']}")
        print(f"   Graph reason: {rec['original_reason']}")
        print(f"   LLM explanation: {rec['llm_explanation']}")
        print()


if __name__ == "__main__":
    sku = sys.argv[1] if len(sys.argv) > 1 else "BRG-6205-2RS"
    asyncio.run(main(sku))
