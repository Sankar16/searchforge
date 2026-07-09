import { useState, useEffect, useCallback } from 'react'

const API = 'http://localhost:8000'

function StatCard({ label, value, sub, color = '#00C2E0' }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '20px 24px',
      border: '1px solid #E5E7EB', flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24, marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0A1628' }}>{title}</h3>
      {children}
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>{text}</div>
  )
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/analytics`)
      if (res.ok) {
        setData(await res.json())
        setLastRefresh(new Date())
      }
    } catch (_) {}
  }, [])

  useEffect(() => {
    fetchAnalytics()
    const id = setInterval(fetchAnalytics, 10000)
    return () => clearInterval(id)
  }, [fetchAnalytics])

  if (!data) {
    return (
      <div style={{ padding: 32, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#9CA3AF', fontSize: 14 }}>Loading analytics…</div>
      </div>
    )
  }

  const { searches, gap_analyses, catalog } = data

  return (
    <div style={{ padding: 32, maxWidth: 960, fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0A1628' }}>Analytics</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            Search and catalog performance · auto-refreshes every 10s
            {lastRefresh && ` · last updated ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          style={{
            fontSize: 13, padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontWeight: 500,
          }}
        >
          Refresh now
        </button>
      </div>

      {/* 1 — Search overview stat cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Total Searches" value={searches.total} sub="since server start" />
        <StatCard
          label="Zero-Result Rate"
          value={`${searches.zero_result_rate}%`}
          sub="searches with no hits"
          color={searches.zero_result_rate > 20 ? '#EF4444' : '#10B981'}
        />
        <StatCard
          label="Avg Top Score"
          value={searches.total ? `${searches.avg_top_score}` : '—'}
          sub="relevance of best match"
          color="#6366F1"
        />
        <StatCard label="Gap Analyses" value={gap_analyses.total} sub="zero-result queries analyzed" color="#F59E0B" />
      </div>

      {/* 2 — Catalog stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Analyses Run" value={catalog.analyses_run} sub="full pipeline runs" color="#0A1628" />
        <StatCard label="Descriptions Approved" value={catalog.descriptions_approved} color="#10B981" />
        <StatCard label="Descriptions Rejected" value={catalog.descriptions_rejected} color="#EF4444" />
        <StatCard
          label="Approval Rate"
          value={catalog.analyses_run ? `${catalog.approval_rate}%` : '—'}
          sub="of reviewed rewrites"
          color={catalog.approval_rate >= 70 ? '#10B981' : '#F59E0B'}
        />
      </div>

      {/* 3 — Top queries */}
      <Section title="Top Search Queries">
        {searches.top_queries.length === 0 ? (
          <EmptyState text="No searches yet. Try the Search Preview page." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Query</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Count</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Bar</th>
              </tr>
            </thead>
            <tbody>
              {searches.top_queries.map((row, i) => {
                const maxCount = searches.top_queries[0]?.count || 1
                const pct = Math.round((row.count / maxCount) * 100)
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 8px', color: '#1A1A2E', fontWeight: 500 }}>{row.query}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: '#374151' }}>{row.count}</td>
                    <td style={{ padding: '8px 8px', width: 160 }}>
                      <div style={{ background: '#F3F4F6', borderRadius: 4, height: 8 }}>
                        <div style={{ background: '#00C2E0', borderRadius: 4, height: 8, width: `${pct}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* 4 — Recent searches */}
      <Section title="Recent Searches">
        {searches.recent.length === 0 ? (
          <EmptyState text="No searches recorded yet." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Query</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Mode</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Results</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Top Score</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {searches.recent.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '8px 8px', color: '#1A1A2E', fontWeight: 500 }}>{s.query}</td>
                  <td style={{ padding: '8px 8px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                      background: s.mode === 'clean' ? '#D1FAE5' : '#FEF3C7',
                      color: s.mode === 'clean' ? '#065F46' : '#92400E',
                    }}>{s.mode}</span>
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: s.result_count === 0 ? '#EF4444' : '#374151' }}>
                    {s.result_count === 0 ? '0 ⚠' : s.result_count}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#374151' }}>
                    {s.result_count > 0 ? s.top_match_score.toFixed(1) : '—'}
                  </td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                    {new Date(s.timestamp + 'Z').toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* 5 — Recent gap analyses */}
      <Section title="Recent Gap Analyses">
        {gap_analyses.recent.length === 0 ? (
          <EmptyState text="No gap analyses yet. Run a zero-result search and click 'Analyze Gap'." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Query</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Hidden Matches</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6B7280', fontWeight: 600 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {gap_analyses.recent.map((g, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '8px 8px', color: '#1A1A2E', fontWeight: 500 }}>{g.query}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#374151' }}>{g.hidden_match_count}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                    {new Date(g.timestamp + 'Z').toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}
