import os
import json
import re
from typing import Dict, Any

from dotenv import load_dotenv
from anthropic import Anthropic

from src.schemas import Product


load_dotenv()


def get_anthropic_client() -> Anthropic | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        return None

    return Anthropic(api_key=api_key)


def extract_json_from_text(text: str) -> Dict[str, Any]:
    """
    Claude may return JSON inside markdown or with a short preface.
    This extracts the first JSON object from the response.
    """

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
    """
    Fallback evaluator when no LLM key is available or parsing fails.
    """

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
    """
    Ensures the judge result always has the expected fields.
    """

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


def evaluate_rewritten_description(
    product: Product,
    original_description: str,
    rewritten_description: str,
) -> Dict[str, Any]:
    """
    Uses Claude as a judge to evaluate whether the rewritten description is accurate.
    """

    client = get_anthropic_client()

    if client is None:
        return heuristic_description_eval(product, rewritten_description)

    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")

    prompt = f"""
You are evaluating a rewritten B2B industrial product description.

Your task:
Check whether the rewritten description is accurate, useful for search, and grounded only in the product data.

Important:
- Penalize invented specs, invented materials, invented applications, or invented brands.
- If the rewritten description adds details not present in product data, mark hallucination_risk as medium or high.
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

    try:
        response = client.messages.create(
            model=model,
            max_tokens=300,
            temperature=0,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
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