from src.crosssell_agent.recommender import recommend_cross_sell


def print_recommendations(cart_sku: str) -> None:
    recommendations = recommend_cross_sell(cart_sku)

    print("\n" + "=" * 90)
    print(f"CART ITEM: {cart_sku}")
    print("=" * 90)

    if not recommendations:
        print("No cross-sell recommendations found.")
        return

    for rank, rec in enumerate(recommendations, start=1):
        print(f"\nRecommendation {rank}")
        print("----------------")
        print(f"SKU: {rec['target_sku']}")
        print(f"Name: {rec['recommended_name']}")
        print(f"Category: {rec['recommended_category']}")
        print(f"Relationship: {rec['relationship']}")
        print(f"Confidence: {rec['confidence']}")
        print(f"Reason: {rec['reason']}")
        print(f"Price: {rec['recommended_price']}")


def main() -> None:
    demo_cart_items = [
        "BRG-6205-2RS",
        "BRG-UC205",
        "MNT-MOTOR-BASE-56C",
        "VAL-BALL-1-2-BRASS",
        "FST-M8-40-ZN",
    ]

    print("\nSEARCHFORGE CROSS-SELL REASONING DEMO")
    print("-------------------------------------")

    for sku in demo_cart_items:
        print_recommendations(sku)


if __name__ == "__main__":
    main()