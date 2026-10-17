import { useState } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'
import { useAuth } from '../../context/AuthContext'

export default function FirstLoginPasswordPage() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setSaving(true)
    try {
      const response = await apiClient.post('/auth/first-password', { password, confirmPassword })
      const nextUser = updateUser({ ...response.data.user, mustChangePassword: false })
      navigate(`/dashboard/${nextUser.role}`, { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update your password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f7f7f5', color: '#151515' }}>
      <section style={{ width: 'min(100%, 460px)', background: '#fff', border: '1px solid #e5e5e2', borderRadius: 22, padding: 32, boxShadow: '0 24px 80px rgba(0,0,0,.07)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', background: '#f0f0ed', marginBottom: 22 }}><KeyRound size={24} /></div>
        <p style={{ fontSize: 11, letterSpacing: '.14em', fontWeight: 800, color: '#777', margin: '0 0 10px' }}>FIRST LOGIN SECURITY</p>
        <h1 style={{ fontSize: 30, letterSpacing: '-.04em', margin: '0 0 10px' }}>Create your password</h1>
        <p style={{ color: '#6b6b68', lineHeight: 1.6, margin: '0 0 24px' }}>Welcome{user?.name ? `, ${user.name}` : ''}. Your temporary password must be replaced before you can use the school portal.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 7, fontSize: 13, fontWeight: 700 }}>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} style={{ height: 46, border: '1px solid #d8d8d4', borderRadius: 11, padding: '0 12px', fontSize: 15 }} /></label>
          <label style={{ display: 'grid', gap: 7, fontSize: 13, fontWeight: 700 }}>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} style={{ height: 46, border: '1px solid #d8d8d4', borderRadius: 11, padding: '0 12px', fontSize: 15 }} /></label>
          <p style={{ color: '#777', fontSize: 12, margin: 0 }}>Use at least 8 characters. Keep your password private.</p>
          {error && <p role="alert" style={{ background: '#fff1f1', color: '#9d2424', padding: 12, borderRadius: 10, margin: 0, fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={saving} style={{ height: 48, border: 0, borderRadius: 12, background: '#151515', color: '#fff', fontWeight: 750, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Saving password…' : 'Save password and continue'}</button>
        </form>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#777', fontSize: 12, marginTop: 20 }}><ShieldCheck size={16} />Your password is stored securely.</div>
        <button onClick={logout} type="button" style={{ marginTop: 18, border: 0, padding: 0, background: 'transparent', color: '#555', textDecoration: 'underline', cursor: 'pointer' }}>Sign out</button>
      </section>
    </main>
  )
}
