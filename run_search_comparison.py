import json
from typing import List, Dict, Any
from src.search.retriever import search_catalog


def load_catalog(path: str) -> List[Dict[str, Any]]:
    with open(path, "r") as f:
        return json.load(f)


def print_results(title: str, results: List[Dict[str, Any]]) -> None:
    print(f"\n{title}")
    print("-" * len(title))

    if not results:
        print("No results found.")
        return

    for rank, result in enumerate(results, start=1):
        print(
            f"{rank}. score={result['score']} | "
            f"{result['sku']} | {result['name']} | {result['category']}"
        )
        print(f"   {result['description']}")


def compare_search_results(
    messy_catalog: List[Dict[str, Any]],
    clean_catalog: List[Dict[str, Any]],
    query: str,
    top_k: int = 5,
) -> None:
    print("\n" + "=" * 90)
    print(f"QUERY: {query}")
    print("=" * 90)

    messy_results = search_catalog(messy_catalog, query, top_k=top_k)
    clean_results = search_catalog(clean_catalog, query, top_k=top_k)

    print_results("MESSY CATALOG RESULTS", messy_results)
    print_results("CLEAN CATALOG RESULTS", clean_results)


def main() -> None:
    messy_catalog = load_catalog("data/catalog_messy.json")
    clean_catalog = load_catalog("data/catalog_clean.json")

    queries = [
        "25mm sealed bearing",
        "bolt for motor mount",
        "half inch brass valve",
        "pillow block for 6205 bearing",
        "thread sealant for pipe fitting",
    ]

    print("\nSEARCHFORGE SEARCH COMPARISON")
    print("-----------------------------")
    print(f"Messy catalog products: {len(messy_catalog)}")
    print(f"Clean catalog products: {len(clean_catalog)}")

    for query in queries:
        compare_search_results(
            messy_catalog=messy_catalog,
            clean_catalog=clean_catalog,
            query=query,
            top_k=5,
        )


if __name__ == "__main__":
    main()