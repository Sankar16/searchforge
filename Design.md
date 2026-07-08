# SearchForge — Design Document

Status snapshot as of 2026-07-08. This document reflects the **actual current implementation**, verified against source, not aspirational roadmap language (see [README.md](README.md), which is partly stale — its "planned"/"next milestone" LangGraph section was written before LangGraph was actually added).

## 1. Purpose

SearchForge is a B2B eCommerce search quality platform. It cleans messy industrial product catalogs (missing specs, inconsistent units, weak descriptions, duplicate SKUs), compares search relevance before/after cleaning, and generates spec-aware cross-sell recommendations with human-readable reasoning.

## 2. System Architecture

Three layers, each backed by a `src/` package:

```
data/                          JSON catalogs (messy + clean), sole persistence layer
├── catalog_messy.json
├── catalog_clean.json
└── catalog_issue_map.json

src/
├── schemas.py                 Product, CatalogIssue (Pydantic models, shared everywhere)
├── catalog_agent/             Layer 1: Catalog Intelligence
│   ├── spec_checker.py        product-type inference + required-spec rules
│   ├── uom.py                 inch → mm normalization
│   ├── description_quality.py rule-based description scoring
│   ├── description_rewriter.py template-based description rewriting (NOT an LLM)
│   ├── dedup.py                fuzzy duplicate detection (rapidfuzz)
│   ├── report.py                health report aggregation
│   ├── state.py                 CatalogAgentState (LangGraph TypedDict)
│   └── graph.py                 LangGraph workflow (linear, 9 nodes)
├── search/                     Layer 2: Search Quality
│   ├── retriever.py             weighted in-memory keyword search
│   └── indexer.py               EMPTY FILE — no indexing logic exists
├── crosssell_agent/             Layer 3: Cross-Sell Reasoning
│   ├── knowledge_graph.py       hardcoded compatibility graph (networkx.DiGraph)
│   └── recommender.py           joins graph recs with catalog data
└── evaluation/                  EMPTY DIRECTORY — scaffold only, not in git, no files

app.py                         Streamlit UI (3 tabs), invokes the LangGraph pipeline
run_catalog_check.py           CLI: pipeline as direct function calls (pre-LangGraph path)
run_catalog_graph.py           CLI: pipeline via the compiled LangGraph graph
run_search_comparison.py       CLI: messy vs. clean search comparison
run_dedup_check.py             CLI: standalone duplicate detection
run_crosssell_demo.py          CLI: cross-sell recommendations for demo cart SKUs
tests/                         EMPTY — no test files exist
```

## 3. Data Models (`src/schemas.py`)

```python
class Product(BaseModel):
    sku: str
    name: str
    category: str
    description: str
    brand: Optional[str]
    specs: Dict[str, Any] = {}
    uom: Optional[str]
    price: Optional[float]
    search_terms: List[str] = []

class CatalogIssue(BaseModel):
    sku: str
    issue_type: str
    message: str
    severity: str
```

These two models are the only schemas in the system — there is no embedding/vector schema and no evaluation-result schema, matching the fact that neither vector search nor an evaluation harness is implemented yet.

## 4. Catalog Intelligence Agent

### 4.1 Product type inference & spec checking (`spec_checker.py`)
- `infer_product_type(product)` — a rule-based keyword classifier (if/elif chain over `name`/`category`) covering ~27 product types (bearings, pillow blocks, valves, pipe fittings, fasteners, etc.), falling back to `"unknown"`. This function is the taxonomy backbone used by both spec-checking and dedup.
- `PRODUCT_TYPE_REQUIRED_SPECS` — required spec fields per product type; `SPEC_ALIASES` — accepted alternate key names (e.g. `bore`/`id` for `inner_diameter_mm`).
- `check_missing_specs(products)` — flags `unknown_product_type` (medium) and `missing_spec` (high) issues.

