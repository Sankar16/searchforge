# SearchForge — Design Document

*Last updated: 2026-07-09. Reflects the actual implementation verified against source code. The previous version of this document was written during planning and referenced Streamlit, no tests, no ChromaDB, and no FastAPI or React — none of that is true anymore.*

---

## 1. What This Is

SearchForge is a B2B catalog intelligence platform for industrial product distributors. It takes a messy product catalog (CSV or the built-in demo), runs it through an AI pipeline that fixes spec gaps, rewrites weak descriptions, and detects duplicate listings, then gives merchandisers a review UI where they can approve, edit, or reject each change before downloading the cleaned catalog. It also shows a side-by-side semantic search comparison (before and after cleaning) so you can see directly how the improvements affect what customers find, generates AI-powered cross-sell recommendations grounded in product compatibility data, and surfaces a "search gap" explanation when a query returns zero results — telling the merchandiser exactly why and what they should fix.

---

## 2. The Problem

B2B industrial product catalogs are unusually messy because the data comes from many sources — manufacturer spec sheets, ERP exports, manual entry — and nobody has time to clean it before it goes live.

The specific problems SearchForge addresses:

**Vague descriptions kill search.** A ball bearing described as "high quality bearing for industrial use" will never appear when a customer searches for "sealed bearing for 25mm motor shaft" — even though it's the right product. The words just aren't there. This is the most common source of zero-result searches.

**Missing specs make recommendations impossible.** If a bearing doesn't have `inner_diameter_mm` in its spec fields, a compatibility system can't match it to a housing. Mechanical specs are what make industrial search intelligent — without them you're just doing text matching on marketing copy.

**Inconsistent units cause silent failures.** One supplier provides shaft diameter in inches; another in mm. Without normalization, two otherwise-identical products look completely different to any system comparing specs.

**Duplicate listings split relevance.** When the same product appears under three different SKUs with slightly different names, every search distributes relevance across all three instead of surfacing one authoritative result.

**Cross-sell is usually correlation, not reasoning.** "Customers who bought X also bought Y" tells you nothing about *why* the products go together or whether the pairing is actually correct. A mechanic who buys the wrong lubricant because an algorithm said "frequently bought together" is not a happy customer.

**Merchandisers have no visibility into search gaps.** When a customer searches for something and gets no results, nothing in a typical catalog system tells the merchandiser what happened, what the customer was probably looking for, or what they should change.

---

## 3. Architecture Overview

```
Landing Page / Login (React)
        ↓
AppShell (React + React Router v6)
        ↓
┌──────────────────────────────────────────────────┐
│                   Three Pages                    │
│  Catalog Optimizer | Search Preview | Smart Recs │
└──────────────────────────────────────────────────┘
        ↓ fetch()
FastAPI Backend (api/main.py, port 8000)
        ↓
┌──────────────────────────────────────────────────────────────┐
│                      Three Pipelines                         │
│                                                              │
│  LangGraph Catalog Agent (13 nodes)                         │
│  load → spec check → UOM → spec recheck → description check  │
│  → [conditional] rewrite → judge → [conditional] repair      │
│  → dedup → report → save                                    │
│                                                              │
│  MCP Catalog Server ←──── Cross-Sell LLM Agent             │
│  (FastMCP, stdio transport)    (Claude Haiku 4.5)           │
│  4 tools: search_products,     spawns MCP subprocess,       │
│  get_product, get_compatibility, calls tools, then          │
│  get_catalog_health            generates explanations        │
│                                                              │
│  ChromaDB Semantic Search                                    │
│  (all-MiniLM-L6-v2, in-memory)                             │
│  messy index + clean index, built at startup                │
│  gap analysis at 15% threshold via Claude Haiku             │
└──────────────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────┐
│           Data Layer             │
│  catalog_messy.json   (source)   │
│  catalog_uploaded.json (CSV)     │
│  catalog_clean.json   (pipeline) │
│  catalog_final.json   (approved) │
└──────────────────────────────────┘
```

