import { useState } from "react";
import ProductCard from "../components/ProductCard.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function SearchComparison() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [messyRes, cleanRes] = await Promise.all([
        fetch(`${API}/api/search?q=${encodeURIComponent(query)}&mode=messy`),
        fetch(`${API}/api/search?q=${encodeURIComponent(query)}&mode=clean`),
      ]);
      if (!messyRes.ok || !cleanRes.ok) throw new Error("Search request failed");
      const [messy, clean] = await Promise.all([messyRes.json(), cleanRes.json()]);
      setResults({ messy: messy.results, clean: clean.results });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const messySkus = new Set(results?.messy?.map((p) => p.sku) || []);
  const cleanSkus = new Set(results?.clean?.map((p) => p.sku) || []);

  const exampleQueries = [
    "25mm sealed bearing",
    "bolt for motor mount",
    "half inch brass valve",
    "pillow block for 6205 bearing",
    "thread sealant for pipe fitting",
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Search Comparison</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compare search results between the messy and cleaned catalog.
        </p>
      </div>

      <form onSubmit={runSearch} className="flex gap-3 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mb-6">
        {exampleQueries.map((q) => (
          <button
            key={q}
            onClick={() => setQuery(q)}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-full transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Messy column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">Messy Catalog</span>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {results.messy.length} results
              </span>
            </div>
            {results.messy.length === 0 ? (
              <div className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">
                No results found
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {results.messy.map((p) => (
                  <ProductCard key={p.sku} product={p} isNew={false} />
                ))}
              </div>
            )}
          </div>

          {/* Clean column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">Clean Catalog</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {results.clean.length} results
              </span>
            </div>
            {results.clean.length === 0 ? (
              <div className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">
                No results found
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {results.clean.map((p) => (
                  <ProductCard
                    key={p.sku}
                    product={p}
                    isNew={!messySkus.has(p.sku)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!results && !loading && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">🔎</div>
          <div className="text-lg font-medium">Enter a query to compare results</div>
          <div className="text-sm mt-1">Try one of the example queries above</div>
        </div>
      )}
    </div>
  );
}
