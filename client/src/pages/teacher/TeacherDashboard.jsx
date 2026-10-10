import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './TeacherDashboard.css'

function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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

  const subjectCount = useMemo(
    () => new Set(assignments.map((item) => item.subject?._id || item.subject).filter(Boolean)).size,
    [assignments],
  )

  const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const todaySchedule = useMemo(
    () => timetable
      .filter((entry) => entry.day === todayKey && (!entry.teacher || String(entry.teacher?._id || entry.teacher) === String(user?.id)))
      .sort((a, b) => a.periodNumber - b.periodNumber),
    [timetable, todayKey, user?.id],
  )

  const attendanceMarked = Boolean(attendance?.record?.checkIn)
  const networkOk = attendance?.network?.allowed
  const attendanceStatus = attendance?.record?.status === 'late' ? 'Late' : attendanceMarked ? 'Present' : 'Not marked'
  const firstName = user?.name?.split(' ')[0] || 'Teacher'

  return (
    <main className="teacher-dashboard">
      <section className="teacher-dashboard-hero">
        <div>
          <span className="teacher-dashboard-kicker">TEACHER WORKSPACE</span>
          <h1>Everything you need for today.</h1>
          <p>Welcome back, {firstName}. Keep your attendance, classes and teaching schedule in one place.</p>
        </div>
        <div className="teacher-date-card">
          <CalendarDays size={18} />
          <div><span>Today</span><strong>{formatDate()}</strong></div>
        </div>
      </section>

      {error && <div className="teacher-dashboard-alert">{error}</div>}

      <section className="teacher-focus-card">
        <div className="teacher-focus-main">
          <div className={`teacher-attendance-icon ${attendanceMarked ? 'is-present' : ''}`}><CheckCircle2 size={27} /></div>
          <div>
            <span className="teacher-section-label">YOUR ATTENDANCE</span>
            <h2>{attendanceStatus}</h2>
            <p>{attendanceMarked ? `Checked in at ${formatTime(attendance.record.checkIn)}${attendance.record.checkOut ? ` · Checked out at ${formatTime(attendance.record.checkOut)}` : ''}` : 'Mark your attendance from the attendance page.'}</p>
          </div>
        </div>
        <div className="teacher-focus-side">
          <div className={`teacher-network ${networkOk ? 'verified' : 'waiting'}`}>
            {networkOk ? <Wifi size={17} /> : <WifiOff size={17} />}
            <span>{networkOk ? 'School network verified' : 'School network check'}</span>
          </div>
          <Link className="teacher-secondary-action" to="/module/attendance">
            {attendanceMarked ? 'View my attendance' : 'Mark my attendance'} <ArrowRight size={16} />
          </Link>
          <Link className="teacher-primary-action teacher-class-attendance-action" to="/module/class-attendance">
            Mark class attendance <ArrowRight size={16} />
          </Link>
          <Link className="teacher-primary-action teacher-marks-action" to="/module/exams">
            Enter exam marks <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="teacher-overview-grid">
        <article className="teacher-overview-card"><div className="teacher-overview-icon purple"><BookOpen size={20} /></div><div><strong>{loading ? '—' : assignedSections.length}</strong><span>Assigned classes</span></div></article>
        <article className="teacher-overview-card"><div className="teacher-overview-icon blue"><Users size={20} /></div><div><strong>{loading ? '—' : studentCount}</strong><span>Students in my sections</span></div></article>
        <article className="teacher-overview-card"><div className="teacher-overview-icon orange"><Clock3 size={20} /></div><div><strong>{loading ? '—' : todaySchedule.length}</strong><span>Periods today</span></div></article>
        <article className="teacher-overview-card"><div className="teacher-overview-icon green"><GraduationCap size={20} /></div><div><strong>{loading ? '—' : subjectCount}</strong><span>Assigned subjects</span></div></article>
      </section>

      <section className="teacher-main-grid">
        <article className="teacher-dashboard-panel schedule-panel">
          <div className="teacher-panel-title-row"><div><span className="teacher-section-label">TODAY'S PLAN</span><h2>Teaching schedule</h2></div><Link to="/module/timetable" className="teacher-text-action">Full timetable <ArrowRight size={15} /></Link></div>
          <div className="teacher-schedule-list">
            {todaySchedule.map((entry, index) => (
              <div className="teacher-schedule-item" key={entry._id}>
                <div className="teacher-period-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="teacher-period-time"><strong>{entry.startTime || '—'}</strong><span>{entry.endTime || ''}</span></div>
                <div className="teacher-period-content"><strong>{entry.subject?.name || 'Subject'}</strong><span>Class {entry.class?.name || entry.section?.class?.name || '—'} · Section {entry.section?.name || '—'}</span></div>
                <span className="teacher-room">{entry.room || 'Room —'}</span>
              </div>
            ))}
            {!todaySchedule.length && !loading && <div className="teacher-empty-state"><CalendarDays size={24} /><strong>No periods scheduled today</strong><span>Your published timetable will appear here.</span></div>}
          </div>
        </article>

        <article className="teacher-dashboard-panel classes-panel">
          <div className="teacher-panel-title-row"><div><span className="teacher-section-label">MY TEACHING</span><h2>Assigned classes</h2></div><Link to="/module/my-classes" className="teacher-text-action">View all <ArrowRight size={15} /></Link></div>
          <div className="teacher-class-list">
            {assignedSections.slice(0, 5).map((item) => {
              const sectionId = item.section?._id || item.section
              const classId = item.class?._id || item.class
              const classAssignments = assignments.filter((assignment) => (assignment.class?._id || assignment.class) === classId && (assignment.section?._id || assignment.section) === sectionId)
              const count = enrollments.filter((enrollment) => (enrollment.section?._id || enrollment.section) === sectionId).length
              return <div className="teacher-class-row" key={`${classId}-${sectionId}`}><div className="teacher-class-badge"><GraduationCap size={19} /></div><div><strong>{item.class?.name || 'Class'} · {item.section?.name || '—'}</strong><span>{classAssignments.map((assignment) => assignment.subject?.name).filter(Boolean).join(', ') || 'Class assignment'}</span></div><b>{count}</b></div>
            })}
            {!assignedSections.length && !loading && <div className="teacher-empty-state compact"><BookOpen size={22} /><strong>No class assignments yet</strong><span>The principal will assign your classes and subjects.</span></div>}
          </div>
        </article>
      </section>

      <section className="teacher-dashboard-footer-card"><div className="teacher-footer-icon"><ShieldCheck size={21} /></div><div><strong>Attendance is verified by the school network</strong><span>Attendance is checked on the server. The attendance window is currently open all day; production school Wi-Fi rules can be configured later.</span></div></section>
    </main>
  )
}

export default TeacherDashboard
