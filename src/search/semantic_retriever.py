import json
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

PROJECT_ROOT = Path(__file__).resolve().parents[2]

encoder = SentenceTransformer("all-MiniLM-L6-v2")
chroma_client = chromadb.Client()

# Module-level index cache
_indexes: dict = {}


def build_semantic_index(catalog: list[dict], collection_name: str):
    """Build a ChromaDB collection from a product catalog."""
    try:
        chroma_client.delete_collection(collection_name)
    except Exception:
        pass

    collection = chroma_client.create_collection(collection_name)

    ids, embeddings, metadatas, documents = [], [], [], []

    for product in catalog:
        text_parts = [
            product.get("name", ""),
            product.get("description", ""),
            product.get("category", ""),
        ]

        specs = product.get("specs", {})
        if isinstance(specs, dict):
            text_parts.append(" ".join(f"{k} {v}" for k, v in specs.items()))

        search_terms = product.get("search_terms", [])
        if search_terms:
            text_parts.extend(search_terms)

        full_text = " ".join(filter(None, text_parts))

        ids.append(product["sku"])
        embeddings.append(encoder.encode(full_text).tolist())
        documents.append(full_text)
        metadatas.append({
            "sku": product.get("sku", ""),
            "name": product.get("name", ""),
            "category": product.get("category", ""),
            "description": product.get("description", ""),
            "price": str(product.get("price") or ""),
            "brand": str(product.get("brand") or ""),
        })

    collection.add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
    return collection


def semantic_search(collection, query: str, top_k: int = 5, min_score: float = 35) -> list[dict]:
    """Search using semantic similarity. min_score filters out low-relevance results."""
    query_embedding = encoder.encode(query).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
    )

    products = []
    for i, metadata in enumerate(results["metadatas"][0]):
        distance = results["distances"][0][i]
        # ChromaDB cosine distance is 0-2, so normalise to 0-100
        score = round((1 - (distance / 2)) * 100, 1)

        if score < min_score:
            continue

        if score >= 80:
            match_label = "Strong match"
        elif score >= 65:
            match_label = "Good match"
        elif score >= 50:
            match_label = "Related"
        elif score >= 35:
            match_label = "Partial match"
        else:
            match_label = "Weak match"

        products.append({**metadata, "score": score, "match_label": match_label, "match_type": "semantic"})

    return products


def get_or_build_index(mode: str):
    """Return cached index or build it from disk."""
    if mode in _indexes:
        return _indexes[mode]

    if mode == "clean":
        path = PROJECT_ROOT / "data" / "catalog_clean.json"
    elif mode == "final":
        path = PROJECT_ROOT / "data" / "catalog_final.json"
    else:
        path = PROJECT_ROOT / "data" / "catalog_messy.json"

    if not path.exists():
        path = PROJECT_ROOT / "data" / "catalog_messy.json"

    with open(path) as f:
        catalog = json.load(f)

    collection = build_semantic_index(catalog, f"catalog_{mode}")
    _indexes[mode] = collection
    return collection