The frontend never touches the file system directly. Every interaction goes through FastAPI endpoints. The three pipelines are independently invoked — the catalog agent, the cross-sell agent, and semantic search can all run without each other.

---

## 4. Component Deep Dives

### 4.1 LangGraph Catalog Agent

The catalog agent is a compiled LangGraph `StateGraph` with 13 nodes and two conditional decision points.

**Nodes in execution order:**

```
load_catalog              → reads JSON from disk into Product objects
check_specs_before        → flags missing required specs (pre-UOM)
normalize_uom             → converts *_in spec keys to *_mm (7 mappings)
check_specs_after         → re-flags missing specs (post-UOM, expects fewer)
check_descriptions        → scores descriptions 0–5, identifies weak_skus

route_after_description_check  ← DECISION POINT 1
  "skip_rewrite"          → prepare_products_without_rewrite
  "rewrite"               → rewrite_descriptions

rewrite_descriptions      → Claude async batch rewrite for weak_skus only
evaluate_rewrites         → Claude-as-judge scores each rewritten description

route_after_evaluation    ← DECISION POINT 2
  "continue"              → detect_duplicates
  "repair"                → repair_failed_rewrites

repair_failed_rewrites    → re-prompts Claude only for flagged SKUs, passes
                            judge notes back as repair context
evaluate_rewrites_after_repair → re-judges the repaired batch, then continues

detect_duplicates         → rapidfuzz pairwise comparison, threshold=88
generate_report           → aggregates health metrics
save_clean_catalog        → writes catalog_clean.json
```

**Why LangGraph over a sequential function call chain:** the conditional branches are the main reason. Whether to call the LLM at all (skip_rewrite when `weak_skus` is empty) and whether to run the repair loop (based on judge output) are decisions that depend on data computed earlier in the pipeline. A simple for-loop can handle this, but LangGraph's `StateGraph` makes the branching explicit, auditable, and easy to extend. The state dictionary propagates through every node without manual plumbing.

**The repair loop:** runs exactly once. The `evaluate_rewrites_after_repair` node checks failures after repair but the graph unconditionally routes to `detect_duplicates` after it — there's no second repair pass. This is intentional. If a description still fails after one repair attempt, it proceeds as-is. The alternative (unlimited loops) risks LLM cost runaway and wasn't necessary for the demo catalog.

**What the agent produces:** `catalog_clean.json` with optimized descriptions for approved SKUs, a health report with before/after metrics, description evaluations with judge scores and hallucination risk levels, and a list of duplicate candidate pairs.

**Model used:** Claude Sonnet for rewriting (needs quality), Claude Haiku for judging (speed matters when evaluating a batch). Both are configurable via `ANTHROPIC_REWRITE_MODEL` and `ANTHROPIC_JUDGE_MODEL`.

**Representative output on the 74-product demo catalog:**
```
Spec issues before UOM normalization: 41
Spec issues after UOM normalization: 33
Weak descriptions before rewrite: 22
Weak descriptions after rewrite: 0
Descriptions passing judge: 21/22
Average judge score: 8.09/10
Duplicate pairs detected: 6
```

### 4.2 MCP Catalog Server

MCP (Model Context Protocol) is a standard for exposing tools to LLM agents in a way that decouples the tool implementation from the agent that uses it. Instead of the cross-sell agent importing Python functions directly, it spawns the MCP server as a subprocess and calls tools over stdin/stdout.

**The 4 tools exposed by `src/mcp_server/catalog_server.py`:**

| Tool | What it does |
|------|-------------|
| `search_products(query, top_k)` | Keyword search against `catalog_clean.json` |
| `get_product(sku)` | Returns the full product record for a SKU |
| `get_compatibility(sku)` | Returns cross-sell recommendations from the NetworkX graph |
| `get_catalog_health()` | Returns category list, product count, average price |

