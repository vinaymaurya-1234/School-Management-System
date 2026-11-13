import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Users } from 'lucide-react'
import apiClient from '../../api/client'

export default function AccountantStudentsPage() {
  const [students, setStudents] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await apiClient.get('/students')
      setStudents(Array.isArray(data.students) ? data.students : [])
    } catch (requestError) {
      setStudents([])
      setError(requestError.response?.data?.message || 'Student directory could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    apiClient.get('/students')
      .then(({ data }) => { if (active) setStudents(Array.isArray(data.students) ? data.students : []) })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Student directory could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return students.filter((student) => !term || [student.name, student.admissionNumber].some((value) => String(value || '').toLowerCase().includes(term)))
  }, [students, query])

  return (
    <main className="accountant-directory-page">
      <header className="page-heading-row">
        <div><span className="eyebrow">FINANCE / STUDENT DIRECTORY</span><h1>Student directory</h1><p>Basic student identifiers for fee and payment administration. Personal and guardian details are not exposed in this view.</p></div>
        <button type="button" className="secondary-button" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </header>
      <section className="accountant-directory-panel">
        <div className="accountant-directory-toolbar">
          <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student name or admission number" /></label>
          <span>{loading ? 'Loading…' : `${visible.length} records`}</span>
        </div>
        {error && <div className="dashboard-notice" role="alert">{error}<button type="button" onClick={load}>Retry</button></div>}
        {loading ? <div className="accountant-directory-empty">Loading student records…</div> : visible.length ? (
          <div className="accountant-directory-table-wrap"><table className="accountant-directory-table"><thead><tr><th>Student</th><th>Admission number</th><th>Account status</th></tr></thead><tbody>
            {visible.map((student) => <tr key={student.id}><td><strong>{student.name}</strong></td><td>{student.admissionNumber || '—'}</td><td><span className={student.active && student.accountActive !== false ? 'accountant-status-active' : 'accountant-status-inactive'}>{student.active && student.accountActive !== false ? 'Active' : 'Inactive'}</span></td></tr>)}
          </tbody></table></div>
        ) : <div className="accountant-directory-empty"><Users size={24} /><strong>{students.length ? 'No matching students' : 'No student records available'}</strong><span>{students.length ? 'Try another name or admission number.' : 'Student records will appear after admissions are created.'}</span></div>}
      </section>
    </main>
  )
}
