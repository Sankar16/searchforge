import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DEMO_SKUS = ['BRG-6205-2RS', 'BRG-6206-2RS', 'SEAL-V-55', 'BELT-AX42', 'CPL-JAW-28']

const REL_MAP = {
  fits_with: 'Fits with',
  compatible_with: 'Compatible with',
  requires: 'Required for',
  recommended_with: 'Recommended with',
  alternative_to: 'Alternative to',
  frequently_bought_with: 'Frequently bought with',
}

function relLabel(rel) {
  return REL_MAP[rel] || rel?.replace(/_/g, ' ') || 'Related'
}

function ConfidenceBadge({ level }) {
  const map = {
    high: { bg: '#D1FAE5', color: '#065F46', label: 'High Confidence' },
    medium: { bg: '#FEF3C7', color: '#92400E', label: 'Medium Confidence' },
    low: { bg: '#FEE2E2', color: '#991B1B', label: 'Lower Confidence' },
  }
  const style = map[level] || map['medium']
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: style.bg, color: style.color }}>
      {style.label}
    </span>
  )
}

export default function CrossSell() {
  const [sku, setSku] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Saved pairings: [{cart_sku, cart_name, rec_sku, rec_name, reason}]
  const [savedPairings, setSavedPairings] = useState([])

  async function lookup(s) {
    const term = (s ?? sku).trim().toUpperCase()
    if (!term) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(`${API}/api/crosssell/${encodeURIComponent(term)}`)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || 'Lookup failed')
      }
      setData(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function saveRule(rec) {
    const cart = data?.cart_product
    const cartSku = data?.cart_sku
    const key = `${cartSku}|${rec.sku}`
    if (savedPairings.some(p => `${p.cart_sku}|${p.rec_sku}` === key)) return
    setSavedPairings(s => [...s, {
      cart_sku: cartSku,
      cart_name: cart?.name || cartSku,
      rec_sku: rec.sku,
      rec_name: rec.name,
      reason: rec.reason || rec.original_reason || '',
    }])
  }

  function removeRule(idx) {
    setSavedPairings(s => s.filter((_, i) => i !== idx))
  }

  function exportPairings() {
    if (!savedPairings.length) return
    const header = 'Cart SKU,Cart Product,Recommendation SKU,Recommendation,Reason\n'
    const rows = savedPairings.map(p =>
      [p.cart_sku, p.cart_name, p.rec_sku, p.rec_name, `"${p.reason.replace(/"/g, '""')}"`].join(',')
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cross_sell_rules.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const cart = data?.cart_product
  const recs = data?.recommendations || []

  return (
    <div style={{ padding: '32px 36px', fontFamily: 'Inter, sans-serif', maxWidth: 1100 }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0A1628', margin: 0 }}>Smart Recommendations</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0' }}>
          AI-powered cross-sell suggestions grounded in product compatibility data
        </p>
      </div>

      {/* Search bar */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '20px 24px', marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Enter Cart SKU
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={sku}
            onChange={e => setSku(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="e.g. BRG-6205-2RS"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8,
              border: '1.5px solid #E5E7EB', fontSize: 14, color: '#1A1A2E',
              fontFamily: 'Inter, monospace', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#00C2E0'; e.target.style.boxShadow = '0 0 0 3px rgba(0,194,224,0.1)' }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
          />
          <button
            onClick={() => lookup()}
            disabled={loading || !sku.trim()}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: loading || !sku.trim() ? '#E5E7EB' : '#00C2E0',
              color: loading || !sku.trim() ? '#9CA3AF' : '#fff',
              fontSize: 14, fontWeight: 600, cursor: loading || !sku.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif', transition: 'background 0.15s',
            }}
          >
            {loading ? 'Loading…' : 'Get Recommendations'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {DEMO_SKUS.map(s => (
            <button
              key={s}
              onClick={() => { setSku(s); lookup(s) }}
              style={{
                padding: '5px 12px', borderRadius: 999, border: '1.5px solid #E5E7EB',
                background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer',
                fontFamily: 'monospace', transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#00C2E0'; e.currentTarget.style.color = '#00C2E0' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Cart product card */}
      {cart && (
        <div style={{
          background: '#0A1628', borderRadius: 14, padding: '20px 24px', marginBottom: 24,
          display: 'flex', alignItems: 'flex-start', gap: 20,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(0,194,224,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              In Cart · {cart.category}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{cart.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginBottom: 10 }}>{data.cart_sku}</div>
            {cart.description && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: 12 }}>{cart.description}</div>
            )}
            {cart.specs && Object.keys(cart.specs).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(cart.specs).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 12, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', padding: '3px 10px', borderRadius: 6, fontWeight: 500 }}>
                    {k}: {v}
                  </span>
                ))}
              </div>
            )}
          </div>
          {cart.price && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#00C2E0' }}>${cart.price.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations grid */}
      {recs.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A1628', marginBottom: 16 }}>
            Recommended Add-ons
            <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: 13, marginLeft: 8 }}>{recs.length} suggestions</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 32 }}>
            {recs.map(r => {
              const key = `${data?.cart_sku}|${r.sku}`
              const isSaved = savedPairings.some(p => `${p.cart_sku}|${p.rec_sku}` === key)
              return (
                <div key={r.sku} style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
                  padding: '20px', display: 'flex', flexDirection: 'column', gap: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        {relLabel(r.relationship_type)} · {r.category}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1628' }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 }}>{r.sku}</div>
                    </div>
                    {r.confidence && <ConfidenceBadge level={r.confidence} />}
                  </div>

                  {r.specs && Object.keys(r.specs).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {Object.entries(r.specs).slice(0, 3).map(([k, v]) => (
                        <span key={k} style={{ fontSize: 11, background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: 5, fontWeight: 500 }}>
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}

                  {(r.reason || r.original_reason) && (
                    <div style={{ background: 'rgba(0,194,224,0.06)', border: '1px solid rgba(0,194,224,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#00C2E0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Why this product?
                      </div>
                      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                        {r.reason || r.original_reason}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 4 }}>
                    {r.price ? (
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#0A1628' }}>${r.price.toFixed(2)}</span>
                    ) : <span />}
                    <button
                      onClick={() => saveRule(r)}
                      disabled={isSaved}
                      style={{
                        fontSize: 13, padding: '7px 16px', borderRadius: 7,
                        border: isSaved ? 'none' : '1.5px solid #00C2E0',
                        background: isSaved ? '#D1FAE5' : '#fff',
                        color: isSaved ? '#065F46' : '#00C2E0',
                        cursor: isSaved ? 'default' : 'pointer',
                        fontWeight: 600, fontFamily: 'Inter, sans-serif',
                        transition: 'all 0.15s',
                      }}
                    >
                      {isSaved ? '✓ Rule Saved' : 'Save Rule'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Saved Pairings panel */}
      {savedPairings.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A1628', margin: 0 }}>
              Saved Cross-Sell Rules
              <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: 13, marginLeft: 8 }}>{savedPairings.length} rule{savedPairings.length !== 1 ? 's' : ''}</span>
            </h2>
            <button
              onClick={exportPairings}
              style={{
                fontSize: 13, padding: '8px 18px', borderRadius: 8,
                border: '1.5px solid #0A1628', background: '#fff', color: '#0A1628',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              Export CSV
            </button>
          </div>

          <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Cart Product', 'Recommendation', 'Reason', ''].map(h => (
                <div key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
              ))}
            </div>
            {savedPairings.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', borderBottom: i < savedPairings.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center' }}>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0A1628' }}>{p.cart_name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{p.cart_sku}</div>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0A1628' }}>{p.rec_name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{p.rec_sku}</div>
                </div>
                <div style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  {p.reason.length > 100 ? p.reason.slice(0, 100) + '…' : p.reason}
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => removeRule(i)}
                    style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' }}
                  >Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
