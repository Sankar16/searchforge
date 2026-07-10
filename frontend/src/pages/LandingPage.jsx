import { useNavigate } from 'react-router-dom'

const FEATURES = [
  {
    emoji: '📊',
    title: 'Catalog Intelligence',
    accent: '#00C2E0',
    poweredBy: 'LangGraph + Claude Sonnet',
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
    accent: '#6C2BD9',
    poweredBy: 'ChromaDB + all-MiniLM-L6-v2',
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
    accent: '#10B981',
    poweredBy: 'MCP + Claude Haiku',
    desc: 'MCP-powered compatibility matching generates spec-grounded explanations for why products go together — not just correlation, but reasoning.',
    items: [
      'Knowledge graph compatibility matching',
      'Claude-generated explanations',
      'Spec-aware filtering',
      'Business-language confidence levels',
    ],
  },
]

const STEPS = [
  {
    emoji: '📤',
    bg: '#0A1628',
    title: 'Upload your catalog',
    desc: 'Upload your catalog CSV or use our sample 74-product industrial catalog.',
  },
  {
    emoji: '⚙️',
    bg: '#00C2E0',
    title: 'AI analyzes and fixes',
    desc: 'LangGraph pipeline runs automatically, rewriting and validating every product.',
  },
  {
    emoji: '📈',
    bg: '#10B981',
    title: 'Search improves immediately',
    desc: 'Customers find products, cart sizes grow, revenue follows.',
  },
]

const TECH_BADGES = ['LangGraph', 'Claude', 'MCP', 'ChromaDB', 'Pydantic AI', 'FastAPI', 'React']

