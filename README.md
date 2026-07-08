SearchForge — B2B Search Quality Platform

SearchForge is a B2B eCommerce search quality platform that improves messy industrial product catalogs and generates spec-aware cross-sell recommendations.

The project demonstrates how catalog intelligence, search quality improvement, and reasoning-based recommendations can work together to improve product discoverability and buyer experience in B2B commerce.

⸻

Problem

B2B product catalogs often contain messy and incomplete data:

* Missing technical specifications
* Inconsistent units of measurement
* Weak or generic product descriptions
* Duplicate or near-duplicate SKUs
* Poor search relevance
* Cross-sell recommendations that do not explain compatibility

For industrial products, search quality depends heavily on structured specifications such as size, thread type, material, pressure rating, voltage, shaft diameter, and compatible bearing series.

SearchForge solves this by cleaning the catalog first, then using the improved product data for better search and recommendation experiences.

⸻

Project Overview

SearchForge has three main layers:

1. Catalog Intelligence Agent
2. Search Quality Layer
3. Cross-Sell Reasoning Agent

1. Catalog Intelligence Agent

The Catalog Intelligence Agent analyzes and improves product catalog quality.

Current capabilities:

* Detects missing required specifications
* Normalizes units of measurement
* Detects weak product descriptions
* Rewrites weak descriptions using structured product data
* Detects possible duplicate products
* Generates a cleaned catalog
* Produces a catalog health report

2. Search Quality Layer

The Search Quality Layer compares search results between the messy catalog and the cleaned catalog.

It shows how better catalog data improves search visibility and relevance.

Current capabilities:

* Weighted keyword search
* Field-level scoring
* Messy vs clean catalog comparison
* Search result ranking based on product name, category, specs, description, and search terms

3. Cross-Sell Reasoning Agent

The Cross-Sell Reasoning Agent recommends compatible products based on industrial product relationships.

Unlike simple “customers also bought” recommendations, this agent explains why a product is compatible.

Current capabilities:

* Compatibility graph
* Cart-based recommendations
* Relationship types
* Confidence scores
* Human-readable reasoning

Example:

Cart Item: 6205-2RS Sealed Ball Bearing
Recommended Product: P205 Pillow Block Housing
Reason:
6205-series bearings are compatible with P205 pillow block housings for 25mm shaft support.

⸻

Demo Features

The Streamlit app includes three tabs:

Catalog Health

Shows catalog quality metrics:

* Total products
* Missing spec issues
* UOM-related fixes
* Weak description fixes
* Possible duplicate pairs
* Sample rewritten descriptions

Search Comparison

Compares search results before and after catalog cleaning.

Example queries:

25mm sealed bearing
bolt for motor mount
half inch brass valve
pillow block for 6205 bearing
thread sealant for pipe fitting

Cart + Cross-Sell

Shows spec-aware product recommendations for selected cart items.

Example:

Cart Item: FST-M8-40-ZN
Recommendations:
- M8 Flat Washer Zinc
- M8 Zinc Hex Nut

⸻

Current Results

Catalog Intelligence output:

Total products: 74
Spec issues before UOM normalization: 41
Spec issues after UOM normalization: 33
UOM-related issues fixed: 8
Weak descriptions before rewrite: 22
Weak descriptions after rewrite: 0
Possible duplicate pairs: 6

Duplicate detection was tuned from a noisy first version to a cleaner candidate set:

173 possible duplicate pairs → 9 → 6

Example duplicate candidates:

BRG-6303-OPEN ↔ BRG-6303-NO-SPEC
FST-M8-40-ZN ↔ FST-M8-40-HEXAGON
FST-M8-40-ZN ↔ FST-HEX-M8X40
VAL-BUTTERFLY-4IN ↔ VAL-BUTTERFLY-LUG
FST-MOTOR-KIT-M8 ↔ FST-MOTOR-BOLT-KIT

⸻

Tech Stack

* Python
* Pydantic
* RapidFuzz
* NetworkX
* Streamlit
* JSON-based mock catalog
* Rule-based catalog validation
* Weighted keyword search
* Graph-based recommendation logic

Planned upgrades:

