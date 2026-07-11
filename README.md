# SearchForge

> AI-powered B2B catalog intelligence — automatically fix product data
> issues, improve search relevance, and increase order value with
> reasoning-based cross-sell recommendations.

---

## What It Does

Industrial B2B distributors lose revenue when messy product catalogs cause customers to search for products that exist but can't be found. SearchForge runs an AI pipeline over your catalog CSV to fix spec gaps, rewrite vague descriptions, and surface duplicate listings — then gives merchandisers a review UI to approve every change before it ships. The same cleaned catalog powers semantic search and spec-grounded cross-sell recommendations, so improvements to the data immediately improve what customers find and buy.

---

## Features

### 🗂 Catalog Optimizer
- Detects duplicate listings using embedding similarity
- Identifies missing required specs per product category
- Rewrites vague descriptions using Claude with spec-grounded prompts
- LLM-as-judge scores every rewrite for hallucination risk
- Repair loop re-prompts on failed evaluations (max 1 pass); 🔄 badge marks repaired descriptions
- Per-row approve / edit / reject UI with apply + CSV export
- Pydantic AI typed schemas enforce structured LLM outputs — no silent JSON parsing failures
- Double-click protection prevents duplicate analysis jobs
- Four-dimension judge scoring (accuracy, searchability, specificity, clarity) with per-dimension feedback passed into the repair prompt
- Explicit hallucination/inference taxonomy: definitional inferences from product name are scored separately from invented technical specs
- LLM-based spec inference (`GET /api/catalog/spec-requirements`) — Claude Haiku determines expected specs for any product category

### 🔍 Search Preview
- Semantic search using ChromaDB + all-MiniLM-L6-v2
- Side-by-side toggle: original vs optimized catalog
- Match quality labels (Strong match / Good match / Related / Partial)
- **Search Gap Detector**: when optimized catalog returns zero results,
  Claude Haiku analyzes why and suggests which product descriptions
  need which keywords — turns a failure state into a merchandising insight
- Analytics tracking on every search query (query, mode, result count, top match score)

### 🛒 Smart Recommendations
- Compatibility knowledge graph (NetworkX) with 15 product relationships
- MCP-powered data access: cross-sell agent calls catalog tools via
  Model Context Protocol instead of direct imports
- Claude Haiku generates spec-grounded explanations for why products
  pair together (not correlation — reasoning)
- Relationship badges mapped to actual graph edge types (Fits This Housing, Works With, Commonly Paired, Recommended Add-on)
- Save pairings to session, export as CSV for merchandising platform
- Dynamic knowledge graph generation — LLM validates candidate pairs at pipeline end, writes `generated_graph.json`; falls back to hardcoded graph
- Hybrid candidate generation — rule-based (spec matching + category pairs) + embedding-based (semantic similarity); works for any product domain without per-domain configuration

### 📊 Analytics Dashboard
- Real-time search performance metrics (auto-refreshes every 10s)
- Zero-result rate tracking — surfaces queries where customers find nothing; turns red above 20%
- Top 10 searched queries with hit counts
- Recent gap analyses showing hidden match counts
- Catalog activity: analyses run, descriptions approved, approval rate on rewrites
- Session-scoped — resets on server restart; production would persist to Postgres/Redis

---

## Architecture

