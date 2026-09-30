import { useState } from 'react'
import { Eye, EyeOff, GraduationCap, LockKeyhole, Mail } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(form.email, form.password)

    if (!result.success) {
      setError(result.message)
      setLoading(false)
      return
    }

    navigate(`/dashboard/${result.user.role}`, { replace: true })
    setLoading(false)
  }

  return (
    <main className="immersive-login">
      <div className="immersive-login-image" aria-hidden="true" />
      <div className="immersive-login-vignette" aria-hidden="true" />
      <div className="immersive-login-glow glow-one" aria-hidden="true" />
      <div className="immersive-login-glow glow-two" aria-hidden="true" />

      <header className="immersive-login-brand">
        <div className="immersive-brand-mark">
          <GraduationCap size={20} strokeWidth={2.2} />
        </div>
        <div>
          <strong>School Management System</strong>
          <span>Secure school workspace</span>
        </div>
      </header>

      <section className="immersive-login-card" aria-label="Sign in">
        <div className="immersive-card-topline" />
        <div className="immersive-card-icon"><GraduationCap size={22} /></div>
        <span className="immersive-kicker">WELCOME BACK</span>
        <h1>Sign in to your account</h1>
        <p className="immersive-subtitle">Use the credentials provided by your school administrator.</p>

        <form onSubmit={handleSubmit} className="immersive-form">
          <label htmlFor="email">Email address</label>
          <div className="immersive-input">
            <Mail size={17} />
            <input id="email" name="email" type="email" placeholder="you@school.com" value={form.email} onChange={handleChange} autoComplete="email" required />
          </div>

          <label htmlFor="password">Password</label>
          <div className="immersive-input">
            <LockKeyhole size={17} />
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={form.password} onChange={handleChange} autoComplete="current-password" required />
            <button type="button" className="immersive-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {error && <div className="immersive-form-error">{error}</div>}

          <button className="immersive-submit" type="submit" disabled={loading}>
            <span>{loading ? 'Signing in...' : 'Continue to dashboard'}</span>
            <span aria-hidden="true">↗</span>
          </button>
        </form>

        <div className="immersive-security">
          <span className="security-dot" />
          Secure login · Role-based access
        </div>
      </section>

      <footer className="immersive-login-footer">
        <span>© 2026 School Management System</span>
        <span>Authorized school users only</span>
      </footer>
    </main>
  )
}

export default Login
