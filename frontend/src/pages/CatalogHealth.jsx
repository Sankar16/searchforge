import { useState, useRef, useEffect } from 'react'
import { useCatalog } from '../context/CatalogContext.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATUS_MSGS = [
  'Detecting duplicate listings…',
  'Analyzing description quality…',
  'Rewriting with AI…',
  'Running quality checks…',
]

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #E5E7EB', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent || '#0A1628', letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function StepIndicator({ step }) {
  const steps = ['Upload', 'Analyze', 'Review']
  const keys = ['upload', 'analyze', 'review']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {steps.map((label, i) => {
        const isActive = keys[i] === step
        const isDone = keys.indexOf(step) > i
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: isDone ? '#00C2E0' : isActive ? '#0A1628' : '#E5E7EB',
                color: (isDone || isActive) ? '#fff' : '#9CA3AF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {isDone ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? '#0A1628' : isDone ? '#00C2E0' : '#9CA3AF' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 48, height: 2, background: isDone ? '#00C2E0' : '#E5E7EB', margin: '0 12px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function CatalogHealth() {
  const {
    uploadSource, setUploadSource,
    uploadedFile, setUploadedFile,
    analysisResult, setAnalysisResult,
    analysisRan, setAnalysisRan,
    approvedSkus, rejectedSkus,
    editedDescriptions,
    approveSkus, rejectSkus, toggleApprove,
    setEditedDescription,
    changesApplied, setChangesApplied,
    setDownloadReady,
    activeJobId, setActiveJobId,
    resetAll,
  } = useCatalog()

  const [loading, setLoading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [statusIdx, setStatusIdx] = useState(0)
  const [editingSkus, setEditingSkus] = useState({})
  const [editBuffer, setEditBuffer] = useState({})
  const [dismissedPairs, setDismissedPairs] = useState(new Set())
  const [applyLoading, setApplyLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const fileInputRef = useRef(null)

  // Elapsed timer: ticks every 1 second, cycles status every 8 seconds
  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    setStatusIdx(0)
    const tick = setInterval(() => {
      setElapsed(s => {
        const next = s + 1
        if (next % 8 === 0) setStatusIdx(i => (i + 1) % STATUS_MSGS.length)
        return next
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [loading])

  // FIX 1: loading check comes BEFORE step derivation — always shows loading UI
  if (loading) {
    return (
      <div style={{ padding: '32px 36px', fontFamily: 'Inter, sans-serif' }}>
        <style>{`
          @keyframes sf-spin { to { transform: rotate(360deg) } }
          .sf-spinner { animation: sf-spin 0.9s linear infinite; }
        `}</style>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0A1628', margin: 0 }}>Catalog Optimizer</h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0' }}>Upload your catalog, analyze issues, review AI suggestions</p>
        </div>

        <StepIndicator step="analyze" />

        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          {/* Spinner */}
          <div className="sf-spinner" style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '4px solid #E5E7EB',
            borderTopColor: '#00C2E0',
            margin: '0 auto 24px',
          }} />

          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0A1628', margin: '0 0 8px' }}>
            Analyzing your catalog…
          </h2>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 28, minHeight: 22 }}>
            {STATUS_MSGS[statusIdx]}
          </div>

          {/* Progress bar */}
          <div style={{ width: 400, margin: '0 auto', background: '#E5E7EB', borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.min((elapsed / 90) * 100, 95)}%`,
              background: 'linear-gradient(90deg, #00C2E0, #6C2BD9)',
              borderRadius: 999, transition: 'width 1s linear',
            }} />
          </div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 12 }}>
            {elapsed}s elapsed — typically 1–3 minutes
          </div>
        </div>
      </div>
    )
  }

  // Derive step only when not loading
  const step = !analysisRan ? 'upload' : 'review'

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  function isRejected(sku) { return rejectedSkus.includes(sku) }

  function handleApproveAll() {
    const all = (analysisResult?.description_rewrites || []).map(r => r.sku)
    approveSkus(all)
  }

  function handleRejectAll() {
    const all = (analysisResult?.description_rewrites || []).map(r => r.sku)
    rejectSkus(all)
  }

  function startEdit(sku, optimized) {
    setEditBuffer(b => ({ ...b, [sku]: editedDescriptions[sku] ?? optimized }))
    setEditingSkus(m => ({ ...m, [sku]: true }))
  }

  function saveEdit(sku) {
    setEditedDescription(sku, editBuffer[sku])
    setEditingSkus(m => ({ ...m, [sku]: false }))
    if (isRejected(sku)) toggleApprove(sku)
  }

  function cancelEdit(sku) {
    setEditingSkus(m => ({ ...m, [sku]: false }))
  }

  function getApprovedSkuList() {
    return (analysisResult?.description_rewrites || [])
      .map(r => r.sku)
      .filter(sku => !rejectedSkus.includes(sku))
  }

  async function handleFileUpload(file) {
    if (!file) return
    setUploadError(null)
    setUploadLoading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`${API}/api/catalog/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload failed')
      setUploadedFile({ name: file.name, size: file.size, total_products: data.total_products, columns_detected: data.columns_detected, missing_optional: data.missing_optional })
      setUploadSource('file')
    } catch (e) {
      setUploadError(e.message)
    } finally {
      setUploadLoading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }

  function handleUseSample() {
    setUploadSource('sample')
    setUploadedFile({ name: 'catalog_messy.json', total_products: 74, columns_detected: ['sku', 'name', 'category', 'description', 'price', 'brand'], missing_optional: [] })
    setUploadError(null)
  }

  async function runAnalysis() {
    setLoading(true)
    setAnalysisRan(false)

    let pollInterval = null

    const cleanup = () => {
      if (pollInterval) clearInterval(pollInterval)
      setActiveJobId(null)
    }

    try {
      const src = uploadSource === 'file' ? 'uploaded' : 'sample'
      const startRes = await fetch(`${API}/api/catalog/analyze?source=${src}`, { method: 'POST' })
      if (!startRes.ok) throw new Error((await startRes.json()).detail || 'Failed to start analysis')
      const { job_id } = await startRes.json()
      setActiveJobId(job_id)

      await new Promise((resolve, reject) => {
        pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${API}/api/catalog/status/${job_id}`)
            const statusData = await statusRes.json()

            if (statusData.status === 'complete') {
              cleanup()
              setAnalysisResult(statusData.result)
              setAnalysisRan(true)
              const allSkus = (statusData.result.description_rewrites || []).map(r => r.sku)
              approveSkus(allSkus)
              resolve()
            } else if (statusData.status === 'error') {
              cleanup()
              reject(new Error(statusData.error || 'Analysis failed'))
            }
            // pending or running — keep polling
          } catch (err) {
            cleanup()
            reject(new Error('Lost connection to server'))
          }
        }, 2000)

        // Safety timeout after 5 minutes
        setTimeout(() => {
          cleanup()
          reject(new Error('Analysis timed out after 5 minutes'))
        }, 300000)
      })
    } catch (e) {
      showToast(e.message, false)
    } finally {
      setLoading(false)
    }
  }

  async function applyChanges() {
    setApplyLoading(true)
    try {
      const res = await fetch(`${API}/api/catalog/apply-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_skus: getApprovedSkuList(),
          edited_descriptions: editedDescriptions,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Apply failed')
      setChangesApplied(true)
      setDownloadReady(true)
      showToast(`Applied ${data.applied} rewrites, reverted ${data.reverted}. catalog_final.json saved.`)
      // Bug 5: fire-and-forget reindex so search reflects applied changes
      fetch(`${API}/api/search/reindex`, { method: 'POST' }).catch(() => {})
    } catch (e) {
      showToast(e.message, false)
    } finally {
      setApplyLoading(false)
    }
  }

  async function downloadCSV() {
    const res = await fetch(`${API}/api/catalog/download`)
    if (!res.ok) { showToast('No catalog ready. Apply changes first.', false); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'optimized_catalog.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalRewrites = (analysisResult?.description_rewrites || []).length
  const approvedCount = totalRewrites - rejectedSkus.filter(s =>
    (analysisResult?.description_rewrites || []).some(r => r.sku === s)
  ).length
  const repairedCount = (analysisResult?.description_rewrites || []).filter(r => r.was_repaired).length

  const catalogLabel = uploadSource === 'file' && uploadedFile
    ? uploadedFile.name
    : 'Sample Catalog'

  return (
    <div style={{ padding: '32px 36px', paddingBottom: step === 'review' ? 120 : 32, fontFamily: 'Inter, sans-serif', maxWidth: 1100 }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0A1628', margin: 0 }}>Catalog Optimizer</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0' }}>Upload your catalog, analyze issues, review AI suggestions</p>
      </div>

      <StepIndicator step={step} />

      {/* ── STEP 1: Upload ─────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploadLoading && fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#00C2E0' : uploadSource === 'file' && uploadedFile ? '#00C2E0' : '#D1D5DB'}`,
                borderRadius: 16, padding: 40, textAlign: 'center',
                cursor: uploadLoading ? 'wait' : 'pointer',
                background: dragOver ? 'rgba(0,194,224,0.04)' : uploadSource === 'file' && uploadedFile ? 'rgba(0,194,224,0.04)' : '#fff',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => handleFileUpload(e.target.files?.[0])} />
              <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
              {uploadLoading ? (
                <p style={{ color: '#6B7280', fontSize: 14 }}>Uploading…</p>
              ) : uploadSource === 'file' && uploadedFile ? (
                <>
                  <div style={{ color: '#00C2E0', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>✓ Catalog uploaded</div>
                  <div style={{ color: '#6B7280', fontSize: 13 }}>{uploadedFile.total_products} products · {uploadedFile.name}</div>
                  <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>Click to replace</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#0A1628', marginBottom: 6 }}>Upload your catalog CSV</div>
                  <div style={{ color: '#9CA3AF', fontSize: 13 }}>Drag & drop or click to browse</div>
                  <hr style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '16px 0 12px' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Expected format:</div>
                  <div style={{
                    background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6,
                    padding: '8px 12px', fontFamily: 'monospace', fontSize: 11,
                    color: '#374151', textAlign: 'left', whiteSpace: 'pre', lineHeight: 1.6,
                    marginBottom: 10,
                  }}>{'sku,name,category,description,price\nBRG-001,Widget A,Bearings,...,12.50'}</div>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      const csv = 'sku,name,category,description,price,brand\nBRG-001,Example Bearing,Bearings,Enter description here,12.50,Acme\n'
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = 'catalog_template.csv'; a.click()
                      URL.revokeObjectURL(url)
                    }}
                    style={{ fontSize: 12, color: '#00C2E0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                  >
                    Download template CSV
                  </button>
                </>
              )}
            </div>

            <div
              onClick={handleUseSample}
              style={{
                border: `2px solid ${uploadSource === 'sample' ? '#00C2E0' : '#E5E7EB'}`,
                borderRadius: 16, padding: 40, textAlign: 'center',
                cursor: 'pointer',
                background: uploadSource === 'sample' ? 'rgba(0,194,224,0.04)' : '#fff',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>🧪</div>
              {uploadSource === 'sample' ? (
                <>
                  <div style={{ color: '#00C2E0', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>✓ Sample catalog selected</div>
                  <div style={{ color: '#6B7280', fontSize: 13 }}>74 industrial products</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#0A1628', marginBottom: 6 }}>Use sample catalog</div>
                  <div style={{ color: '#9CA3AF', fontSize: 13 }}>74 industrial B2B products with real issues</div>
                  <hr style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '16px 0 12px' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Includes:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
                    {['74 products', '6 categories', 'Real issues injected'].map(pill => (
                      <span key={pill} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: '#F3F4F6', color: '#374151', fontWeight: 500 }}>{pill}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: '#00C2E0', fontWeight: 500 }}>Best for exploring all features</div>
                </>
              )}
            </div>
          </div>

          {uploadError && (
            <div style={{ marginTop: 16, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
              {uploadError}
            </div>
          )}

          {uploadedFile && uploadSource === 'file' && (
            <div style={{ marginTop: 16, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
              <span style={{ color: '#15803D', fontWeight: 600 }}>Detected columns: </span>
              <span style={{ color: '#374151' }}>{uploadedFile.columns_detected?.join(', ')}</span>
              {uploadedFile.missing_optional?.length > 0 && (
                <span style={{ color: '#9CA3AF' }}> · Optional missing: {uploadedFile.missing_optional.join(', ')}</span>
              )}
            </div>
          )}

          {uploadSource && (
            <div style={{ marginTop: 28 }}>
              <button
                onClick={runAnalysis}
                disabled={loading || activeJobId !== null}
                style={{
                  background: loading || activeJobId !== null ? 'rgba(0,194,224,0.5)' : '#00C2E0',
                  color: '#fff', border: 'none',
                  padding: '13px 36px', borderRadius: 10, fontSize: 15, fontWeight: 600,
                  cursor: loading || activeJobId !== null ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Run Analysis →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Review ─────────────────────────────────────────────── */}
      {step === 'review' && analysisResult && (
        <div>
          {/* FIX 2: New analysis header bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button
              onClick={resetAll}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: '#6B7280',
                background: 'none', border: '1px solid #E5E7EB', borderRadius: 7,
                padding: '7px 14px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#0A1628'; e.currentTarget.style.color = '#0A1628' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280' }}
            >
              ← New Analysis
            </button>
            <div style={{ fontSize: 13, color: '#9CA3AF' }}>
              Using: <span style={{ color: '#374151', fontWeight: 500 }}>{catalogLabel}</span>
            </div>
          </div>

          {/* FIX 2: changesApplied banner */}
          {changesApplied && (
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10,
              padding: '14px 18px', marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 13, color: '#15803D', fontWeight: 600 }}>
                ✓ Changes have been applied and downloaded.
              </div>
              <button
                onClick={resetAll}
                style={{
                  fontSize: 13, fontWeight: 600, color: '#fff',
                  background: '#00C2E0', border: 'none', borderRadius: 7,
                  padding: '7px 16px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >
                Run New Analysis →
              </button>
            </div>
          )}

          {/* Completeness Score */}
          {analysisResult.completeness_score && (() => {
            const score = analysisResult.completeness_score
            const scoreBefore = score.before || 0
            const scoreAfter = score.after || 0
            const improvement = scoreAfter - scoreBefore
            return (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1628' }}>Catalog Completeness Score</div>
                    <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Based on description quality, spec coverage, and duplicate detection</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#EF4444' }}>{scoreBefore}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Before</div>
                    </div>
                    <div style={{ fontSize: 20, color: '#D1D5DB' }}>→</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#10B981' }}>{scoreAfter}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>After</div>
                    </div>
                    {improvement > 0 && (
                      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#15803D' }}>+{improvement}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>improvement</div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>
                    <span>0</span><span>100</span>
                  </div>
                  <div style={{ position: 'relative', height: 10, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: '#FCA5A5', borderRadius: 999, width: `${scoreBefore}%`, transition: 'width 0.5s ease' }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: '#34D399', borderRadius: 999, width: `${scoreAfter}%`, transition: 'width 0.7s ease' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FCA5A5' }} />
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>Before optimization</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#34D399' }} />
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>After optimization</span>
                    </div>
                  </div>
                </div>
                {/* Breakdown */}
                {score.breakdown && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
                    <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Vague Descriptions</div>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: '#EF4444', fontWeight: 600 }}>{score.breakdown.vague_descriptions?.before || 0} issues</span>
                        <span style={{ color: '#9CA3AF', margin: '0 6px' }}>→</span>
                        <span style={{ color: '#10B981', fontWeight: 600 }}>{score.breakdown.vague_descriptions?.after || 0} remaining</span>
                      </div>
                    </div>
                    <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Missing Specs</div>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: '#EF4444', fontWeight: 600 }}>{score.breakdown.missing_specs?.before || 0} issues</span>
                        <span style={{ color: '#9CA3AF', margin: '0 6px' }}>→</span>
                        <span style={{ color: '#10B981', fontWeight: 600 }}>{score.breakdown.missing_specs?.after || 0} remaining</span>
                      </div>
                    </div>
                    <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Duplicate Listings</div>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: score.breakdown.duplicate_listings?.count > 0 ? '#F59E0B' : '#10B981', fontWeight: 600 }}>
                          {score.breakdown.duplicate_listings?.count || 0} pairs
                        </span>
                        <span style={{ color: '#9CA3AF', fontSize: 11, marginLeft: 4 }}>found</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Knowledge Graph stats */}
          {analysisResult.knowledge_graph?.total_edges > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1628' }}>🔗 Compatibility Graph Generated</div>
                  <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>AI discovered product compatibility relationships in your catalog</div>
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#00C2E0' }}>{analysisResult.knowledge_graph.total_edges}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>relationships found</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#6B7280' }}>{analysisResult.knowledge_graph.total_candidates}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>pairs evaluated</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Metric cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
            <StatCard label="Total Products" value={analysisResult.total_products} />
            <StatCard label="Issues Remaining" value={analysisResult.total_issues} accent={analysisResult.total_issues > 0 ? '#EF4444' : '#10B981'} />
            <StatCard label="Spec Issues Fixed" value={analysisResult.spec_issues_before - analysisResult.spec_issues_after} sub={`was ${analysisResult.spec_issues_before}`} accent="#00C2E0" />
            <StatCard label="Descriptions Optimized" value={analysisResult.descriptions_passing_judge} sub={`avg score ${analysisResult.avg_judge_score}`} accent="#00C2E0" />
            <StatCard label="Descriptions Repaired" value={repairedCount} sub="Failed first quality check, automatically fixed" accent={repairedCount > 0 ? '#D97706' : '#10B981'} />
            <StatCard label="Duplicate Pairs" value={analysisResult.duplicate_pairs} accent={analysisResult.duplicate_pairs > 0 ? '#F59E0B' : '#10B981'} />
          </div>

          {/* Section A: Description rewrites */}
          {analysisResult.description_rewrites?.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A1628', margin: 0 }}>
                  Review Description Rewrites
                  <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: 13, marginLeft: 8 }}>
                    {approvedCount}/{totalRewrites} approved
                  </span>
                </h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleApproveAll} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', color: '#374151' }}>
                    Approve All
                  </button>
                  <button onClick={handleRejectAll} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', color: '#374151' }}>
                    Reject All
                  </button>
                </div>
              </div>

              <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 140px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['Product', 'Original Description', 'Optimized Description', 'Action'].map(h => (
                    <div key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                  ))}
                </div>

                {analysisResult.description_rewrites.map((r, i) => {
                  const rejected = isRejected(r.sku)
                  const editing = editingSkus[r.sku]
                  const displayOptimized = editedDescriptions[r.sku] ?? r.optimized_description
                  return (
                    <div key={r.sku} style={{
                      display: 'grid', gridTemplateColumns: '140px 1fr 1fr 140px',
                      borderBottom: i < analysisResult.description_rewrites.length - 1 ? '1px solid #F3F4F6' : 'none',
                      opacity: rejected ? 0.45 : 1,
                      background: rejected ? '#F9FAFB' : '#fff',
                      transition: 'opacity 0.2s',
                    }}>
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0A1628', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {r.name}
                          {r.was_repaired && (
                            <span
                              title="This description failed the first quality check and was automatically repaired by the AI"
                              style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', cursor: 'help', whiteSpace: 'nowrap' }}
                            >
                              🔄 Repaired
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{r.sku}</div>
                      </div>
                      <div style={{ padding: '14px 16px', fontSize: 13, color: '#6B7280', lineHeight: 1.55 }}>
                        {r.original_description || r.original || '—'}
                      </div>
                      <div style={{ padding: '14px 16px', fontSize: 13, color: '#0A1628', lineHeight: 1.55 }}>
                        {editing ? (
                          <>
                            <textarea
                              value={editBuffer[r.sku] ?? displayOptimized}
                              onChange={e => setEditBuffer(b => ({ ...b, [r.sku]: e.target.value }))}
                              style={{
                                width: '100%', minHeight: 80, fontSize: 13, padding: 8,
                                border: '1.5px solid #00C2E0', borderRadius: 6, resize: 'vertical',
                                fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
                              }}
                            />
                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                              <button onClick={() => saveEdit(r.sku)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 5, border: 'none', background: '#00C2E0', color: '#fff', cursor: 'pointer' }}>Save</button>
                              <button onClick={() => cancelEdit(r.sku)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 5, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', color: '#374151' }}>Cancel</button>
                            </div>
                          </>
                        ) : (
                          <>
                            {displayOptimized}
                            {editedDescriptions[r.sku] && <span style={{ marginLeft: 6, fontSize: 11, color: '#00C2E0', fontWeight: 600 }}>edited</span>}
                          </>
                        )}
                      </div>
                      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => toggleApprove(r.sku)}
                          style={{
                            fontSize: 12, padding: '5px 0', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                            border: rejected ? '1.5px solid #10B981' : '1.5px solid #EF4444',
                            color: rejected ? '#10B981' : '#EF4444', background: '#fff',
                          }}
                        >
                          {rejected ? '✓ Approve' : '✕ Reject'}
                        </button>
                        {!rejected && !editing && (
                          <button
                            onClick={() => startEdit(r.sku, r.optimized_description)}
                            style={{ fontSize: 12, padding: '5px 0', borderRadius: 6, cursor: 'pointer', border: '1.5px solid #D1D5DB', background: '#fff', color: '#6B7280' }}
                          >Edit</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section B: Quality gate */}
          {analysisResult.description_evaluations?.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A1628', marginBottom: 12 }}>Quality Gate Results</h2>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 60px 60px 60px 60px 70px 110px 60px 1fr', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['SKU', 'Acc', 'Search', 'Spec', 'Clarity', 'Score', 'Risk', 'Pass', 'Notes'].map(h => (
                    <div key={h} style={{ padding: '10px 10px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                  ))}
                </div>
                {analysisResult.description_evaluations.map((e, i) => {
                  const scoreColor = (s) => s >= 8 ? '#10B981' : s >= 6 ? '#F59E0B' : '#EF4444'
                  const composite = e.judge_score ?? e.accuracy
                  return (
                    <div key={e.sku} style={{ display: 'grid', gridTemplateColumns: '130px 60px 60px 60px 60px 70px 110px 60px 1fr', borderBottom: i < analysisResult.description_evaluations.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center' }}>
                      <div style={{ padding: '10px 10px', fontSize: 12, color: '#374151', fontWeight: 500 }}>{e.sku}</div>
                      {e.accuracy != null ? (
                        <>
                          <div style={{ padding: '10px 10px', fontSize: 13, fontWeight: 700, color: scoreColor(e.accuracy) }}>{e.accuracy}</div>
                          <div style={{ padding: '10px 10px', fontSize: 13, fontWeight: 700, color: scoreColor(e.searchability) }}>{e.searchability}</div>
                          <div style={{ padding: '10px 10px', fontSize: 13, fontWeight: 700, color: scoreColor(e.specificity) }}>{e.specificity}</div>
                          <div style={{ padding: '10px 10px', fontSize: 13, fontWeight: 700, color: scoreColor(e.clarity) }}>{e.clarity}</div>
                        </>
                      ) : (
                        <div style={{ padding: '10px 10px', fontSize: 12, color: '#9CA3AF', gridColumn: 'span 4' }}>—</div>
                      )}
                      <div style={{ padding: '10px 10px', fontSize: 14, fontWeight: 800, color: scoreColor(composite) }}>{composite}</div>
                      <div style={{ padding: '10px 10px' }}>
                        <span style={{
                          fontSize: 11, padding: '2px 7px', borderRadius: 999, fontWeight: 600,
                          background: e.hallucination_risk === 'low' ? '#D1FAE5' : e.hallucination_risk === 'medium' ? '#FEF3C7' : '#FEE2E2',
                          color: e.hallucination_risk === 'low' ? '#065F46' : e.hallucination_risk === 'medium' ? '#92400E' : '#991B1B',
                        }}>{e.hallucination_risk}</span>
                      </div>
                      <div style={{ padding: '10px 10px' }}>
                        <span style={{ fontSize: 12, color: e.passes_quality_gate ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                          {e.passes_quality_gate ? '✓' : '✕'}
                        </span>
                      </div>
                      <div style={{ padding: '10px 10px', fontSize: 12, color: '#6B7280' }}>{Array.isArray(e.notes) ? e.notes.join(' · ') : e.notes}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section C: Duplicates */}
          {analysisResult.duplicate_candidates?.filter((_, i) => !dismissedPairs.has(i)).length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0A1628', marginBottom: 12 }}>Potential Duplicates</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {analysisResult.duplicate_candidates.map((d, i) => dismissedPairs.has(i) ? null : (
                  <div key={i} style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, color: '#374151' }}>
                      <span style={{ fontWeight: 600, color: '#0A1628' }}>{d.sku_a}</span>
                      <span style={{ color: '#9CA3AF', margin: '0 10px' }}>↔</span>
                      <span style={{ fontWeight: 600, color: '#0A1628' }}>{d.sku_b}</span>
                      <span style={{ marginLeft: 12, color: '#D97706', fontWeight: 600, fontSize: 12 }}>{d.similarity}% similar</span>
                    </div>
                    <button
                      onClick={() => setDismissedPairs(s => new Set([...s, i]))}
                      style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', color: '#6B7280' }}
                    >Dismiss</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: step === 'review' ? 100 : 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#0A1628' : '#991B1B', color: '#fff',
          padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 1000, whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Sticky bottom bar */}
      {step === 'review' && analysisResult && (
        <div style={{
          position: 'fixed', bottom: 0, left: 240, right: 0, zIndex: 50,
          background: '#fff', borderTop: '1px solid #E5E7EB',
          padding: '16px 36px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 14, color: '#6B7280' }}>
            <span style={{ fontWeight: 700, color: '#0A1628' }}>{approvedCount}</span> of{' '}
            <span style={{ fontWeight: 700, color: '#0A1628' }}>{totalRewrites}</span> rewrites approved
            {changesApplied && <span style={{ marginLeft: 16, color: '#10B981', fontWeight: 600 }}>✓ Changes applied</span>}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={downloadCSV}
              style={{
                padding: '10px 24px', borderRadius: 8, border: '1.5px solid #0A1628',
                background: '#fff', color: '#0A1628', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              Download CSV
            </button>
            <button
              onClick={applyChanges}
              disabled={applyLoading}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: applyLoading ? 'rgba(0,194,224,0.6)' : '#00C2E0',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: applyLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {applyLoading ? 'Applying…' : 'Apply Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
