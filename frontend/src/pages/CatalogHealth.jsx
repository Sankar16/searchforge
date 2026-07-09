import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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

    // tick elapsed seconds while loading
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)

    // 3 minute timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000)

    try {
      const res = await fetch(`${API_BASE}/api/catalog/analyze`, {
        method: 'POST',
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const data = await res.json()
      setAnalysis(data)
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
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalog Health</h1>
          <p className="text-gray-500 mt-1">
            Run the LangGraph catalog intelligence pipeline to analyze and clean your product catalog.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {loading ? `Analyzing... (${elapsed}s)` : 'Run Catalog Analysis'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {!analysis && !loading && !error && (
        <div className="text-center py-24 text-gray-400">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg font-medium">No analysis run yet</p>
          <p className="text-sm mt-1">Click "Run Catalog Analysis" to start</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-24 text-gray-400">
          <div className="text-5xl mb-6">⚙️</div>
          <p className="text-lg font-medium text-gray-600">Running LangGraph pipeline...</p>
          <p className="text-sm mt-2">Making LLM calls — this takes 30–90 seconds</p>
          <div className="mt-6 w-64 mx-auto bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min((elapsed / 90) * 100, 95)}%` }}
            />
          </div>
          <p className="text-xs mt-2 text-gray-400">{elapsed}s elapsed</p>
        </div>
      )}

      {analysis && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Products', value: analysis.total_products },
              { label: 'Spec Issues Fixed', value: (analysis.spec_issues_before ?? 0) - (analysis.spec_issues_after ?? 0) },
              { label: 'Avg Judge Score', value: analysis.avg_judge_score?.toFixed(2) },
              { label: 'Duplicate Pairs', value: analysis.duplicate_pairs },
            ].map((m) => (
              <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500">{m.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{m.value ?? '—'}</p>
              </div>
            ))}
          </div>

          {/* Description Evaluations Table */}
          {analysis.description_evaluations?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Description Evaluations</h2>
                <span className="text-sm text-gray-400">
                  {analysis.descriptions_passing_judge ?? 0} / {analysis.descriptions_evaluated ?? 0} passing
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['SKU', 'Judge Score', 'Hallucination Risk', 'Status', 'Notes'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.description_evaluations.map((e, i) => (
                      <tr key={i} className={`border-t border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{e.sku}</td>
                        <td className="px-4 py-3 font-medium">{e.judge_score?.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            e.hallucination_risk === 'low'    ? 'bg-green-100 text-green-700' :
                            e.hallucination_risk === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                          }`}>
                            {e.hallucination_risk}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            e.passes_quality_gate ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {e.passes_quality_gate ? '✓ Pass' : '✗ Fail'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{e.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Duplicate Candidates Table */}
          {analysis.duplicate_candidates?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Duplicate Candidates</h2>
                <span className="text-sm text-gray-400">{analysis.duplicate_candidates.length} pairs found</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['SKU A', 'SKU B', 'Similarity'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.duplicate_candidates.map((d, i) => (
                      <tr key={i} className={`border-t border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{d.sku_a}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{d.sku_b}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-orange-400 h-1.5 rounded-full"
                                style={{ width: `${Math.min(d.similarity, 100)}%` }}
                              />
                            </div>
                            <span className="font-medium">{d.similarity.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}