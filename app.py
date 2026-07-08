import json
import streamlit as st

from src.schemas import Product
from src.catalog_agent.uom import normalize_catalog_uom
from src.catalog_agent.spec_checker import check_missing_specs
from src.catalog_agent.description_quality import check_description_quality
from src.catalog_agent.description_rewriter import rewrite_weak_descriptions
from src.catalog_agent.dedup import find_duplicate_candidates
from src.catalog_agent.report import build_catalog_health_report
from src.search.retriever import search_catalog
from src.crosssell_agent.recommender import recommend_cross_sell


st.set_page_config(
    page_title="SearchForge",
    page_icon="🔎",
    layout="wide",
)


def load_json(path: str):
    with open(path, "r") as f:
        return json.load(f)


def load_products(path: str) -> list[Product]:
    raw_catalog = load_json(path)
    return [Product(**item) for item in raw_catalog]


@st.cache_data
def load_catalogs():
    messy_catalog = load_json("data/catalog_messy.json")
    clean_catalog = load_json("data/catalog_clean.json")
    return messy_catalog, clean_catalog


@st.cache_data
def run_catalog_pipeline():
    products = load_products("data/catalog_messy.json")

    messy_spec_issues = check_missing_specs(products)
    messy_description_issues = check_description_quality(products)

    normalized_products = normalize_catalog_uom(products)

    normalized_spec_issues = check_missing_specs(normalized_products)
    normalized_description_issues = check_description_quality(normalized_products)

    weak_skus = {issue.sku for issue in normalized_description_issues}

    rewritten_products = rewrite_weak_descriptions(
        products=normalized_products,
        weak_skus=weak_skus,
    )

    final_spec_issues = check_missing_specs(rewritten_products)
    final_description_issues = check_description_quality(rewritten_products)

    duplicate_candidates = find_duplicate_candidates(rewritten_products, threshold=88)

    report = build_catalog_health_report(
        products=products,
        messy_spec_issues=messy_spec_issues,
        normalized_spec_issues=final_spec_issues,
        description_issues=final_description_issues,
    )

    return {
        "products": products,
        "normalized_products": normalized_products,
        "rewritten_products": rewritten_products,
        "messy_spec_issues": messy_spec_issues,
        "messy_description_issues": messy_description_issues,
        "normalized_spec_issues": normalized_spec_issues,
        "normalized_description_issues": normalized_description_issues,
        "final_spec_issues": final_spec_issues,
        "final_description_issues": final_description_issues,
        "duplicate_candidates": duplicate_candidates,
        "report": report,
        "weak_skus": weak_skus,
    }


st.title("🔎 SearchForge")
st.caption("B2B Search Quality Platform — Catalog Intelligence + Cross-Sell Reasoning")

tab1, tab2, tab3 = st.tabs(
    [
        "Catalog Health",
        "Search Comparison",
        "Cart + Cross-Sell",
    ]
)


with tab1:
    st.header("Catalog Intelligence Agent")

    pipeline = run_catalog_pipeline()
    report = pipeline["report"]

    col1, col2, col3, col4 = st.columns(4)

    col1.metric("Total Products", report["total_products"])
    col2.metric(
        "Spec Issues",
        report["normalized_spec_issues"],
        delta=f"-{report['uom_issues_fixed']} after UOM fix",
    )
    col3.metric(
        "Weak Descriptions",
        len(pipeline["final_description_issues"]),
        delta=f"-{len(pipeline['normalized_description_issues'])}",
    )
    col4.metric("Possible Duplicates", len(pipeline["duplicate_candidates"]))

    st.subheader("Catalog Health Summary")

    st.write(
        {
            "Spec issues before UOM normalization": report["messy_spec_issues"],
            "Spec issues after UOM normalization": report["normalized_spec_issues"],
            "UOM-related issues fixed": report["uom_issues_fixed"],
            "Weak descriptions before rewrite": len(pipeline["normalized_description_issues"]),
            "Weak descriptions after rewrite": len(pipeline["final_description_issues"]),
            "Possible duplicate pairs": len(pipeline["duplicate_candidates"]),
            "Total current issues": report["total_current_issues"] + len(pipeline["duplicate_candidates"]),
        }
    )

    st.subheader("Sample Description Rewrites")

    shown = 0
    for original, rewritten in zip(
        pipeline["normalized_products"],
        pipeline["rewritten_products"],
    ):
        if original.sku in pipeline["weak_skus"]:
            with st.expander(f"{original.sku} — {original.name}"):
                st.markdown("**Before**")
                st.write(original.description)
                st.markdown("**After**")
                st.write(rewritten.description)

            shown += 1
            if shown >= 5:
                break

    st.subheader("Possible Duplicate Pairs")

    if pipeline["duplicate_candidates"]:
        duplicate_rows = [
            {
                "SKU 1": item["sku_1"],
                "Product 1": item["name_1"],
                "SKU 2": item["sku_2"],
                "Product 2": item["name_2"],
                "Score": item["similarity_score"],
            }
            for item in pipeline["duplicate_candidates"]
        ]
        st.dataframe(duplicate_rows, use_container_width=True)
    else:
        st.success("No duplicate candidates found.")


with tab2:
    st.header("Search Comparison")

    messy_catalog, clean_catalog = load_catalogs()

    query = st.text_input(
        "Search query",
        value="pillow block for 6205 bearing",
    )

    top_k = st.slider("Number of results", min_value=3, max_value=10, value=5)

    messy_results = search_catalog(messy_catalog, query, top_k=top_k)
    clean_results = search_catalog(clean_catalog, query, top_k=top_k)

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Messy Catalog Results")

        for result in messy_results:
            with st.container(border=True):
                st.markdown(f"**{result['name']}**")
                st.caption(f"SKU: {result['sku']} | Score: {result['score']}")
                st.write(result["description"])

    with col2:
        st.subheader("Clean Catalog Results")

        for result in clean_results:
            with st.container(border=True):
                st.markdown(f"**{result['name']}**")
                st.caption(f"SKU: {result['sku']} | Score: {result['score']}")
                st.write(result["description"])


with tab3:
    st.header("Cross-Sell Reasoning Agent")

    demo_skus = [
        "BRG-6205-2RS",
        "BRG-UC205",
        "MNT-MOTOR-BASE-56C",
        "VAL-BALL-1-2-BRASS",
        "FST-M8-40-ZN",
    ]

    selected_sku = st.selectbox(
        "Select cart item",
        options=demo_skus,
        index=0,
    )

    recommendations = recommend_cross_sell(selected_sku)

    st.subheader(f"Cart Item: {selected_sku}")

    if not recommendations:
        st.warning("No recommendations found.")
    else:
        for rec in recommendations:
            with st.container(border=True):
                st.markdown(f"### {rec['recommended_name']}")
                st.caption(
                    f"SKU: {rec['target_sku']} | "
                    f"Category: {rec['recommended_category']} | "
                    f"Confidence: {rec['confidence']}"
                )
                st.write(f"**Relationship:** {rec['relationship']}")
                st.write(f"**Reason:** {rec['reason']}")

                if rec["recommended_price"] is not None:
                    st.write(f"**Price:** ${rec['recommended_price']}")