* LangGraph workflow orchestration
* LLM-based product type fallback
* LLM-based natural description rewriting
* Vector search with embeddings
* ChromaDB or similar vector database
* More advanced cross-sell reasoning
* Human review workflow for duplicate candidates

⸻

Project Structure

searchforge/
├── data/
│   ├── catalog_messy.json
│   └── catalog_clean.json
│
├── src/
│   ├── schemas.py
│   │
│   ├── catalog_agent/
│   │   ├── spec_checker.py
│   │   ├── uom.py
│   │   ├── description_quality.py
│   │   ├── description_rewriter.py
│   │   ├── dedup.py
│   │   └── report.py
│   │
│   ├── search/
│   │   └── retriever.py
│   │
│   └── crosssell_agent/
│       ├── knowledge_graph.py
│       └── recommender.py
│
├── app.py
├── run_catalog_check.py
├── run_search_comparison.py
├── run_dedup_check.py
├── run_crosssell_demo.py
├── requirements.txt
└── README.md

⸻

How to Run

1. Clone the repository

git clone https://github.com/Sankar16/searchforge.git
cd searchforge

2. Create a virtual environment

python -m venv venv
source venv/bin/activate

3. Install dependencies

python -m pip install -r requirements.txt

4. Run the Streamlit app

python -m streamlit run app.py

The app will open in your browser at:

http://localhost:8501

⸻

Run Individual Scripts

Catalog health check

python run_catalog_check.py

Search comparison

python run_search_comparison.py

Duplicate detection

python run_dedup_check.py

Cross-sell reasoning demo

python run_crosssell_demo.py

⸻

Why This Project Matters

B2B search is different from normal eCommerce search.

In consumer eCommerce, a buyer may search for broad terms like:

running shoes
black backpack
wireless headphones

In B2B commerce, buyers often search using technical details:

6205 sealed bearing
1/2 inch NPT brass ball valve
M8 x 40mm zinc hex bolt
P205 pillow block housing
24V solenoid valve

If specs are missing, inconsistent, or poorly written, the right products may not appear in search results.

SearchForge shows how better catalog intelligence can improve:

* Search relevance
* Product discoverability
* Buyer confidence
* Cross-sell quality
* Catalog operations
* Data quality workflows

⸻

Agentic AI Design

The current version uses modular Python tools that perform specific catalog intelligence tasks.

Current flow:

Load catalog
↓
Check missing specs
↓
Normalize units
↓
Check description quality
↓
Rewrite weak descriptions
↓
Detect duplicates
↓
Generate health report
↓
Save clean catalog

This is the foundation for an agentic workflow.

The next planned upgrade is to convert this pipeline into a LangGraph-based agent where each step becomes a graph node and the workflow state is managed centrally.

Planned LangGraph flow:

START
↓
load_catalog
↓
check_specs_before
↓
normalize_uom
↓
check_specs_after
↓
check_descriptions
↓
rewrite_weak_descriptions
↓
detect_duplicates
↓
generate_health_report
↓
save_clean_catalog
↓
END

This will allow the agent to make conditional decisions such as:

If weak descriptions are found → rewrite them
If no weak descriptions are found → skip rewriting
If duplicate candidates are found → generate duplicate review report
If product type is unknown → use LLM fallback classification

⸻

Key Design Principle

SearchForge follows a hybrid AI design:

Rules handle deterministic catalog checks.
LLMs handle fuzzy language and reasoning tasks.
Agents orchestrate the workflow.

This makes the system practical for B2B use cases where technical accuracy matters.

⸻

Future Improvements

Planned improvements include:

* LangGraph orchestration for the Catalog Intelligence Agent
* LLM-based product type classification
* LLM-based natural product description rewriting
* Embedding-based semantic search
* Vector database integration
* More detailed compatibility reasoning
* SKU merge suggestions for duplicate products
* Admin review workflow
* Exportable catalog quality reports
* Larger industrial product catalog
* Evaluation metrics for search improvement

⸻

Status

Current status: Demo-ready V1

Completed:

* Catalog health report
* Missing spec detection
* UOM normalization
* Weak description detection
* Description rewriting
* Duplicate detection
* Clean catalog generation
* Weighted search comparison
* Cross-sell compatibility graph
* Streamlit demo UI

Next milestone:

Upgrade Catalog Intelligence Agent to LangGraph workflow