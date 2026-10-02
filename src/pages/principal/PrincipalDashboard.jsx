import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, CalendarDays, Check, ChevronRight, CircleAlert, Clock3, UserCheck, UserRoundX, Users, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './PrincipalDashboard.css'

const OPERATION_MODULES = ['fees', 'notices', 'exams', 'payroll']

function PrincipalDashboard() {
  const { user } = useAuth()
  const [teacherSummary, setTeacherSummary] = useState(null)
  const [events, setEvents] = useState([])
  const [attention, setAttention] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    const requests = await Promise.allSettled([
      apiClient.get('/teacher-attendance/summary'),
      apiClient.get(`/events?year=${new Date().getFullYear()}`),
      ...OPERATION_MODULES.map((module) => apiClient.get(`/operations/${module}`)),
    ])

    const [teacherResult, eventResult, ...operationResults] = requests
    if (teacherResult.status === 'fulfilled') setTeacherSummary(teacherResult.value?.data || null)
    if (eventResult.status === 'fulfilled') setEvents(eventResult.value?.data?.records || [])

    const operationRecords = operationResults.flatMap((result) => result.status === 'fulfilled' ? result.value?.data?.records || [] : [])
    const pendingRecords = operationRecords
      .filter((record) => isAttentionRecord(record))
      .map((record) => ({ ...record, priority: normalizePriority(record.data?.priority), moduleLabel: formatModule(record.module) }))
      .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 8)
    setAttention(pendingRecords)

    if (requests.some((result) => result.status === 'rejected')) setError('Some live sections could not be refreshed. The available sections are still shown.')
    setLoading(false)
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const calendarItems = useMemo(() => getUpcomingEvents(events), [events])
  const todayLabel = useMemo(() => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()), [])
  const attendanceRecorded = teacherSummary?.attendanceRecorded

  const handleAttentionAction = async (item, status) => {
    try {
      const nextData = { ...(item.data || {}), status }
      await apiClient.put(`/operations/${item.module}/${item._id || item.id}`, { data: nextData })
      setAttention((current) => current.filter((entry) => (entry._id || entry.id) !== (item._id || item.id)))
    } catch (actionError) {
      setError(actionError?.response?.data?.message || 'Could not update this item.')
    }
  }

  return (
    <div className="principal-dashboard">
      <section className="control-room-header"><div><div className="control-room-eyebrow"><span className="status-pulse" /> PRINCIPAL CONTROL ROOM</div><h1>Today at a glance</h1><p>{todayLabel} · {user?.school?.name || 'Your school'}</p></div></section>
      {error && <div className="dashboard-notice" role="status"><CircleAlert size={17} /><span>{error}</span></div>}

      <section className="dashboard-section teacher-strip-section">
        <div className="section-heading compact-heading"><div><span>STAFF PRESENCE</span><h2>Teacher status today</h2><p>{attendanceRecorded ? 'Live attendance from teacher self check-in. Only the people who need attention are named below.' : 'Teacher attendance has not been recorded yet today.'}</p></div><Link to="/module/attendance" className="quiet-link">Open attendance <ChevronRight size={15} /></Link></div>
        <div className="teacher-status-strip">
          <StatusBlock label="Present" value={teacherSummary?.present ?? '—'} icon={UserCheck} tone="green" loading={loading} />
          <StatusBlock label="Absent" value={teacherSummary?.absent ?? '—'} icon={UserRoundX} tone="red" loading={loading} />
          <StatusBlock label="On leave" value={teacherSummary?.onLeave ?? '—'} icon={Clock3} tone="amber" loading={loading} />
          <div className="absent-teachers"><div className="strip-label">ABSENT TEACHERS</div>{attendanceRecorded ? (teacherSummary?.absentNames?.length ? <div className="absent-name-list">{teacherSummary.absentNames.slice(0, 4).map((name) => <span key={name}>{name}</span>)}{teacherSummary.absentNames.length > 4 && <span>+{teacherSummary.absentNames.length - 4} more</span>}</div> : <strong className="muted-value">None today</strong>) : <strong className="muted-value">Attendance not recorded</strong>}</div>
        </div>
      </section>

      <section className="dashboard-section calendar-section">
        <div className="section-heading compact-heading"><div><span>THIS WEEK</span><h2>Calendar</h2></div><Link to="/module/events" className="quiet-link">View calendar <ChevronRight size={15} /></Link></div>
        <div className="calendar-strip">{calendarItems.length ? calendarItems.map((item) => <CalendarItem key={item.id} item={item} />) : <div className="calendar-empty"><CalendarDays size={18} /><div><strong>No events scheduled this week</strong><span>Add PTMs, holidays and school events from Events.</span></div><Link to="/module/events">Add event <ArrowUpRight size={14} /></Link></div>}</div>
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-section attention-section"><div className="section-heading"><div><div className="heading-with-count"><span>NEEDS ATTENTION</span>{attention.length > 0 && <b>{attention.length}</b>}</div><h2>Approval queue</h2><p>Resolve the things that need the principal's decision.</p></div><CircleAlert size={20} className="heading-icon" /></div><div className="attention-list">{attention.map((item) => <AttentionRow key={item._id || item.id} item={item} onAction={handleAttentionAction} />)}{!attention.length && <div className="attention-empty"><div className="empty-check"><Check size={19} /></div><div><strong>Nothing needs your attention</strong><p>Pending approvals from supported operations will appear here automatically.</p></div></div>}</div></article>
        <aside className="dashboard-side-stack"><article className="dashboard-section pulse-card"><div className="section-heading"><div><span>SCHOOL PULSE</span><h2>Quick signals</h2></div></div><div className="signal-list"><Link to="/module/teachers" className="signal-row"><span className="signal-icon"><Users size={17} /></span><span><strong>{loading ? '—' : teacherSummary?.totalTeachers ?? 0}</strong><small>Teacher profiles</small></span><ChevronRight size={15} /></Link><Link to="/module/events" className="signal-row"><span className="signal-icon"><CalendarDays size={17} /></span><span><strong>{calendarItems.length}</strong><small>Events this week</small></span><ChevronRight size={15} /></Link><Link to="/module/notices" className="signal-row"><span className="signal-icon"><CircleAlert size={17} /></span><span><strong>{attention.length}</strong><small>Items in queue</small></span><ChevronRight size={15} /></Link></div></article><article className="dashboard-section focus-card"><span>PRINCIPAL FOCUS</span><h2>Keep the queue clear.</h2><p>Approvals, staff presence and time-sensitive school events stay in one place so the home screen remains operational rather than decorative.</p></article></aside>
      </section>
    </div>
  )
}

