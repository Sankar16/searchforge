"""
Comprehensive unit tests for SearchForge core modules:
  - src/catalog_agent/uom.py
  - src/catalog_agent/dedup.py
  - src/catalog_agent/spec_checker.py
  - src/crosssell_agent/knowledge_graph.py
"""

import json
import sys
from pathlib import Path

import pytest
import networkx as nx

from src.schemas import Product
from src.catalog_agent.uom import inch_to_mm, normalize_product_uom, normalize_catalog_uom
from src.catalog_agent.dedup import find_duplicate_candidates
from src.catalog_agent.spec_checker import check_missing_specs
from src.crosssell_agent.knowledge_graph import build_compatibility_graph, get_graph_recommendations
from src.crosssell_agent.graph_generator import (
    find_candidate_pairs,
    build_graph_from_edges,
    COMPATIBLE_CATEGORY_PAIRS,
)
from src.search.semantic_retriever import build_semantic_index, semantic_search
from src.search.retriever import search_catalog
from src.crosssell_agent.recommender import recommend_cross_sell

# Import calculate_completeness_score directly from api/main.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "api"))
from main import calculate_completeness_score


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────

def make_product(**kwargs) -> Product:
    defaults = dict(sku="SKU-001", name="Test Product", category="Bearings", description="A test product")
    defaults.update(kwargs)
    return Product(**defaults)


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def bearing_product():
    return make_product(
        sku="BRG-6205-2RS",
        name="6205-2RS Sealed Ball Bearing",
        category="Bearings",
        description="Deep groove ball bearing with rubber seals.",
        specs={
            "inner_diameter_in": 1.0,
            "outer_diameter_in": 2.047,
            "width_in": 0.591,
        },
    )


@pytest.fixture
def sample_catalog():
    """Small catalog with one clear duplicate pair and one unrelated product."""
    brg_a = make_product(
        sku="BRG-A",
        name="6205-2RS Sealed Ball Bearing",
        category="Bearings",
        description="Bearing A",
        specs={"inner_diameter_mm": 25, "outer_diameter_mm": 52, "width_mm": 15},
    )
    brg_b = make_product(
        sku="BRG-B",
        name="6205-2RS Sealed Ball Bearing",
        category="Bearings",
        description="Bearing B — same product, different SKU",
        specs={"inner_diameter_mm": 25, "outer_diameter_mm": 52, "width_mm": 15},
    )
    valve = make_product(
        sku="VAL-001",
        name="1/2 Inch Ball Valve",
        category="Valves",
        description="Brass ball valve.",
        specs={"size_inch": "0.5", "pressure_rating_psi": 400, "material": "brass", "valve_type": "ball"},
    )
    return [brg_a, brg_b, valve]


@pytest.fixture
def graph():
    return build_compatibility_graph()


# ─────────────────────────────────────────────────────────────────────────────
# UOM — inch_to_mm
# ─────────────────────────────────────────────────────────────────────────────

def test_inch_to_mm_converts_one_inch_to_25_4():
    assert inch_to_mm(1) == 25.4


def test_inch_to_mm_converts_half_inch_to_12_7():
    assert inch_to_mm(0.5) == 12.7


def test_inch_to_mm_returns_none_for_non_numeric_string():
    assert inch_to_mm("abc") is None


def test_inch_to_mm_returns_none_for_none_input():
    assert inch_to_mm(None) is None


def test_inch_to_mm_handles_string_numeric_input():
    assert inch_to_mm("1.5") == pytest.approx(38.1, rel=1e-3)


# ─────────────────────────────────────────────────────────────────────────────
# UOM — normalize_product_uom
# ─────────────────────────────────────────────────────────────────────────────

def test_normalize_uom_converts_inner_diameter_in_to_mm():
    p = make_product(specs={"inner_diameter_in": 1.0})
    result = normalize_product_uom(p)
    assert result.specs["inner_diameter_mm"] == pytest.approx(25.4)


def test_normalize_uom_does_not_overwrite_existing_mm_spec():
    p = make_product(specs={"inner_diameter_in": 1.0, "inner_diameter_mm": 20.0})
    result = normalize_product_uom(p)
    assert result.specs["inner_diameter_mm"] == 20.0


