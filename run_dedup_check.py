import json
from src.schemas import Product
from src.catalog_agent.dedup import find_duplicate_candidates


def load_products(path: str) -> list[Product]:
    with open(path, "r") as f:
        raw_catalog = json.load(f)

    return [Product(**item) for item in raw_catalog]


def main() -> None:
    products = load_products("data/catalog_clean.json")

    duplicates = find_duplicate_candidates(products, threshold=88)

    print("\nDUPLICATE DETECTION REPORT")
    print("--------------------------")
    print(f"Products checked: {len(products)}")
    print(f"Possible duplicate pairs found: {len(duplicates)}")

    print("\nTop duplicate candidates:")
    for item in duplicates[:30]:
        print(
            f"{item['similarity_score']} | "
            f"{item['sku_1']} ({item['name_1']}) "
            f"<-> {item['sku_2']} ({item['name_2']})"
        )
        print(f"    Types: {item['product_type_1']} ↔ {item['product_type_2']}")
        print(f"    Shared identifiers: {item['shared_identifiers']}")
        print(f"    Reason: {item['reason']}")


if __name__ == "__main__":
    main()