# SearchForge — Design Document

Status snapshot as of 2026-07-08. This document reflects the **actual current implementation**, verified against source and recent CLI runs, not aspirational roadmap language. README.md is a public onboarding document; this file is the technical implementation/design document.

## 1. Purpose

SearchForge is a B2B eCommerce search quality platform. It cleans messy industrial product catalogs (missing specs, inconsistent units, weak descriptions, duplicate SKUs), compares search relevance before/after cleaning, and generates spec-aware cross-sell recommendations with human-readable reasoning.

The current implementation now includes a real LLM path for description rewriting and evaluation: weak product descriptions are rewritten using Claude with bounded async concurrency, and rewritten descriptions are evaluated by a separate LLM-as-judge quality gate.

## 2. System Architecture

Three layers, each backed by a `src/` package:

```text
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
│   ├── description_rewriter.py deterministic fallback/template description rewriting
│   ├── llm_description_rewriter.py Claude-based async description rewriting
│   ├── llm_evaluator.py       Claude-based LLM-as-judge description evaluation
│   ├── dedup.py               fuzzy duplicate detection (rapidfuzz)
│   ├── report.py              health report aggregation
│   ├── state.py               CatalogAgentState (LangGraph TypedDict)
│   └── graph.py               LangGraph workflow (conditional, 13 nodes, repair loop)
├── search/                    Layer 2: Search Quality
│   ├── retriever.py            weighted in-memory keyword search
│   └── indexer.py              scaffold/empty or not meaningfully implemented yet
├── crosssell_agent/            Layer 3: Cross-Sell Reasoning
│   ├── knowledge_graph.py      hardcoded compatibility graph (networkx.DiGraph)
│   └── recommender.py          joins graph recs with catalog data
└── evaluation/                 scaffold only if present; no full evaluation harness yet

app.py                         Streamlit UI (3 tabs), invokes the LangGraph pipeline
run_catalog_check.py           CLI: pipeline as direct function calls (pre-LangGraph path)
run_catalog_graph.py           CLI: pipeline via the compiled LangGraph graph
run_search_comparison.py       CLI: messy vs. clean search comparison
run_dedup_check.py             CLI: standalone duplicate detection
run_crosssell_demo.py          CLI: cross-sell recommendations for demo cart SKUs
run_llm_rewrite_demo.py        CLI: standalone LLM rewrite + judge demo
tests/                         empty or not meaningfully implemented yet
```

## 3. Data Models (`src/schemas.py`)

```python
class Product(BaseModel):
    sku: str
    name: str
    category: str
    description: str
    brand: Optional[str] = None
    specs: Dict[str, Any] = Field(default_factory=dict)
    uom: Optional[str] = None
    price: Optional[float] = None
    search_terms: List[str] = Field(default_factory=list)


class CatalogIssue(BaseModel):
    sku: str
    issue_type: str
    message: str
    severity: str
```

These two models are the only formal Pydantic schemas in the current system. LLM evaluation outputs are currently stored as plain dictionaries in the LangGraph state, not as a dedicated `EvaluationResult` model. There is still no embedding/vector schema because vector search has not been implemented yet.

## 4. Catalog Intelligence Agent

### 4.1 Product type inference & spec checking (`spec_checker.py`)

- `infer_product_type(product)` — a rule-based keyword classifier (if/elif chain over `name`/`category`) covering industrial product types such as bearings, pillow blocks, valves, pipe fittings, fasteners, shafts, couplings, threadlocker, bearing grease, and pipe wrenches. It falls back to `"unknown"` when no rule matches.
- `PRODUCT_TYPE_REQUIRED_SPECS` — required spec fields per product type.
- `SPEC_ALIASES` — accepted alternate key names (e.g. `bore`/`id` for `inner_diameter_mm`, `od` for `outer_diameter_mm`, `pressure` for `pressure_rating_psi`).
- `check_missing_specs(products)` — flags `unknown_product_type` (medium) and `missing_spec` (high) issues.

Current verified output:

```text
Spec issues before UOM normalization: 41
Spec issues after UOM normalization: 33
```

### 4.2 UOM normalization (`uom.py`)

`normalize_product_uom` converts `*_in` spec keys to `*_mm` using:

```python
INCH_TO_MM = 25.4
```

Examples:

