import os
import json
import asyncio
from typing import Dict, Any, List, Literal

from dotenv import load_dotenv
from anthropic import Anthropic
from pydantic import BaseModel, Field
from pydantic_ai import Agent

from src.schemas import Product


load_dotenv()


class JudgeResult(BaseModel):
    accuracy: int = Field(ge=0, le=10)
    searchability: int = Field(ge=0, le=10)
    specificity: int = Field(ge=0, le=10)
    clarity: int = Field(ge=0, le=10)
    hallucination_risk: Literal["low", "medium", "high"]
    notes: list[str]
    specs_verified: list[str]

    @property
    def composite_score(self) -> float:
        return round((self.accuracy + self.searchability + self.specificity + self.clarity) / 4, 1)

    @property
    def passes_quality_gate(self) -> bool:
        return self.composite_score >= 6.5 and self.hallucination_risk != "high"

    @property
    def judge_score(self) -> float:
        return self.composite_score


_judge_model = f"anthropic:{os.getenv('ANTHROPIC_JUDGE_MODEL', 'claude-sonnet-4-6')}"

judge_agent = Agent(
    _judge_model,
    output_type=JudgeResult,
    system_prompt=(
        "You evaluate rewritten B2B product descriptions across four dimensions. Score each 0-10.\n\n"
        "ACCURACY (score this dimension carefully):\n"
        "HALLUCINATION (score 1-2): Invents specific technical specs, dimensions, brand names, "
        "certifications, or claims that directly contradict or significantly extend beyond source data. "
        "Examples: source has no voltage but description says '120V rated'; source has no pressure "
        "rating but description says '600 PSI'; source has no material but description says "
        "'stainless steel grade 316'.\n"
        "REASONABLE INFERENCE (score 4-5): Uses domain knowledge to infer obvious product "
        "characteristics that a knowledgeable product manager would know from the product name alone. "
        "Examples: 't-shirt' → 'short-sleeve design' (every t-shirt has short sleeves); "
        "'ball bearing' → 'rotational support' (definitional); "
        "'polo shirt' → 'collared design' (definitional); "
        "'bluetooth mouse' → 'wireless connectivity' (definitional); "
        "'hiking boot' → 'outdoor use' (obvious from category).\n"
        "The test: Could a knowledgeable product manager infer this from the product name and "
        "category alone, without any additional data? Yes → score 4-5 (reasonable inference, "
        "low hallucination risk). No → score 1-3 (requires verification, hallucination risk).\n"
        "Generic use-case claims ('for business use', 'professional environments') that are "
        "appropriate for the category but unverified score 3-4.\n\n"
        "hallucination_risk: "
        "'high' if accuracy_score <= 2 (actual hallucination of specs/numbers); "
        "'medium' if accuracy_score == 3 (unverifiable specific claims); "
        "'low' if accuracy_score >= 4 (reasonable inference or verified from source data).\n\n"
        "- searchability: Does the description include keywords buyers would use to search? "
        "Look for product type terms, material names, application terms, spec values.\n"
        "- specificity: Is the description specific about this product vs. generic filler "
        "phrases that could apply to any product?\n"
        "- clarity: Is the description clear, natural prose that is easy to read and not a spec dump?\n\n"
        "specs_verified: list only spec keys that appear in both the product data and the rewritten description."
    ),
)


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

    base = max(1, min(score, 10))
    return {
        "accuracy": base,
        "searchability": base,
        "specificity": base,
        "clarity": base,
        "hallucination_risk": "low",
        "passes": score >= 7,
        "notes": notes or ["Heuristic fallback evaluation used."],
        "specs_verified": [],
    }