**Why MCP instead of direct Python imports:** the cross-sell agent would work fine with a direct import today, but MCP makes the boundary explicit. If catalog data later lived in a separate microservice, a database, or a third-party PIM system, the agent code wouldn't change — only the server implementation would. It also means the MCP tools could in principle be called by any MCP-compatible agent, not just the SearchForge cross-sell agent.

**How the cross-sell agent uses it:** `CatalogMCPClient` in `src/mcp_server/catalog_client.py` spawns the server subprocess, opens the stdio transport, calls `get_product` and `get_compatibility` for the cart SKU, closes the connection, then passes the results to Claude for explanation generation. The subprocess is short-lived — it spawns, serves the two requests, and exits.

**Known limitation:** spawning a subprocess per request adds ~200ms latency. A production version would keep the MCP server running as a persistent process and reuse the connection. For a demo with single-user traffic, the overhead is acceptable.

### 4.3 ChromaDB Semantic Search

**What's indexed:** for each product, a single text document is built from `name + description + category + specs (key value pairs) + search_terms`. The full text is embedded with `all-MiniLM-L6-v2` from the `sentence-transformers` library.

**Why `all-MiniLM-L6-v2`:** it's fast (runs locally, no API cost), produces 384-dimensional embeddings of reasonable quality for short industrial product text, and is widely tested. A larger model would produce better embeddings at the cost of slower indexing and higher memory use — not worth it for a demo with 74 products.

**Two indexes:** `catalog_messy` and `catalog_clean` are built at FastAPI startup in a background thread. Both are kept in memory in the module-level `_indexes` dict. This lets the Search Preview page fetch both simultaneously and show the before/after difference in a single request.

**Scoring:** ChromaDB returns cosine distances in the range [0, 2]. Zero means identical; 2 means perfectly opposite. The score exposed to the UI is:

```python
score = round((1 - (distance / 2)) * 100, 1)
```

This maps to [0, 100] where 100 is a perfect match. Match labels:

| Score | Label |
|-------|-------|
| ≥ 80 | Strong match |
| ≥ 65 | Good match |
| ≥ 50 | Related |
| ≥ 35 | Partial match |

Results below 35 are filtered out for normal search. Gap analysis runs at a 15% floor to surface hidden matches.

**Index lifecycle:** built at startup, cleared from `_indexes` when `apply-changes` runs (so subsequent searches use the final catalog), rebuilt explicitly via `POST /api/search/reindex` which the frontend calls automatically after applying changes.

### 4.4 Search Gap Detector

When a query against the optimized catalog returns zero results, the Search Preview page automatically calls `POST /api/search/gap-analysis`.

**What it does:** runs semantic search against both indexes at `min_score=15` (much lower than the normal 35 threshold) to collect products that are semantically close but didn't clear the normal bar. It deduplicates the results by SKU, then sends them to Claude Haiku with a merchandising prompt asking for:

- Why the search found nothing (gap summary)
- What the customer was probably looking for (likely intent)
- Which catalog products probably match but aren't described that way (hidden matches with explanation)
- Keywords to add to descriptions
- An example of how to rewrite a product description to capture the query

**Why only on the optimized catalog empty state:** gap analysis is a signal that the *cleaned* catalog is still missing something — either the optimization didn't go far enough, or the product genuinely doesn't exist. Showing it on the original catalog empty state would just be noise, since almost any reasonable query finds nothing in a messy catalog.

**Why this is the most useful feature for a merchandiser:** every other feature in the platform tells them what's wrong in aggregate. Gap analysis tells them what a specific customer searched for, which products they probably wanted, and exactly what text to add to fix it. It closes the loop between "search returned nothing" and "here's what to do about it."

### 4.5 React Frontend

**Stack:** React 18 + Vite for the build tool, Tailwind CSS via CDN (no PostCSS build step — all styling is either inline or loaded from the Tailwind CDN script tag). The decision to use Tailwind CDN avoids build configuration complexity while keeping the demo visually consistent.

