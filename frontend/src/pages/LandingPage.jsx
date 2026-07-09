import { useNavigate } from 'react-router-dom'

const FEATURES = [
  {
    emoji: '📊',
    title: 'Catalog Intelligence',
    desc: 'Automatically detect vague descriptions, missing specs, and duplicate listings. AI rewrites descriptions to be searchable and accurate.',
    items: [
      'LLM-powered description rewriting',
      'Duplicate detection with similarity scoring',
      'Missing spec auto-detection',
      'Quality gate with hallucination prevention',
    ],
  },
  {
    emoji: '🔍',
    title: 'Search Intelligence',
    desc: 'See exactly how your customers experience search before and after catalog optimization. Understand which products surface and why.',
    items: [
      'Real-time search preview',
      'Optimized result highlighting',
      'Category-aware ranking',
      'Instant results',
    ],
  },
  {
    emoji: '🛒',
    title: 'Smart Cross-Sell',
    desc: 'MCP-powered compatibility matching generates spec-grounded explanations for why products go together — not just correlation, but reasoning.',
    items: [
      'Knowledge graph compatibility matching',
      'Claude-generated explanations',
      'Spec-aware filtering',
      'Business-language confidence levels',
    ],
  },
]

const STATS = [
  { value: '74+',   label: 'Products Analyzed' },
  { value: '8.50',  label: 'Avg Quality Score' },
  { value: '22/22', label: 'Descriptions Optimized' },
  { value: '6',     label: 'Duplicate Pairs Detected' },
]

const STEPS = [
  { n: '1', title: 'Upload your catalog',       desc: 'Connect your product data in any format — JSON, CSV, or API.' },
  { n: '2', title: 'AI analyzes and fixes',     desc: 'LangGraph pipeline runs automatically, rewriting and validating every product.' },
  { n: '3', title: 'Search improves immediately', desc: 'Customers find products, cart sizes grow, revenue follows.' },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A2E' }}>

      {/* ── SECTION 1: Hero ─────────────────────────────────────── */}
      <section
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0A1628 0%, #112240 100%)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Navbar */}
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="22" height="22" fill="none" stroke="#00C2E0" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>SearchForge</span>
          </div>
          <button
            onClick={() => navigate('/login')}
            style={{
              border: '1.5px solid rgba(255,255,255,0.5)',
              background: 'transparent',
              color: '#fff',
              padding: '8px 20px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={e => e.target.style.borderColor = '#fff'}
            onMouseLeave={e => e.target.style.borderColor = 'rgba(255,255,255,0.5)'}
          >
            Sign In
          </button>
        </nav>

        {/* Hero content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px 80px' }}>
          {/* Pill badge */}
          <div style={{
            display: 'inline-block',
            background: 'rgba(0,194,224,0.15)',
            border: '1px solid rgba(0,194,224,0.4)',
            color: '#00C2E0',
            padding: '6px 16px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 28,
            letterSpacing: '0.02em',
          }}>
            AI-Powered B2B Search Intelligence
          </div>

          <h1 style={{ color: '#fff', fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 800, lineHeight: 1.1, maxWidth: 760, marginBottom: 24, letterSpacing: '-1px' }}>
            Fix Your Catalog.<br />Improve Search.<br />Increase Revenue.
          </h1>

          <p style={{ color: '#9CA3AF', fontSize: 18, maxWidth: 580, lineHeight: 1.7, marginBottom: 36 }}>
            SearchForge automatically detects and fixes product data issues that hurt search performance — so your customers find what they need and buy more.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: '#00C2E0',
                color: '#fff',
                border: 'none',
                padding: '14px 32px',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Start Free Trial
            </button>
            <button
              style={{
                background: 'transparent',
                color: '#fff',
                border: '1.5px solid rgba(255,255,255,0.4)',
                padding: '14px 32px',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Watch Demo
            </button>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            No credit card required · Works with any B2B catalog · Setup in minutes
          </p>
        </div>
      </section>

      {/* ── SECTION 2: Stats bar ────────────────────────────────── */}
      <section style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '32px 48px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, textAlign: 'center' }}>
          {STATS.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#0A1628', letterSpacing: '-1px' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 3: Features ─────────────────────────────────── */}
      <section style={{ background: '#F4F6F9', padding: '80px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, color: '#0A1628', marginBottom: 48, letterSpacing: '-0.5px' }}>
            Everything your catalog needs to perform
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,194,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 20 }}>
                  {f.emoji}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0A1628', marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.65, marginBottom: 20 }}>{f.desc}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {f.items.map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                      <span style={{ color: '#00C2E0', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: How it works ─────────────────────────────── */}
      <section style={{ background: '#fff', padding: '80px 48px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, color: '#0A1628', marginBottom: 56, letterSpacing: '-0.5px' }}>
            From messy catalog to optimized search in minutes
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, position: 'relative' }}>
            {/* Connector line */}
            <div style={{ position: 'absolute', top: 28, left: '16.5%', right: '16.5%', height: 2, background: 'linear-gradient(90deg, #00C2E0, #6C2BD9)', zIndex: 0 }} />
            {STEPS.map((step, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: i === 1 ? '#00C2E0' : '#0A1628',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 800,
                  margin: '0 auto 20px',
                  border: '3px solid #fff',
                  boxShadow: '0 0 0 2px ' + (i === 1 ? '#00C2E0' : '#0A1628'),
                }}>
                  {step.n}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0A1628', marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: CTA ──────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #0A1628 0%, #112240 100%)', padding: '80px 48px', textAlign: 'center' }}>
        <h2 style={{ color: '#fff', fontSize: 36, fontWeight: 800, marginBottom: 16, letterSpacing: '-0.5px' }}>
          Ready to optimize your catalog?
        </h2>
        <p style={{ color: '#9CA3AF', fontSize: 17, marginBottom: 36 }}>
          Join B2B distributors using SearchForge to improve search performance.
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: '#00C2E0',
            color: '#fff',
            border: 'none',
            padding: '14px 36px',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Get Started Free
        </button>
      </section>

      {/* ── SECTION 6: Footer ───────────────────────────────────── */}
      <footer style={{ background: '#0A1628', padding: '40px 48px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <svg width="18" height="18" fill="none" stroke="#00C2E0" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>SearchForge</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>AI-Powered B2B Search Intelligence</p>
            </div>
            <div style={{ display: 'flex', gap: 32 }}>
              {['Product', 'Docs', 'Contact'].map(link => (
                <a key={link} href="#" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textDecoration: 'none' }}
                  onMouseEnter={e => e.target.style.color = '#fff'}
                  onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.5)'}
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20, textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>© 2026 SearchForge. Built for B2B eCommerce.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
