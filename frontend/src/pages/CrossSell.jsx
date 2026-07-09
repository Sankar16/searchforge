import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const DEMO_SKUS = [
  { sku: "BRG-6205-2RS", label: "SKF 6205-2RS Bearing" },
  { sku: "FST-M8-40-ZN", label: "M8x40 Zinc Hex Bolt" },
  { sku: "VAL-BALL-1-2-BRASS", label: "1/2 Brass Ball Valve" },
  { sku: "MNT-MOTOR-BASE-56C", label: "56C Motor Mount Base" },
  { sku: "PIP-ELBOW-90-1IN", label: "1 inch 90 Degree Elbow" },
];

const relationshipColors = {
  fits_housing: "bg-purple-100 text-purple-700",
  fits_shaft: "bg-indigo-100 text-indigo-700",
  requires_housing: "bg-purple-100 text-purple-700",
  compatible_shaft: "bg-indigo-100 text-indigo-700",
  requires_fastener: "bg-amber-100 text-amber-700",
  pairs_with: "bg-teal-100 text-teal-700",
  requires_sealant: "bg-pink-100 text-pink-700",
};

function relBadgeClass(rel) {
  return relationshipColors[rel] || "bg-gray-100 text-gray-600";
}

function specList(specs) {
  if (!specs || Object.keys(specs).length === 0) return "No spec data";
  return Object.entries(specs)
    .slice(0, 5)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join(" · ");
}

export default function CrossSell() {
  const [selectedSku, setSelectedSku] = useState(DEMO_SKUS[0].sku);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function getRecs() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API}/api/crosssell/${selectedSku}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cross-Sell Recommendations</h1>
        <p className="text-sm text-gray-500 mt-1">
          MCP-powered compatibility recommendations with Claude-generated explanations.
        </p>
      </div>

      <div className="flex gap-3 mb-8">
        <select
          value={selectedSku}
          onChange={(e) => setSelectedSku(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {DEMO_SKUS.map((item) => (
            <option key={item.sku} value={item.sku}>
              {item.label} ({item.sku})
            </option>
          ))}
        </select>
        <button
          onClick={getRecs}
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Fetching…
            </span>
          ) : (
            "Get Recommendations"
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Cart product */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Cart Item
            </div>
            <div className="font-bold text-lg text-gray-900">
              {data.cart_product?.name}
            </div>
            <div className="text-xs font-mono text-gray-400 mb-2">{data.cart_sku}</div>
            <div className="text-xs text-gray-500">{specList(data.cart_product?.specs)}</div>
          </div>

          {/* Recommendations */}
          {data.recommendations?.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-12 border border-dashed border-gray-200 rounded-lg">
              No cross-sell recommendations found for this product.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {data.recommendations?.map((rec, i) => (
                <div
                  key={rec.sku}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-gray-900">{rec.name}</div>
                      <div className="text-xs font-mono text-gray-400 mt-0.5">{rec.sku}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {rec.relationship && (
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${relBadgeClass(rec.relationship)}`}
                        >
                          {rec.relationship.replace(/_/g, " ")}
                        </span>
                      )}
                      {rec.confidence != null && (
                        <span className="text-xs text-gray-500 font-medium">
                          {Math.round(rec.confidence * 100)}% confidence
                        </span>
                      )}
                      {rec.price != null && (
                        <span className="text-sm font-semibold text-gray-800">
                          ${rec.price}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* LLM explanation */}
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
                    <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                      ✦ Claude Explanation
                    </div>
                    <p className="text-sm text-blue-900 leading-relaxed">
                      {rec.llm_explanation}
                    </p>
                  </div>

                  {/* Original graph reason */}
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      Graph Reason
                    </div>
                    <p className="text-xs text-gray-600">{rec.original_reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">🔗</div>
          <div className="text-lg font-medium">Select a cart item and click Get Recommendations</div>
        </div>
      )}
    </div>
  );
}
