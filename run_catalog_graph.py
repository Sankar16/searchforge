from src.catalog_agent.graph import build_catalog_intelligence_graph


def main() -> None:
    graph = build_catalog_intelligence_graph()

    initial_state = {
        "input_path": "data/catalog_messy.json",
        "output_path": "data/catalog_clean.json",
        "raw_products": [],
        "normalized_products": [],
        "rewritten_products": [],
        "messy_spec_issues": [],
        "normalized_spec_issues": [],
        "messy_description_issues": [],
        "normalized_description_issues": [],
        "final_description_issues": [],
        "weak_skus": set(),
        "duplicate_candidates": [],
        "health_report": {},
    }

    final_state = graph.invoke(initial_state)

    report = final_state["health_report"]
    duplicate_candidates = final_state["duplicate_candidates"]

    print("\nLANGGRAPH CATALOG INTELLIGENCE REPORT")
    print("-------------------------------------")
    print(f"Total products: {report['total_products']}")
    print(f"Spec issues before UOM normalization: {report['messy_spec_issues']}")
    print(f"Spec issues after UOM normalization: {report['normalized_spec_issues']}")
    print(f"UOM-related issues fixed: {report['uom_issues_fixed']}")
    print(f"Weak descriptions before rewrite: {len(final_state['normalized_description_issues'])}")
    print(f"Weak descriptions after rewrite: {len(final_state['final_description_issues'])}")
    print(f"Possible duplicate pairs: {len(duplicate_candidates)}")
    print(
        "Total current issues: "
        f"{report['total_current_issues'] + len(duplicate_candidates)}"
    )

    print("\nDUPLICATE CANDIDATES")
    print("--------------------")

    for item in duplicate_candidates[:10]:
        print(
            f"{item['similarity_score']} | "
            f"{item['sku_1']} ({item['name_1']}) "
            f"<-> {item['sku_2']} ({item['name_2']})"
        )

    print("\nSaved cleaned catalog to data/catalog_clean.json")


if __name__ == "__main__":
    main()