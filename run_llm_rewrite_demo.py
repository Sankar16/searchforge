import json

from src.schemas import Product
from src.catalog_agent.description_quality import check_description_quality
from src.catalog_agent.uom import normalize_catalog_uom
from src.catalog_agent.llm_description_rewriter import rewrite_weak_descriptions_with_llm
from src.catalog_agent.llm_evaluator import evaluate_rewritten_description


def load_products(path: str) -> list[Product]:
    with open(path, "r") as f:
        raw_catalog = json.load(f)

    return [Product(**item) for item in raw_catalog]


def main() -> None:
    products = load_products("data/catalog_messy.json")
    normalized_products = normalize_catalog_uom(products)

    weak_issues = check_description_quality(normalized_products)
    weak_skus = {issue.sku for issue in weak_issues}

    rewritten_products = rewrite_weak_descriptions_with_llm(
        products=normalized_products,
        weak_skus=weak_skus,
    )

    print("\nLLM DESCRIPTION REWRITE + JUDGE DEMO")
    print("------------------------------------")
    print(f"Weak descriptions found: {len(weak_skus)}")

    shown = 0

    for original, rewritten in zip(normalized_products, rewritten_products):
        if original.sku not in weak_skus:
            continue

        evaluation = evaluate_rewritten_description(
            product=original,
            original_description=original.description,
            rewritten_description=rewritten.description,
        )

        print("\n" + "=" * 90)
        print(f"SKU: {original.sku}")
        print(f"Name: {original.name}")
        print(f"Original: {original.description}")
        print(f"Rewritten: {rewritten.description}")
        print(f"Judge score: {evaluation.get('score')}/10")
        print(f"Hallucination risk: {evaluation.get('hallucination_risk')}")
        print(f"Passes: {evaluation.get('passes')}")
        print(f"Notes: {evaluation.get('notes')}")

        shown += 1
        if shown >= 5:
            break


if __name__ == "__main__":
    main()