```text
inner_diameter_in → inner_diameter_mm
outer_diameter_in → outer_diameter_mm
width_in → width_mm
diameter_in → diameter_mm
length_in → length_mm
bore_diameter_in → bore_diameter_mm
shaft_diameter_in → shaft_diameter_mm
```

The original inch fields are retained, and the product is tagged as:

```python
product.uom = "normalized"
```

Current verified output:

```text
UOM-related issues fixed: 8
```

### 4.3 Description quality scoring (`description_quality.py`)

`score_description(product)` is a rule-based 0–5 quality score.

It penalizes:

- Very short descriptions
- Weak marketing phrases such as `"good"`, `"high quality"`, `"reliable"`, `"strong"`, `"useful"`
- Descriptions that do not include product spec values
- Descriptions that do not mention tokens from the product name

`check_description_quality(products)` flags `weak_description` when:

```python
score <= 2
```

Current verified output:

```text
Weak descriptions before rewrite: 22
Weak descriptions after rewrite: 0
```

### 4.4 Deterministic fallback description rewriter (`description_rewriter.py`)

`description_rewriter.py` is still present and important, but it is now a fallback path rather than the primary rewrite path.

`rewrite_description(product)` builds a deterministic description from the product name, category, and specs.

Example style:

```text
{name} is a {category} product with {specs_text}. Suitable for B2B industrial, maintenance, repair, and equipment assembly applications.
```

This fallback is used when:

- No Anthropic API key is available
- An LLM call fails
- A rewrite call returns empty text

### 4.5 LLM description rewriter (`llm_description_rewriter.py`)

`llm_description_rewriter.py` implements Claude-based description rewriting.

Main functions:

```python
rewrite_description_with_claude(product)
rewrite_description_with_claude_async(product, client, semaphore)
rewrite_weak_descriptions_with_llm(products, weak_skus)
rewrite_weak_descriptions_with_llm_async(products, weak_skus)
```

Current behavior:

- Uses Claude to rewrite weak descriptions.
- Uses product name, category, brand, specs, and current description as grounded context.
- Instructs the model not to invent technical specs.
- Writes concise, factual, search-friendly product descriptions.
- Falls back to deterministic rewriting on failure.
- Uses bounded async concurrency through:
  - `AsyncAnthropic`
  - `asyncio.gather`
  - `asyncio.Semaphore`
  - `LLM_CONCURRENCY`

Environment variables:

```text
ANTHROPIC_API_KEY
ANTHROPIC_REWRITE_MODEL
LLM_CONCURRENCY
```

Example generated description:

```text
SKF 6205-2RS is a deep groove ball bearing with double rubber seals (2RS), featuring a 25mm inner diameter, 52mm outer diameter, and 15mm width. Constructed from chrome steel, this sealed ball bearing provides protection against contaminants in industrial applications.
```

This is now the primary rewrite path used by the LangGraph workflow.

`llm_description_rewriter.py` also implements a targeted repair path used by the graph's conditional retry loop (see §5):

```python
repair_failed_rewrites_with_llm_async(original_products, rewritten_products, failed_evaluations)
```

This re-prompts Claude only for the SKUs the judge flagged (failed the quality gate, or `medium`/`high` hallucination risk), passing the judge's notes back in as repair context. Products that already passed are left untouched — it does not re-rewrite the whole batch.

### 4.6 LLM-as-judge evaluator (`llm_evaluator.py`)

`llm_evaluator.py` implements Claude-based evaluation of rewritten descriptions.

Main functions:

```python
evaluate_rewritten_description(product, original_description, rewritten_description)
evaluate_rewritten_description_async(...)
evaluate_rewritten_descriptions_async(original_products, rewritten_products, weak_skus)
```

The evaluator checks whether the rewritten description:

- Is grounded in the product data
- Avoids invented specs
- Avoids invented materials or brands
- Is useful for eCommerce search
- Avoids vague marketing fluff

Current judge output fields:

```text
sku
name
original_description
rewritten_description
judge_score
hallucination_risk
passes_quality_gate
notes
```

Important terminology:

The judge score is a **rubric-based quality score**, not statistical confidence.

Environment variables:

```text
ANTHROPIC_JUDGE_MODEL
LLM_CONCURRENCY
```

The judge model is separately configurable from the rewrite model. This gives separation between the generation path and evaluation path, although both currently use Anthropic unless configured otherwise.

