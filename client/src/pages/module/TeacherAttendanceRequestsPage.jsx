import { useCallback, useEffect, useState } from 'react'
import { Check, CheckCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import apiClient from '../../api/client'
import './TeacherAttendanceRequestsPage.css'

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—'
}

export default function TeacherAttendanceRequestsPage() {
  const [requests, setRequests] = useState([])
  const [selected, setSelected] = useState([])
  const [decisionStatus, setDecisionStatus] = useState('present')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setError('')
      const response = await apiClient.get('/teacher-attendance/requests')
      setRequests(response.data.requests || [])
      setSelected([])
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load pending teacher requests.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const approveSelected = async () => {
    if (!selected.length) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await apiClient.patch('/teacher-attendance/requests/bulk-approve', { ids: selected, status: decisionStatus })
      setMessage(response.data.message || 'Selected attendance requests approved.')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to approve selected requests.')
    } finally { setBusy(false) }
  }

  const allSelected = requests.length > 0 && requests.every((item) => selected.includes(item._id))

  return <main className="teacher-requests-page">
    <header className="teacher-requests-hero">
      <div><span>STAFF ADMINISTRATION</span><h1>Teacher attendance requests</h1><p>Review missed attendance requests and approve several dates together. Approved requests update the official staff attendance register.</p></div>
      <button type="button" className="teacher-requests-refresh" onClick={load} disabled={loading || busy}><RefreshCw size={16} /> Refresh</button>
    </header>

    {error && <div className="teacher-requests-alert error">{error}</div>}
    {message && <div className="teacher-requests-alert success">{message}</div>}

    <section className="teacher-requests-panel">
      <div className="teacher-requests-toolbar">
        <div><span className="teacher-requests-kicker">PENDING APPROVAL</span><h2>{requests.length} request{requests.length === 1 ? '' : 's'}</h2><p>Select the requests you have verified.</p></div>
        <label className="teacher-requests-status">Approve selected as
          <select value={decisionStatus} onChange={(event) => setDecisionStatus(event.target.value)}>
            <option value="present">Present</option><option value="late">Late</option><option value="on_leave">On leave</option>
          </select>
        </label>
      </div>

      {loading ? <div className="teacher-requests-empty">Loading pending requests…</div> : requests.length ? <>
        <label className="teacher-requests-select-all"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : requests.map((item) => item._id))} /> Select all pending requests</label>
        <div className="teacher-requests-list">{requests.map((item) => <label className={`teacher-requests-row ${selected.includes(item._id) ? 'selected' : ''}`} key={item._id}>
          <input type="checkbox" checked={selected.includes(item._id)} onChange={() => toggle(item._id)} />
          <span className="teacher-requests-date">{dateLabel(item.date)}</span>
          <span className="teacher-requests-person"><strong>{item.teacher?.user?.name || 'Teacher'}</strong><small>{item.teacher?.employeeId || item.teacher?.designation || 'Staff member'}</small></span>
          <span className="teacher-requests-reason"><small>Reason</small>{item.reason}</span>
          <span className="teacher-requests-pending">Pending</span>
        </label>)}</div>
        <div className="teacher-requests-footer"><span>{selected.length} selected</span><button type="button" onClick={approveSelected} disabled={!selected.length || busy}><CheckCheck size={17} />{busy ? 'Approving…' : `Approve ${selected.length || ''} request${selected.length === 1 ? '' : 's'}`}</button></div>
      </> : <div className="teacher-requests-empty"><span className="teacher-requests-empty-icon"><Check size={22} /></span><strong>You're all caught up</strong><p>No pending teacher attendance requests right now.</p></div>}
    </section>
    <p className="teacher-requests-note"><ShieldCheck size={15} /> Approval changes the selected dates in the official teacher attendance register. Review the reasons before approving.</p>
  </main>
}
