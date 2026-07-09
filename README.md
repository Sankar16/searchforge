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
- Repair loop re-prompts on failed evaluations (max 1 pass)
- Per-row approve / edit / reject UI with apply + CSV export

### 🔍 Search Preview
- Semantic search using ChromaDB + all-MiniLM-L6-v2
- Side-by-side toggle: original vs optimized catalog
- Match quality labels (Strong match / Good match / Related / Partial)
- **Search Gap Detector**: when optimized catalog returns zero results,
  Claude Haiku analyzes why and suggests which product descriptions
  need which keywords — turns a failure state into a merchandising insight

### 🛒 Smart Recommendations
- Compatibility knowledge graph (NetworkX) with 15 product relationships
- MCP-powered data access: cross-sell agent calls catalog tools via
  Model Context Protocol instead of direct imports
- Claude Haiku generates spec-grounded explanations for why products
  pair together (not correlation — reasoning)
- Save pairings to session, export as CSV for merchandising platform

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
        │    → Claude Haiku: gap summary, hidden matches, keyword suggestions
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
             + Claude Haiku  (spec-grounded explanation)

Data layer
──────────
data/catalog_messy.json    ← source / uploaded CSV
data/catalog_clean.json    ← pipeline output
data/catalog_final.json    ← merchandiser-approved
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
| Tool protocol | MCP via FastMCP (stdio transport) |
| Vector search | ChromaDB + all-MiniLM-L6-v2 |
| Compatibility graph | NetworkX DiGraph |
| Fuzzy dedup | rapidfuzz (threshold 88) |
| Tests | pytest — 47 tests across UOM, dedup, spec checker, knowledge graph |

---

## Results on the 74-product demo catalog

```
Spec issues before UOM normalization:  41
Spec issues after UOM normalization:   33
Weak descriptions before rewrite:      22
Weak descriptions after rewrite:        0
Descriptions passing judge:            21 / 22
Average judge score:                    8.09 / 10
Duplicate pairs detected:               6
```

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
# Run tests
source venv/bin/activate  # activate venv first
python -m pytest tests/ -v
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required for analyze, cross-sell, and gap analysis |
| `ANTHROPIC_REWRITE_MODEL` | `claude-sonnet-4-5` | Model used for description rewrites |
| `ANTHROPIC_JUDGE_MODEL` | `claude-haiku-4-5` | Model used for LLM-as-judge evaluation |
| `LLM_CONCURRENCY` | `5` | Max parallel LLM calls during rewrite batch |

> **Without an API key:** spec checking, UOM normalization, dedup, and all tests run fine. The analyze, cross-sell, and gap analysis endpoints require a key.

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
│       ├── knowledge_graph.py    # NetworkX compatibility graph
│       ├── recommender.py
│       └── llm_agent.py          # Claude Haiku explanation generator
├── frontend/
│   └── src/pages/
│       ├── CatalogHealth.jsx
│       ├── SearchComparison.jsx
│       └── CrossSell.jsx
├── data/
│   └── catalog_messy.json        # 74-product demo catalog
├── tests/                        # 47 pytest tests
└── DESIGN.md                     # Architecture deep-dive
```

---

## Design Decisions

**Why LangGraph?** The pipeline has two conditional branches — skip rewrite when no weak descriptions exist, and run a repair loop when the judge flags failures. LangGraph's `StateGraph` makes these branches explicit and auditable without manual state plumbing.

**Why MCP for cross-sell?** The cross-sell agent accesses catalog data via Model Context Protocol rather than direct Python imports. This decouples the agent from the data retrieval implementation — if catalog data later moved to a database or separate service, the agent code wouldn't change.

**Why two ChromaDB indexes?** Both `catalog_messy` and `catalog_clean` are built at startup and kept in memory. The Search Preview page queries both simultaneously and renders a side-by-side comparison in a single request, making the before/after difference immediately visible.

**Why Haiku for gap analysis and cross-sell, Sonnet for rewrites?** Rewrites are stored permanently in the catalog — quality matters. Gap analysis and cross-sell explanations are ephemeral, grounded-generation tasks where speed and cost matter more than output quality ceiling.

See [DESIGN.md](DESIGN.md) for the full architecture deep-dive, including what's production-ready vs demo-only, known limitations, and what a production system would need.
