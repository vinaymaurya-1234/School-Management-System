import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock3, LogIn, LogOut, Send, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import apiClient from '../../api/client'
import './TeacherAttendancePage.css'

function time(value) { return value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—' }
function dateLabel(value) { return new Date(value).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }

export default function TeacherAttendancePage() {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [showRequest, setShowRequest] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    try {
      setError('')
      const [todayRes, historyRes] = await Promise.all([
        apiClient.get('/teacher-attendance/me'),
        apiClient.get('/teacher-attendance/history', { params: { limit: 31 } }),
      ])
      setData(todayRes.data)
      setHistory(historyRes.data.history || [])
    } catch (err) { setError(err.response?.data?.message || 'Unable to load your attendance.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const record = data?.record
  const request = data?.request
  const networkOk = data?.network?.allowed
  const windowClosed = Boolean(record?.status === 'absent') || (data?.window?.close && new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) > data.window.close)
  const canCheckIn = !record?.checkIn && !windowClosed && networkOk
  const canCheckOut = Boolean(record?.checkIn) && !record?.checkOut && networkOk
  const attendanceStatus = record?.status === 'late' ? 'Late' : record?.status === 'absent' ? 'Absent' : record?.checkIn ? 'Present' : 'Not marked'
  const attendanceDays = useMemo(() => history.filter((item) => ['present', 'late'].includes(item.record?.status)).length, [history])
  const requestPending = request?.status === 'pending'

  const action = async (type) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await apiClient.post(`/teacher-attendance/${type}`)
      setMessage(response.data.message)
      await load()
    } catch (err) { setError(err.response?.data?.message || 'Attendance action failed.'); await load() }
    finally { setBusy(false) }
  }

  const submitRequest = async (event) => {
    event.preventDefault()
    if (!requestReason.trim()) return setError('Please enter the reason for your attendance request.')
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await apiClient.post('/teacher-attendance/request', { reason: requestReason.trim() })
      setMessage(response.data.message)
      setRequestReason('')
      setShowRequest(false)
      await load()
    } catch (err) { setError(err.response?.data?.message || 'Unable to send attendance request.') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="teacher-attendance-shell"><div className="teacher-attendance-loading">Loading attendance workspace...</div></div>

  return (
    <div className="teacher-attendance-shell">
      <header className="teacher-attendance-hero">
        <div><span className="teacher-attendance-eyebrow">STAFF PRESENCE</span><h1>Daily attendance</h1><p>{dateLabel(data?.date)} · Check in from the authorized school network. The server decides whether the check-in is on time or late.</p></div>
        <div className={`teacher-attendance-network ${networkOk ? 'verified' : 'blocked'}`}>{networkOk ? <Wifi size={18} /> : <WifiOff size={18} />}<div><strong>{networkOk ? 'School network verified' : 'School network required'}</strong><span>{data?.network?.message}</span></div></div>
      </header>

      {error && <div className="teacher-attendance-alert error"><AlertCircle size={17} />{error}</div>}
      {message && <div className="teacher-attendance-alert success"><CheckCircle2 size={17} />{message}</div>}

      <section className="teacher-attendance-layout">
        <article className="teacher-attendance-card teacher-today-card">
          <div className="teacher-today-top"><div><span className="teacher-card-label">TODAY'S RECORD</span><h2>{data?.teacher?.name}</h2><p>{data?.teacher?.employeeId || 'Staff member'}</p></div><span className={`teacher-status-pill ${record?.status || 'not_marked'}`}>{attendanceStatus}</span></div>

          <div className="teacher-time-grid"><div><span>Check-in</span><strong>{time(record?.checkIn)}</strong><small>{record?.checkIn ? (record.status === 'late' ? 'Late arrival · still counted present' : 'On time') : 'Not recorded'}</small></div><div><span>Check-out</span><strong>{time(record?.checkOut)}</strong><small>{record?.checkOut ? 'Recorded' : record?.checkIn ? 'Awaiting checkout' : 'Available after check-in'}</small></div></div>

          <div className="teacher-action-row"><button type="button" className="teacher-primary-action" disabled={busy || !canCheckIn} onClick={() => action('check-in')}><LogIn size={18} />{busy ? 'Processing...' : 'Check in'}</button><button type="button" className="teacher-secondary-action" disabled={busy || !canCheckOut} onClick={() => action('check-out')}><LogOut size={18} />Check out</button></div>

          {windowClosed && !record?.checkIn && <div className="teacher-closed-state"><div><strong>Check-in window closed</strong><span>After 08:00, attendance cannot be self-marked. Send a request to the principal with your reason.</span></div>{requestPending ? <b>Request pending</b> : <button type="button" onClick={() => setShowRequest(true)}><Send size={15} /> Send request</button>}</div>}
          {request?.status === 'approved' && <div className="teacher-request-result approved"><CheckCircle2 size={16} /><span>Request approved as <strong>{request.decisionStatus}</strong>.</span></div>}
          {request?.status === 'rejected' && <div className="teacher-request-result rejected"><AlertCircle size={16} /><span>Request rejected{request.reviewNote ? `: ${request.reviewNote}` : '.'}</span></div>}
          {!networkOk && <div className="teacher-network-hint"><ShieldCheck size={16} />Connect to the authorized school Wi-Fi before marking attendance.</div>}
        </article>

        <aside className="teacher-attendance-card teacher-rules-card"><span className="teacher-card-label">CHECK-IN POLICY</span><div className="teacher-policy-line"><span className="policy-time">07:00</span><div><strong>Window opens</strong><small>Self check-in becomes available.</small></div></div><div className="teacher-policy-line"><span className="policy-time">07:15</span><div><strong>Late starts</strong><small>07:16–08:00 is Present + Late.</small></div></div><div className="teacher-policy-line"><span className="policy-time">08:00</span><div><strong>Window closes</strong><small>08:01 onward requires a principal request.</small></div></div><div className="teacher-policy-note"><ShieldCheck size={16} /><span>Late does not mean absent. A valid late check-in counts in Present and Late.</span></div></aside>
      </section>

      {showRequest && <section className="teacher-attendance-card teacher-request-form-card"><div><span className="teacher-card-label">ATTENDANCE EXCEPTION</span><h2>Request principal approval</h2><p>Explain why you could not check in before 08:00. The principal will decide the final status.</p></div><form onSubmit={submitRequest}><textarea value={requestReason} onChange={(event) => setRequestReason(event.target.value)} placeholder="Example: I reached school at 08:20 because..." maxLength={500} autoFocus /><div className="teacher-form-actions"><button type="button" className="teacher-secondary-action" onClick={() => { setShowRequest(false); setRequestReason('') }}>Cancel</button><button type="submit" className="teacher-primary-action" disabled={busy}><Send size={16} />{busy ? 'Sending...' : 'Send to principal'}</button></div></form></section>}

      <section className="teacher-attendance-card teacher-history-card"><div className="teacher-history-head"><div><span className="teacher-card-label">ATTENDANCE HISTORY</span><h2>Recent records</h2></div><span className="teacher-history-count">{attendanceDays} present/late in recent records</span></div><div className="teacher-history-table"><div className="teacher-history-row header"><span>Date</span><span>Status</span><span>Check-in</span><span>Check-out</span><span>Source</span></div>{history.length ? history.map((item) => <div className="teacher-history-row" key={`${item.date}-${item.record?.teacher}`}><span>{new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span><span className={`history-status ${item.record?.status || 'not_marked'}`}>{item.record?.status?.replace('_', ' ') || 'Not marked'}</span><span>{time(item.record?.checkIn)}</span><span>{time(item.record?.checkOut)}</span><span>{item.record?.verification?.networkVerified ? 'School Wi-Fi' : item.record?.source === 'development' ? 'Development mode' : 'Principal approval'}</span></div>) : <div className="teacher-history-empty">No attendance records yet.</div>}</div></section>
    </div>
  )
}
