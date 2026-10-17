import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Download, KeyRound, Loader2, RefreshCw, Search, ShieldCheck, Users, X } from 'lucide-react'
import apiClient from '../../api/client'
import './PrincipalCredentialsPage.css'

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function PrincipalCredentialsPage() {
  const [students, setStudents] = useState([])
  const [parents, setParents] = useState([])
  const [query, setQuery] = useState('')
  const [years, setYears] = useState([])
  const [yearId, setYearId] = useState('')
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newCredential, setNewCredential] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [response, yearResponse] = await Promise.all([
        apiClient.get('/students/credentials'),
        apiClient.get('/academic/years'),
      ])
      setStudents(response.data.students || [])
      setParents(response.data.parents || [])
      const nextYears = yearResponse.data.years || []
      setYears(nextYears)
      const selectedYear = nextYears.find((item) => item._id === yearId) || nextYears.find((item) => item.isActive) || nextYears[0]
      if (selectedYear) {
        setYearId(selectedYear._id)
        const [classResponse, sectionResponse, enrollmentResponse] = await Promise.all([
          apiClient.get('/academic/classes', { params: { academicYear: selectedYear._id } }),
          apiClient.get('/academic/sections', { params: { academicYear: selectedYear._id } }),
          apiClient.get('/academic/enrollments', { params: { academicYear: selectedYear._id } }),
        ])
        setClasses(classResponse.data.classes || [])
        setSections(sectionResponse.data.sections || [])
        setEnrollments(enrollmentResponse.data.enrollments || [])
      } else {
        setClasses([]); setSections([]); setEnrollments([])
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load account records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resetPassword = async (account) => {
    if (!account.userId) {
      setError('This account is missing its user reference. Refresh and try again.')
      return
    }
    if (!window.confirm(`Generate a new temporary password for ${account.name}? The current password will stop working.`)) return
    setBusyId(account.userId)
    setError('')
    setNotice('')
    try {
      const response = await apiClient.post(`/students/credentials/${account.userId}/reset`)
      setNewCredential(response.data)
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not reset the temporary password.')
    } finally {
      setBusyId('')
    }
  }

  const selectedYear = years.find((item) => item._id === yearId)
  const classSections = useMemo(() => sections.filter((section) => {
    const sectionClassId = section.class?._id || section.class
    return !selectedClass || sectionClassId === selectedClass
  }), [sections, selectedClass])
  const enrolledUserIds = useMemo(() => {
    const matching = enrollments.filter((item) => {
      const classId = item.class?._id || item.class
      const sectionId = item.section?._id || item.section
      return (!selectedClass || classId === selectedClass) && (!selectedSection || sectionId === selectedSection)
    })
    return new Set(matching.map((item) => item.student?._id || item.student))
  }, [enrollments, selectedClass, selectedSection])
  const classFilteredStudents = students.filter((item) => {
    if (!selectedClass && !selectedSection) return true
    return enrolledUserIds.has(item.userId)
  })
  const visibleStudents = classFilteredStudents.filter((item) => `${item.name} ${item.admissionNumber} ${item.loginId} ${item.email}`.toLowerCase().includes(query.toLowerCase()))
  const visibleParents = parents.filter((item) => {
    const childMatches = (item.children || []).some((child) => {
      const childStudent = students.find((student) => student.admissionNumber === child.admissionNumber)
      return childStudent && classFilteredStudents.some((student) => student.studentId === childStudent.studentId)
    })
    if ((selectedClass || selectedSection) && !childMatches) return false
    return `${item.name} ${item.loginId} ${item.phone} ${(item.children || []).map((child) => child.name).join(' ')} ${item.email}`.toLowerCase().includes(query.toLowerCase())
  })

  const changeAcademicYear = async (nextYearId) => {
    setYearId(nextYearId); setSelectedClass(''); setSelectedSection('')
    if (!nextYearId) { setClasses([]); setSections([]); setEnrollments([]); return }
    try {
      const [classResponse, sectionResponse, enrollmentResponse] = await Promise.all([
        apiClient.get('/academic/classes', { params: { academicYear: nextYearId } }),
        apiClient.get('/academic/sections', { params: { academicYear: nextYearId } }),
        apiClient.get('/academic/enrollments', { params: { academicYear: nextYearId } }),
      ])
      setClasses(classResponse.data.classes || [])
      setSections(sectionResponse.data.sections || [])
      setEnrollments(enrollmentResponse.data.enrollments || [])
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load classes and sections.')
    }
  }

  const exportDirectory = () => {
    downloadCsv('school-login-directory.csv', [
      ['Account type', 'Name', 'Login ID', 'Email', 'Phone', 'Status', 'First login password change required'],
      ...students.map((item) => ['Student', item.name, item.loginId, item.email, '', item.active ? 'Active' : 'Inactive', item.mustChangePassword ? 'Yes' : 'No']),
      ...parents.map((item) => ['Parent', item.name, item.loginId, item.email, item.phone, item.active ? 'Active' : 'Inactive', item.mustChangePassword ? 'Yes' : 'No']),
    ])
  }

  return (
    <main className="principal-credentials-page">
      <header className="credentials-hero">
        <div>
          <span className="credentials-eyebrow"><ShieldCheck size={15} /> PRINCIPAL / EXPLORE</span>
          <h1>Student & Parent Login Credentials</h1>
          <p>View login IDs and account status. Temporary passwords are shown only once when generated or reset.</p>
        </div>
        <button className="credentials-secondary" onClick={exportDirectory}><Download size={17} /> Export directory</button>
      </header>

      {error && <div className="credentials-alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}
      {notice && <div className="credentials-alert success" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16} /></button></div>}

      <section className="credentials-stats">
        <div><span>Student accounts</span><strong>{students.length}</strong></div>
        <div><span>Parent accounts</span><strong>{parents.length}</strong></div>
        <div><span>Need first login</span><strong>{students.filter((x) => x.mustChangePassword).length + parents.filter((x) => x.mustChangePassword).length}</strong></div>
      </section>

      <section className="credentials-filters" aria-label="Filter login credentials">
        <label className="credentials-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or login ID…" /></label>
        <label className="credentials-filter"><span>ACADEMIC YEAR</span><select value={yearId} onChange={(event) => changeAcademicYear(event.target.value)}><option value="">All / no year</option>{years.map((item) => <option key={item._id} value={item._id}>{item.name}{item.isActive ? ' (Active)' : ''}</option>)}</select></label>
        <label className="credentials-filter"><span>CLASS</span><select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSection('') }} disabled={!yearId || classes.length === 0}><option value="">All classes</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
        <label className="credentials-filter"><span>SECTION</span><select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)} disabled={!selectedClass || classSections.length === 0}><option value="">All sections</option>{classSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></label>
        {(selectedClass || selectedSection || query) && <button className="credentials-clear-filters" onClick={() => { setQuery(''); setSelectedClass(''); setSelectedSection('') }}>Clear</button>}
      </section>
      <p className="credentials-filter-summary">{selectedYear ? `Academic year: ${selectedYear.name}` : 'Select an academic year'} · Showing {visibleStudents.length} students and {visibleParents.length} parent accounts</p>

      <section className="credentials-card">
        <div className="credentials-card-heading"><div><span>STUDENT ACCOUNTS</span><h2>Student login IDs</h2></div><span>{visibleStudents.length} accounts</span></div>
        {loading ? <div className="credentials-empty"><Loader2 className="credentials-spin" /> Loading accounts…</div> : visibleStudents.length ? (
          <div className="credentials-table-wrap"><table><thead><tr><th>Student</th><th>Admission No.</th><th>Login ID</th><th>Account status</th><th>Action</th></tr></thead><tbody>
            {visibleStudents.map((item) => <tr key={item.studentId}><td><strong>{item.name}</strong></td><td>{item.admissionNumber}</td><td><code>{item.loginId || 'Not assigned'}</code></td><td><span className={`credentials-status ${item.active ? 'active' : 'inactive'}`}>{!item.active ? 'Inactive' : item.mustChangePassword ? 'Password change pending' : 'Active'}</span></td><td><button className="credentials-reset" disabled={busyId === item.userId || !item.userId} onClick={() => resetPassword(item)}>{busyId === item.userId ? <Loader2 className="credentials-spin" size={15} /> : <RefreshCw size={15} />} Reset password</button></td></tr>)}
          </tbody></table></div>
        ) : <div className="credentials-empty"><Users size={23} />No student accounts found.</div>}
      </section>

      <section className="credentials-card">
        <div className="credentials-card-heading"><div><span>GUARDIAN ACCOUNTS</span><h2>Parent login IDs</h2></div><span>{visibleParents.length} accounts</span></div>
        {loading ? <div className="credentials-empty"><Loader2 className="credentials-spin" /> Loading accounts…</div> : visibleParents.length ? (
          <div className="credentials-table-wrap"><table><thead><tr><th>Parent / Guardian</th><th>Linked children</th><th>Login ID</th><th>Account status</th><th>Action</th></tr></thead><tbody>
            {visibleParents.map((item) => <tr key={item.parentProfileId}><td><strong>{item.name}</strong><small>{item.phone || 'No phone recorded'}</small></td><td>{(item.children || []).map((child) => child.name).join(', ') || 'No linked child'}</td><td><code>{item.loginId || 'Not assigned'}</code></td><td><span className={`credentials-status ${item.active ? 'active' : 'inactive'}`}>{!item.active ? 'Inactive' : item.mustChangePassword ? 'Password change pending' : 'Active'}</span></td><td><button className="credentials-reset" disabled={busyId === item.userId || !item.userId} onClick={() => resetPassword(item)}>{busyId === item.userId ? <Loader2 className="credentials-spin" size={15} /> : <RefreshCw size={15} />} Reset password</button></td></tr>)}
          </tbody></table></div>
        ) : <div className="credentials-empty"><Users size={23} />No parent accounts found.</div>}
      </section>

      <p className="credentials-security-note"><ShieldCheck size={16} /> Passwords are never retrievable from this page. Reset creates a new temporary password and invalidates the old one.</p>

      {newCredential && (
        <div className="credential-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setNewCredential(null)}>
          <section className="credential-modal" role="dialog" aria-modal="true" aria-labelledby="credential-modal-title">
            <button className="credential-modal-close" onClick={() => setNewCredential(null)} aria-label="Close"><X size={19} /></button>
            <div className="credential-modal-icon"><KeyRound size={23} /></div>
            <span className="credentials-eyebrow">TEMPORARY CREDENTIAL GENERATED</span>
            <h2 id="credential-modal-title">{newCredential.name}</h2>
            <p>Share this privately. It will not be shown again after closing this window.</p>
            <div className="credential-secret"><span>Login ID</span><strong>{newCredential.loginId}</strong><button onClick={() => navigator.clipboard?.writeText(newCredential.loginId)} aria-label="Copy login ID"><Copy size={16} /></button></div>
            <div className="credential-secret"><span>Temporary password</span><strong>{newCredential.temporaryPassword}</strong><button onClick={() => navigator.clipboard?.writeText(newCredential.temporaryPassword)} aria-label="Copy temporary password"><Copy size={16} /></button></div>
            <div className="credential-modal-warning">The user must change this password immediately after signing in.</div>
            <button className="credentials-primary" onClick={() => { setNewCredential(null); setNotice('Temporary password was shown once. Share it privately.'); }}>Done</button>
          </section>
        </div>
      )}
    </main>
  )
}