### 4.2 UOM normalization (`uom.py`)
`normalize_product_uom` converts `*_in` spec keys to `*_mm` (`INCH_TO_MM = 25.4`), retaining the original inch fields and tagging `product.uom = "normalized"`.

### 4.3 Description quality & rewriting
- `description_quality.py` — `score_description` (0–5 rule-based score: penalizes short text, weak marketing phrases, absence of spec values or product name in the text). `check_description_quality` flags `weak_description` when score ≤ 2.
- `description_rewriter.py` — **template-based, not LLM-based**: `rewrite_description` builds `"{name} is a {category} product with {specs_text}. Suitable for B2B industrial, maintenance, repair, and equipment assembly applications."` No model inference or API calls exist anywhere in this codebase.

### 4.4 Duplicate detection (`dedup.py`)
`find_duplicate_candidates(products, threshold=88)` does an O(n²) pairwise comparison using `rapidfuzz.fuzz.token_set_ratio`, scored as `0.7 × name_similarity + 0.3 × spec_similarity`, gated by shared technical identifiers (regex-extracted: bearing codes, `M8`-style callouts, fractions) and product-type compatibility. Tuned during development from 173 → 9 → 6 candidate pairs on the demo catalog. Returns plain dicts, not `CatalogIssue` — `duplicate_candidates_to_issues` exists to convert them but is currently unused by the pipeline.

### 4.5 Health report (`report.py`)
`build_catalog_health_report` aggregates total products, spec issues before/after normalization, description issues, and a `Counter`-based issue-type/severity breakdown. Note: duplicate candidates are **not** included in this dict — callers (`app.py`, `run_catalog_check.py`) merge them in separately for display.

### 4.6 LangGraph workflow (`state.py` + `graph.py`)

`CatalogAgentState` (TypedDict) carries `input_path`/`output_path`, `raw_products`, `normalized_products`, `rewritten_products`, the four issue lists (messy/normalized specs, messy/normalized/final descriptions), `weak_skus`, `duplicate_candidates`, and `health_report`.

`build_catalog_intelligence_graph()` wires 9 nodes with `StateGraph`:

```
START
 → load_catalog
 → check_specs_before
 → normalize_uom
 → check_specs_after
 → check_descriptions
 → rewrite_descriptions
 → detect_duplicates
 → generate_report
 → save_clean_catalog
 → END
```