Current verified output from `run_catalog_graph.py`:

```text
Description evaluations: 22
Descriptions passing judge: 21
Average judge score: 8.09/10
```

Sample judge output:

```text
BRG-6205-2RS | score=9/10 | risk=low | passes=True
BRG-6303-NO-SPEC | score=7/10 | risk=medium | passes=True
```

### 4.7 Duplicate detection (`dedup.py`)

`find_duplicate_candidates(products, threshold=88)` performs O(n²) pairwise comparison using `rapidfuzz.fuzz.token_set_ratio`.

The algorithm uses:

- Product-type compatibility
- Shared technical identifiers
- Regex-extracted identifiers such as `6205`, `UC205`, `P205`, `M8`, `40mm`, `1/2`
- Name similarity
- Spec similarity
- Type-specific filters for valves and pipe adapters

Scoring:

```text
final_score = 0.7 × name_similarity + 0.3 × spec_similarity
```

Tuning history on the demo catalog:

```text
173 possible duplicate pairs → 9 → 6
```

Current duplicate candidates:

```text
BRG-6303-OPEN ↔ BRG-6303-NO-SPEC
FST-M8-40-ZN ↔ FST-M8-40-HEXAGON
FST-M8-40-ZN ↔ FST-HEX-M8X40
VAL-BUTTERFLY-4IN ↔ VAL-BUTTERFLY-LUG
FST-MOTOR-KIT-M8 ↔ FST-MOTOR-BOLT-KIT
FST-HEX-M8X40 ↔ FST-M8-40-HEXAGON
```

`duplicate_candidates_to_issues` exists but is currently not used by the main LangGraph pipeline. Duplicate candidates are displayed separately from formal health-report issue counts.

### 4.8 Health report (`report.py`)

`build_catalog_health_report` aggregates:

```text
total_products
messy_spec_issues
normalized_spec_issues
uom_issues_fixed
weak_description_issues
total_current_issues
issue_summary
```

Important note:

The health report dictionary does **not** yet include:

- Duplicate candidate count
- Description judge metrics
- Hallucination risk counts

Those values are currently stored separately in LangGraph state and merged in CLI/UI display code.

## 5. LangGraph workflow (`state.py` + `graph.py`)

`CatalogAgentState` is a `TypedDict` carrying shared workflow state.

Current state fields include:

```text
input_path
output_path
raw_products
normalized_products
rewritten_products
messy_spec_issues
normalized_spec_issues
messy_description_issues
normalized_description_issues
final_description_issues
description_evaluations
initial_failed_description_evaluations
failed_description_evaluations
repaired_products
repair_description_evaluations
weak_skus
duplicate_candidates
health_report
```

`build_catalog_intelligence_graph()` now wires a **conditional** graph with two decision points and a repair loop (added in "Add conditional LangGraph rewrite repair loop"):

```text
START
 → load_catalog
 → check_specs_before
 → normalize_uom
 → check_specs_after
 → check_descriptions
 → route_after_description_check
     "rewrite"      → rewrite_descriptions → evaluate_rewrites → route_after_evaluation
     "skip_rewrite" → prepare_products_without_rewrite → detect_duplicates

 route_after_evaluation (from evaluate_rewrites):
     "continue" → detect_duplicates
     "repair"   → repair_failed_rewrites → evaluate_rewrites_after_repair → detect_duplicates

 → detect_duplicates
 → generate_report
 → save_clean_catalog
 → END
```

Current graph nodes (13 total):

```text
load_catalog
check_specs_before
normalize_uom
check_specs_after
check_descriptions
prepare_products_without_rewrite   (new — skip branch when weak_skus is empty)
rewrite_descriptions
evaluate_rewrites
repair_failed_rewrites             (new — retries only judge-flagged SKUs)
evaluate_rewrites_after_repair     (new — re-judges the repaired batch)
detect_duplicates
generate_report
save_clean_catalog
```

Routing logic:

