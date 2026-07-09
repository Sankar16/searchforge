import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PILLS = ['bearing 6205', 'hydraulic fitting', 'v-belt', 'industrial seal', 'shaft coupling']

const MODES = [
  { value: 'clean', label: 'Optimized Catalog' },
  { value: 'messy', label: 'Original Catalog' },
]

export default function SearchComparison() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('clean')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)

  async function doSearch(q, m) {
    const term = (q ?? query).trim()
    const searchMode = m ?? mode
    if (!term) return
    setLoading(true)
    setError(null)
    setSearched(false)
    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(term)}&mode=${searchMode}`)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || 'Search failed')
      }
      setResults(await res.json())
      setSearched(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleModeChange(newMode) {
    setMode(newMode)
    if (searched && query.trim()) {
      doSearch(query, newMode)
    }
  }

  return (
    <div style={{ padding: '32px 36px', fontFamily: 'Inter, sans-serif', maxWidth: 1000 }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0A1628', margin: 0 }}>Search Preview</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0' }}>
          Compare search results between your original and AI-optimized catalog
        </p>
      </div>

      {/* Search bar + mode toggle */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '20px 24px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Search Query
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="e.g. bearing 6205 or hydraulic fitting"
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #E5E7EB', fontSize: 14, color: '#1A1A2E',
                fontFamily: 'Inter, sans-serif', outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#00C2E0'; e.target.style.boxShadow = '0 0 0 3px rgba(0,194,224,0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
            />
            <button
              onClick={() => doSearch()}
              disabled={loading || !query.trim()}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: loading || !query.trim() ? '#E5E7EB' : '#00C2E0',
                color: loading || !query.trim() ? '#9CA3AF' : '#fff',
                fontSize: 14, fontWeight: 600, cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif', transition: 'background 0.15s',
              }}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Catalog Version
          </label>
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3, gap: 2 }}>
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => handleModeChange(m.value)}
                style={{
                  padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                  background: mode === m.value ? '#fff' : 'transparent',
                  color: mode === m.value ? '#0A1628' : '#9CA3AF',
                  boxShadow: mode === m.value ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode banners */}
      {searched && mode === 'clean' && (
        <div style={{ background: 'rgba(0,194,224,0.08)', border: '1px solid rgba(0,194,224,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#0A1628', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#00C2E0', fontWeight: 700 }}>✓</span>
          Showing results from the <strong>AI-optimized catalog</strong> — descriptions have been rewritten for better search relevance.
        </div>
      )}
      {searched && mode === 'messy' && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>⚠</span>
          Showing results from the <strong>original catalog</strong> — results may be less relevant due to data quality issues.
        </div>
      )}

      {/* Pill suggestions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {PILLS.map(p => (
          <button
            key={p}
            onClick={() => { setQuery(p); doSearch(p, mode) }}
            style={{
              padding: '6px 14px', borderRadius: 999, border: '1.5px solid #E5E7EB',
              background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#00C2E0'; e.currentTarget.style.color = '#00C2E0' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151' }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Zero results */}
      {searched && results?.results?.length === 0 && !loading && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#0A1628', marginBottom: 8 }}>No results found</div>
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>
            Try switching to the <strong>Optimized Catalog</strong> or refining your search terms.
          </div>
        </div>
      )}

      {/* Results grid */}
      {results?.results?.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 14 }}>
            {results.results.length} result{results.results.length !== 1 ? 's' : ''} for "<strong style={{ color: '#374151' }}>{results.query}</strong>"
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {results.results.map(r => (
              <div key={r.sku} style={{
                background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
                padding: '20px', display: 'flex', flexDirection: 'column', gap: 10,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{r.category}</span>
                  {mode === 'clean' && (
                    <span style={{ fontSize: 11, background: 'rgba(0,194,224,0.12)', color: '#00C2E0', fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>
                      ✓ Optimized
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0A1628' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' }}>{r.sku}</div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, flex: 1 }}>{r.description}</div>
                {r.price && (
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1628', paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
                    ${r.price.toFixed(2)}
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#D1D5DB' }}>
                  Relevance: <span style={{ color: '#9CA3AF', fontWeight: 600 }}>{(r.score * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