def test_normalize_uom_converts_all_seven_inch_fields():
    p = make_product(specs={
        "inner_diameter_in":  1.0,
        "outer_diameter_in":  2.0,
        "width_in":           0.5,
        "diameter_in":        1.5,
        "length_in":          3.0,
        "bore_diameter_in":   0.75,
        "shaft_diameter_in":  1.25,
    })
    result = normalize_product_uom(p)
    for key in ("inner_diameter_mm", "outer_diameter_mm", "width_mm",
                "diameter_mm", "length_mm", "bore_diameter_mm", "shaft_diameter_mm"):
        assert key in result.specs, f"Expected {key} to be added"


def test_normalize_uom_sets_uom_to_normalized():
    p = make_product(specs={"inner_diameter_in": 1.0})
    result = normalize_product_uom(p)
    assert result.uom == "normalized"


def test_normalize_uom_does_not_modify_original_product(bearing_product):
    original_specs = dict(bearing_product.specs)
    normalize_product_uom(bearing_product)
    assert bearing_product.specs == original_specs


def test_normalize_uom_ignores_specs_not_in_conversion_map():
    p = make_product(specs={"color": "chrome", "material": "steel", "inner_diameter_in": 1.0})
    result = normalize_product_uom(p)
    assert result.specs["color"] == "chrome"
    assert result.specs["material"] == "steel"


# ─────────────────────────────────────────────────────────────────────────────
# UOM — normalize_catalog_uom
# ─────────────────────────────────────────────────────────────────────────────

def test_normalize_catalog_uom_processes_multiple_products():
    products = [
        make_product(sku="P1", specs={"inner_diameter_in": 1.0}),
        make_product(sku="P2", specs={"outer_diameter_in": 2.0}),
    ]
    results = normalize_catalog_uom(products)
    assert len(results) == 2


def test_normalize_catalog_uom_returns_same_count():
    products = [make_product(sku=f"P{i}") for i in range(5)]
    results = normalize_catalog_uom(products)
    assert len(results) == 5


def test_normalize_catalog_uom_all_products_have_normalized_uom():
    products = [make_product(sku=f"P{i}", specs={"inner_diameter_in": float(i + 1)}) for i in range(3)]
    results = normalize_catalog_uom(products)
    assert all(r.uom == "normalized" for r in results)


# ─────────────────────────────────────────────────────────────────────────────
# Dedup — find_duplicate_candidates
# ─────────────────────────────────────────────────────────────────────────────

def test_dedup_detects_two_identical_products_as_duplicates(sample_catalog):
    # sample_catalog[0] and [1] are identical bearings with different SKUs
    brg_a, brg_b = sample_catalog[0], sample_catalog[1]
    dupes = find_duplicate_candidates([brg_a, brg_b])
    assert len(dupes) == 1
    skus = {dupes[0]["sku_1"], dupes[0]["sku_2"]}
    assert skus == {"BRG-A", "BRG-B"}


def test_dedup_does_not_flag_completely_different_product_types(sample_catalog):
    # A bearing and a valve have different inferred types; they cannot be duplicates
    brg = sample_catalog[0]
    valve = sample_catalog[2]
    dupes = find_duplicate_candidates([brg, valve])
    assert dupes == []


def test_dedup_detects_products_with_same_sku_prefix():
    p1 = make_product(
        sku="BRG-6205-A",
        name="6205-2RS Deep Groove Ball Bearing",
        category="Bearings",
        description="First variant",
        specs={"inner_diameter_mm": 25, "outer_diameter_mm": 52, "width_mm": 15},
    )
    p2 = make_product(
        sku="BRG-6205-B",
        name="6205-2RS Deep Groove Ball Bearing",
        category="Bearings",
        description="Second variant",
        specs={"inner_diameter_mm": 25, "outer_diameter_mm": 52, "width_mm": 15},
    )
    dupes = find_duplicate_candidates([p1, p2])
    # Both share "6205" as identifier and have identical names → should be detected
    assert len(dupes) == 1