- `route_after_description_check(state)` — returns `"skip_rewrite"` if `weak_skus` is empty, else `"rewrite"`. Avoids paying for LLM rewrite/judge calls when the catalog has no weak descriptions.
- `route_after_evaluation(state)` — returns `"repair"` if `failed_description_evaluations` is non-empty, else `"continue"`. A description is treated as failing if it fails `passes_quality_gate` **or** its `hallucination_risk` is `"medium"` or `"high"` (`find_failed_description_evaluations` in `graph.py`) — medium risk is intentionally included because catalog copy should be conservative, not just "technically passing."
- The repair loop runs exactly **once** (no re-check after `evaluate_rewrites_after_repair` routes back into `route_after_evaluation`) — if repaired descriptions still fail the judge, they proceed to `detect_duplicates` as-is rather than looping indefinitely. There is no retry-count cap in state because there's only ever one repair pass.

Current status:

- The graph is fully implemented, including conditional branching via `add_conditional_edges` (two decision points, described above).
- The graph uses sync node functions; async LLM work is invoked inside nodes through `asyncio.run(...)`.
- `prepare_products_without_rewrite_node` exists so that downstream nodes (`detect_duplicates`, `generate_report`) can always read from `rewritten_products` regardless of which branch ran — it copies `normalized_products` into `rewritten_products` and zeroes out the evaluation/repair fields.

The pre-LangGraph direct pipeline (`run_catalog_check.py`) still exists in parallel with the graph-based path (`run_catalog_graph.py`), though it does not have the conditional skip/repair behavior — that logic lives only in `graph.py`.

Current verified `run_catalog_graph.py` output:

```text
LANGGRAPH CATALOG INTELLIGENCE REPORT
-------------------------------------
Total products: 74
Spec issues before UOM normalization: 41
Spec issues after UOM normalization: 33
UOM-related issues fixed: 8
Weak descriptions before rewrite: 22
Weak descriptions after rewrite: 0
Description evaluations: 22
Descriptions passing judge: 21
Average judge score: 8.09/10
Possible duplicate pairs: 6
Total current issues: 39
```

## 6. Search Quality Layer

`retriever.py` implements weighted in-memory keyword search.

Main function:

```python
search_catalog(catalog, query, top_k=5)
```

Field weights:

```text
name: 5
search_terms: 4
category: 3
description: 2
specs: 1
```

Current behavior:

- Tokenizes query text.
- Adds simple token variants, such as `25mm → 25`.
- Scores products by substring/token presence in weighted fields.
- Sorts by score.
- Returns top K results.

Current CLI:

```text
run_search_comparison.py
```

Example queries:

```text
25mm sealed bearing
bolt for motor mount
half inch brass valve
pillow block for 6205 bearing
thread sealant for pipe fitting
```

Current limitations:

- No inverted index
- No embeddings
- No vector database
- No ChromaDB
- No RAG
- No semantic search
- No search evaluation metrics beyond visual before/after comparison

`indexer.py` exists as a scaffold but does not contain a meaningful implemented index yet.

## 7. Cross-Sell Reasoning Agent

Implemented in:

```text
src/crosssell_agent/knowledge_graph.py
src/crosssell_agent/recommender.py
```

`knowledge_graph.py` builds a static `networkx.DiGraph` from a hardcoded relationship list.

Each edge includes:

```text
relationship
reason
confidence
```

Example relationships:

```text
BRG-6205-2RS → HSG-P205
BRG-6205-2RS → MNT-SHAFT-25MM
BRG-UC205 → HSG-P205
MNT-MOTOR-BASE-56C → FST-MOTOR-KIT-M8
VAL-BALL-1-2-BRASS → PIP-SEALANT-PTFE
FST-M8-40-ZN → FST-WASHER-M8-FLAT
FST-M8-40-ZN → FST-NUT-M8-ZN
```

`recommender.py`:

- Loads `data/catalog_clean.json`
- Builds the graph
- Gets outgoing edges for the cart SKU
- Enriches target SKUs with product name/category/description/specs/price
- Returns recommendation dictionaries

Current CLI:

```text
run_crosssell_demo.py
```

Current limitations:

- Cross-sell graph is hardcoded.
- Graph is rebuilt from scratch on each call.
- No LangGraph workflow exists for cross-sell yet.
- No MCP server yet.
- No LLM-generated cross-sell explanations yet.
- Edge confidence values are manually assigned relationship weights, not learned probabilities.

## 8. Streamlit UI (`app.py`)

Single-file Streamlit app with three tabs:

```text
Catalog Health
Search Comparison
Cart + Cross-Sell
```