```
Browser (React 18 + Vite)
        │
        │  fetch()
        ▼
FastAPI Backend  (api/main.py · port 8000)
        │
        ├─── POST /api/catalog/analyze
        │         │
        │         ▼
        │    LangGraph Catalog Agent  (13 nodes)
        │    load → spec check → UOM normalize → spec recheck
        │    → description check
        │         ├─[weak descriptions found]──▶ rewrite (Claude Sonnet)
        │         │                              → judge (Claude Haiku)
        │         │                              → [failures] repair → re-judge
        │         └─[none]──────────────────────▶ skip rewrite
        │    → dedup (rapidfuzz) → report → save catalog_clean.json
        │
        ├─── GET  /api/search?q=…&mode=clean|messy
        │         │
        │         ▼
        │    ChromaDB  (in-memory, all-MiniLM-L6-v2)
        │    Two indexes built at startup: catalog_messy + catalog_clean
        │    Score = (1 − distance/2) × 100  →  match labels
        │
        ├─── POST /api/search/gap-analysis
        │         │
        │         ▼
        │    Low-threshold search (min_score=15) across both indexes
        │    → Claude Haiku (Pydantic AI): GapAnalysis structured output
        │
        ├─── GET  /api/analytics
        │         → in-memory store: searches, gap analyses, catalog metrics
        │
        ├─── GET  /api/catalog/status/{job_id}
        │         → async job polling (analyze runs in background thread)
        │
        └─── GET  /api/crosssell/{sku}
                  │
                  ▼
             CatalogMCPClient  (spawns subprocess)
                  │  stdio transport
                  ▼
             MCP Catalog Server  (FastMCP)
             Tools: search_products · get_product
                    get_compatibility · get_catalog_health
                  │
                  ▼
             NetworkX DiGraph  (15 compatibility edges)
             + Claude Haiku (Pydantic AI): CrossSellExplanation structured output

Data layer
──────────
data/catalog_messy.json      ← source / uploaded CSV
data/catalog_clean.json      ← pipeline output
data/generated_graph.json    ← dynamic compatibility graph (regenerated each run)

LangSmith (optional tracing)
─────────────────────────────
Set LANGCHAIN_API_KEY + LANGCHAIN_TRACING_V2=true to trace every
LangGraph node automatically — inputs, outputs, latency, token usage.
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite, Tailwind CSS (CDN) |
| Routing / state | React Router v6, React Context |
| Backend | FastAPI + Pydantic |
| Agent orchestration | LangGraph `StateGraph` |
| LLM — rewrite / judge | Claude Sonnet 4.5 |
| LLM — cross-sell / gap | Claude Haiku 4.5 |
| Structured outputs | Pydantic AI 2.7+ |
| LLM tracing | LangSmith (optional) |
| Retry logic | Custom exponential backoff (`claude_retry.py`) |
| Tool protocol | MCP via FastMCP (stdio transport) |
| Vector search | ChromaDB + all-MiniLM-L6-v2 |
| Compatibility graph | NetworkX DiGraph |
| Fuzzy dedup | rapidfuzz (threshold 88) |
| Tests | pytest — 73 tests across UOM, dedup, spec checker, knowledge graph, graph generator, semantic retriever, completeness, MCP tools |

---

## Results

### Industrial B2B — 74-product demo catalog

```
Spec issues before UOM normalization:  41
Spec issues after UOM normalization:   33
Weak descriptions identified:          22
Weak descriptions after rewrite:        0
Descriptions passing judge:            21 / 22
Average composite judge score:          8.1 / 10
Duplicate pairs detected:               6
Repair loop triggered on:               1 description
```

### Multi-domain generalization

| Domain | Notes |
|--------|-------|
| Electronics | Spec checker skips unknown product types (no noise issues). ChromaDB dedup required for SKU variant catalogs. Graph candidates via hardcoded electronics pairs + embeddings. |
| Apparel | No spec data — rewriter infers from name/category. Repair rate dropped from ~25% to ~10% after lowering pass threshold and adding hallucination/inference taxonomy. Cross-sell pairs found via embedding similarity (no apparel category rules needed). |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Sankar16/searchforge.git
cd searchforge

# 2. Python dependencies
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 3. Environment variables  (.env in project root)
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# 4. Start backend  (Terminal 1)
uvicorn api.main:app --reload --port 8000

# 5. Start frontend  (Terminal 2)
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

**Demo credentials:** `demo@searchforge.com` / `demo123`

```bash
# Run tests  (73 tests)
source venv/bin/activate  # activate venv first
python -m pytest tests/ -v
# Slow tests (semantic retriever — loads ML model) are marked @pytest.mark.slow
# and run by default; skip them with: python -m pytest tests/ -v -m "not slow"
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required for analyze, cross-sell, and gap analysis |
| `ANTHROPIC_REWRITE_MODEL` | `claude-haiku-4-5-20251001` | Model used for description rewrites |
| `ANTHROPIC_JUDGE_MODEL` | `claude-sonnet-4-6` | Model used for LLM-as-judge evaluation |
| `LLM_CONCURRENCY` | `5` | Max parallel LLM calls during rewrite batch |
| `LANGCHAIN_API_KEY` | — | Optional — enables LangSmith tracing |
| `LANGCHAIN_TRACING_V2` | — | Set to `true` to activate tracing |
| `LANGCHAIN_PROJECT` | — | LangSmith project name (e.g. `searchforge`) |

> **Without an API key:** spec checking, UOM normalization, dedup, and all tests run fine. The analyze, cross-sell, and gap analysis endpoints require a key.
>
> **LangSmith is optional.** The app works without it. Set `LANGCHAIN_API_KEY` to enable full pipeline observability — every LangGraph node's inputs, outputs, latency, and token usage.

---

## Project Structure