def normalize_eval_result(result: Dict[str, Any]) -> Dict[str, Any]:
    def _clamp(val, default=5):
        try:
            return max(1, min(int(val), 10))
        except (TypeError, ValueError):
            return default

    accuracy = _clamp(result.get("accuracy", result.get("score", 5)))
    searchability = _clamp(result.get("searchability", accuracy))
    specificity = _clamp(result.get("specificity", accuracy))
    clarity = _clamp(result.get("clarity", accuracy))

    hallucination_risk = result.get("hallucination_risk", "medium")
    if hallucination_risk not in ["low", "medium", "high", "unknown"]:
        hallucination_risk = "medium"

    notes = result.get("notes", [])
    if isinstance(notes, str):
        notes = [notes]
    if not isinstance(notes, list):
        notes = ["Judge returned notes in an unexpected format."]

    composite = round((accuracy + searchability + specificity + clarity) / 4, 1)
    passes = composite >= 6.5 and hallucination_risk != "high"

    return {
        "accuracy": accuracy,
        "searchability": searchability,
        "specificity": specificity,
        "clarity": clarity,
        "hallucination_risk": hallucination_risk,
        "passes": bool(passes),
        "notes": notes,
        "specs_verified": result.get("specs_verified", []),
    }


def build_evaluation_prompt(
    product: Product,
    original_description: str,
    rewritten_description: str,
) -> str:
    return (
        f"Product data:\n{json.dumps(product.model_dump(), indent=2)}\n\n"
        f"Original weak description:\n{original_description}\n\n"
        f"Rewritten description:\n{rewritten_description}"
    )


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
            messages=[{
                "role": "user",
                "content": build_evaluation_prompt(
                    product=product,
                    original_description=original_description,
                    rewritten_description=rewritten_description,
                ),
            }],
        )
        raw_text = response.content[0].text.strip()
        import json as _json, re as _re
        cleaned = raw_text.replace("```json", "").replace("```", "").strip()
        try:
            parsed = _json.loads(cleaned)
        except Exception:
            m = _re.search(r"\{.*\}", cleaned, _re.DOTALL)
            parsed = _json.loads(m.group(0)) if m else {}
        return normalize_eval_result(parsed)
    except Exception as error:
        fallback = heuristic_description_eval(product, rewritten_description)
        fallback["notes"].append(f"LLM judge fallback used because of error: {error}")
        return fallback


async def evaluate_rewritten_description_async(
    product: Product,
    original_description: str,
    rewritten_description: str,
    semaphore: asyncio.Semaphore,
) -> Dict[str, Any]:
    """Async single-product LLM judge call using pydantic-ai agent with built-in retry."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        return heuristic_description_eval(product, rewritten_description)

    async with semaphore:
        try:
            result = await judge_agent.run(
                build_evaluation_prompt(
                    product=product,
                    original_description=original_description,
                    rewritten_description=rewritten_description,
                )
            )
            j = result.output
            return {
                "accuracy": j.accuracy,
                "searchability": j.searchability,
                "specificity": j.specificity,
                "clarity": j.clarity,
                "composite_score": j.composite_score,
                "hallucination_risk": j.hallucination_risk,
                "passes": j.passes_quality_gate,
                "notes": j.notes,
                "specs_verified": j.specs_verified,
            }
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
    """Evaluates only products that were rewritten. Runs judge calls concurrently with bounded concurrency."""
    semaphore = asyncio.Semaphore(get_llm_concurrency())

    weak_products = [
        (original, rewritten)
        for original, rewritten in zip(original_products, rewritten_products)
        if original.sku in weak_skus
    ]

    if not weak_products:
        return []

    tasks = [
        evaluate_rewritten_description_async(
            product=original,
            original_description=original.description,
            rewritten_description=rewritten.description,
            semaphore=semaphore,
        )
        for original, rewritten in weak_products
    ]

    raw_evaluations = await asyncio.gather(*tasks)

    enriched_evaluations = []

    for (original, rewritten), evaluation in zip(weak_products, raw_evaluations):
        composite = evaluation.get("composite_score") or round(
            (evaluation.get("accuracy", 5) + evaluation.get("searchability", 5) +
             evaluation.get("specificity", 5) + evaluation.get("clarity", 5)) / 4, 1
        )
        enriched_evaluations.append(
            {
                "sku": original.sku,
                "name": original.name,
                "original_description": original.description,
                "rewritten_description": rewritten.description,
                "accuracy": evaluation.get("accuracy", 5),
                "searchability": evaluation.get("searchability", 5),
                "specificity": evaluation.get("specificity", 5),
                "clarity": evaluation.get("clarity", 5),
                "judge_score": composite,
                "hallucination_risk": evaluation["hallucination_risk"],
                "passes_quality_gate": evaluation["passes"],
                "notes": evaluation["notes"],
            }
        )

    return enriched_evaluations