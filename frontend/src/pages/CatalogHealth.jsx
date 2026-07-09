import { useState, useRef, useEffect } from 'react'
import { useCatalog } from '../context/CatalogContext.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATUS_MSGS = [
  'Loading catalog data…',
  'Normalizing specifications…',
  'Detecting duplicate SKUs…',
  'Evaluating descriptions with AI…',
  'Rewriting weak descriptions…',
  'Running quality gate…',
  'Generating health report…',
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
  // ── Context state (persists across navigation) ─────────────────────────
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
  } = useCatalog()

  // ── Local transient UI state ───────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [statusIdx, setStatusIdx] = useState(0)
  const [editingSkus, setEditingSkus] = useState({})   // {sku: bool}
  const [editBuffer, setEditBuffer] = useState({})      // {sku: string}
  const [dismissedPairs, setDismissedPairs] = useState(new Set())
  const [applyLoading, setApplyLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const fileInputRef = useRef(null)

  // Derive step from context + loading
  const step = !analysisRan ? 'upload' : loading ? 'analyze' : 'review'

  // Elapsed timer while analyzing
  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    setStatusIdx(0)
    const tick = setInterval(() => {
      setElapsed(s => s + 1)
      setStatusIdx(i => Math.min(i + 1, STATUS_MSGS.length - 1))
    }, 12000)
    return () => clearInterval(tick)
  }, [loading])

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Helpers: review state ──────────────────────────────────────────────

  // A SKU is rejected if it's in the rejectedSkus list
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
    // Ensure the SKU is approved after editing
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

  // ── Upload ─────────────────────────────────────────────────────────────

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

  // ── Analyze ────────────────────────────────────────────────────────────

  async function runAnalysis() {
    setLoading(true)
    setAnalysisRan(false)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3 * 60 * 1000)
    try {
      const src = uploadSource === 'file' ? 'uploaded' : 'sample'
      const res = await fetch(`${API}/api/catalog/analyze?source=${src}`, {
        method: 'POST',
        signal: controller.signal,
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Analysis failed')
      const data = await res.json()
      setAnalysisResult(data)
      setAnalysisRan(true)
      // Default all rewrite SKUs to approved
      const allSkus = (data.description_rewrites || []).map(r => r.sku)
      approveSkus(allSkus)
    } catch (e) {
      if (e.name === 'AbortError') showToast('Analysis timed out. Please try again.', false)
      else showToast(e.message, false)
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  // ── Apply / Download ───────────────────────────────────────────────────

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

  // ── Derived ────────────────────────────────────────────────────────────

  const totalRewrites = (analysisResult?.description_rewrites || []).length
  const approvedCount = totalRewrites - rejectedSkus.filter(s =>
    (analysisResult?.description_rewrites || []).some(r => r.sku === s)
  ).length

  // ── Render ─────────────────────────────────────────────────────────────

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

            {/* Option A: CSV upload */}
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
                  <div style={{ color: '#D1D5DB', fontSize: 12, marginTop: 8 }}>Required: SKU, Name, Category, Description</div>
                </>
              )}
            </div>

            {/* Option B: Sample catalog */}
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
                  <div style={{ color: '#D1D5DB', fontSize: 12, marginTop: 8 }}>Perfect for exploring the platform</div>
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
                style={{
                  background: '#00C2E0', color: '#fff', border: 'none',
                  padding: '13px 36px', borderRadius: 10, fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >
                Run Analysis →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Analyzing ──────────────────────────────────────────── */}
      {step === 'analyze' && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 20 }}>{STATUS_MSGS[statusIdx]}</div>
          <div style={{ width: 400, margin: '0 auto', background: '#E5E7EB', borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.min((elapsed / 90) * 100, 95)}%`,
              background: 'linear-gradient(90deg, #00C2E0, #6C2BD9)',
              borderRadius: 999, transition: 'width 1s linear',
            }} />
          </div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 12 }}>
            Analyzing… ({elapsed}s) — typically 1–3 minutes
          </div>
        </div>
      )}

      {/* ── STEP 3: Review ─────────────────────────────────────────────── */}
      {step === 'review' && analysisResult && (
        <div>
          {/* Metric cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
            <StatCard label="Total Products" value={analysisResult.total_products} />
            <StatCard label="Issues Remaining" value={analysisResult.total_issues} accent={analysisResult.total_issues > 0 ? '#EF4444' : '#10B981'} />
            <StatCard label="Spec Issues Fixed" value={analysisResult.spec_issues_before - analysisResult.spec_issues_after} sub={`was ${analysisResult.spec_issues_before}`} accent="#00C2E0" />
            <StatCard label="Descriptions Optimized" value={analysisResult.descriptions_passing_judge} sub={`avg score ${analysisResult.avg_judge_score}`} accent="#00C2E0" />
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
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0A1628' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{r.sku}</div>
                      </div>
                      <div style={{ padding: '14px 16px', fontSize: 13, color: '#6B7280', lineHeight: 1.55 }}>
                        {r.original_description}
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
                <div style={{ display: 'grid', gridTemplateColumns: '140px 80px 130px 80px 1fr', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['SKU', 'Score', 'Hallucination Risk', 'Passed', 'Notes'].map(h => (
                    <div key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                  ))}
                </div>
                {analysisResult.description_evaluations.map((e, i) => (
                  <div key={e.sku} style={{ display: 'grid', gridTemplateColumns: '140px 80px 130px 80px 1fr', borderBottom: i < analysisResult.description_evaluations.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <div style={{ padding: '12px 16px', fontSize: 13, color: '#374151', fontWeight: 500 }}>{e.sku}</div>
                    <div style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: e.judge_score >= 8 ? '#10B981' : e.judge_score >= 6 ? '#F59E0B' : '#EF4444' }}>{e.judge_score}</div>
                    <div style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 12, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                        background: e.hallucination_risk === 'low' ? '#D1FAE5' : e.hallucination_risk === 'medium' ? '#FEF3C7' : '#FEE2E2',
                        color: e.hallucination_risk === 'low' ? '#065F46' : e.hallucination_risk === 'medium' ? '#92400E' : '#991B1B',
                      }}>{e.hallucination_risk}</span>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, color: e.passes_quality_gate ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                        {e.passes_quality_gate ? '✓ Yes' : '✕ No'}
                      </span>
                    </div>
                    <div style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>{e.notes}</div>
                  </div>
                ))}
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

      {/* ── Toast ──────────────────────────────────────────────────────── */}
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

      {/* ── Sticky bottom bar ──────────────────────────────────────────── */}
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