**Routing:** React Router v6 with nested routes. All application routes live under `/app/*` and are protected by a `RequireAuth` wrapper that checks `localStorage.getItem('sf_authenticated')`. Unauthenticated requests redirect to `/login`.

**State persistence:** `CatalogContext` (React Context) holds the full catalog analysis result, approval/rejection state, edited descriptions, and saved cross-sell pairings. It wraps all routes in `App.jsx`, so navigating between the three pages doesn't lose state. This matters because the analysis result is large and the user may want to review descriptions, switch to Search Preview to check search quality, then come back and continue approving.

The `resetAll()` function wipes analysis state but intentionally does **not** clear `savedPairings` — those persist until the user explicitly clears them or exports to CSV, because a merchandiser building a cross-sell rule set doesn't want to lose their work just because they re-ran the catalog analysis.

**The three pages:**

*Catalog Optimizer* — the main workflow. Upload CSV or use the demo catalog, click Analyze (triggers the full LangGraph pipeline via `POST /api/catalog/analyze`, which blocks for 30–90 seconds depending on how many descriptions need rewriting), review the before/after description table with approve/reject/edit controls, then Apply Changes which downloads the final catalog and triggers a search reindex.

*Search Preview* — type a query or click a demo pill, see semantic search results from both the original and optimized catalogs side by side in a toggle view. A comparison banner shows how many more results the optimized catalog finds. If the optimized catalog returns zero, the gap detector fires automatically.

*Smart Recommendations* — enter a cart SKU or click a demo SKU, see the cross-sell recommendations with relationship type badges, confidence labels, and Claude-generated explanations. Save pairings to a session list, then export as CSV for import into a merchandising platform.

**Auth:** `localStorage.getItem('sf_authenticated')` set on successful login. Demo credentials are hardcoded (`demo@searchforge.com` / `demo123`). This is obviously not production auth — it's just enough gating to make the demo feel like a real application.

---

## 5. Key Design Decisions

### Decision 1: Sequential LangGraph vs parallel agents

**Chose:** sequential pipeline where each node reads from the previous node's output.

**Why:** catalog data transformation is inherently sequential — you can't evaluate a rewritten description before you've rewritten it, and you can't rewrite descriptions before you've identified which ones are weak. Parallel agents sound appealing but the dependencies make them mostly parallel in name only. The bigger benefit of LangGraph here is the conditional branching and the clean audit trail of what ran and in what order. For a compliance-sensitive workflow where someone needs to understand *why* a description changed, predictable sequential execution is a feature.

