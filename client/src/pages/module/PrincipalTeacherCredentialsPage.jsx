import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Download, KeyRound, Loader2, RefreshCw, Search, ShieldCheck, Users, X } from 'lucide-react'
import apiClient from '../../api/client'
import './PrincipalCredentialsPage.css'

export default function PrincipalTeacherCredentialsPage() {
  const [teachers, setTeachers] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState('')
  const [newCredential, setNewCredential] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get('/teachers/credentials')
      const list = Array.isArray(response.data?.teachers) ? response.data.teachers : []
      setTeachers(list.filter((item) => item && item.userId && item.loginId))
      const provisioned = Array.isArray(response.data?.provisionedCredentials) ? response.data.provisionedCredentials : []
      if (provisioned.length) {
        const rows = [['Teacher', 'Employee ID', 'Login ID', 'Temporary Password'], ...provisioned.map((item) => [item.name, item.employeeId, item.loginId, item.temporaryPassword])]
        const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\\r\\n')
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'existing-teacher-login-credentials.csv'
        anchor.click()
        URL.revokeObjectURL(url)
        setNotice(`Generated login credentials for ${provisioned.length} existing teacher account(s). Downloaded the temporary credentials CSV; share it privately.`)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load teacher credentials.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const visibleTeachers = teachers.filter((item) =>
    `${item.name || ''} ${item.loginId || ''} ${item.email || ''} ${item.employeeId || ''} ${item.phone || ''}`.toLowerCase().includes(query.toLowerCase())
  )

  const resetPassword = async (teacher) => {
    if (!teacher.userId) return
    setBusyId(teacher.userId)
    setError('')
    setNotice('')
    try {
      const response = await apiClient.post(`/teachers/credentials/${teacher.userId}/reset`)
      setNewCredential(response.data)
      setNotice('Temporary password generated. Share it privately.')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset teacher password.')
    } finally {
      setBusyId('')
    }
  }

  const exportDirectory = () => {
    const rows = [['Teacher', 'Employee ID', 'Login ID', 'Email', 'Phone', 'Status', 'Password change required'],
      ...visibleTeachers.map((item) => [item.name, item.employeeId, item.loginId, item.email, item.phone, item.active ? 'Active' : 'Inactive', item.mustChangePassword ? 'Yes' : 'No'])]
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'teacher-login-credentials-directory.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="principal-credentials-page">
      <header className="credentials-hero">
        <div><span className="credentials-eyebrow"><ShieldCheck size={15} /> PRINCIPAL / EXPLORE</span><h1>Teacher Login Credentials</h1><p>View teacher login IDs, account status and reset temporary passwords. Passwords are shown only when generated.</p></div>
        <button className="credentials-secondary" onClick={exportDirectory}><Download size={17} /> Export directory</button>
      </header>
      {error && <div className="credentials-alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}
      {notice && <div className="credentials-alert success" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16} /></button></div>}
      <section className="credentials-stats">
        <div><span>Total teacher accounts</span><strong>{teachers.length}</strong></div>
        <div><span>Active accounts</span><strong>{teachers.filter((item) => item.active).length}</strong></div>
        <div><span>First login password change pending</span><strong>{teachers.filter((item) => item.mustChangePassword).length}</strong></div>
      </section>
      <label className="credentials-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teacher name, login ID, employee ID…" /></label>
      <section className="credentials-card">
        <div className="credentials-card-heading"><div><span>TEACHER ACCOUNTS</span><h2>Teacher login directory</h2></div><span>{visibleTeachers.length} accounts</span></div>
        {loading ? <div className="credentials-empty"><Loader2 className="credentials-spin" /> Loading teacher accounts…</div> : visibleTeachers.length ? (
          <div className="credentials-table-wrap"><table><thead><tr><th>Teacher</th><th>Employee ID</th><th>Login ID</th><th>Account status</th><th>Action</th></tr></thead><tbody>
            {visibleTeachers.map((item) => <tr key={item.userId}><td><strong>{item.name}</strong><small>{item.email || item.phone || 'No email added'}</small></td><td>{item.employeeId || '—'}</td><td><code>{item.loginId || 'Not assigned'}</code></td><td><span className={`credentials-status ${item.active ? 'active' : 'inactive'}`}>{!item.active ? 'Inactive' : item.mustChangePassword ? 'Password change pending' : 'Active'}</span></td><td><button className="credentials-reset" disabled={busyId === item.userId || !item.userId} onClick={() => resetPassword(item)}>{busyId === item.userId ? <Loader2 className="credentials-spin" size={15} /> : <RefreshCw size={15} />} Reset password</button></td></tr>)}
          </tbody></table></div>
        ) : <div className="credentials-empty"><Users size={23} />No teacher accounts found.</div>}
      </section>
      <p className="credentials-security-note"><ShieldCheck size={16} /> Passwords are never stored in readable form on this page. Reset creates a new temporary password and invalidates the old one.</p>
      {newCredential && <div className="credential-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setNewCredential(null)}><section className="credential-modal" role="dialog" aria-modal="true" aria-labelledby="teacher-credential-title"><button className="credential-modal-close" onClick={() => setNewCredential(null)} aria-label="Close"><X size={19} /></button><div className="credential-modal-icon"><KeyRound size={23} /></div><span className="credentials-eyebrow">TEMPORARY CREDENTIAL GENERATED</span><h2 id="teacher-credential-title">{newCredential.name}</h2><p>Share this privately. The temporary password will not be shown again after closing this window.</p><div className="credential-secret"><span>Login ID</span><strong>{newCredential.loginId}</strong><button onClick={() => navigator.clipboard?.writeText(newCredential.loginId)} aria-label="Copy login ID"><Copy size={16} /></button></div><div className="credential-secret"><span>Temporary password</span><strong>{newCredential.temporaryPassword}</strong><button onClick={() => navigator.clipboard?.writeText(newCredential.temporaryPassword)} aria-label="Copy temporary password"><Copy size={16} /></button></div><div className="credential-modal-warning">The teacher must change this password after signing in.</div><button className="credentials-primary" onClick={() => setNewCredential(null)}>Done</button></section></div>}
    </main>
  )
}