function StatusBlock({ label, value, icon: Icon, tone, loading }) { return <div className={`status-block ${tone}`}><span className="status-icon"><Icon size={19} /></span><div><strong>{loading ? '—' : value}</strong><span>{label}</span></div></div> }
function CalendarItem({ item }) { return <Link to="/module/events" className="calendar-item"><div className="calendar-day"><strong>{item.day}</strong><span>{item.month}</span></div><div className="calendar-copy"><strong>{item.title}</strong><span>{item.type}{item.timeRange ? ` · ${item.timeRange}` : ''}</span></div><ArrowUpRight size={15} /></Link> }
function AttentionRow({ item, onAction }) { return <div className="attention-row"><div className={`priority-mark ${item.priority}`} /><div className="attention-copy"><div className="attention-meta"><span>{item.moduleLabel}</span><b>{item.priority}</b></div><strong>{item.title}</strong><p>{item.data?.description || item.data?.reason || 'This record is waiting for review.'}</p></div><div className="attention-actions"><button type="button" className="decline-action" onClick={() => onAction(item, 'declined')}><X size={14} /> Decline</button><button type="button" className="approve-action" onClick={() => onAction(item, 'approved')}><Check size={14} /> Approve</button></div></div> }
function getUpcomingEvents(records) { const now = new Date(); const start = new Date(now); start.setHours(0,0,0,0); const end = new Date(start); end.setDate(start.getDate() + 7); return records.map((record) => { const rawDate = record.date || record.data?.date || record.data?.startDate || record.data?.eventDate || record.createdAt; const date = new Date(`${rawDate}T00:00:00`); if (Number.isNaN(date.getTime()) || date < start || date > end) return null; const startTime = record.startTime || record.data?.startTime || record.data?.time || ''; const endTime = record.endTime || record.data?.endTime || ''; return { id: record._id || record.id, title: record.title, date, day: new Intl.DateTimeFormat('en-IN', { day: '2-digit' }).format(date), month: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date), type: record.type || record.data?.type || record.data?.category || 'School event', timeRange: startTime ? (endTime ? `${startTime} – ${endTime}` : startTime) : '' } }).filter(Boolean).sort((a,b) => a.date-b.date).slice(0,6) }
function isAttentionRecord(record) { const status = String(record.data?.status || '').toLowerCase(); return ['pending','pending_approval','review','open','requested','submitted'].includes(status) || record.data?.requiresAttention === true }
function normalizePriority(priority) { const value = String(priority || 'normal').toLowerCase(); return ['urgent','high','normal','low'].includes(value) ? value : 'normal' }
function priorityRank(priority) { return { urgent:4, high:3, normal:2, low:1 }[priority] || 0 }
function formatModule(module) { return String(module || 'item').replace(/[-_]/g,' ').replace(/\b\w/g,(letter)=>letter.toUpperCase()) }

export default PrincipalDashboard
