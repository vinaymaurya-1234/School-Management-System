import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, LogIn, LogOut, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import apiClient from '../../api/client'
import './TeacherAttendancePage.css'

function time(value) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function dateLabel(value) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TeacherAttendancePage() {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
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
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load your attendance.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const record = data?.record
  const networkOk = data?.network?.allowed
  const canCheckIn = !record?.checkIn && networkOk
  const canCheckOut = Boolean(record?.checkIn) && !record?.checkOut && networkOk
  const statusLabel = record?.status === 'late' ? 'Late' : record?.checkIn ? 'Present' : 'Not marked'
  const attendanceDays = useMemo(() => history.filter((item) => item.record?.status === 'present' || item.record?.status === 'late').length, [history])

  const action = async (type) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await apiClient.post(`/teacher-attendance/${type}`)
      setMessage(response.data.message)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Attendance action failed.')
      await load()
    } finally { setBusy(false) }
  }

  if (loading) return <div className="teacher-attendance-shell"><div className="teacher-attendance-loading">Loading attendance...</div></div>

  return (
    <div className="teacher-attendance-shell">
      <header className="teacher-attendance-hero">
        <div>
          <span className="teacher-attendance-eyebrow">STAFF PRESENCE</span>
          <h1>My attendance</h1>
          <p>Check in and check out from the school network. Your attendance is recorded directly against your staff profile.</p>
        </div>
        <div className="teacher-attendance-network">
          {networkOk ? <Wifi size={18} /> : <WifiOff size={18} />}
          <div><strong>{networkOk ? 'Network verified' : 'School network required'}</strong><span>{data?.network?.message}</span></div>
        </div>
      </header>

      {error && <div className="teacher-attendance-alert error">{error}</div>}
      {message && <div className="teacher-attendance-alert success"><CheckCircle2 size={17} />{message}</div>}

      <section className="teacher-attendance-grid">
        <article className="teacher-attendance-card today-card">
          <div className="teacher-card-top"><div><span className="teacher-card-label">TODAY</span><h2>{data?.teacher?.name}</h2><p>{data?.teacher?.employeeId || 'Staff member'} · {dateLabel(data?.date)}</p></div><span className={`teacher-status-pill ${record?.status || 'pending'}`}>{statusLabel}</span></div>
          <div className="teacher-attendance-times">
            <div><span>Check-in</span><strong>{time(record?.checkIn)}</strong><small>{record?.checkIn ? (record.status === 'late' ? 'Late arrival' : 'On time') : 'Not recorded'}</small></div>
            <div><span>Check-out</span><strong>{time(record?.checkOut)}</strong><small>{record?.checkOut ? 'Recorded' : 'Awaiting checkout'}</small></div>
          </div>
          <div className="teacher-attendance-actions">
            <button type="button" className="teacher-primary-action" disabled={busy || !canCheckIn} onClick={() => action('check-in')}><LogIn size={18} />{busy ? 'Processing...' : 'Check in'}</button>
            <button type="button" className="teacher-secondary-action" disabled={busy || !canCheckOut} onClick={() => action('check-out')}><LogOut size={18} />Check out</button>
          </div>
          {!networkOk && <div className="teacher-network-hint"><ShieldCheck size={16} />Connect to the authorized school Wi-Fi before marking attendance.</div>}
        </article>

        <aside className="teacher-attendance-card rules-card">
          <span className="teacher-card-label">ATTENDANCE WINDOW</span>
          <div className="teacher-window-row"><Clock3 size={18} /><div><strong>{data?.window?.start}</strong><span>Check-in opens</span></div></div>
          <div className="teacher-window-row"><Clock3 size={18} /><div><strong>{data?.window?.lateAfter}</strong><span>Late after</span></div></div>
          <div className="teacher-window-row"><Clock3 size={18} /><div><strong>{data?.window?.close}</strong><span>Check-in closes</span></div></div>
          <div className="teacher-rule-note"><ShieldCheck size={15} /> Attendance is verified server-side. Changing browser data cannot mark attendance from an unauthorized network.</div>
        </aside>
      </section>

      <section className="teacher-attendance-card history-card">
        <div className="teacher-history-head"><div><span className="teacher-card-label">ATTENDANCE HISTORY</span><h2>Recent working days</h2></div><span className="teacher-history-count">{attendanceDays} present/late in recent records</span></div>
        <div className="teacher-history-table">
          <div className="teacher-history-row header"><span>Date</span><span>Status</span><span>Check-in</span><span>Check-out</span><span>Verification</span></div>
          {history.length ? history.map((item) => <div className="teacher-history-row" key={`${item.date}-${item.record?.teacher}`}><span>{dateLabel(item.date)}</span><span className={`history-status ${item.record?.status || 'not_marked'}`}>{item.record?.status?.replace('_', ' ') || 'Not marked'}</span><span>{time(item.record?.checkIn)}</span><span>{time(item.record?.checkOut)}</span><span>{item.record?.verification?.networkVerified ? 'School Wi-Fi' : item.record?.source === 'development' ? 'Development mode' : 'Admin'}</span></div>) : <div className="teacher-history-empty">No attendance records yet.</div>}
        </div>
      </section>
    </div>
  )
}
