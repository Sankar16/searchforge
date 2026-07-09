import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DEMO_SKUS = [
  { sku: 'BRG-6205-2RS',      label: 'SKF 6205-2RS Bearing' },
  { sku: 'FST-M8-40-ZN',      label: 'M8x40 Zinc Hex Bolt' },
  { sku: 'VAL-BALL-1-2-BRASS', label: '1/2 Brass Ball Valve' },
  { sku: 'MNT-MOTOR-BASE-56C', label: '56C Motor Mount Base' },
  { sku: 'PIP-ELBOW-90-1IN',  label: '1 inch 90 Degree Elbow' },
]

const REL_MAP = {
  requires_housing:  { label: 'Required Component', style: { background: '#FEE2E2', color: '#DC2626' } },
  fits_housing:      { label: 'Required Component', style: { background: '#FEE2E2', color: '#DC2626' } },
  compatible_shaft:  { label: 'Works With',         style: { background: '#DBEAFE', color: '#2563EB' } },
  fits_shaft:        { label: 'Works With',         style: { background: '#DBEAFE', color: '#2563EB' } },
  pairs_with:        { label: 'Commonly Paired',    style: { background: '#DCFCE7', color: '#16A34A' } },
  requires_fastener: { label: 'Recommended Add-on', style: { background: '#F3E8FF', color: '#7C3AED' } },
  requires_sealant:  { label: 'Recommended Add-on', style: { background: '#F3E8FF', color: '#7C3AED' } },
}

function relBadge(rel) {
  return REL_MAP[rel] || { label: 'Compatible Product', style: { background: '#F3F4F6', color: '#6B7280' } }
}

function confidenceLabel(conf) {
  if (conf >= 0.9) return 'Highly Compatible'
  if (conf >= 0.75) return 'Often Paired Together'
  return 'Compatible'
}

function SpecPills({ specs }) {
  if (!specs || Object.keys(specs).length === 0) return null
  const entries = Object.entries(specs).slice(0, 6)
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="text-xs px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}
        >
          {k.replace(/_/g, ' ')}: {v}
        </span>
      ))}
    </div>
  )
}

export default function CrossSell() {
  const [selectedSku, setSelectedSku] = useState(DEMO_SKUS[0].sku)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function getRecs() {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(`${API}/api/crosssell/${selectedSku}`)
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A2E' }}>Smart Recommendations</h1>
        <p style={{ color: '#6B7280', fontSize: 14 }}>
          AI-powered product pairings that increase order value.
        </p>
      </div>

      {/* Selector */}
      <div className="flex flex-col gap-3 mb-8" style={{ maxWidth: 480 }}>
        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>
          Select a product to see recommendations
        </label>
        <div className="relative">
          <select
            value={selectedSku}
            onChange={e => setSelectedSku(e.target.value)}
            className="w-full appearance-none px-4 py-3 pr-10 rounded-xl text-sm font-medium outline-none"
            style={{
              background: '#fff',
              border: '1.5px solid #E5E7EB',
              color: '#1A1A2E',
              cursor: 'pointer',
            }}
          >
            {DEMO_SKUS.map(item => (
              <option key={item.sku} value={item.sku}>
                {item.label} ({item.sku})
              </option>
            ))}
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="16" height="16" fill="none" stroke="#9CA3AF" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        <button
          onClick={getRecs}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#00C2E0' }}
        >
          {loading ? 'Fetching…' : 'Get Recommendations'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg px-4 py-3 mb-6 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-8 w-8" style={{ color: '#00C2E0' }} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-6">
          {/* Cart product card */}
          <div className="rounded-xl p-6" style={{ background: '#112240' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Selected Product
            </p>
            <p className="text-xl font-bold text-white">{data.cart_product?.name}</p>
            <p className="font-mono text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{data.cart_sku}</p>
            <SpecPills specs={data.cart_product?.specs} />
          </div>

          {/* Recommendations */}
          {data.recommendations?.length === 0 ? (
            <div
              className="rounded-xl py-16 text-center text-sm"
              style={{ border: '1.5px dashed #E5E7EB', color: '#9CA3AF' }}
            >
              No recommendations found for this product.
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold" style={{ color: '#6B7280' }}>
                {data.recommendations.length} Recommended Product{data.recommendations.length !== 1 ? 's' : ''}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.recommendations.map(rec => {
                  const badge = relBadge(rec.relationship)
                  return (
                    <div
                      key={rec.sku}
                      className="rounded-xl p-5 flex flex-col gap-3"
                      style={{ background: '#fff', border: '1px solid #E5E7EB' }}
                    >
                      {/* Relationship badge */}
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full self-start"
                        style={badge.style}
                      >
                        {badge.label}
                      </span>

                      {/* Product name + SKU + price */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm" style={{ color: '#1A1A2E' }}>{rec.name}</p>
                          <p className="font-mono text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{rec.sku}</p>
                        </div>
                        {rec.price != null && (
                          <span className="font-bold text-sm flex-shrink-0" style={{ color: '#1A1A2E' }}>
                            ${rec.price}
                          </span>
                        )}
                      </div>

                      {/* Compatibility label */}
                      {rec.confidence != null && (
                        <p className="text-xs font-medium" style={{ color: '#6B7280' }}>
                          {confidenceLabel(rec.confidence)}
                        </p>
                      )}

                      {/* LLM explanation */}
                      {rec.llm_explanation && (
                        <div
                          className="rounded-lg p-3 text-sm leading-relaxed"
                          style={{
                            background: '#E0F7FA',
                            borderLeft: '3px solid #00C2E0',
                            color: '#0A1628',
                          }}
                        >
                          <p className="text-xs font-semibold mb-1" style={{ color: '#00C2E0' }}>
                            Why this product?
                          </p>
                          {rec.llm_explanation}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24" style={{ color: '#9CA3AF' }}>
          <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9M17 19a1 1 0 100 2 1 1 0 000-2zm-8 0a1 1 0 100 2 1 1 0 000-2z"/>
          </svg>
          <p className="font-medium mb-1">Select a product and click Get Recommendations</p>
        </div>
      )}
    </div>
  )
}