### Tab 1 — Catalog Health

`run_catalog_pipeline()` is cached via `@st.cache_data` and invokes the real compiled LangGraph workflow:

```python
graph.invoke(initial_state)
```

It displays:

- Total products
- Spec issues
- Weak descriptions
- Possible duplicates
- Catalog health summary
- Sample description rewrites
- Duplicate candidate table
- Static LangGraph workflow checklist
- LLM judge metrics: descriptions evaluated, average judge score, failed/needs-review count, and a per-SKU table of judge score / hallucination risk / pass-fail (added in "Show LLM judge metrics in Streamlit")

The workflow checklist is hardcoded and mirrors the graph nodes. It is not currently driven by actual `graph.stream()` node execution events, so it still won't visually distinguish a run that hit the skip-rewrite branch or the repair loop from a "normal" run — it always renders the same static list regardless of which conditional path actually executed.

The judge metrics table reads `pipeline["description_evaluations"]` from the invoked graph's final state. Note that after a repair pass runs, `description_evaluations` is overwritten with `repair_description_evaluations` (see `evaluate_rewrites_after_repair_node` in `graph.py`), so the UI currently shows only the **post-repair** judge results, not the original pre-repair failures — there's no UI surface yet for "N descriptions needed repair before passing."

### Tab 2 — Search Comparison

Reads:

```text
data/catalog_messy.json
data/catalog_clean.json
```

Runs `search_catalog` against both and shows side-by-side results.

### Tab 3 — Cart + Cross-Sell

Uses a hardcoded demo SKU dropdown and calls:

```python
recommend_cross_sell(selected_sku)
```

Displays:

- Recommended product
- SKU
- Category
- Relationship type
- Confidence
- Reason
- Price

### Coupling note

Tab 1 writes `data/catalog_clean.json`.

Tabs 2 and 3 read `data/catalog_clean.json`.

The three tabs share state through the file system, not through a backend API or in-memory session object. This is acceptable for the demo but should be redesigned for a production-style application.

## 9. Tech Stack

Current implemented stack:

```text
Python
Pydantic
LangGraph
Anthropic Python SDK
python-dotenv
asyncio
RapidFuzz
NetworkX
Streamlit
JSON catalog files
```

Current AI usage:

```text
Claude-based description rewriting
Claude-based LLM-as-judge description evaluation
```

Current deterministic/non-LLM logic:

```text
Product type inference
Spec validation
UOM normalization
Description quality scoring
Duplicate detection filters
Weighted keyword search
NetworkX graph traversal
```

Not implemented yet:

```text
OpenAI SDK
Embeddings
ChromaDB
Vector search
RAG
MCP server
FastAPI backend
React frontend
Automated tests
```

## 10. Configuration

Expected `.env` configuration:

```text
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_REWRITE_MODEL=claude-sonnet-4-5
ANTHROPIC_JUDGE_MODEL=claude-haiku-4-5
LLM_CONCURRENCY=5
```

`.env` must remain in `.gitignore`.

Important note:

`judge_score` is not statistical confidence. It is a model-generated rubric score.

## 11. Testing

Current status:

```text
tests/ exists but is empty or not meaningfully implemented
No pytest coverage yet
No CI workflow yet
```

Recommended first tests:

```text
test_spec_checker.py
test_uom.py
test_description_quality.py
test_dedup.py
test_search_retriever.py
test_crosssell_recommender.py
```

LLM components should be tested with mocks, not live API calls.

## 12. Known Issues and Limitations

### 12.1 requirements.txt hygiene

`requirements.txt` should be manually checked before sharing.

A known failure mode is merged package names, such as:

```text
pandasrapidfuzz
```

Recommended verification:

```bash
python -m pip install -r requirements.txt
```

### 12.2 LangGraph flow is conditional, but only partially

The graph now branches (see §5): it skips the rewrite/evaluate path when there are no weak descriptions, and it runs one repair pass when the judge flags a rewrite as failing or medium/high hallucination risk.

Still missing conditional behaviors:

```text
If duplicate candidates exist → generate duplicate review report
If product type is unknown → use LLM fallback classifier
If repair still fails the judge after one pass → currently proceeds anyway rather than falling back to the deterministic template rewriter
```

