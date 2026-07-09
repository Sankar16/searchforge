import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext.jsx'

const NAV = [
  {
    to: '/app/catalog',
    label: 'Catalog Optimizer',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: '/app/search',
    label: 'Search Preview',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    to: '/app/crosssell',
    label: 'Smart Recommendations',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9M17 19a1 1 0 100 2 1 1 0 000-2zm-8 0a1 1 0 100 2 1 1 0 000-2z" />
      </svg>
    ),
  },
]

export default function AppShell() {
  const navigate = useNavigate()
  const { analysisRan, analysisResult, changesApplied, savedPairings, activeJobId } = useCatalog()

  function logout() {
    localStorage.removeItem('sf_authenticated')
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* Top bar */}
      <header style={{
        height: 56,
        background: '#fff',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" fill="none" stroke="#0A1628" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#0A1628' }}>SearchForge</span>
        </div>

        {/* User info + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#00C2E0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
            D
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Demo User</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>demo@searchforge.com</div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#9CA3AF', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9CA3AF' }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside style={{ width: 240, background: '#0A1628', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '16px 12px', overflowY: 'auto' }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                  borderLeft: isActive ? '3px solid #00C2E0' : '3px solid transparent',
                  paddingLeft: isActive ? 9 : 9,
                  background: isActive ? 'rgba(0,194,224,0.12)' : 'transparent',
                  color: isActive ? '#00C2E0' : 'rgba(255,255,255,0.65)',
                })}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Analysis running indicator */}
          {activeJobId && (
            <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <style>{`@keyframes sf-pulse { 0%,100%{opacity:1} 50%{opacity:.4} } .sf-pulse{animation:sf-pulse 1.5s ease-in-out infinite}`}</style>
              <div className="sf-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#FBBF24', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#FBBF24' }}>Analysis running…</span>
            </div>
          )}

          {/* Catalog status card */}
          {analysisRan && (
            <div style={{ marginTop: 16, padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
              {changesApplied ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#10B981', marginBottom: 4 }}>✓ Changes applied</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                    {analysisResult?.descriptions_passing_judge ?? 0} descriptions optimized
                  </div>
                  <button
                    onClick={async () => {
                      const res = await fetch('http://localhost:8000/api/catalog/download')
                      if (!res.ok) return
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'optimized_catalog.csv'
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    style={{
                      width: '100%', fontSize: 11, padding: '6px 0', borderRadius: 6,
                      border: '1px solid rgba(0,194,224,0.4)', background: 'rgba(0,194,224,0.1)',
                      color: '#00C2E0', cursor: 'pointer', fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download CSV
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#00C2E0', marginBottom: 4 }}>✓ Analysis complete</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    {analysisResult?.description_rewrites?.length ?? 0} descriptions reviewed
                  </div>
                </>
              )}
            </div>
          )}

          {/* FIX 3b: Saved pairings count */}
          {savedPairings.length > 0 && (
            <div
              onClick={() => navigate('/app/crosssell')}
              style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(0,194,224,0.08)', border: '1px solid rgba(0,194,224,0.2)',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,194,224,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,194,224,0.08)'}
            >
              <span style={{ fontSize: 14 }}>🛒</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#00C2E0' }}>
                {savedPairings.length} saved pairing{savedPairings.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>B2B Search Intelligence</p>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, background: '#F4F6F9', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