const ANIMATION_CSS = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.sf-anim-line {
  opacity: 0;
  animation: fadeInUp 0.45s ease forwards;
}
`

const TERMINAL_LINES = [
  { delay: '0s',    icon: '✓', iconCls: '#4ADE80', label: 'Loading catalog',       value: '74 products',    valueCls: '#2DD4BF', pulse: false },
  { delay: '0.8s',  icon: '✓', iconCls: '#4ADE80', label: 'Duplicates found',      value: '6 pairs',        valueCls: '#FBB24B', pulse: false },
  { delay: '1.6s',  icon: '✓', iconCls: '#4ADE80', label: 'Spec gaps detected',    value: '8 products',     valueCls: '#F87171', pulse: false },
  { delay: '2.4s',  icon: '✓', iconCls: '#4ADE80', label: 'Descriptions rewritten', value: '22/22',         valueCls: '#4ADE80', pulse: false },
  { delay: '3.2s',  icon: '✓', iconCls: '#4ADE80', label: 'Quality gate passed',   value: 'avg 8.5/10',     valueCls: '#2DD4BF', pulse: false },
  { delay: '4.0s',  icon: '▶', iconCls: '#2DD4BF', label: 'Search quality improved', value: '+34%',         valueCls: '#4ADE80', pulse: true,  bold: true },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A2E' }}>
      <style>{ANIMATION_CSS}</style>

      {/* ── SECTION 1: Hero ─────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0A1628 0%, #112240 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}>
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
            style={{ border: '1.5px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#fff'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'}
          >
            Sign In
          </button>
        </nav>

        {/* Hero two-column body */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 48px 80px' }}>
          <div style={{ maxWidth: 1160, width: '100%', display: 'flex', gap: 64, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Left column — headline + buttons */}
            <div style={{ flex: '1 1 380px', minWidth: 300 }}>
              <div style={{ display: 'inline-block', background: 'rgba(0,194,224,0.15)', border: '1px solid rgba(0,194,224,0.4)', color: '#00C2E0', padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, marginBottom: 28, letterSpacing: '0.02em' }}>
                AI-Powered B2B Search Intelligence
              </div>

              <h1 style={{ color: '#fff', fontSize: 'clamp(30px, 4.5vw, 56px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 24, letterSpacing: '-1px' }}>
                Fix Your Catalog.<br />Improve Search.<br />Increase Revenue.
              </h1>

              <p style={{ color: '#9CA3AF', fontSize: 18, lineHeight: 1.7, marginBottom: 36, maxWidth: 520 }}>
                SearchForge automatically detects and fixes product data issues that hurt search performance — so your customers find what they need and buy more.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <button
                  onClick={() => navigate('/login')}
                  style={{ background: '#00C2E0', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                >
                  Try It Free →
                </button>
                <button
                  style={{ background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                >
                  Watch Demo
                </button>
              </div>

              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                No credit card required · Works with any B2B catalog · Setup in minutes
              </p>
            </div>

            {/* Right column — animated terminal card */}
            <div style={{ flex: '1 1 300px', minWidth: 280, maxWidth: 460 }}>
              <div style={{ background: '#1E293B', borderRadius: 14, border: '1px solid #334155', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                {/* Terminal header bar */}
                <div style={{ background: '#0F172A', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #1E293B' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  <span style={{ color: '#94A3B8', fontSize: 12, marginLeft: 8, fontFamily: 'monospace' }}>catalog-analysis.py</span>
                </div>
                {/* Terminal lines */}
                <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'monospace', fontSize: 13 }}>
                  {TERMINAL_LINES.map((line, i) => (
                    <div
                      key={i}
                      className="sf-anim-line"
                      style={{ animationDelay: line.delay, display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <span style={{ color: line.iconCls, fontSize: 14, animation: line.pulse ? 'fadeInUp 0.45s ease forwards, pulse 1.5s ease-in-out 4s infinite' : undefined }}>
                        {line.icon}
                      </span>
                      <span style={{ color: '#CBD5E1', flex: 1, fontWeight: line.bold ? 600 : 400 }}>
                        {line.label}
                      </span>
                      <span style={{ color: line.valueCls, fontWeight: line.bold ? 700 : 500 }}>
                        {line.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 2: Before / After ───────────────────────────── */}
      <section style={{ background: '#fff', padding: '72px 48px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, color: '#0A1628', marginBottom: 14, letterSpacing: '-0.5px' }}>
              Your catalog is losing customers right now
            </h2>
            <p style={{ color: '#6B7280', fontSize: 17, lineHeight: 1.6, maxWidth: 520, margin: '0 auto' }}>
              Vague product descriptions mean zero search results. SearchForge fixes this automatically.
            </p>
          </div>

          {/* Cards + arrow row */}
          <div style={{ display: 'flex', gap: 0, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>

            {/* BEFORE card */}
            <div style={{ flex: '1 1 300px', maxWidth: 400, border: '2px solid #FECACA', background: '#FFF5F5', borderRadius: 20, padding: '24px 24px 28px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                ❌ Without SearchForge
              </div>
              <span style={{ background: '#F3F4F6', color: '#374151', fontSize: 12, padding: '3px 10px', borderRadius: 999, fontWeight: 500 }}>
                6205-2RS Bearing
              </span>
              <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', marginTop: 12, border: '1px solid #FECACA' }}>
                <p style={{ color: '#9CA3AF', fontSize: 14, fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>"Good bearing."</p>
              </div>
              <div style={{ marginTop: 18 }}>
                <p style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 6 }}>Customer searches for:</p>
                <span style={{ background: '#CCFBF1', color: '#0D9488', fontSize: 13, padding: '4px 12px', borderRadius: 999, fontWeight: 500 }}>
                  sealed bearing for motor
                </span>
              </div>
              <div style={{ marginTop: 16 }}>
                <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: 13, padding: '5px 14px', borderRadius: 999, fontWeight: 600 }}>
                  ✗ 0 results found
                </span>
                <p style={{ color: '#EF4444', fontSize: 12, marginTop: 8, marginBottom: 0 }}>Customer leaves. Sale lost.</p>
              </div>
            </div>

            {/* Arrow */}
            <div style={{ padding: '0 20px', color: '#00C2E0', fontSize: 32, fontWeight: 300, flexShrink: 0, lineHeight: 1 }}>
              →
            </div>

            {/* AFTER card */}
            <div style={{ flex: '1 1 300px', maxWidth: 400, border: '2px solid #A7F3D0', background: '#F0FDF4', borderRadius: 20, padding: '24px 24px 28px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                ✓ With SearchForge
              </div>
              <span style={{ background: '#F3F4F6', color: '#374151', fontSize: 12, padding: '3px 10px', borderRadius: 999, fontWeight: 500 }}>
                6205-2RS Bearing
              </span>
              <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', marginTop: 12, border: '1px solid #A7F3D0' }}>
                <p style={{ color: '#1F2937', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                  "SKF deep groove ball bearing with double rubber seals, 25mm bore, 52mm OD. Ideal for motors, pumps, and conveyors in dusty or wet environments."
                </p>
              </div>
              <div style={{ marginTop: 18 }}>
                <p style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 6 }}>Customer searches for:</p>
                <span style={{ background: '#CCFBF1', color: '#0D9488', fontSize: 13, padding: '4px 12px', borderRadius: 999, fontWeight: 500 }}>
                  sealed bearing for motor
                </span>
              </div>
              <div style={{ marginTop: 16 }}>
                <span style={{ background: '#D1FAE5', color: '#059669', fontSize: 13, padding: '5px 14px', borderRadius: 999, fontWeight: 600 }}>
                  ✓ 5 relevant results
                </span>
                <p style={{ color: '#059669', fontSize: 12, marginTop: 8, marginBottom: 0 }}>Customer finds product. Sale made.</p>
              </div>
            </div>

          </div>

          {/* Small stats row */}
          <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 36, marginBottom: 0 }}>
            74 products analyzed · 22/22 descriptions improved · avg quality score 8.5/10 · 6 duplicate pairs detected
          </p>
        </div>
      </section>

      {/* ── SECTION 3: Features ─────────────────────────────────── */}
      <section style={{ background: '#F4F6F9', padding: '80px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, color: '#0A1628', marginBottom: 48, letterSpacing: '-0.5px' }}>
            Everything your catalog needs to perform
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column' }}>
                {/* Accent bar */}
                <div style={{ height: 4, background: f.accent, flexShrink: 0 }} />
                <div style={{ padding: '28px 28px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,194,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 20 }}>
                    {f.emoji}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0A1628', marginBottom: 10 }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.65, marginBottom: 20 }}>{f.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {f.items.map(item => (
                      <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                        <span style={{ color: '#00C2E0', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p style={{ color: '#9CA3AF', fontSize: 11, marginTop: 20, marginBottom: 0 }}>
                    Powered by {f.poweredBy}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech stack credibility bar ───────────────────────────── */}
      <div style={{ background: '#0A1628', padding: '20px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#6B7280', fontSize: 13, marginRight: 4 }}>Built on</span>
          {TECH_BADGES.map(tech => (
            <span key={tech} style={{ background: '#1E293B', color: '#CBD5E1', fontSize: 12, padding: '4px 12px', borderRadius: 999, border: '1px solid #334155' }}>
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* ── SECTION 4: How it works ─────────────────────────────── */}
      <section style={{ background: '#fff', padding: '80px 48px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, color: '#0A1628', marginBottom: 56, letterSpacing: '-0.5px' }}>
            From messy catalog to optimized search in minutes
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, position: 'relative' }}>
            {/* Connector line */}
            <div style={{ position: 'absolute', top: 28, left: '16.5%', right: '16.5%', height: 2, background: 'linear-gradient(90deg, #0A1628, #00C2E0, #10B981)', zIndex: 0 }} />
            {STEPS.map((step, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: step.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                  margin: '0 auto 20px',
                  border: '3px solid #fff',
                  boxShadow: '0 0 0 2px ' + step.bg,
                }}>
                  {step.emoji}
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
        <h2 style={{ color: '#fff', fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, marginBottom: 16, letterSpacing: '-0.5px' }}>
          See SearchForge fix a real B2B catalog in 60 seconds
        </h2>
        <p style={{ color: '#9CA3AF', fontSize: 17, marginBottom: 36 }}>
          Upload your catalog or try our sample — no account setup needed.
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{ background: '#00C2E0', color: '#fff', border: 'none', padding: '14px 36px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
        >
          Try It Free →
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
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                >
                  {link}
                </a>
              ))}
              <a
                href="https://github.com/Sankar16/searchforge"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
              >
                GitHub
              </a>
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