**This is fully implemented**, added in commit `274cd1e` (after README's "planned" language was written in `e544d83`). All edges are unconditional `add_edge` calls — there is **no conditional branching** yet (no `add_conditional_edges`), despite the README describing a vision of conditional skip-if-clean / LLM-fallback-if-unknown-type logic. That remains future work, not current behavior.

The pre-LangGraph pipeline (`run_catalog_check.py`, direct function calls in sequence) still exists in parallel with the graph-based one (`run_catalog_graph.py`) and produces equivalent output.

## 5. Search Quality Layer

- `retriever.py` — `search_catalog(catalog, query, top_k=5)`: weighted substring/keyword scoring over raw catalog dicts, no persistent index. Field weights: `name` (5), `search_terms` (4), `category` (3), `description` (2), `specs` (1). Recomputed from scratch on every call — O(products × query tokens), fine at demo scale (74 products), not indexed.
- `indexer.py` — **empty file**. No inverted index, no persistence, no embeddings. Named/scaffolded but never implemented.
- There is no vector search, no embeddings, and no ChromaDB integration anywhere in the codebase or `requirements.txt` — these remain future work as the README states.

## 6. Cross-Sell Reasoning Agent

- `knowledge_graph.py` — `build_compatibility_graph()` builds a `networkx.DiGraph` from a **hardcoded list of ~15 relationship records** (bearing↔housing fits, shaft compatibility, motor-mount hardware, valve↔sealant pairing), each edge carrying `relationship`, `reason` (human-readable string), and `confidence`. This is a static, manually curated graph — not learned or dynamically inferred.
- `recommender.py` — `recommend_cross_sell(cart_sku)` rebuilds the graph and joins outgoing edges with live catalog data (name/category/description/specs/price) from `data/catalog_clean.json`. Graph is rebuilt from scratch on every call; no caching.

## 7. Streamlit UI (`app.py`)

Single-file app, `st.tabs(["Catalog Health", "Search Comparison", "Cart + Cross-Sell"])`.

- **Tab 1 — Catalog Health**: `run_catalog_pipeline()` (cached via `@st.cache_data`) imports and invokes the **real compiled LangGraph graph** (`graph.invoke(initial_state)`) — this is the "Connect Streamlit UI to LangGraph workflow" change (commits `274cd1e`/`ec40940`/`775b153`). Renders 4 metrics (total products, spec issues, weak descriptions, duplicates), before/after rewrite samples, and the duplicate-pairs table. The "workflow steps" checklist shown in the UI is a **hardcoded static list mirroring the 9 node names** — it always renders all steps as complete; it is not driven by actual per-node execution status (no use of `graph.stream()` for progress).
- **Tab 2 — Search Comparison**: reads `data/catalog_messy.json` and `data/catalog_clean.json` directly from disk (independent of any in-memory pipeline state) and runs `search_catalog` against both for side-by-side comparison.
- **Tab 3 — Cart + Cross-Sell**: a hardcoded 5-SKU demo cart `st.selectbox`, calls `recommend_cross_sell`.

**Coupling note**: Tab 1's pipeline run overwrites `data/catalog_clean.json` via `save_clean_catalog_node`, and Tabs 2/3 read that same file from disk. The three tabs share state only through this file, not through any in-memory/session object — running Tab 1 changes what Tabs 2/3 see on their next read.

## 8. Tech Stack

Python, Pydantic, RapidFuzz, NetworkX, Streamlit, LangGraph (`langgraph==1.2.8` + checkpoint/prebuilt/sdk packages), JSON-based catalog storage. No LLM API, no vector database — confirmed by a repo-wide search (no `openai`, `anthropic`, `chromadb`, `sentence-transformers`, or similar in `requirements.txt` or source).

**Known issue**: `requirements.txt` currently has a line-concatenation bug — `pandas` and `rapidfuzz` are merged onto one line as `pandasrapidfuzz` (missing newline), which breaks `pip install -r requirements.txt` as written. Needs a one-line fix.

## 9. Testing

`tests/` exists but is completely empty — no test files, no framework config. There is currently zero automated test coverage across the project.

## 10. Gaps vs. README's Roadmap Claims

| README states | Actual status |
|---|---|
| LangGraph orchestration — "planned"/"next milestone" | **Done.** Linear 9-node graph, no conditional edges yet. |
| LLM-based product type fallback | Not implemented — `infer_product_type` is pure rule-based with an `"unknown"` fallback and no model call. |
| LLM-based natural description rewriting | Not implemented — `rewrite_description` is pure string templating. |
| Vector search / embeddings / ChromaDB | Not implemented — `retriever.py` is keyword/substring search only; `indexer.py` is empty. |
| Evaluation metrics for search improvement | `src/evaluation/` is an empty, untracked scaffold directory — no code. |
| (not mentioned) Automated tests | None exist. |

## 11. Near-Term Design Priorities

Given the above, the highest-leverage next steps (not yet scheduled, listed by dependency order) are:
1. Fix the `requirements.txt` install bug.
2. Add conditional edges to `graph.py` (skip rewrite if no weak descriptions; branch to review report when duplicates are found) — the state/graph scaffolding already supports this.
3. Implement `src/search/indexer.py` or fold its intended responsibility into `retriever.py` explicitly, so the "indexer" module isn't a dead stub.
4. Stand up minimal tests for the deterministic rule-based modules (`spec_checker`, `uom`, `description_quality`, `dedup`) before adding LLM/embedding-based components, since those are the easiest to regression-test.
5. Decide whether cross-sell/search state should move from file-based coupling to shared in-memory session state in `app.py`, especially once the pipeline gets slower (e.g., after adding LLM calls).
