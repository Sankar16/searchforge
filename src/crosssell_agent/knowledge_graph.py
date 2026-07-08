import networkx as nx
from typing import Dict, Any, List


def build_compatibility_graph() -> nx.DiGraph:
    """
    Builds a lightweight B2B compatibility graph.

    Edge meaning:
    source product/category -> recommended compatible product/category
    """

    graph = nx.DiGraph()

    relationships = [
        {
            "source_sku": "BRG-6205-2RS",
            "target_sku": "HSG-P205",
            "relationship": "fits_housing",
            "reason": "6205-series bearings are compatible with P205 pillow block housings for 25mm shaft support.",
            "confidence": 0.95,
        },
        {
            "source_sku": "BRG-6205-RUBBER",
            "target_sku": "HSG-P205",
            "relationship": "fits_housing",
            "reason": "The rubber-sealed 6205 bearing uses the same 6205-series dimensions and can be paired with a P205 housing.",
            "confidence": 0.90,
        },
        {
            "source_sku": "BRG-UC205",
            "target_sku": "HSG-P205",
            "relationship": "fits_housing",
            "reason": "UC205 insert bearings are designed for P205 pillow block housings.",
            "confidence": 0.98,
        },
        {
            "source_sku": "BRG-UC204",
            "target_sku": "HSG-P204",
            "relationship": "fits_housing",
            "reason": "UC204 insert bearings are designed for P204 pillow block housings.",
            "confidence": 0.98,
        },
        {
            "source_sku": "BRG-UC204",
            "target_sku": "HSG-FL204",
            "relationship": "fits_flange_housing",
            "reason": "UC204 insert bearings can also be mounted in FL204 two-bolt flange housings.",
            "confidence": 0.92,
        },
        {
            "source_sku": "HSG-P205",
            "target_sku": "MNT-SHAFT-25MM",
            "relationship": "requires_shaft",
            "reason": "The P205 housing supports 25mm shaft assemblies, so a 25mm steel shaft is compatible.",
            "confidence": 0.88,
        },
        {
            "source_sku": "BRG-6205-2RS",
            "target_sku": "MNT-SHAFT-25MM",
            "relationship": "fits_shaft",
            "reason": "The 6205-2RS bearing has a 25mm inner diameter, matching a 25mm shaft.",
            "confidence": 0.92,
        },
        {
            "source_sku": "MNT-MOTOR-BASE-56C",
            "target_sku": "FST-MOTOR-KIT-M8",
            "relationship": "requires_hardware",
            "reason": "The 56C motor base plate requires mounting hardware; the M8 kit includes bolts, washers, and nuts for motor mounting.",
            "confidence": 0.87,
        },
        {
            "source_sku": "MNT-MOTOR-56C-PLATE",
            "target_sku": "FST-MOTOR-KIT-M8",
            "relationship": "requires_hardware",
            "reason": "The 56C motor base plate should be installed with M8 motor mount hardware.",
            "confidence": 0.84,
        },
        {
            "source_sku": "FST-M8-40-ZN",
            "target_sku": "FST-WASHER-M8-FLAT",
            "relationship": "pairs_with",
            "reason": "M8 bolts are commonly paired with M8 flat washers to distribute clamping load.",
            "confidence": 0.90,
        },
        {
            "source_sku": "FST-M8-40-ZN",
            "target_sku": "FST-NUT-M8-ZN",
            "relationship": "pairs_with",
            "reason": "M8 bolts require matching M8 nuts when fastening through unthreaded holes.",
            "confidence": 0.90,
        },
        {
            "source_sku": "PIP-ELBOW-1-2-NPT-BRASS",
            "target_sku": "PIP-SEALANT-PTFE",
            "relationship": "requires_sealant",
            "reason": "NPT threaded brass fittings typically require PTFE thread seal tape to help prevent leaks.",
            "confidence": 0.86,
        },
        {
            "source_sku": "VAL-BALL-1-2-BRASS",
            "target_sku": "PIP-SEALANT-PTFE",
            "relationship": "requires_sealant",
            "reason": "This ball valve uses 1/2 inch NPT female connections, which commonly require PTFE thread seal tape.",
            "confidence": 0.88,
        },
        {
            "source_sku": "VAL-HALF-BRASS-BALL",
            "target_sku": "PIP-SEALANT-PTFE",
            "relationship": "requires_sealant",
            "reason": "The half-inch brass shutoff valve uses NPT-style threaded connections, so thread seal tape is recommended.",
            "confidence": 0.82,
        },
        {
            "source_sku": "VAL-SOLENOID-1-2-24V",
            "target_sku": "PIP-SEALANT-PTFE",
            "relationship": "requires_sealant",
            "reason": "The 1/2 inch NPT solenoid valve should be installed with thread seal tape to reduce leakage risk.",
            "confidence": 0.84,
        },
    ]

    for rel in relationships:
        graph.add_edge(
            rel["source_sku"],
            rel["target_sku"],
            relationship=rel["relationship"],
            reason=rel["reason"],
            confidence=rel["confidence"],
        )

    return graph


def get_graph_recommendations(graph: nx.DiGraph, sku: str) -> List[Dict[str, Any]]:
    if sku not in graph:
        return []

    recommendations = []

    for target_sku in graph.successors(sku):
        edge_data = graph.get_edge_data(sku, target_sku)

        recommendations.append(
            {
                "source_sku": sku,
                "target_sku": target_sku,
                "relationship": edge_data["relationship"],
                "reason": edge_data["reason"],
                "confidence": edge_data["confidence"],
            }
        )

    return sorted(
        recommendations,
        key=lambda item: item["confidence"],
        reverse=True,
    )