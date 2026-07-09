import { useState } from 'react'
import { useCatalog } from '../context/CatalogContext.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DEMO_SKUS = ['BRG-6205-2RS', 'BRG-6206-2RS', 'SEAL-V-55', 'BELT-AX42', 'CPL-JAW-28']

// Bug 1: relationship badge map keyed by actual API relationship field values
const REL_BADGE_MAP = {
  requires_housing:   { label: 'Required Component', bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' },
  compatible_shaft:   { label: 'Works With',          bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' },
  pairs_with:         { label: 'Commonly Paired',     bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
  requires_sealant:   { label: 'Recommended Add-on',  bg: '#EDE9FE', color: '#6D28D9', border: '#DDD6FE' },
  requires_nut:       { label: 'Required Component',  bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' },
  requires_washer:    { label: 'Required Component',  bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' },
  compatible_seal:    { label: 'Compatible Seal',     bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' },
  requires_lubricant: { label: 'Recommended Add-on',  bg: '#EDE9FE', color: '#6D28D9', border: '#DDD6FE' },
  // Legacy values from relLabel fallbacks
  fits_with:              { label: 'Fits With',          bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
  compatible_with:        { label: 'Compatible',         bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' },
  requires:               { label: 'Required',           bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' },
  recommended_with:       { label: 'Recommended',        bg: '#EDE9FE', color: '#6D28D9', border: '#DDD6FE' },
  alternative_to:         { label: 'Alternative',        bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  frequently_bought_with: { label: 'Often Bought Together', bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
}

function getRelationshipBadge(relationship) {
  return REL_BADGE_MAP[relationship] || { label: 'Compatible', bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
}

// Bug 2: confidence label — handles both numeric (0.0–1.0) and string ("high"/"medium"/"low")
function getConfidenceLabel(confidence) {
  const numVal = typeof confidence === 'number'
    ? confidence
    : { high: 0.95, medium: 0.8, low: 0.5 }[confidence] ?? 0.5
  if (numVal >= 0.9) return { label: 'Highly Compatible', color: '#059669' }
  if (numVal >= 0.75) return { label: 'Often Paired Together', color: '#0D9488' }
  return { label: 'Compatible', color: '#6B7280' }
}

// For saving to context — keep string representation
function confidenceLabel(confidence) {
  const { label } = getConfidenceLabel(confidence)
  return label
}

function relLabel(rel) {
  return getRelationshipBadge(rel).label
}

export default function CrossSell() {
  const { savedPairings, savePairing, removePairing } = useCatalog()

  const [sku, setSku] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)  // Bug 6: already existed, adding UI
  const [error, setError] = useState(null)

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

  function toggleSave(rec) {
    const cartSku = data?.cart_sku
    const cart = data?.cart_product
    const isSaved = savedPairings.some(
      p => p.cart_sku === cartSku && p.recommended_sku === rec.sku
    )
    if (isSaved) {
      removePairing(cartSku, rec.sku)
    } else {
      savePairing({
        cart_sku: cartSku,
        cart_product_name: cart?.name || cartSku,
        recommended_sku: rec.sku,
        recommended_name: rec.name,
        relationship: rec.relationship_type || '',
        relationship_label: relLabel(rec.relationship_type),
        confidence_label: confidenceLabel(rec.confidence),
        llm_explanation: rec.reason || rec.original_reason || '',
        saved_at: new Date().toISOString(),
      })
    }
  }

  function exportPairings() {
    if (!savedPairings.length) return
    const header = 'cart_sku,cart_name,rec_sku,rec_name,relationship,confidence,explanation,saved_at\n'
    const rows = savedPairings.map(p =>
      [
        p.cart_sku,
        `"${(p.cart_product_name || '').replace(/"/g, '""')}"`,
        p.recommended_sku,
        `"${(p.recommended_name || '').replace(/"/g, '""')}"`,
        p.relationship_label,
        p.confidence_label,
        `"${(p.llm_explanation || '').replace(/"/g, '""')}"`,
        p.saved_at,
      ].join(',')
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

      {/* Bug 6: Loading state UI */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <style>{`@keyframes cs-spin { to { transform: rotate(360deg) } } .cs-spinner { animation: cs-spin 0.8s linear infinite; }`}</style>
          <div className="cs-spinner" style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2.5px solid #E5E7EB', borderTopColor: '#00C2E0',
            margin: '0 auto 12px',
          }} />
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Getting recommendations…</p>
        </div>
      )}

      {/* Cart product card */}
      {!loading && cart && (
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
      {!loading && recs.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A1628', marginBottom: 16 }}>
            Recommended Add-ons
            <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: 13, marginLeft: 8 }}>{recs.length} suggestions</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 32 }}>
            {recs.map(r => {
              const isSaved = savedPairings.some(
                p => p.cart_sku === data?.cart_sku && p.recommended_sku === r.sku
              )
              // Bug 1: proper relationship badge
              const relBadge = getRelationshipBadge(r.relationship_type)
              // Bug 2: proper confidence label
              const conf = r.confidence != null ? getConfidenceLabel(r.confidence) : null

              return (
                <div key={r.sku} style={{
                  background: '#fff', borderRadius: 12, border: `1px solid ${isSaved ? 'rgba(0,194,224,0.3)' : '#E5E7EB'}`,
                  padding: '20px', display: 'flex', flexDirection: 'column', gap: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      {/* Bug 1: relationship badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                          background: relBadge.bg, color: relBadge.color,
                          border: `1px solid ${relBadge.border}`,
                        }}>
                          {relBadge.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {r.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1628' }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 }}>{r.sku}</div>
                    </div>
                    {/* Bug 2: confidence label */}
                    {conf && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: conf.color, flexShrink: 0, marginTop: 2 }}>
                        {conf.label}
                      </span>
                    )}
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
                      onClick={() => toggleSave(r)}
                      title="Save this product pairing to your session. Export all saved pairings as CSV to import into your merchandising platform."
                      style={{
                        fontSize: 13, padding: '7px 16px', borderRadius: 7,
                        border: isSaved ? 'none' : '1.5px solid #00C2E0',
                        background: isSaved ? '#D1FAE5' : '#fff',
                        color: isSaved ? '#065F46' : '#00C2E0',
                        cursor: 'pointer',
                        fontWeight: 600, fontFamily: 'Inter, sans-serif',
                        transition: 'all 0.15s',
                      }}
                    >
                      {isSaved ? '✓ Saved' : 'Save Rule'}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
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

          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
            These pairings have been saved to your session. Export CSV to use in your merchandising platform.
          </div>

          <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 130px auto', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Cart Product', 'Recommended Product', 'Relationship', 'Confidence', ''].map(h => (
                <div key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
              ))}
            </div>
            {savedPairings.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 130px auto', borderBottom: i < savedPairings.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'start' }}>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0A1628' }}>{p.cart_product_name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 }}>{p.cart_sku}</div>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0A1628' }}>{p.recommended_name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 }}>{p.recommended_sku}</div>
                  {p.llm_explanation && (
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6, lineHeight: 1.5 }}>
                      {p.llm_explanation.length > 90 ? p.llm_explanation.slice(0, 90) + '…' : p.llm_explanation}
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: 12, background: 'rgba(0,194,224,0.1)', color: '#0A1628', padding: '2px 8px', borderRadius: 5, fontWeight: 500 }}>
                    {p.relationship_label || 'Compatible'}
                  </span>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    {p.confidence_label || 'Compatible'}
                  </span>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <button
                    onClick={() => removePairing(p.cart_sku, p.recommended_sku)}
                    title="Remove from saved pairings"
                    style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer', fontWeight: 600 }}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
