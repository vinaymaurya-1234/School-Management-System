import { useState } from 'react'
import { Eye, EyeOff, GraduationCap, LockKeyhole, Mail } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './LoginPremium.css'

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
    <main className="premium-login">
      <div className="premium-login__photo" aria-hidden="true" />
      <div className="premium-login__shade" aria-hidden="true" />
      <div className="premium-login__grain" aria-hidden="true" />

      <div className="premium-login__topline">
        <span className="premium-login__brand">
          <span className="premium-login__brand-mark"><GraduationCap size={15} strokeWidth={2.4} /></span>
          School Management
        </span>
        <span className="premium-login__secure">Secure school portal</span>
      </div>

      <section className="premium-login__card" aria-label="Sign in">
        <div className="premium-login__card-glow" aria-hidden="true" />

        <div className="premium-login__intro">
          <div className="premium-login__icon"><GraduationCap size={23} strokeWidth={2} /></div>
          <span className="premium-login__eyebrow">WELCOME BACK</span>
          <h1>Sign in to your account</h1>
          <p>Use the account provided by your school administrator.</p>
        </div>

        <form onSubmit={handleSubmit} className="premium-login__form">
          <label htmlFor="email">Email address</label>
          <div className="premium-login__input">
            <Mail size={17} />
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@school.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          <label htmlFor="password">Password</label>
          <div className="premium-login__input">
            <LockKeyhole size={17} />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="premium-login__password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {error && <div className="premium-login__error">{error}</div>}

          <button className="premium-login__submit" type="submit" disabled={loading}>
            <span>{loading ? 'Signing in...' : 'Sign in'}</span>
            <span className="premium-login__submit-arrow" aria-hidden="true">↗</span>
          </button>
        </form>

        <div className="premium-login__security">
          <span className="premium-login__status-dot" />
          Protected access · Role-based permissions
        </div>
      </section>

      <div className="premium-login__bottomline">
        <span>© 2026 School Management System</span>
        <span>Authorized users only</span>
      </div>
    </main>
  )
}

export default Login
