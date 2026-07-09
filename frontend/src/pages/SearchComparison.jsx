import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PILLS = [
  '25mm sealed bearing',
  'bolt for motor mount',
  'brass ball valve',
  'pipe elbow',
  'motor mount',
]

function ProductCard({ product }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-2"
      style={{ background: '#fff', border: '1px solid #E5E7EB' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm leading-snug" style={{ color: '#1A1A2E' }}>
          {product.name}
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: '#ECFEFF', color: '#00C2E0' }}
        >
          ✓ Optimized
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs" style={{ color: '#9CA3AF' }}>{product.sku}</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: '#EFF6FF', color: '#3B82F6' }}
        >
          {product.category}
        </span>
      </div>

      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#6B7280' }}>
        {product.description}
      </p>

      {product.price != null && (
        <div className="font-semibold text-sm mt-1" style={{ color: '#1A1A2E' }}>
          ${product.price}
        </div>
      )}
    </div>
  )
}

export default function SearchComparison() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeQuery, setActiveQuery] = useState('')

  async function runSearch(q) {
    const trimmed = q.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setActiveQuery(trimmed)
    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(trimmed)}&mode=clean`)
      if (!res.ok) throw new Error('Search request failed')
      const data = await res.json()
      setResults(data.results)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    runSearch(query)
  }

  function handlePill(pill) {
    setQuery(pill)
    runSearch(pill)
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A2E' }}>Search Preview</h1>
        <p style={{ color: '#6B7280', fontSize: 14 }}>
          See how customers experience your optimized catalog.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2"
            width="18" height="18" fill="none" stroke="#9CA3AF" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm outline-none transition-shadow"
            style={{
              background: '#fff',
              border: '1.5px solid #E5E7EB',
              color: '#1A1A2E',
            }}
            onFocus={e => { e.target.style.borderColor = '#00C2E0'; e.target.style.boxShadow = '0 0 0 3px rgba(0,194,224,0.15)' }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
          />
        </div>
      </form>

      {/* Pill suggestions */}
      <div className="flex flex-wrap gap-2 mb-8">
        {PILLS.map(pill => (
          <button
            key={pill}
            onClick={() => handlePill(pill)}
            className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
            style={{ background: '#E5E7EB', color: '#374151' }}
            onMouseEnter={e => { e.target.style.background = '#D1D5DB' }}
            onMouseLeave={e => { e.target.style.background = '#E5E7EB' }}
          >
            {pill}
          </button>
        ))}
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

      {/* Results grid */}
      {!loading && results && results.length > 0 && (
        <>
          <p className="text-xs font-medium mb-4" style={{ color: '#6B7280' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for "{activeQuery}"
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {results.map(p => <ProductCard key={p.sku} product={p} />)}
          </div>
        </>
      )}

      {/* Empty results */}
      {!loading && results && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24" style={{ color: '#9CA3AF' }}>
          <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <p className="font-medium mb-1">No products found for "{activeQuery}"</p>
          <p className="text-sm">Try adjusting your search terms</p>
        </div>
      )}

      {/* Pre-search state */}
      {!loading && !results && !error && (
        <div className="flex flex-col items-center justify-center py-24" style={{ color: '#9CA3AF' }}>
          <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <p className="font-medium mb-1">Enter a query to preview results</p>
          <p className="text-sm">Try one of the suggestions above</p>
        </div>
      )}
    </div>
  )
}
