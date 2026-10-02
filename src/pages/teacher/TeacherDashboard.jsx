import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, ShieldCheck, Users, Wifi, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './TeacherDashboard.css'

function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function TeacherDashboard() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [timetable, setTimetable] = useState([])
  const [attendance, setAttendance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const yearRes = await apiClient.get('/academic/years')
        const years = yearRes.data.years || []
        const year = years.find((item) => item.isActive) || years[0]
        if (!year) return

        const [assignmentRes, enrollmentRes, timetableRes, attendanceRes] = await Promise.all([
          apiClient.get('/academic/teacher-assignments', { params: { academicYear: year._id, teacherId: user.id } }),
          apiClient.get('/academic/enrollments', { params: { academicYear: year._id } }),
          apiClient.get('/timetable', { params: { academicYear: year._id } }),
          apiClient.get('/teacher-attendance/me'),
        ])

        if (!mounted) return
        setAssignments(assignmentRes.data.assignments || [])
        setEnrollments(enrollmentRes.data.enrollments || [])
        setTimetable(timetableRes.data.entries || [])
        setAttendance(attendanceRes.data || null)
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || 'Unable to load your teacher workspace.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [user?.id])

  const assignedSections = useMemo(() => {
    const seen = new Set()
    return assignments.filter((item) => {
      const key = `${item.class?._id || item.class}:${item.section?._id || item.section}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [assignments])

  const studentCount = useMemo(() => {
    const ids = new Set(assignedSections.map((item) => item.section?._id || item.section))
    return enrollments.filter((item) => ids.has(item.section?._id || item.section)).length
  }, [assignedSections, enrollments])

  const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const todaySchedule = useMemo(() => timetable
    .filter((entry) => entry.day === todayKey && (!entry.teacher || String(entry.teacher?._id || entry.teacher) === String(user?.id)))
    .sort((a, b) => a.periodNumber - b.periodNumber), [timetable, todayKey, user?.id])

  const attendanceMarked = Boolean(attendance?.record?.checkIn)
  const networkOk = attendance?.network?.allowed
  const attendanceStatus = attendance?.record?.status === 'late' ? 'Late' : attendanceMarked ? 'Present' : 'Not marked'

  return (
    <div className="teacher-workspace">
      <header className="teacher-workspace-header">
        <div>
          <span className="teacher-eyebrow">TEACHER WORKSPACE</span>
          <h1>Good morning, {user?.name?.split(' ')[0] || 'Teacher'}.</h1>
          <p>Your classes, schedule and attendance — only the things you need for today.</p>
        </div>
        <Link to="/module/attendance" className="teacher-header-action">
          <CheckCircle2 size={17} />
          {attendanceMarked ? 'View attendance' : 'Mark attendance'}
          <ArrowRight size={15} />
        </Link>
      </header>

      {error && <div className="teacher-dashboard-alert">{error}</div>}

      <section className="teacher-attendance-banner">
        <div className="attendance-banner-main">
          <div className={`attendance-status-icon ${attendanceMarked ? 'is-marked' : ''}`}>
            <CheckCircle2 size={23} />
          </div>
          <div>
            <span className="teacher-card-eyebrow">TODAY'S ATTENDANCE</span>
            <h2>{attendanceStatus}</h2>
            <p>{attendanceMarked ? `Checked in at ${formatTime(attendance.record.checkIn)}${attendance.record.checkOut ? ` · Checked out at ${formatTime(attendance.record.checkOut)}` : ''}` : 'Your attendance has not been marked yet.'}</p>
          </div>
        </div>
        <div className="attendance-banner-meta">
          <div className={`network-status ${networkOk ? 'verified' : 'blocked'}`}>
            {networkOk ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{networkOk ? 'School network verified' : 'School network required'}</span>
          </div>
          <Link to="/module/attendance">Open attendance <ArrowRight size={14} /></Link>
        </div>
      </section>

      <section className="teacher-stat-grid">
        <div className="teacher-stat-card"><span className="teacher-stat-icon"><BookOpen size={18} /></span><div><strong>{loading ? '—' : assignedSections.length}</strong><span>Assigned classes</span></div></div>
        <div className="teacher-stat-card"><span className="teacher-stat-icon"><Users size={18} /></span><div><strong>{loading ? '—' : studentCount}</strong><span>Students</span></div></div>
        <div className="teacher-stat-card"><span className="teacher-stat-icon"><CalendarDays size={18} /></span><div><strong>{loading ? '—' : todaySchedule.length}</strong><span>Periods today</span></div></div>
        <div className="teacher-stat-card"><span className="teacher-stat-icon"><Clock3 size={18} /></span><div><strong>{attendance?.record?.checkIn ? formatTime(attendance.record.checkIn) : '—'}</strong><span>Check-in time</span></div></div>
      </section>

      <section className="teacher-content-grid">
        <article className="teacher-panel">
          <div className="teacher-panel-heading"><div><span className="teacher-card-eyebrow">TODAY</span><h2>My teaching schedule</h2></div><Link to="/module/timetable">Full timetable <ArrowRight size={14} /></Link></div>
          <div className="teacher-schedule-list">
            {todaySchedule.map((entry) => (
              <div className="teacher-schedule-row" key={entry._id}>
                <div className="schedule-time">{entry.startTime}<small>{entry.endTime || ''}</small></div>
                <div className="schedule-dot" />
                <div className="schedule-info"><strong>{entry.subject?.name || 'Subject'}</strong><span>Class {entry.class?.name || entry.section?.class?.name || '—'} · Section {entry.section?.name || '—'}</span></div>
                <span className="schedule-room">{entry.room || 'Room not set'}</span>
              </div>
            ))}
            {!todaySchedule.length && !loading && <div className="teacher-empty"><CalendarDays size={20} /><strong>No periods published for today.</strong><span>Your schedule will appear here after the timetable is published.</span></div>}
          </div>
        </article>

        <article className="teacher-panel">
          <div className="teacher-panel-heading"><div><span className="teacher-card-eyebrow">ACADEMICS</span><h2>My classes</h2></div><Link to="/module/my-classes">View all <ArrowRight size={14} /></Link></div>
          <div className="teacher-class-grid">
            {assignedSections.map((item) => {
              const sectionId = item.section?._id || item.section
              const classAssignments = assignments.filter((assignment) => (assignment.class?._id || assignment.class) === (item.class?._id || item.class) && (assignment.section?._id || assignment.section) === sectionId)
              const count = enrollments.filter((enrollment) => (enrollment.section?._id || enrollment.section) === sectionId).length
              return <div className="teacher-class-card" key={`${item.class?._id || item.class}-${sectionId}`}><div className="class-card-top"><span>{item.class?.name || 'Class'} · {item.section?.name || '—'}</span>{item.isClassTeacher && <b>Class teacher</b>}</div><strong>{classAssignments.map((assignment) => assignment.subject?.name).filter(Boolean).join(', ') || 'Class assignment'}</strong><small>{count} students</small></div>
            })}
            {!assignedSections.length && !loading && <div className="teacher-empty"><BookOpen size={20} /><strong>No class assignments yet.</strong><span>The principal needs to assign your classes and subjects.</span></div>}
          </div>
        </article>
      </section>

      <section className="teacher-security-note"><ShieldCheck size={18} /><div><strong>Attendance is school-network verified</strong><span>Attendance requests are checked by the server. When production Wi-Fi is configured, marking from outside the authorized school network will be blocked.</span></div></section>
    </div>
  )
}

export default TeacherDashboard