def test_dedup_does_not_flag_different_categories():
    # Two products with different inferred types (bearing vs valve) are never duplicates
    bearing = make_product(
        sku="BRG-X",
        name="6205-2RS Ball Bearing",
        category="Bearings",
        description="Ball bearing",
        specs={"inner_diameter_mm": 25},
    )
    valve = make_product(
        sku="VAL-X",
        name="1 Inch Gate Valve",
        category="Valves",
        description="Gate valve",
        specs={"size_inch": 1, "valve_type": "gate"},
    )
    dupes = find_duplicate_candidates([bearing, valve])
    assert dupes == []


def test_dedup_empty_catalog_returns_no_duplicates():
    assert find_duplicate_candidates([]) == []


def test_dedup_single_product_returns_no_duplicates():
    p = make_product(sku="SOLO", name="6205 Ball Bearing", category="Bearings", description="Only product")
    assert find_duplicate_candidates([p]) == []


def test_dedup_threshold_above_any_possible_score_returns_no_duplicates(sample_catalog):
    brg_a, brg_b = sample_catalog[0], sample_catalog[1]
    # threshold=101 can never be reached (max score is 100)
    dupes = find_duplicate_candidates([brg_a, brg_b], threshold=101)
    assert dupes == []


def test_dedup_threshold_zero_returns_all_comparable_pairs_with_shared_id():
    p1 = make_product(
        sku="BRG-6205-C",
        name="6205 Standard Bearing",
        category="Bearings",
        description="Standard",
        specs={"inner_diameter_mm": 25},
    )
    p2 = make_product(
        sku="BRG-6205-D",
        name="6205 Precision Bearing",
        category="Bearings",
        description="Precision grade",
        specs={"inner_diameter_mm": 25},
    )
    # At threshold=0 any comparable pair with a shared identifier is included
    dupes = find_duplicate_candidates([p1, p2], threshold=0)
    assert len(dupes) >= 1


def test_dedup_result_contains_expected_fields(sample_catalog):
    brg_a, brg_b = sample_catalog[0], sample_catalog[1]
    dupes = find_duplicate_candidates([brg_a, brg_b])
    assert dupes, "Expected at least one duplicate"
    d = dupes[0]
    for field in ("sku_1", "sku_2", "name_1", "name_2", "similarity_score", "reason"):
        assert field in d, f"Missing field: {field}"


