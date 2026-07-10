import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const MODES = [
  { value: 'clean', label: 'Optimized Catalog' },
  { value: 'messy', label: 'Original Catalog' },
]

const BADGE = {
  'Strong match': { bg: '#D1FAE5', color: '#065F46' },
  'Good match':   { bg: 'rgba(0,194,224,0.12)', color: '#007A8F' },
  'Related':      { bg: '#DBEAFE', color: '#1E40AF' },
  'Partial match':{ bg: '#F3F4F6', color: '#6B7280' },
}

function MatchBadge({ label }) {
  const style = BADGE[label] || BADGE['Partial match']
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: style.bg, color: style.color }}>
      {label}
    </span>
  )
}

// ── Synonym Rules Section ──────────────────────────────────────────────────

function SynonymSection({ synonymsLoading, synonymRules, skippedIndices, approvedSynonyms, onApprove, onSkip, onExport }) {
  if (!synonymsLoading && synonymRules.length === 0) return null
  return (
    <div style={{ marginTop: 24, borderTop: '1px solid #E5E7EB', paddingTop: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        Suggested Synonym Rules
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
        Add these to your search platform to help customers find these products
      </div>
      {synonymsLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#6B7280', fontSize: 13 }}>
          <style>{`@keyframes syn-spin { to { transform: rotate(360deg) } } .syn-spin { animation: syn-spin 0.8s linear infinite; }`}</style>
          <div className="syn-spin" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #E5E7EB', borderTopColor: '#00C2E0', flexShrink: 0 }} />
          Generating synonym rules…
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {synonymRules.map((rule, i) => {
          if (skippedIndices.has(i)) return null
          const isApproved = approvedSynonyms.some(r => r.trigger === rule.trigger)
          return (
            <div key={i} style={{ background: '#FAFAFA', border: `1px solid ${isApproved ? 'rgba(0,194,224,0.3)' : '#E5E7EB'}`, borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                  {rule.trigger}
                </span>
                <span style={{ color: '#9CA3AF', fontSize: 13 }}>→</span>
                {rule.synonyms.map((s, j) => (
                  <span key={j} style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 999, background: 'rgba(0,194,224,0.08)', color: '#007A8F', border: '1px solid rgba(0,194,224,0.25)' }}>
                    {s}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{rule.rationale}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => onApprove(rule, i)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1.5px solid ${isApproved ? '#00C2E0' : '#00C2E0'}`,
                    background: isApproved ? '#00C2E0' : '#fff',
                    color: isApproved ? '#fff' : '#00C2E0',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {isApproved ? '✓ Approved' : '✓ Approve Rule'}
                </button>
                {!isApproved && (
                  <button
                    onClick={() => onSkip(i)}
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid #E5E7EB', background: '#fff', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}
                  >
                    ✗ Skip
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {approvedSynonyms.length > 0 && (
        <button
          onClick={onExport}
          style={{
            marginTop: 12, fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8,
            border: '1.5px solid #0A1628', background: '#fff', color: '#0A1628',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          Export Synonym Rules ({approvedSynonyms.length})
        </button>
      )}
    </div>
  )
}

// ── Gap Analysis Card ──────────────────────────────────────────────────────

function GapAnalysisCard({ gap, query, synonymProps }) {
  return (
    <div style={{
      background: '#fff',
      borderLeft: '4px solid #F59E0B',
      borderRadius: 12,
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      padding: '24px',
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>⚠</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#92400E' }}>
          Search Gap Detected
        </span>
      </div>

      {/* Gap summary */}
      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: '0 0 20px' }}>
        {gap.gap_summary}
      </p>

      {/* Likely intent */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          What the customer is looking for
        </div>
        <div style={{ fontSize: 14, color: '#0A1628', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px' }}>
          {gap.likely_intent}
        </div>
      </div>

      {/* Hidden matches */}
      {gap.hidden_matches?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Hidden matches in your catalog
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
            These products probably match but your descriptions don't say so:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gap.hidden_matches.map((m, i) => (
              <div key={i} style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderLeft: '3px solid #F59E0B',
                borderRadius: 8,
                padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0A1628', marginBottom: 2 }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginBottom: 6 }}>
                      {m.sku}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600, color: '#92400E' }}>Why it matches: </span>
                      {m.reason}
                    </div>
                  </div>
                  <button
                    onClick={() => alert('Go to Catalog Optimizer and re-run analysis to improve this product\'s description')}
                    style={{
                      flexShrink: 0,
                      fontSize: 12, fontWeight: 600,
                      padding: '6px 12px', borderRadius: 6,
                      border: '1.5px solid #00C2E0',
                      background: '#fff', color: '#00C2E0',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Improve This Description →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested keywords */}
      {gap.suggested_keywords?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Keywords to add to your descriptions
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {gap.suggested_keywords.map((kw, i) => (
              <span key={i} style={{
                fontSize: 12, fontWeight: 500,
                padding: '4px 10px', borderRadius: 999,
                background: 'rgba(0,194,224,0.08)',
                color: '#007A8F',
                border: '1px solid rgba(0,194,224,0.25)',
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description suggestion */}
      {gap.description_suggestion && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Example description improvement
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
            Consider adding language like this to your product descriptions
          </div>
          <div style={{
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '14px 16px',
            fontFamily: 'monospace',
            fontSize: 13,
            color: '#374151',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}>
            {gap.description_suggestion}
          </div>
        </div>
      )}

      {/* Synonym rules */}
      {synonymProps && (
        <SynonymSection
          synonymsLoading={synonymProps.loading}
          synonymRules={synonymProps.rules}
          skippedIndices={synonymProps.skipped}
          approvedSynonyms={synonymProps.approved}
          onApprove={synonymProps.onApprove}
          onSkip={synonymProps.onSkip}
          onExport={synonymProps.onExport}
        />
      )}
    </div>
  )
}

// ── Gap Analysis Loading ───────────────────────────────────────────────────

function GapLoadingState() {
  return (
    <div style={{
      background: '#fff',
      borderLeft: '4px solid #F59E0B',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 24,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <style>{`@keyframes sf-gap-spin { to { transform: rotate(360deg) } } .sf-gap-spinner { animation: sf-gap-spin 0.9s linear infinite; }`}</style>
      <div className="sf-gap-spinner" style={{
        width: 18, height: 18, borderRadius: '50%',
        border: '2px solid #FDE68A', borderTopColor: '#F59E0B',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 14, color: '#92400E', fontWeight: 500 }}>
        Analyzing search gap…
      </span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

function exportSynonymRules(rules) {
  const header = 'trigger,synonyms,rationale\n'
  const rows = rules.map(r => `"${r.trigger}","${r.synonyms.join('|')}","${r.rationale}"`).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'synonym_rules.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function SearchComparison() {
  const navigate = useNavigate()
  const { analysisRan, changesApplied } = useCatalog()

  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('clean')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)

  const [cleanResults, setCleanResults] = useState(null)
  const [messyResults, setMessyResults] = useState(null)

  const [gapAnalysis, setGapAnalysis] = useState(null)
  const [gapLoading, setGapLoading] = useState(false)

  const [suggestions, setSuggestions] = useState([])

  const [synonymRules, setSynonymRules] = useState([])
  const [synonymsLoading, setSynonymsLoading] = useState(false)
  const [approvedSynonyms, setApprovedSynonyms] = useState([])
  const [skippedSynonymIndices, setSkippedSynonymIndices] = useState(new Set())

  const activeResults = mode === 'clean' ? cleanResults : messyResults

  useEffect(() => {
    fetch(`${API}/api/search/suggestions?mode=clean`)
      .then(r => r.json())
      .then(data => setSuggestions(data.suggestions || []))
      .catch(() => {})
  }, [])

  async function runGapAnalysis(term) {
    setGapLoading(true)
    setGapAnalysis(null)
    setSynonymRules([])
    setSynonymsLoading(false)
    setApprovedSynonyms([])
    setSkippedSynonymIndices(new Set())
    try {
      const res = await fetch(`${API}/api/search/gap-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term }),
      })
      const data = await res.json()
      setGapAnalysis(data)
      // Fetch synonyms after gap analysis succeeds
      setSynonymsLoading(true)
      fetch(`${API}/api/search/synonyms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term, suggested_keywords: data.suggested_keywords || [] }),
      })
        .then(r => r.json())
        .then(syn => setSynonymRules(syn.synonyms || []))
        .catch(() => {})
        .finally(() => setSynonymsLoading(false))
    } catch (e) {
      // Gap analysis failure is non-fatal — silently swallow
      setGapAnalysis(null)
    } finally {
      setGapLoading(false)
    }
  }

  async function handleSearch(overrideQuery) {
    const term = (overrideQuery !== undefined ? overrideQuery : query).trim()
    if (!term) return
    setLoading(true)
    setError(null)
    setSearched(false)
    setGapAnalysis(null)
    setGapLoading(false)

    try {
      const [cleanRes, messyRes] = await Promise.all([
        fetch(`${API}/api/search?q=${encodeURIComponent(term)}&mode=clean&search_type=semantic`),
        fetch(`${API}/api/search?q=${encodeURIComponent(term)}&mode=messy&search_type=semantic`),
      ])

      if (!cleanRes.ok) {
        const d = await cleanRes.json()
        throw new Error(d.detail || 'Search failed')
      }
      if (!messyRes.ok) {
        const d = await messyRes.json()
        throw new Error(d.detail || 'Search failed')
      }

      const [cleanData, messyData] = await Promise.all([cleanRes.json(), messyRes.json()])
      setCleanResults(cleanData)
      setMessyResults(messyData)
      setSearched(true)

      // Trigger gap analysis only when the optimized catalog has no results
      if ((cleanData.results?.length ?? 0) === 0) {
        runGapAnalysis(term)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleModeChange(newMode) {
    setMode(newMode)
  }

  const showCleanEmptyState = searched && !loading && mode === 'clean' && (cleanResults?.results?.length ?? 0) === 0
  const showMessyEmptyState = searched && !loading && mode === 'messy' && (messyResults?.results?.length ?? 0) === 0

  return (
    <div style={{ padding: '32px 36px', fontFamily: 'Inter, sans-serif', maxWidth: 1000 }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0A1628', margin: 0 }}>Search Preview</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0' }}>
          Compare search results between your original and AI-optimized catalog
        </p>
      </div>

      {/* Context-aware banners */}
      {analysisRan && changesApplied && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#15803D', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>✓</span>
          Catalog optimized — switch to <strong>Optimized Catalog</strong> to see improved search results.
        </div>
      )}
      {analysisRan && !changesApplied && (
        <div style={{ background: 'rgba(0,194,224,0.06)', border: '1px solid rgba(0,194,224,0.25)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            <span style={{ color: '#00C2E0', fontWeight: 700 }}>ℹ</span>
            {' '}Analysis complete — apply your changes in Catalog Optimizer to see improvements here.
          </span>
          <button
            onClick={() => navigate('/app/catalog')}
            style={{ fontSize: 12, fontWeight: 600, color: '#00C2E0', background: 'none', border: 'none', cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
          >
            Go to Catalog Optimizer →
          </button>
        </div>
      )}

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
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. sealed bearing for motor shaft"
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #E5E7EB', fontSize: 14, color: '#1A1A2E',
                fontFamily: 'Inter, sans-serif', outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#00C2E0'; e.target.style.boxShadow = '0 0 0 3px rgba(0,194,224,0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
            />
            <button
              onClick={() => handleSearch()}
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
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, textAlign: 'center' }}>
            Powered by semantic search — finds products by meaning, not just keywords
          </div>
        </div>
      </div>

      {/* Mode banners (post-search, only when results exist) */}
      {searched && mode === 'clean' && (cleanResults?.results?.length ?? 0) > 0 && (
        <div style={{ background: 'rgba(0,194,224,0.08)', border: '1px solid rgba(0,194,224,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#0A1628', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#00C2E0', fontWeight: 700 }}>✓</span>
          <strong>Optimized catalog</strong> — enriched descriptions help customers find more relevant products.
        </div>
      )}
      {searched && mode === 'messy' && (messyResults?.results?.length ?? 0) > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>⚠</span>
          <strong>Original catalog</strong> — vague descriptions limit what customers can find via semantic search.
        </div>
      )}

      {/* Pill suggestions — dynamic from catalog */}
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {suggestions.map(p => (
            <button
              key={p}
              onClick={() => { setQuery(p); handleSearch(p) }}
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
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── Optimized catalog zero-result: gap analysis ─────────────────── */}
      {showCleanEmptyState && (
        <>
          {gapLoading && <GapLoadingState />}
          {!gapLoading && gapAnalysis && (
            <GapAnalysisCard
              gap={gapAnalysis}
              query={cleanResults.query}
              synonymProps={{
                loading: synonymsLoading,
                rules: synonymRules,
                skipped: skippedSynonymIndices,
                approved: approvedSynonyms,
                onApprove: (rule) => {
                  setApprovedSynonyms(prev =>
                    prev.some(r => r.trigger === rule.trigger) ? prev : [...prev, rule]
                  )
                },
                onSkip: (idx) => setSkippedSynonymIndices(prev => new Set([...prev, idx])),
                onExport: () => exportSynonymRules(approvedSynonyms),
              }}
            />
          )}
          {!gapLoading && !gapAnalysis && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#0A1628', marginBottom: 8 }}>
                No relevant products found for "{cleanResults?.query}"
              </div>
              <div style={{ fontSize: 13, color: '#9CA3AF', maxWidth: 420, margin: '0 auto' }}>
                This query returned no results — consider adding relevant keywords to your product descriptions.
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Original catalog zero-result: simple state (gaps here are expected) */}
      {showMessyEmptyState && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#0A1628', marginBottom: 8 }}>
            No relevant products found for "{messyResults?.query}"
          </div>
          <div style={{ fontSize: 13, color: '#9CA3AF', maxWidth: 420, margin: '0 auto' }}>
            This query returned no results — consider adding relevant keywords to your product descriptions.
          </div>
        </div>
      )}

      {/* ── Results grid ────────────────────────────────────────────────── */}
      {activeResults?.results?.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 14 }}>
            {activeResults.results.length} result{activeResults.results.length !== 1 ? 's' : ''} for "<strong style={{ color: '#374151' }}>{activeResults.query}</strong>"
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {activeResults.results.map(r => (
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
                  {r.price ? (
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0A1628' }}>${r.price.toFixed(2)}</span>
                  ) : <span />}
                  {r.match_label && <MatchBadge label={r.match_label} />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
