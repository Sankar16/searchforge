import os
import json
import re
import asyncio
from typing import Dict, Any, List

from dotenv import load_dotenv
from anthropic import Anthropic, AsyncAnthropic

from src.schemas import Product


load_dotenv()


def get_anthropic_client() -> Anthropic | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        return None

    return Anthropic(api_key=api_key)


def get_llm_concurrency() -> int:
    try:
        return int(os.getenv("LLM_CONCURRENCY", "5"))
    except ValueError:
        return 5


def extract_json_from_text(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)

    if not match:
        raise ValueError(f"No JSON object found in LLM response: {cleaned}")

    return json.loads(match.group(0))


def heuristic_description_eval(
    product: Product,
    rewritten_description: str,
) -> Dict[str, Any]:
    score = 7
    notes = []

    description_lower = rewritten_description.lower()
    has_spec_value = False

    for value in product.specs.values():
        if value in [None, "", []]:
            continue

        if isinstance(value, list):
            for item in value:
                if str(item).lower() in description_lower:
                    has_spec_value = True
                    break
        else:
            if str(value).lower() in description_lower:
                has_spec_value = True

        if has_spec_value:
            break

    if has_spec_value:
        score += 1
    else:
        score -= 1
        notes.append("Description may not include specific product specs.")

    if len(rewritten_description.split()) < 8:
        score -= 2
        notes.append("Description may be too short.")

    if any(word in description_lower for word in ["best", "premium", "world-class"]):
        score -= 1
        notes.append("Description may contain marketing fluff.")

    return {
        "score": max(1, min(score, 10)),
        "hallucination_risk": "unknown",
        "passes": score >= 7,
        "notes": notes or ["Heuristic fallback evaluation used."],
    }


def normalize_eval_result(result: Dict[str, Any]) -> Dict[str, Any]:
    score = result.get("score", 1)

    try:
        score = int(score)
    except (TypeError, ValueError):
        score = 1

    hallucination_risk = result.get("hallucination_risk", "medium")

    if hallucination_risk not in ["low", "medium", "high", "unknown"]:
        hallucination_risk = "medium"

    passes = result.get("passes", False)

    if isinstance(passes, str):
        passes = passes.lower() == "true"

    notes = result.get("notes", [])

    if isinstance(notes, str):
        notes = [notes]

    if not isinstance(notes, list):
        notes = ["Judge returned notes in an unexpected format."]

    return {
        "score": max(1, min(score, 10)),
        "hallucination_risk": hallucination_risk,
        "passes": bool(passes),
        "notes": notes,
    }


def build_evaluation_prompt(
    product: Product,
    original_description: str,
    rewritten_description: str,
) -> str:
    return f"""
You are evaluating a rewritten B2B industrial product description.

Your task:
Check whether the rewritten description is accurate, useful for search, and grounded only in the product data.

Important:
- Penalize invented specs, invented materials, invented applications, or invented brands.
- If the rewritten description adds details not present in product data, mark hallucination_risk as medium or high.
- This is a rubric-based quality score, not statistical confidence.
- Return JSON only.
- Do not include markdown.
- Do not include explanation outside JSON.

Product data:
{json.dumps(product.model_dump(), indent=2)}

Original weak description:
{original_description}

Rewritten description:
{rewritten_description}

Return exactly this JSON shape:
{{
  "score": 8,
  "hallucination_risk": "low",
  "passes": true,
  "notes": ["Short reason here"]
}}
"""


def evaluate_rewritten_description(
    product: Product,
    original_description: str,
    rewritten_description: str,
) -> Dict[str, Any]:
    client = get_anthropic_client()

    if client is None:
        return heuristic_description_eval(product, rewritten_description)

    model = os.getenv("ANTHROPIC_JUDGE_MODEL", "claude-haiku-4-5")

    try:
        response = client.messages.create(
            model=model,
            max_tokens=300,
            temperature=0,
            messages=[
                {
                    "role": "user",
                    "content": build_evaluation_prompt(
                        product=product,
                        original_description=original_description,
                        rewritten_description=rewritten_description,
                    ),
                }
            ],
        )

        raw_text = response.content[0].text.strip()
        parsed = extract_json_from_text(raw_text)

        return normalize_eval_result(parsed)

    except Exception as error:
        fallback = heuristic_description_eval(product, rewritten_description)
        fallback["notes"].append(f"LLM judge fallback used because of error: {error}")
        return fallback


async def evaluate_rewritten_description_async(
    product: Product,
    original_description: str,
    rewritten_description: str,
    client: AsyncAnthropic | None,
    semaphore: asyncio.Semaphore,
) -> Dict[str, Any]:
    """
    Async single-product LLM judge call.
    Falls back to heuristic evaluation if client is unavailable or judge call fails.
    """

    if client is None:
        return heuristic_description_eval(product, rewritten_description)

    model = os.getenv("ANTHROPIC_JUDGE_MODEL", "claude-haiku-4-5")

    async with semaphore:
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=300,
                temperature=0,
                messages=[
                    {
                        "role": "user",
                        "content": build_evaluation_prompt(
                            product=product,
                            original_description=original_description,
                            rewritten_description=rewritten_description,
                        ),
                    }
                ],
            )

            raw_text = response.content[0].text.strip()
            parsed = extract_json_from_text(raw_text)

            return normalize_eval_result(parsed)

        except Exception as error:
            fallback = heuristic_description_eval(product, rewritten_description)
            fallback["notes"].append(
                f"Async LLM judge fallback used because of error: {error}"
            )
            return fallback


async def evaluate_rewritten_descriptions_async(
    original_products: List[Product],
    rewritten_products: List[Product],
    weak_skus: set[str],
) -> List[Dict[str, Any]]:
    """
    Evaluates only products that were rewritten.
    Runs judge calls concurrently with bounded concurrency.
    """

    api_key = os.getenv("ANTHROPIC_API_KEY")
    semaphore = asyncio.Semaphore(get_llm_concurrency())

    weak_products = [
        (original, rewritten)
        for original, rewritten in zip(original_products, rewritten_products)
        if original.sku in weak_skus
    ]

    if not weak_products:
        return []

    if not api_key:
        client = None

        tasks = [
            evaluate_rewritten_description_async(
                product=original,
                original_description=original.description,
                rewritten_description=rewritten.description,
                client=client,
                semaphore=semaphore,
            )
            for original, rewritten in weak_products
        ]

        raw_evaluations = await asyncio.gather(*tasks)

    else:
        async with AsyncAnthropic(api_key=api_key) as client:
            tasks = [
                evaluate_rewritten_description_async(
                    product=original,
                    original_description=original.description,
                    rewritten_description=rewritten.description,
                    client=client,
                    semaphore=semaphore,
                )
                for original, rewritten in weak_products
            ]

            raw_evaluations = await asyncio.gather(*tasks)

    enriched_evaluations = []

    for (original, rewritten), evaluation in zip(weak_products, raw_evaluations):
        enriched_evaluations.append(
            {
                "sku": original.sku,
                "name": original.name,
                "original_description": original.description,
                "rewritten_description": rewritten.description,
                "judge_score": evaluation["score"],
                "hallucination_risk": evaluation["hallucination_risk"],
                "passes_quality_gate": evaluation["passes"],
                "notes": evaluation["notes"],
            }
        )

    return enriched_evaluations