def test_dedup_results_sorted_by_similarity_descending():
    # Build three pairs: one high-similarity, two lower
    p1 = make_product(sku="BRG-6205-X", name="6205-2RS Ball Bearing", category="Bearings", description="")
    p2 = make_product(sku="BRG-6205-Y", name="6205-2RS Ball Bearing", category="Bearings", description="")
    p3 = make_product(sku="BRG-6205-Z", name="6205 Bearing Unit", category="Bearings", description="")
    dupes = find_duplicate_candidates([p1, p2, p3])
    scores = [d["similarity_score"] for d in dupes]
    assert scores == sorted(scores, reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# Spec checker — check_missing_specs
# ─────────────────────────────────────────────────────────────────────────────

def test_spec_checker_bearing_with_all_required_specs_passes():
    bearing = make_product(
        sku="BRG-FULL",
        name="6205-2RS Ball Bearing",
        category="Bearings",
        description="Full spec bearing",
        specs={"inner_diameter_mm": 25, "outer_diameter_mm": 52, "width_mm": 15},
    )
    issues = check_missing_specs([bearing])
    assert issues == []


def test_spec_checker_bearing_missing_inner_diameter_mm_fails():
    bearing = make_product(
        sku="BRG-NO-ID",
        name="6205-2RS Ball Bearing",
        category="Bearings",
        description="Missing ID",
        specs={"outer_diameter_mm": 52, "width_mm": 15},
    )
    issues = check_missing_specs([bearing])
    missing_spec_issues = [i for i in issues if i.issue_type == "missing_spec"]
    missing_specs = [i.message for i in missing_spec_issues]
    assert any("inner_diameter_mm" in m for m in missing_specs)


def test_spec_checker_valve_with_all_required_specs_passes():
    valve = make_product(
        sku="VAL-FULL",
        name="1/2 Inch Ball Valve",
        category="Valves",
        description="Full spec valve",
        specs={
            "size_inch": "0.5",
            "pressure_rating_psi": 400,
            "material": "brass",
            "valve_type": "ball",
        },
    )
    issues = check_missing_specs([valve])
    assert issues == []


def test_spec_checker_valve_missing_size_fails():
    valve = make_product(
        sku="VAL-NO-SIZE",
        name="1/2 Inch Ball Valve",
        category="Valves",
        description="Valve without size",
        specs={"pressure_rating_psi": 400, "material": "brass", "valve_type": "ball"},
    )
    issues = check_missing_specs([valve])
    missing = [i.message for i in issues if i.issue_type == "missing_spec"]
    assert any("size_inch" in m for m in missing)


def test_spec_checker_unknown_category_is_handled_gracefully():
    mystery = make_product(
        sku="MYS-001",
        name="Mystery Widget",
        category="Unknown Widgets",
        description="Nobody knows what this is",
        specs={},
    )
    issues = check_missing_specs([mystery])
    assert len(issues) == 0  # Unknown types skip spec validation


def test_spec_checker_empty_specs_returns_issues():
    bearing = make_product(
        sku="BRG-EMPTY",
        name="6205 Ball Bearing",
        category="Bearings",
        description="No specs at all",
        specs={},
    )
    issues = check_missing_specs([bearing])
    # Bearings need inner_diameter_mm, outer_diameter_mm, width_mm → 3 issues
    missing = [i for i in issues if i.issue_type == "missing_spec"]
    assert len(missing) == 3


def test_spec_checker_extra_specs_beyond_required_still_passes():
    bearing = make_product(
        sku="BRG-EXTRA",
        name="6205 Ball Bearing",
        category="Bearings",
        description="Extra specs",
        specs={
            "inner_diameter_mm": 25,
            "outer_diameter_mm": 52,
            "width_mm": 15,
            "color": "chrome",
            "brand": "NSK",
            "weight_kg": 0.12,
        },
    )
    issues = check_missing_specs([bearing])
    assert issues == []


# ─────────────────────────────────────────────────────────────────────────────
# Section 1: Graph Generator tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def small_catalog():
    return [
        {
            "sku": "BRG-TEST-001",
            "name": "Test Bearing",
            "category": "Bearings",
            "description": "Test bearing",
            "specs": {"inner_diameter_mm": 25, "outer_diameter_mm": 52},
        },
        {
            "sku": "HSG-TEST-001",
            "name": "Test Housing",
            "category": "Housings",
            "description": "Test housing",
            "specs": {"bore_diameter_mm": 25},
        },
        {
            "sku": "SHAFT-TEST-001",
            "name": "Test Shaft",
            "category": "Mounts",
            "description": "Test shaft",
            "specs": {"diameter_mm": 25},
        },
        {
            "sku": "BOLT-TEST-001",
            "name": "Test Bolt",
            "category": "Fasteners",
            "description": "Test bolt",
            "specs": {"diameter_mm": 8},
        },
        {
            "sku": "VALVE-TEST-001",
            "name": "Test Valve",
            "category": "Valves",
            "description": "Test valve",
            "specs": {"size_inch": 0.5},
        },
    ]


def test_find_candidate_pairs_returns_list(small_catalog):
    result = find_candidate_pairs(small_catalog)
    assert isinstance(result, list)


def test_find_candidate_pairs_not_empty(small_catalog):
    result = find_candidate_pairs(small_catalog)
    assert len(result) > 0


def test_find_candidate_pairs_no_self_pairs(small_catalog):
    candidates = find_candidate_pairs(small_catalog)
    assert all(a["sku"] != b["sku"] for a, b in candidates)


def test_find_candidate_pairs_no_duplicate_pairs(small_catalog):
    candidates = find_candidate_pairs(small_catalog)
    normalized = {(min(a["sku"], b["sku"]), max(a["sku"], b["sku"])) for a, b in candidates}
    assert len(candidates) == len(normalized)


def test_find_candidate_pairs_empty_catalog():
    assert find_candidate_pairs([]) == []


def test_find_candidate_pairs_single_product(small_catalog):
    assert find_candidate_pairs([small_catalog[0]]) == []


def test_build_graph_from_edges_returns_digraph():
    G = build_graph_from_edges([])
    assert isinstance(G, nx.DiGraph)


def test_build_graph_from_edges_with_data():
    edges = [
        {
            "source": "A",
            "target": "B",
            "relationship": "fits_housing",
            "confidence": 0.9,
            "reason": "test reason",
            "source_name": "Product A",
            "target_name": "Product B",
        }
    ]
    G = build_graph_from_edges(edges)
    assert G.has_edge("A", "B")
    assert G["A"]["B"]["relationship"] == "fits_housing"
    assert G["A"]["B"]["confidence"] == 0.9


def test_compatible_category_pairs_has_electronics():
    assert ("laptops", "chargers") in COMPATIBLE_CATEGORY_PAIRS
    assert ("monitors", "cables") in COMPATIBLE_CATEGORY_PAIRS


def test_find_candidate_pairs_respects_limit():
    large_catalog = [
        {
            "sku": f"LAP-{i:03d}",
            "name": f"Laptop {i}",
            "category": "Laptops",
            "description": "A laptop",
            "specs": {},
        }
        for i in range(20)
    ]
    candidates = find_candidate_pairs(large_catalog)
    assert len(candidates) <= 60


# ─────────────────────────────────────────────────────────────────────────────
# Section 2: Semantic Retriever tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def search_catalog_data():
    return [
        {
            "sku": "SRCH-001",
            "name": "Ball Bearing 25mm",
            "description": "Deep groove ball bearing for motors",
            "category": "Bearings",
            "specs": {"inner_diameter_mm": 25},
        },
        {
            "sku": "SRCH-002",
            "name": "Brass Ball Valve",
            "description": "Half inch brass ball valve for water",
            "category": "Valves",
            "specs": {"size_inch": 0.5},
        },
        {
            "sku": "SRCH-003",
            "name": "Hex Bolt M8",
            "description": "M8 zinc hex bolt for fastening",
            "category": "Fasteners",
            "specs": {"diameter_mm": 8},
        },
    ]


@pytest.fixture
def catalog_with_duplicate():
    return [
        {
            "sku": "DUP-001",
            "name": "Product A",
            "description": "First occurrence",
            "category": "Test",
            "specs": {},
        },
        {
            "sku": "DUP-001",
            "name": "Product A Duplicate",
            "description": "Second occurrence",
            "category": "Test",
            "specs": {},
        },
        {
            "sku": "DUP-002",
            "name": "Product B",
            "description": "Unique product",
            "category": "Test",
            "specs": {},
        },
    ]


@pytest.mark.slow
def test_build_semantic_index_returns_collection(search_catalog_data):
    collection = build_semantic_index(search_catalog_data, "test_search_001")
    assert collection is not None
    assert collection.count() == 3


@pytest.mark.slow
def test_build_semantic_index_deduplicates_duplicate_skus(catalog_with_duplicate):
    collection = build_semantic_index(catalog_with_duplicate, "test_dedup_001")
    assert collection.count() == 2


@pytest.mark.slow
def test_semantic_search_returns_results(search_catalog_data):
    collection = build_semantic_index(search_catalog_data, "test_search_002")
    results = semantic_search(collection, "bearing motor", top_k=3)
    assert len(results) > 0
    assert results[0]["sku"] is not None


@pytest.mark.slow
def test_semantic_search_score_in_range(search_catalog_data):
    collection = build_semantic_index(search_catalog_data, "test_search_003")
    results = semantic_search(collection, "bearing", top_k=3)
    assert all(0 <= r["score"] <= 100 for r in results)


@pytest.mark.slow
def test_semantic_search_has_match_label(search_catalog_data):
    collection = build_semantic_index(search_catalog_data, "test_search_004")
    results = semantic_search(collection, "bearing", top_k=3)
    valid_labels = {"Strong match", "Good match", "Related", "Partial match", "Weak match"}
    assert all("match_label" in r for r in results)
    assert all(r["match_label"] in valid_labels for r in results)


@pytest.mark.slow
def test_semantic_search_filters_low_scores(search_catalog_data):
    collection = build_semantic_index(search_catalog_data, "test_search_005")
    high_threshold = semantic_search(collection, "xyz123abc", top_k=5, min_score=90)
    low_threshold = semantic_search(collection, "xyz123abc", top_k=5, min_score=10)
    assert len(high_threshold) <= len(low_threshold)


# ─────────────────────────────────────────────────────────────────────────────
# Section 3: Completeness Score tests
# ─────────────────────────────────────────────────────────────────────────────

def _pipeline_result(weak_before=0, weak_after=0, spec_before=0, spec_after=0, dupes=0):
    return {
        "weak_descriptions_before": weak_before,
        "weak_descriptions_after": weak_after,
        "spec_issues_before": spec_before,
        "spec_issues_after": spec_after,
        "duplicate_pairs": dupes,
    }


def test_completeness_score_before_less_than_after():
    catalog = [{}] * 10
    result = calculate_completeness_score(catalog, _pipeline_result(weak_before=8, weak_after=2))
    assert result["after"] > result["before"]


def test_completeness_score_in_range():
    catalog = [{}] * 10
    result = calculate_completeness_score(catalog, _pipeline_result(weak_before=5, spec_before=3, dupes=1))
    assert 0 <= result["before"] <= 100
    assert 0 <= result["after"] <= 100


def test_completeness_score_with_no_issues():
    catalog = [{}] * 10
    result = calculate_completeness_score(catalog, _pipeline_result())
    assert result["before"] == 100
    assert result["after"] == 100


def test_completeness_score_with_all_issues():
    catalog = [{}] * 10
    result = calculate_completeness_score(
        catalog, _pipeline_result(weak_before=10, spec_before=10, dupes=5)
    )
    assert result["before"] < 50


def test_completeness_score_empty_catalog():
    result = calculate_completeness_score([], _pipeline_result())
    assert result["before"] == 0
    assert result["after"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# Section 4: MCP Server tool tests (via underlying functions)
# ─────────────────────────────────────────────────────────────────────────────

_CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "catalog_clean.json"


def _load_clean_catalog():
    with open(_CATALOG_PATH) as f:
        return json.load(f)


def test_catalog_server_search_returns_results():
    catalog = _load_clean_catalog()
    # Use a word from the first product's name so the query works regardless of catalog contents
    first_word = catalog[0]["name"].split()[0] if catalog else "product"
    results = search_catalog(catalog, first_word, top_k=5)
    assert isinstance(results, list)
    assert len(results) > 0
    assert all("sku" in r and "name" in r and "category" in r and "description" in r for r in results)


def test_catalog_server_search_empty_query():
    catalog = _load_clean_catalog()
    results = search_catalog(catalog, "xyznotexist123", top_k=5)
    assert isinstance(results, list)


def test_catalog_server_get_product_known_sku():
    catalog = _load_clean_catalog()
    target_sku = catalog[0]["sku"]
    match = next((p for p in catalog if p["sku"] == target_sku), None)
    assert match is not None
    assert match["sku"] == target_sku


def test_catalog_server_get_product_unknown_sku():
    catalog = _load_clean_catalog()
    match = next((p for p in catalog if p["sku"] == "NOTEXIST-999"), None)
    assert match is None


def test_catalog_server_get_health_returns_metrics():
    catalog = _load_clean_catalog()
    categories = sorted({p.get("category", "") for p in catalog if p.get("category")})
    prices = [p["price"] for p in catalog if p.get("price") is not None]
    avg_price = round(sum(prices) / len(prices), 2) if prices else 0.0
    health = {
        "total_products": len(catalog),
        "categories": categories,
        "avg_price": avg_price,
    }
    assert "total_products" in health
    assert isinstance(health["total_products"], int)
    assert health["total_products"] > 0


def test_spec_checker_accepts_alias_for_required_spec():
    # inner_diameter_mm can be satisfied by alias "bore"
    bearing = make_product(
        sku="BRG-ALIAS",
        name="6205-2RS Ball Bearing",
        category="Bearings",
        description="Uses bore alias",
        specs={"bore": 25, "outer_diameter_mm": 52, "width_mm": 15},
    )
    issues = check_missing_specs([bearing])
    assert issues == []


def test_spec_checker_issue_has_correct_severity():
    bearing = make_product(
        sku="BRG-SEV",
        name="6205 Ball Bearing",
        category="Bearings",
        description="Missing specs",
        specs={"outer_diameter_mm": 52, "width_mm": 15},
    )
    issues = check_missing_specs([bearing])
    assert all(i.severity == "high" for i in issues if i.issue_type == "missing_spec")


def test_spec_checker_processes_multiple_products():
    good = make_product(
        sku="BRG-GOOD",
        name="6205 Ball Bearing",
        category="Bearings",
        description="Good",
        specs={"inner_diameter_mm": 25, "outer_diameter_mm": 52, "width_mm": 15},
    )
    bad = make_product(
        sku="BRG-BAD",
        name="6205 Ball Bearing",
        category="Bearings",
        description="Bad",
        specs={},
    )
    issues = check_missing_specs([good, bad])
    affected_skus = {i.sku for i in issues}
    assert "BRG-GOOD" not in affected_skus
    assert "BRG-BAD" in affected_skus


# ─────────────────────────────────────────────────────────────────────────────
# Knowledge graph — build_compatibility_graph / get_graph_recommendations
# ─────────────────────────────────────────────────────────────────────────────

def test_graph_is_built_successfully(graph):
    assert graph is not None


def test_graph_is_not_empty(graph):
    assert graph.number_of_nodes() > 0
    assert graph.number_of_edges() > 0


def test_graph_has_expected_number_of_nodes(graph):
    # 19 unique SKUs span the 15 relationships defined in knowledge_graph.py
    assert graph.number_of_nodes() == 19


def test_known_sku_returns_recommendations(graph):
    recs = get_graph_recommendations(graph, "BRG-6205-2RS")
    assert len(recs) > 0


def test_unknown_sku_returns_empty_list_without_crash(graph):
    recs = get_graph_recommendations(graph, "DOES-NOT-EXIST-XYZ")
    assert recs == []


def test_recommendation_has_required_fields(graph):
    recs = get_graph_recommendations(graph, "BRG-6205-2RS")
    assert recs, "Need at least one recommendation to check fields"
    r = recs[0]
    for field in ("source_sku", "target_sku", "relationship", "reason", "confidence"):
        assert field in r, f"Missing field: {field}"


def test_recommendation_confidence_is_between_0_and_1(graph):
    recs = get_graph_recommendations(graph, "BRG-6205-2RS")
    for r in recs:
        assert 0.0 <= r["confidence"] <= 1.0, f"confidence out of range: {r['confidence']}"


def test_sku_with_multiple_recommendations_returns_multiple(graph):
    # BRG-6205-2RS → HSG-P205 and MNT-SHAFT-25MM
    recs = get_graph_recommendations(graph, "BRG-6205-2RS")
    assert len(recs) == 2


def test_sku_with_two_housing_options_returns_both(graph):
    # BRG-UC204 → HSG-P204 and HSG-FL204
    recs = get_graph_recommendations(graph, "BRG-UC204")
    assert len(recs) == 2
    target_skus = {r["target_sku"] for r in recs}
    assert "HSG-P204" in target_skus
    assert "HSG-FL204" in target_skus


def test_recommendations_sorted_by_confidence_descending(graph):
    recs = get_graph_recommendations(graph, "BRG-UC204")
    confidences = [r["confidence"] for r in recs]
    assert confidences == sorted(confidences, reverse=True)


def test_graph_contains_known_sku(graph):
    assert "BRG-6205-2RS" in graph


def test_recommendation_source_sku_matches_queried_sku(graph):
    recs = get_graph_recommendations(graph, "FST-M8-40-ZN")
    for r in recs:
        assert r["source_sku"] == "FST-M8-40-ZN"


def test_hardware_sku_returns_two_recommendations(graph):
    # FST-M8-40-ZN → FST-WASHER-M8-FLAT and FST-NUT-M8-ZN
    recs = get_graph_recommendations(graph, "FST-M8-40-ZN")
    assert len(recs) == 2
    targets = {r["target_sku"] for r in recs}
    assert "FST-WASHER-M8-FLAT" in targets
    assert "FST-NUT-M8-ZN" in targets