**Rejected:** parallel specialist agents running simultaneously. Harder to debug when something fails mid-pipeline (which node's output is bad?), and the actual parallelism opportunity is limited to the async LLM batch calls within nodes, which are already parallelized with `asyncio.gather`.

### Decision 2: MCP over direct imports for cross-sell data access

**Chose:** MCP server with FastMCP stdio transport.

**Why:** the cross-sell agent's job is reasoning over product data — it shouldn't be coupled to how that data is stored or retrieved. MCP creates a clean boundary. If catalog data moved to a database, a separate service, or a third-party API, the agent code wouldn't change. The pattern also means the MCP tools could serve other agents in the future without any modification.

**Rejected:** direct Python imports (`from src.crosssell_agent.recommender import recommend_cross_sell`). This works and is simpler, but it hardwires the agent to one specific data retrieval implementation. The MCP version demonstrates the architecture you'd actually want at scale.

### Decision 3: ChromaDB persistent vs in-memory

**Chose:** in-memory ChromaDB (`chromadb.Client()`, no path argument).

**Why:** indexing 74 products takes under a second. The demo doesn't need persistence across restarts badly enough to add the operational complexity of managing a persistent vector store. The indexes are rebuilt at startup automatically.

**What production would use:** `chromadb.PersistentClient(path="./data/chroma_db")` so the index survives restarts. With a large catalog (tens of thousands of products), startup rebuild time becomes a real cost and persistence becomes necessary.

### Decision 4: Claude Haiku for cross-sell explanations and gap analysis

**Chose:** `claude-haiku-4-5-20251001` for both the cross-sell explanation generator and the gap analysis endpoint.

**Why:** both tasks are grounded generation, not reasoning. The agent is given structured data (product specs, relationship type, the graph's existing reason text) and asked to write one or two sentences of clear technical prose. Haiku is fast enough that the explanation feels immediate, and cheap enough that calling it once per recommendation in a batch doesn't add up to a meaningful cost. The gap analysis call is even simpler — it's a structured JSON extraction task.

**Rejected:** Claude Sonnet for all LLM calls. Sonnet is the right choice for the rewriting and judging tasks (where output quality directly affects the catalog and is preserved), but it's overkill for ephemeral explanatory text that the user reads once and doesn't store.

### Decision 5: React Context vs Redux for state

**Chose:** React Context with a single `CatalogContext` provider.

**Why:** the app has one source of shared state — the catalog analysis result plus UI state derived from it. Context handles this without any external dependency. The state is held in a single `useState` per top-level piece (analysisResult, approvedSkus, savedPairings, etc.) which is easy to reason about and debug.

**Rejected:** Redux — adds a dependency, a boilerplate file structure, and a learning curve for a state management problem that doesn't need any of it. localStorage for cross-component state — stale data risk and poor error handling when the analysis result is large.

### Decision 6: Keyword fallback alongside semantic search

**Chose:** semantic search as the default, with automatic fallback to keyword search if semantic fails.

**Why:** semantic search handles natural language queries well ("sealed bearing for motor shaft") but can be unreliable for exact part number queries ("BRG-6205-2RS"). Keyword search handles the exact match case reliably. The hybrid approach covers both without asking the user to choose.

**Rejected:** semantic only — too many exact-match queries in industrial B2B fail when the query is an alphanumeric part number that doesn't embed usefully.

---

## 6. What's Production-Ready vs Demo-Only

**Production-ready (the patterns are correct, not just the code):**

- LangGraph pipeline logic — conditional branching, repair loop, state propagation
- MCP server architecture — correct decoupling pattern with stdio transport
- Semantic search scoring — correct ChromaDB distance normalization
- FastAPI endpoint structure — clean REST API with Pydantic request/response models
- React component architecture — protected routes, context, clean page separation
- Test coverage on core modules — 47 tests on dedup, spec checker, UOM, and knowledge graph

**Demo-only (would need real work before production):**

- In-memory ChromaDB — needs `PersistentClient` with a real data directory
- `localStorage` auth — needs OAuth, SSO, or a real session system
- MCP client spawns a subprocess per request — needs a persistent connection or a different transport
- `POST /api/catalog/analyze` blocks the server thread for 30–90 seconds — needs FastAPI `BackgroundTasks` with a polling endpoint so the frontend can show real progress
- No catalog sync from real sources — ERP, PIM, or database connectors are needed
- No push integration — the cleaned catalog downloads as a CSV; there's no API push to HawkSearch or any eCommerce platform
- Single user — no multi-tenancy, no per-user analysis history, no approval workflows with roles
- No audit trail — once changes are applied, there's no record of what changed or why
- No rollback — if an approved rewrite is wrong, the only option is to re-run the whole analysis

---

## 7. Known Limitations

- **Catalog must be uploaded as CSV.** No live sync from any source system.
- **ChromaDB index rebuilds on every server restart.** With a large catalog this would be a meaningful startup cost.
- **Semantic search shows similar results for both catalogs when only descriptions changed.** If two products have identical names and the only difference is the description, and the query matches the name, both indexes return similar results. The description text improves *what queries find the product* but doesn't change the name-based similarity score for queries that already matched.
- **LLM rewrites are only as good as the source data.** Products with no specs and a generic name produce weak rewrites even after optimization. The pipeline can't invent technical specifications.
- **MCP subprocess spawning adds ~200ms per cross-sell request.** Noticeable on first load for each SKU.
- **The repair loop runs exactly once.** A description that fails the judge after repair proceeds to the final catalog as-is. There's no second chance and no fallback to the deterministic template rewriter (which only fires on API errors, not on judge failures of successful LLM calls).
- **The `analyze` endpoint is synchronous and blocks.** Under concurrent load, multiple analysis requests would queue. Not a problem for single-user demo; a real problem for any shared deployment.

---

## 8. What a Real Production System Would Need

**Data layer:**

- Connectors to ERP/PIM systems (SAP, NetSuite, Akeneo) — CSV upload is a demo convenience, not a viable integration
- Incremental change detection — only re-analyze products that changed since the last run, not the full catalog every time
- Push integration to search platforms (HawkSearch, Algolia, Elasticsearch) — the optimized catalog needs to propagate automatically, not wait for a CSV download
- Feedback loop — did the optimized descriptions actually improve search click-through and conversion? Without metrics, you don't know if the optimization is working
- Audit trail with rollback — every description change should be logged with the original text, the rewrite, who approved it, and when; rollback to any prior version should be one click

**Infrastructure:**

- Async job processing — the catalog analysis pipeline should run as a background job (Celery, FastAPI `BackgroundTasks`, or a queue) with a status polling endpoint and progress streaming; blocking a server thread for 90 seconds is not acceptable in production
- Persistent vector store — ChromaDB `PersistentClient` or a managed vector database
- Real authentication — OAuth 2.0, SSO, or similar; localStorage is a placeholder
- Multi-tenant data isolation — each customer's catalog, analysis history, and cross-sell rules must be isolated
- Rate limiting and cost tracking — LLM calls are the dominant cost driver; per-organization budgets and throttling are necessary
- Monitoring — latency and error rates on LLM calls, search quality metrics over time

---

## 9. Tech Stack Summary

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | React 18 + Vite | Fast setup, HMR, sufficient for demo |
| Styling | Tailwind CSS (CDN) | No build step, consistent design |
| Routing | React Router v6 | Standard, nested protected routes |
| State | React Context | No external dependency, sufficient for single user |
| Backend | FastAPI | Async-ready, Pydantic validation, clean endpoint design |
| Agent orchestration | LangGraph | State machine for conditional multi-step AI pipeline |
| LLM (rewrite/judge) | Claude Sonnet 4.5 | Quality matters for catalog copy that gets stored |
| LLM (cross-sell/gap) | Claude Haiku 4.5 | Fast and cheap for grounded explanatory text |
| Tool protocol | MCP (FastMCP, stdio) | Decoupled tool access; same pattern needed for real microservices |
| Vector search | ChromaDB + all-MiniLM-L6-v2 | Local, fast, no API cost, good enough for industrial text |
| Compatibility graph | NetworkX DiGraph | Lightweight, sufficient for hardcoded compatibility data |
| Data | JSON files | Sufficient for demo; swap for database in production |
| Tests | pytest | 47 tests on UOM, dedup, spec checker, knowledge graph |

---

## 10. Running the Project

```bash
# Install Python dependencies (from project root)
pip install -r requirements.txt

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start the backend (Terminal 1)
uvicorn api.main:app --reload --port 8000

# Start the frontend (Terminal 2)
cd frontend && npm run dev
# → http://localhost:5173

# Run tests
python -m pytest tests/ -v

# Environment variables (create .env in project root)
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_REWRITE_MODEL=claude-sonnet-4-5
ANTHROPIC_JUDGE_MODEL=claude-haiku-4-5
LLM_CONCURRENCY=5
```

**Demo credentials:**
- Email: `demo@searchforge.com`
- Password: `demo123`

**Without an API key:** the analyze endpoint will fail at the rewrite step. The search, cross-sell, and gap analysis endpoints all require a key. The spec checker, UOM normalization, dedup, and all tests run without one.
