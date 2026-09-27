import { useState } from 'react'
import { Eye, EyeOff, GraduationCap, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const demoAccounts = [
  { label: 'Principal', email: 'principal@school.com' },
  { label: 'Teacher', email: 'teacher@school.com' },
  { label: 'Student', email: 'student@school.com' },
  { label: 'Parent', email: 'parent@school.com' },
  { label: 'Accountant', email: 'accountant@school.com' },
]

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

  const handleSubmit = (event) => {
    event.preventDefault()
    setLoading(true)

    window.setTimeout(() => {
      const result = login(form.email, form.password)

      if (!result.success) {
        setError(result.message)
        setLoading(false)
        return
      }

      navigate(`/dashboard/${result.user.role}`, { replace: true })
      setLoading(false)
    }, 350)
  }

  const fillDemo = (email) => {
    setForm({ email, password: '123456' })
    setError('')
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-mark large">
          <GraduationCap size={30} strokeWidth={2.2} />
        </div>
        <span className="eyebrow">SCHOOL MANAGEMENT</span>
        <h1>One connected place for your entire school.</h1>
        <p>
          Manage people, academics, attendance, communication and school operations from one secure platform.
        </p>

        <div className="login-benefits">
          <div>
            <ShieldCheck size={18} />
            <span>Role-based access</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>Built for every school role</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>Responsive on desktop and mobile</span>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <div className="brand-mark">
              <GraduationCap size={24} />
            </div>
            <div>
              <strong>SchoolOS</strong>
              <span>Management Portal</span>
            </div>
          </div>

          <div className="form-heading">
            <span className="eyebrow">WELCOME BACK</span>
            <h2>Sign in to your account</h2>
            <p>Use the account provided by your school administrator.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="email">Email address</label>
            <div className="input-wrap">
              <Mail size={18} />
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
            <div className="input-wrap">
              <LockKeyhole size={18} />
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
                className="input-action"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && <div className="form-error">{error}</div>}

            <button className="primary-button login-button" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="demo-section">
            <div className="demo-heading">
              <span>Development demo accounts</span>
              <small>Password: 123456</small>
            </div>
            <div className="demo-grid">
              {demoAccounts.map((account) => (
                <button key={account.email} type="button" onClick={() => fillDemo(account.email)}>
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Login
