import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, FileText, GraduationCap, Layers3, Megaphone, Plus, Users, Wallet, UserRoundPlus, BarChart3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './PrincipalDashboard.css'

const OPERATION_MODULES = ['fees', 'exams']

function getRecords(result) {
  const data = result?.data || {}
  return data.records || data.students || data.teachers || data.classes || data.items || []
}

function isPending(record) {
  const status = String(record?.data?.status || record?.status || '').toLowerCase()
  return ['pending', 'pending_approval', 'review', 'open', 'requested', 'submitted'].includes(status) || record?.data?.requiresAttention === true
}

function PrincipalDashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState({ students: 0, staff: 0, classes: 0 })
  const [approvals, setApprovals] = useState({ leave: 0, marks: 0, fees: 0 })
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    const year = new Date().getFullYear()
    const results = await Promise.allSettled([
      apiClient.get('/students'),
      apiClient.get('/teachers'),
      apiClient.get('/classes'),
      apiClient.get(`/events?year=${year}`),
      apiClient.get('/leave', { params: { status: 'pending' } }),
      ...OPERATION_MODULES.map((module) => apiClient.get(`/operations/${module}`)),
    ])
    const [studentsResult, teachersResult, classesResult, eventsResult, leaveResult, feesResult, examsResult] = results
    setSummary({
      students: studentsResult.status === 'fulfilled' ? getRecords(studentsResult.value).length : 0,
      staff: teachersResult.status === 'fulfilled' ? getRecords(teachersResult.value).length : 0,
      classes: classesResult.status === 'fulfilled' ? getRecords(classesResult.value).length : 0,
    })
    const leaveRequests = leaveResult.status === 'fulfilled'
      ? (leaveResult.value?.data?.requests || []).filter((request) => String(request.status || 'pending').toLowerCase() === 'pending').length
      : 0
    const feeRecords = feesResult.status === 'fulfilled' ? getRecords(feesResult.value) : []
    const examRecords = examsResult.status === 'fulfilled' ? getRecords(examsResult.value) : []
    setApprovals({
      leave: leaveRequests,
      marks: examRecords.filter(isPending).length,
      fees: feeRecords.filter(isPending).length,
    })
    if (eventsResult.status === 'fulfilled') {
      const records = getRecords(eventsResult.value)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      setEvents(records.map((event) => {
        const rawDate = event.date || event.data?.date || event.data?.startDate || event.data?.eventDate
        const date = new Date(rawDate)
        return { ...event, parsedDate: date }
      }).filter((event) => !Number.isNaN(event.parsedDate.getTime()) && event.parsedDate >= today)
        .sort((a, b) => a.parsedDate - b.parsedDate).slice(0, 3))
    } else setEvents([])
    if (results.some((result) => result.status === 'rejected')) {
      setError('Some dashboard information could not be loaded. Please refresh to try again.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date()), [])
  const totalApprovals = approvals.leave + approvals.marks + approvals.fees
  const greetingName = user?.name?.trim() || 'Principal'

  return (
    <main className="principal-dashboard principal-home-simple">
      <header className="principal-home-heading">
        <div>
          <h1>Good {getGreeting()}, {greetingName} <span aria-hidden="true">👋</span></h1>
          <p>Here's your school overview for today.</p>
        </div>
        <div className="principal-date-pill"><CalendarDays size={17} /> {dateLabel}</div>
      </header>

      {error && <div className="principal-home-error" role="status">{error}</div>}

      <section className="principal-home-stats" aria-label="School overview">
        <StatCard icon={GraduationCap} value={loading ? '—' : summary.students.toLocaleString('en-IN')} label="Total Students" />
        <StatCard icon={Users} value={loading ? '—' : summary.staff.toLocaleString('en-IN')} label="Teachers" />
        <StatCard icon={Layers3} value={loading ? '—' : summary.classes.toLocaleString('en-IN')} label="Total Classes" />
        <StatCard icon={ClipboardCheck} value={loading ? '—' : totalApprovals.toLocaleString('en-IN')} label="Pending Approvals" />
      </section>

      <section className="principal-home-panels">
        <article className="principal-home-panel">
          <div className="principal-home-panel-heading"><h2>Pending Approvals</h2><span>{loading ? '—' : totalApprovals}</span></div>
          <ApprovalLink to="/module/teacher-attendance-requests" icon={FileText} label="Leave Requests" count={approvals.leave} loading={loading} />
          <ApprovalLink to="/module/exams" icon={FileText} label="Marks Publication" count={approvals.marks} loading={loading} />
          <ApprovalLink to="/module/fees" icon={Wallet} label="Fee Verification" count={approvals.fees} loading={loading} />
        </article>

        <article className="principal-home-panel">
          <div className="principal-home-panel-heading">
            <h2>Upcoming Events</h2>
            <Link to="/module/events">View all <ChevronRight size={15} /></Link>
          </div>
          {loading ? <div className="principal-home-empty">Loading events…</div> : events.length ? events.map((event) => (
            <Link className="principal-home-event" to="/module/events" key={event._id || event.id || event.title}>
              <span className="principal-home-icon"><CalendarDays size={19} /></span>
              <span className="principal-home-event-copy"><strong>{event.title || event.name || 'School event'}</strong><small>{new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(event.parsedDate)}</small></span>
              <ChevronRight size={17} />
            </Link>
          )) : <div className="principal-home-empty"><CalendarDays size={19} /><span>No upcoming events scheduled.</span></div>}
        </article>
      </section>

      <section className="principal-home-quick">
        <div className="principal-home-panel-heading"><h2>Quick Actions</h2></div>
        <div className="principal-home-actions">
          <QuickAction to="/module/students" icon={UserRoundPlus} label="Add Student" />
          <QuickAction to="/module/teachers" icon={UserRoundPlus} label="Add Teacher" />
          <QuickAction to="/module/notices" icon={Megaphone} label="Create Notice" />
          <QuickAction to="/module/reports" icon={BarChart3} label="View Reports" />
        </div>
      </section>
    </main>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

function StatCard({ icon: Icon, value, label }) {
  return <article className="principal-home-stat"><span className="principal-home-stat-icon"><Icon size={21} strokeWidth={1.8} /></span><span className="principal-home-stat-copy"><strong>{value}</strong><small>{label}</small></span></article>
}

function ApprovalLink({ to, icon: Icon, label, count, loading }) {
  return <Link to={to} className="principal-home-approval"><span className="principal-home-icon"><Icon size={18} /></span><strong>{label}</strong><span className="principal-home-count">{loading ? '—' : count}</span><ChevronRight size={17} /></Link>
}

function QuickAction({ to, icon: Icon, label }) {
  return <Link to={to} className="principal-home-action"><span><Icon size={20} /></span><strong>{label}</strong><ChevronRight size={16} /></Link>
}

export default PrincipalDashboard