```
searchforge/
├── api/
│   └── main.py                   # FastAPI endpoints
├── src/
│   ├── catalog_agent/
│   │   ├── graph.py              # LangGraph pipeline (13 nodes)
│   │   ├── spec_checker.py
│   │   ├── uom.py
│   │   ├── description_quality.py
│   │   ├── llm_description_rewriter.py
│   │   ├── llm_evaluator.py
│   │   ├── dedup.py
│   │   └── report.py
│   ├── mcp_server/
│   │   ├── catalog_server.py     # FastMCP tool server
│   │   └── catalog_client.py     # Subprocess client
│   ├── search/
│   │   ├── semantic_retriever.py # ChromaDB + sentence-transformers
│   │   └── retriever.py          # Keyword fallback
│   └── crosssell_agent/
│       ├── knowledge_graph.py    # NetworkX hardcoded compatibility graph
│       ├── graph_generator.py    # Dynamic graph generation via LLM
│       ├── recommender.py
│       └── llm_agent.py          # Claude Haiku explanation generator
├── frontend/
│   └── src/pages/
│       ├── CatalogHealth.jsx
│       ├── SearchComparison.jsx
│       ├── CrossSell.jsx
│       └── Analytics.jsx
├── data/
│   └── catalog_messy.json        # 74-product demo catalog
├── tests/                        # 73 pytest tests
└── DESIGN.md                     # Architecture deep-dive
```

---

## Demo Walkthrough

1. **Catalog Optimizer** → upload a CSV or click "Use demo catalog" → Analyze → review the description rewrites (look for the 🔄 badge on repaired descriptions) → Apply Changes
2. **Search Preview** → search for `sealed bearing 25mm` before and after — see the optimized catalog surface results the messy one misses; try a zero-result query to trigger the gap detector
3. **Smart Recommendations** → enter a SKU like `BRG-6205-2RS` → see compatibility graph results with Claude-generated explanations
4. **Analytics** → see real-time search metrics, zero-result rate, and top queries auto-refreshing every 10s

---

## Known Limitations

- Analytics are session-scoped — reset when the server restarts
- LangSmith tracing requires `LANGCHAIN_API_KEY` in `.env` to activate
- MCP client spawns a subprocess per cross-sell request (~200ms overhead)
- The repair loop runs exactly once; a description that still fails after repair proceeds as-is
- No catalog sync from live sources (ERP, PIM) — CSV upload only
- Spec checker only knows industrial B2B product types — electronics and apparel products are classified as "unknown" and skip spec validation; use `GET /api/catalog/spec-requirements` to infer requirements for unconfigured categories
- Knowledge graph generation costs 1 LLM call per candidate pair (up to 60); a large catalog with many category matches will take proportionally longer and use more tokens
- Embedding-based graph candidates reuse the sentence-transformer model from `semantic_retriever.py`; if semantic search has not been used in the session the model loads cold (~2s on first call)

---

## Design Decisions

**Why LangGraph?** The pipeline has two conditional branches — skip rewrite when no weak descriptions exist, and run a repair loop when the judge flags failures. LangGraph's `StateGraph` makes these branches explicit and auditable without manual state plumbing.

**Why MCP for cross-sell?** The cross-sell agent accesses catalog data via Model Context Protocol rather than direct Python imports. This decouples the agent from the data retrieval implementation — if catalog data later moved to a database or separate service, the agent code wouldn't change.

**Why two ChromaDB indexes?** Both `catalog_messy` and `catalog_clean` are built at startup and kept in memory. The Search Preview page queries both simultaneously and renders a side-by-side comparison in a single request, making the before/after difference immediately visible.

**Why Haiku for gap analysis and cross-sell, Sonnet for rewrites?** Rewrites are stored permanently in the catalog — quality matters. Gap analysis and cross-sell explanations are ephemeral, grounded-generation tasks where speed and cost matter more than output quality ceiling.

**Why Pydantic AI instead of raw Anthropic client calls?** Manual JSON parsing — fence stripping, `json.loads()`, defensive field extraction — was spread across four files and was the most likely place for silent failures. Pydantic AI moves schema enforcement to the framework level: the agent validates against a typed model before returning, and schema violations are explicit errors rather than silently malformed data.

**Why in-memory analytics?** Zero operational overhead for a demo. The store is a plain dict reset on restart — sufficient for a single session. Production would use Postgres for query logs and Redis for real-time counters.

See [DESIGN.md](DESIGN.md) for the full architecture deep-dive, including what's production-ready vs demo-only, known limitations, and what a production system would need.
