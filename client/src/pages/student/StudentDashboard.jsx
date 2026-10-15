import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Bell,
  CalendarRange,
  WalletCards,
  GraduationCap,
  Trophy,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './StudentDashboard.css'

function StudentDashboard() {
  const { user } = useAuth()
  const [enrollment, setEnrollment] = useState(null)
  const [timetable, setTimetable] = useState([])
  const [attendance, setAttendance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        setLoading(true)
        setError('')
        const yearRes = await apiClient.get('/academic/years')
        const years = yearRes.data.years || []
        const year = years.find((item) => item.isActive) || years[0]

        if (!year || !user?.id) {
          if (!cancelled) setLoading(false)
          return
        }

        const [enrollmentRes, timetableRes, attendanceRes] = await Promise.all([
          apiClient.get('/academic/enrollments', { params: { academicYear: year._id } }),
          apiClient.get('/timetable', { params: { academicYear: year._id } }),
          apiClient.get('/attendance/summary', { params: { studentId: user.id } }),
        ])

        if (cancelled) return

        const current = (enrollmentRes.data.enrollments || []).find(
          (item) => (item.student?._id || item.student) === user.id && item.status === 'active',
        )

        setEnrollment(current || null)
        setTimetable(timetableRes.data.entries || [])
        setAttendance(attendanceRes.data)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Unable to load your school data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDashboard()
    return () => { cancelled = true }
  }, [user?.id])

  const studentLinks = [
    { title: 'Attendance', description: 'Review your attendance record', href: '/module/attendance', Icon: ClipboardCheck, tone: 'blue' },
    { title: 'Class timetable', description: 'Subjects, periods and teachers', href: '/module/timetable', Icon: CalendarDays, tone: 'violet' },
    { title: 'Exams', description: 'Check upcoming exam schedules', href: '/module/exams', Icon: CalendarRange, tone: 'orange' },
    { title: 'Results', description: 'View published marks and grades', href: '/module/results', Icon: Trophy, tone: 'green' },
    { title: 'Assignments', description: 'Homework assigned by teachers', href: '/module/assignments', Icon: FileText, tone: 'blue' },
    { title: 'Notices', description: 'Important school announcements', href: '/module/notices', Icon: Bell, tone: 'orange' },
    { title: 'Events & holidays', description: 'School events and holidays', href: '/module/events', Icon: CalendarRange, tone: 'violet' },
    { title: 'Fees & receipts', description: 'Fee account and payment receipts', href: '/module/fees', Icon: WalletCards, tone: 'green' },
  ]

  const firstName = String(user?.name || user?.fullName || user?.username || 'Student').trim().split(/\\s+/)[0]
  const attendancePercentage = Number(attendance?.percentage ?? attendance?.attendancePercentage ?? attendance?.summary?.percentage ?? 0)
  const todayName = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date())
  const today = useMemo(() => timetable.filter((entry) => String(entry.day || '').toLowerCase() === todayName.toLowerCase()), [timetable, todayName])
  const weekDays = useMemo(() => new Set(timetable.map((entry) => entry.day).filter(Boolean)).size, [timetable])

  return (
    <div className="student-dashboard student-dashboard-v2">
      <section className="student-v2-hero">
        <div className="student-v2-hero-copy">
          <span className="student-eyebrow"><span className="student-live-dot" /> YOUR STUDENT SPACE</span>
          <h1>Good to see you, {firstName}.</h1>
          <p>{enrollment
            ? `Class ${enrollment.class?.name || '—'} · Section ${enrollment.section?.name || '—'} · ${enrollment.academicYear?.name || 'Current academic year'}`
            : 'Your class details will appear here when your enrollment is active.'}</p>
          <div className="student-v2-hero-actions">
            <Link to="/module/timetable" className="student-v2-primary-link">Open my timetable <ArrowRight size={16} /></Link>
            <Link to="/module/assignments" className="student-v2-secondary-link">View assignments</Link>
          </div>
        </div>
        <div className="student-v2-hero-art" aria-hidden="true">
          <div className="student-v2-orbit orbit-one" /><div className="student-v2-orbit orbit-two" />
          <div className="student-v2-book"><GraduationCap size={52} strokeWidth={1.4} /></div>
          <span className="student-v2-art-label">LEARN · GROW · ACHIEVE</span>
        </div>
      </section>

      {error && <div className="student-alert">{error}</div>}

      <section className="student-v2-stats" aria-label="Your academic overview">
        <article className="student-v2-stat student-v2-stat-attendance">
          <div className="student-v2-stat-top"><span>Attendance</span><span className="student-v2-stat-icon"><CheckCircle2 size={19} /></span></div>
          <strong>{loading ? '—' : attendance ? `${attendancePercentage}%` : '—'}</strong>
          <small>{attendance ? 'Based on recorded attendance' : 'No attendance summary available yet'}</small>
          <div className="student-v2-progress"><span style={{ width: `${Math.min(attendancePercentage, 100)}%` }} /></div>
        </article>
        <article className="student-v2-stat">
          <div className="student-v2-stat-top"><span>My class</span><span className="student-v2-stat-icon"><GraduationCap size={19} /></span></div>
          <strong>{enrollment?.class?.name || '—'}</strong>
          <small>{enrollment?.section?.name ? `Section ${enrollment.section.name}` : 'Active enrollment required'}</small>
        </article>
        <article className="student-v2-stat">
          <div className="student-v2-stat-top"><span>Weekly periods</span><span className="student-v2-stat-icon"><BookOpen size={19} /></span></div>
          <strong>{loading ? '—' : timetable.length}</strong>
          <small>{loading ? 'Loading published timetable' : `${weekDays} scheduled days in your timetable`}</small>
        </article>
        <article className="student-v2-stat">
          <div className="student-v2-stat-top"><span>Today's periods</span><span className="student-v2-stat-icon"><CalendarDays size={19} /></span></div>
          <strong>{loading ? '—' : today.length}</strong>
          <small>From your published timetable</small>
        </article>
      </section>

      <section className="student-v2-section">
        <div className="student-v2-section-heading">
          <div><span className="student-panel-kicker">YOUR SCHOOL, IN ONE PLACE</span><h2>What would you like to do?</h2><p>Open any student service below.</p></div>
        </div>
        <div className="student-v2-services">
          {studentLinks.map(({ title, description, href, Icon, tone }) => (
            <Link className="student-v2-service" to={href} key={title}>
              <span className={`student-v2-service-icon tone-${tone}`}><Icon size={21} /></span>
              <span className="student-v2-service-copy"><strong>{title}</strong><small>{description}</small></span>
              <ArrowRight className="student-v2-service-arrow" size={17} />
            </Link>
          ))}
        </div>
      </section>

      <section className="student-v2-bottom-grid">
        <article className="student-v2-panel">
          <div className="student-v2-panel-heading">
            <div><span className="student-panel-kicker">TODAY</span><h2>Today's class schedule</h2><p>Your published periods for today.</p></div>
            <Link to="/module/timetable" className="student-text-link">Full timetable <ArrowRight size={15} /></Link>
          </div>
          {loading ? <div className="student-loading-list"><span /><span /><span /></div> : today.length ? (
            <div className="student-v2-schedule">
              {today.map((entry, index) => (
                <div className="student-v2-schedule-row" key={entry._id || `${entry.day}-${entry.periodNumber}-${index}`}>
                  <div className="student-v2-time"><strong>{entry.startTime || '—'}</strong><span>{entry.endTime || ''}</span></div>
                  <div className="student-v2-subject"><strong>{entry.subject?.name || 'Subject'}</strong><span>{entry.teacher?.name || 'Teacher'}{entry.room ? ` · ${entry.room}` : ''}</span></div>
                  <span className="student-v2-period">Period {entry.periodNumber || index + 1}</span>
                </div>
              ))}
            </div>
          ) : <div className="student-v2-empty"><CalendarDays size={23} /><strong>No periods published for today</strong><span>Your schedule will appear here when the school publishes it.</span></div>}
        </article>
        <article className="student-v2-panel student-v2-progress-panel">
          <span className="student-panel-kicker">KEEP ON TRACK</span><h2>Your progress</h2><p>Use these shortcuts to stay up to date with your learning.</p>
          <div className="student-v2-progress-links">
            <Link to="/module/attendance"><span className="student-v2-mini-icon"><CheckCircle2 size={17} /></span><span><strong>Attendance record</strong><small>Check your recorded presence</small></span><ArrowRight size={16} /></Link>
            <Link to="/module/exams"><span className="student-v2-mini-icon"><CalendarRange size={17} /></span><span><strong>Exam schedule</strong><small>Prepare for upcoming exams</small></span><ArrowRight size={16} /></Link>
            <Link to="/module/notices"><span className="student-v2-mini-icon"><Bell size={17} /></span><span><strong>School notices</strong><small>Don't miss important updates</small></span><ArrowRight size={16} /></Link>
          </div>
        </article>
      </section>
    </div>
  )
}

export default StudentDashboard
