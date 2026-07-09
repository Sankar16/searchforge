import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function StatCard({ value, label, sub, color }) {
  return (
    <div className="rounded-xl p-6" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
      <div
        className="text-4xl font-bold mb-1"
        style={{ color: color || '#1A1A2E' }}
      >
        {value ?? '—'}
      </div>
      <div className="font-semibold text-sm mb-1" style={{ color: '#1A1A2E' }}>{label}</div>
      <div className="text-xs leading-snug" style={{ color: '#6B7280' }}>{sub}</div>
    </div>
  )
}

export default function CatalogHealth() {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    setAnalysis(null)
    setElapsed(0)

    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000)

    try {
      const res = await fetch(`${API_BASE}/api/catalog/analyze`, {
        method: 'POST',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      setAnalysis(await res.json())
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out after 3 minutes. Try running again.')
      } else {
        setError(err.message)
      }
    } finally {
      clearInterval(timer)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A2E' }}>
            Catalog Optimizer
          </h1>
          <p style={{ color: '#6B7280', fontSize: 14 }}>
            Automatically detect and fix product data issues that hurt search performance.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#00C2E0' }}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Analyzing… ({elapsed}s)
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Run Analysis
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg px-4 py-3 mb-6 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-28" style={{ color: '#6B7280' }}>
          <svg className="animate-spin h-10 w-10 mb-5" style={{ color: '#00C2E0' }} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-base font-semibold mb-1" style={{ color: '#1A1A2E' }}>Analyzing your catalog…</p>
          <p className="text-sm mb-5">Reviewing product descriptions, detecting duplicates, and fixing data gaps</p>
          <div className="w-64 rounded-full h-1.5" style={{ background: '#E5E7EB' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min((elapsed / 90) * 100, 95)}%`, background: '#00C2E0' }}
            />
          </div>
          <p className="text-xs mt-2">{elapsed}s elapsed</p>
        </div>
      )}

      {/* Empty state */}
      {!analysis && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-28" style={{ color: '#9CA3AF' }}>
          <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <p className="text-base font-medium mb-1">No analysis run yet</p>
          <p className="text-sm">Click "Run Analysis" to start</p>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <div className="space-y-8">
          {/* Section A: What We Fixed */}
          <div>
            <h2 className="text-base font-semibold mb-4" style={{ color: '#1A1A2E' }}>What We Fixed</h2>
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                value={analysis.descriptions_evaluated ?? 0}
                label="Descriptions Improved"
                sub="Products with vague or missing descriptions, now optimized for search"
                color="#00C2E0"
              />
              <StatCard
                value={(analysis.spec_issues_before ?? 0) - (analysis.spec_issues_after ?? 0)}
                label="Specs Filled In"
                sub="Missing technical specs detected and addressed"
                color="#10B981"
              />
              <StatCard
                value={analysis.duplicate_pairs ?? 0}
                label="Duplicate Listings"
                sub="Similar products that may be confusing customers"
                color="#F59E0B"
              />
            </div>
          </div>

          {/* Section B: Description Improvements */}
          {analysis.description_evaluations?.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-1" style={{ color: '#1A1A2E' }}>Description Improvements</h2>
              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
                These product descriptions were rewritten to be more specific and search-friendly.
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB', background: '#fff' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      {['Product', 'SKU', 'Updated Description', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.description_evaluations.map((e, i) => (
                      <tr key={i} style={{ borderTop: i > 0 ? '1px solid #F3F4F6' : 'none' }}>
                        <td className="px-5 py-4 font-medium text-sm" style={{ color: '#1A1A2E', maxWidth: 160 }}>
                          {e.sku?.split('-').slice(0, 2).join(' ')}
                        </td>
                        <td className="px-5 py-4" style={{ whiteSpace: 'nowrap' }}>
                          <span className="font-mono text-xs px-2 py-1 rounded" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                            {e.sku}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm" style={{ color: '#374151', maxWidth: 360 }}>
                          {e.notes || 'Description optimized for B2B search performance.'}
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#ECFDF5', color: '#059669' }}>
                            ✓ Improved
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section C: Duplicate Listings */}
          {analysis.duplicate_candidates?.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-1" style={{ color: '#1A1A2E' }}>Duplicate Listings to Review</h2>
              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
                These products may be creating confusion in search results. Review each pair and consider merging into a single listing.
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB', background: '#fff' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      {['Product A', 'Product B', 'Similarity', 'Recommendation'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.duplicate_candidates.map((d, i) => (
                      <tr key={i} style={{ borderTop: i > 0 ? '1px solid #F3F4F6' : 'none' }}>
                        <td className="px-5 py-4 font-mono text-xs" style={{ color: '#374151' }}>{d.sku_a}</td>
                        <td className="px-5 py-4 font-mono text-xs" style={{ color: '#374151' }}>{d.sku_b}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full" style={{ background: '#E5E7EB' }}>
                              <div className="h-1.5 rounded-full" style={{ width: `${d.similarity}%`, background: '#F59E0B' }} />
                            </div>
                            <span className="text-xs" style={{ color: '#6B7280' }}>{d.similarity}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: '#FFFBEB', color: '#D97706' }}>
                            Review &amp; Merge
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
