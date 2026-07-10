import os
import json
import asyncio
from pathlib import Path

import networkx as nx
from pydantic import BaseModel, Field
from pydantic_ai import Agent

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class CompatibilityResult(BaseModel):
    are_compatible: bool
    relationship_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str


class GraphGenerationResult(BaseModel):
    edges: list[dict]
    total_candidates: int
    total_edges: int


COMPATIBLE_CATEGORY_PAIRS = [
    # Industrial
    ("bearings", "housings"),
    ("bearings", "mounts"),
    ("bearings", "fasteners"),
    ("pipe fittings", "valves"),
    ("pipe fittings", "pipe fittings"),
    ("fasteners", "fasteners"),
    ("mounts", "fasteners"),
    ("electrical", "mounts"),
    ("electrical", "cables"),
    ("electrical", "adapters"),
    # Electronics
    ("laptops", "chargers"),
    ("laptops", "adapters"),
    ("laptops", "cables"),
    ("laptops", "docking stations"),
    ("laptops", "mice"),
    ("laptops", "keyboards"),
    ("monitors", "cables"),
    ("monitors", "adapters"),
    ("monitors", "stands"),
    ("keyboards", "mice"),
    ("networking", "networking"),
    ("networking", "cables"),
    ("storage", "cables"),
    ("adapters", "cables"),
    ("headsets", "adapters"),
]

MATCHING_SPEC_PAIRS = [
    ("inner_diameter_mm", "diameter_mm"),
    ("bore", "diameter_mm"),
    ("inner_diameter_mm", "shaft_diameter_mm"),
    ("bore_diameter_mm", "diameter_mm"),
    ("diameter_mm", "diameter_mm"),
]

_compatibility_agent = None


def _get_compatibility_agent() -> Agent:
    global _compatibility_agent
    if _compatibility_agent is None:
        _compatibility_agent = Agent(
            "anthropic:claude-haiku-4-5-20251001",
            output_type=CompatibilityResult,
            system_prompt=(
                "You are a B2B industrial product expert. Given two industrial products, "
                "determine if they are technically compatible (e.g., a bearing fits a housing, "
                "a bolt fits a mount, a valve connects to a fitting). "
                "Only say are_compatible=True if there is a clear technical reason based on the specs. "
                "relationship_type should be one of: 'fits_into', 'mounts_on', 'connects_to', 'pairs_with', "
                "'compatible_charger', 'compatible_cable', 'pairs_with_peripheral', 'requires_adapter', 'compatible_accessory'. "
                "confidence should reflect how certain you are (0.0-1.0). "
                "Keep reason to one short sentence."
            ),
        )
    return _compatibility_agent


def find_candidate_pairs(catalog: list[dict]) -> list[tuple[dict, dict]]:
    candidates: list[tuple[dict, dict]] = []
    seen: set[tuple[str, str]] = set()

    for i, prod_a in enumerate(catalog):
        for j, prod_b in enumerate(catalog):
            if i >= j:
                continue
            key = (prod_a.get("sku", ""), prod_b.get("sku", ""))
            if key in seen:
                continue

            specs_a = prod_a.get("specs", {})
            specs_b = prod_b.get("specs", {})
            added = False

            for spec_a_key, spec_b_key in MATCHING_SPEC_PAIRS:
                if spec_a_key in specs_a and spec_b_key in specs_b:
                    try:
                        if abs(float(specs_a[spec_a_key]) - float(specs_b[spec_b_key])) < 0.5:
                            candidates.append((prod_a, prod_b))
                            seen.add(key)
                            added = True
                            break
                    except (TypeError, ValueError):
                        pass
            if added:
                continue

            cat_a = prod_a.get("category", "").lower()
            cat_b = prod_b.get("category", "").lower()
            for cat1, cat2 in COMPATIBLE_CATEGORY_PAIRS:
                if (cat1 in cat_a and cat2 in cat_b) or (cat2 in cat_a and cat1 in cat_b):
                    candidates.append((prod_a, prod_b))
                    seen.add(key)
                    break

    return candidates[:60]


async def _validate_pair_with_llm(
    prod_a: dict, prod_b: dict, semaphore: asyncio.Semaphore
) -> dict | None:
    prompt = (
        f"Product A:\n{json.dumps({'sku': prod_a.get('sku'), 'name': prod_a.get('name'), 'category': prod_a.get('category'), 'specs': prod_a.get('specs', {})}, indent=2)}\n\n"
        f"Product B:\n{json.dumps({'sku': prod_b.get('sku'), 'name': prod_b.get('name'), 'category': prod_b.get('category'), 'specs': prod_b.get('specs', {})}, indent=2)}\n\n"
        "Are these two products technically compatible? Can one be used together with the other?"
    )
    async with semaphore:
        try:
            result = await _get_compatibility_agent().run(prompt)
            r = result.output
            if not r.are_compatible or r.confidence < 0.6:
                return None
            return {
                "source": prod_a["sku"],
                "target": prod_b["sku"],
                "source_name": prod_a.get("name", ""),
                "target_name": prod_b.get("name", ""),
                "relationship": r.relationship_type,
                "confidence": round(r.confidence, 2),
                "reason": r.reason,
            }
        except Exception:
            return None


async def generate_knowledge_graph(catalog: list[dict]) -> GraphGenerationResult:
    if not os.getenv("ANTHROPIC_API_KEY"):
        return GraphGenerationResult(edges=[], total_candidates=0, total_edges=0)

    candidates = find_candidate_pairs(catalog)
    semaphore = asyncio.Semaphore(8)

    tasks = [_validate_pair_with_llm(a, b, semaphore) for a, b in candidates]
    results = await asyncio.gather(*tasks)

    edges = [r for r in results if r is not None]
    return GraphGenerationResult(
        edges=edges,
        total_candidates=len(candidates),
        total_edges=len(edges),
    )


def build_graph_from_edges(edges: list[dict]) -> nx.DiGraph:
    G = nx.DiGraph()
    for edge in edges:
        G.add_edge(
            edge["source"],
            edge["target"],
            **{k: edge[k] for k in ("relationship", "confidence", "reason", "source_name", "target_name") if k in edge},
        )
    return G


def get_compatibility_graph() -> nx.DiGraph:
    generated_path = PROJECT_ROOT / "data" / "generated_graph.json"
    if generated_path.exists():
        with open(generated_path) as f:
            edges = json.load(f)
        return build_graph_from_edges(edges)
    from src.crosssell_agent.knowledge_graph import build_compatibility_graph
    return build_compatibility_graph()