The last point is worth flagging: `repair_failed_rewrites_with_llm_async` (like the original rewriter) only falls back to the deterministic template in `description_rewriter.py` on an API error or missing key — if the repaired description still fails the judge on a *successful* Claude call, there is no second repair attempt and no re-check; the graph proceeds to `detect_duplicates` with whatever the repair pass produced.

### 12.3 Search is still keyword-based

Search does not use embeddings or vector retrieval.

### 12.4 Cross-sell is static

Cross-sell recommendations are powered by a hardcoded NetworkX graph.

No dynamic spec reasoning, MCP tool access, or LLM-generated explanation exists yet.

### 12.5 Streamlit is demo UI

Streamlit is useful for demonstration but does not demonstrate a production-style SaaS architecture.

A FastAPI + React version would be stronger for full-stack engineering signal.

### 12.6 LLM judge is a rubric evaluator

The judge can catch obvious grounding issues, but it is still an LLM. It should be treated as a quality gate, not a source of absolute truth.

## 13. Gaps vs. Target Architecture

| Target capability | Current status |
|---|---|
| LangGraph Catalog Intelligence Agent | Implemented |
| Conditional LangGraph branches (skip-rewrite, repair loop) | Implemented |
| LLM description rewriting | Implemented |
| Async parallel LLM rewriting | Implemented |
| LLM-as-judge description evaluation | Implemented |
| Separate rewrite/judge model configuration | Implemented |
| Embedding-based duplicate detection | Not implemented |
| ChromaDB semantic search | Not implemented |
| Search RAG | Not implemented |
| LangGraph Cross-Sell Agent | Not implemented |
| LLM-generated cross-sell explanations | Not implemented |
| MCP catalog server | Not implemented |
| FastAPI backend | Not implemented |
| React frontend | Not implemented |
| Automated tests | Not implemented |

## 14. Near-Term Design Priorities

Given the current implementation, the highest-leverage next steps are:

1. Fix and verify `requirements.txt`.
2. Add deterministic unit tests for rule-based modules (spec_checker, uom, description_quality, dedup) and the new routing functions (`route_after_description_check`, `route_after_evaluation`, `find_failed_description_evaluations`) — these are now the parts of the graph most likely to silently regress.
3. Decide on a bounded retry policy for the repair loop (currently exactly one pass, then ships regardless of judge outcome) — either cap-and-fallback-to-template, or surface unresolved failures in the health report/UI instead of silently accepting them.
4. Surface pre-repair vs. post-repair judge results in the Streamlit UI (`description_evaluations` is currently overwritten by the repair pass, losing the "N needed repair" signal — see §8).
5. Add MCP catalog server for cross-sell/catalog access.
6. Add LLM-generated cross-sell explanations.
7. Replace Streamlit with FastAPI + React.
8. Add embeddings + ChromaDB semantic search.
9. Add semantic search evaluation metrics.

## 15. Current Honest Technical Summary

Current accurate summary:

```text
SearchForge is a LangGraph-orchestrated B2B catalog intelligence and search quality platform. It cleans messy industrial product catalogs using deterministic validation, unit normalization, fuzzy duplicate detection, and Claude-based async description rewriting, with conditional branching that skips the LLM path when there's nothing to rewrite and runs a single automatic repair pass when the LLM-as-judge flags a rewrite as failing or hallucination-prone. The cleaned catalog powers keyword-based before/after search comparison and a NetworkX-based cross-sell recommendation demo.
```

Current honest limitation:

```text
The catalog agent now uses LLMs, but search is still keyword-based, cross-sell reasoning is still powered by a static graph, and the UI is still Streamlit rather than a production-style FastAPI/React stack.
```

## 16. Target Architecture

The target architecture remains:

```text
Messy Catalog JSON
        ↓
Catalog Intelligence Agent
LangGraph: analyze → fix → evaluate
        ↓
Clean Catalog
        ↓
ChromaDB Index
        ↓
Search RAG before/after comparison
        ↓
Cross-Sell Reasoning Agent
LangGraph + MCP + NetworkX + spec filtering
        ↓
LLM-as-Judge Evaluator
        ↓
FastAPI + React UI
```

This target is not fully implemented yet.

Current foundation pieces that are implemented:

```text
LangGraph orchestration
LLM rewriting
LLM evaluation
Rule-based precision checks
Duplicate detection
Search comparison
Cross-sell compatibility graph
```
