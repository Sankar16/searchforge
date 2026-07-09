import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    await new Promise(r => setTimeout(r, 400)) // brief loading feel

    if (email === 'demo@searchforge.com' && password === 'demo123') {
      localStorage.setItem('sf_authenticated', 'true')
      navigate('/app/catalog', { replace: true })
    } else {
      setError('Invalid credentials. Use the demo credentials below.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.10)', padding: '44px 40px', width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <svg width="26" height="26" fill="none" stroke="#0A1628" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#0A1628' }}>SearchForge</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0A1628', margin: '0 0 6px' }}>Welcome back</h2>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Sign in to your account</p>
        </div>

        <div style={{ borderTop: '1px solid #E5E7EB', marginBottom: 28 }} />

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="demo@searchforge.com"
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 10,
                border: '1.5px solid #E5E7EB',
                fontSize: 14,
                color: '#1A1A2E',
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#00C2E0'; e.target.style.boxShadow = '0 0 0 3px rgba(0,194,224,0.12)' }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 10,
                border: '1.5px solid #E5E7EB',
                fontSize: 14,
                color: '#1A1A2E',
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#00C2E0'; e.target.style.boxShadow = '0 0 0 3px rgba(0,194,224,0.12)' }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? 'rgba(0,194,224,0.6)' : '#00C2E0',
              color: '#fff',
              border: 'none',
              padding: '13px',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Demo hint */}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 16, lineHeight: 1.5 }}>
          Use demo credentials:<br />
          <span style={{ fontFamily: 'monospace', color: '#6B7280' }}>demo@searchforge.com</span> / <span style={{ fontFamily: 'monospace', color: '#6B7280' }}>demo123</span>
        </p>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.color = '#0A1628'}
            onMouseLeave={e => e.target.style.color = '#6B7280'}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
