import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LayoutGrid,
  Medal,
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
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const today = useMemo(
    () => timetable.filter((entry) => entry.day === todayKey).sort((a, b) => a.periodNumber - b.periodNumber),
    [timetable, todayKey],
  )
  const weekDays = new Set(timetable.map((entry) => entry.day)).size
  const firstName = user?.name?.split(' ')[0] || 'Student'
  const attendancePercentage = Number(attendance?.percentage || 0)

  return (
    <div className="student-dashboard">
      <section className="student-hero">
        <div className="student-hero-copy">
          <span className="student-eyebrow">STUDENT PORTAL</span>
          <h1>Good to see you, {firstName}.</h1>
          <p>
            {enrollment
              ? `Class ${enrollment.class?.name || '—'} · Section ${enrollment.section?.name || '—'} · ${enrollment.academicYear?.name || 'Current academic year'}`
              : 'Your current class information will appear here once your enrollment is active.'}
          </p>
        </div>
        <div className="student-hero-badge">
          <div className="student-avatar">{firstName.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{enrollment?.class?.name || 'Student'}</strong>
            <span>{enrollment?.section?.name ? `Section ${enrollment.section.name}` : 'Portal'}</span>
          </div>
        </div>
      </section>

      {error && <div className="student-alert">{error}</div>}

      <section className="student-stat-grid" aria-label="Student overview">
        <div className="student-stat-card attendance-stat">
          <div className="student-stat-icon"><CheckCircle2 size={20} /></div>
          <span>Attendance</span>
          <strong>{attendancePercentage}%</strong>
          <small>From saved attendance</small>
          <div className="student-progress"><span style={{ width: `${Math.min(attendancePercentage, 100)}%` }} /></div>
        </div>
        <div className="student-stat-card">
          <div className="student-stat-icon"><GraduationCap size={20} /></div>
          <span>My class</span>
          <strong>{enrollment?.class?.name || '—'}</strong>
          <small>{enrollment?.section?.name ? `Section ${enrollment.section.name}` : 'Not enrolled'}</small>
        </div>
        <div className="student-stat-card">
          <div className="student-stat-icon"><BookOpen size={20} /></div>
          <span>Weekly lessons</span>
          <strong>{timetable.length}</strong>
          <small>{weekDays} active days</small>
        </div>
        <div className="student-stat-card">
          <div className="student-stat-icon"><CalendarDays size={20} /></div>
          <span>Today's periods</span>
          <strong>{today.length}</strong>
          <small>Published timetable</small>
        </div>
      </section>

      <section className="student-quick-grid">
        <Link className="student-action-card action-timetable" to="/module/timetable">
          <div className="action-card-top">
            <div className="action-icon"><LayoutGrid size={21} /></div>
            <ArrowRight size={18} />
          </div>
          <strong>My timetable</strong>
          <span>View your complete weekly class schedule.</span>
        </Link>
        <Link className="student-action-card action-exams" to="/module/exams">
          <div className="action-card-top">
            <div className="action-icon"><CalendarDays size={21} /></div>
            <ArrowRight size={18} />
          </div>
          <strong>Exam timetable</strong>
          <span>Check upcoming exams for your class and section.</span>
        </Link>
        <Link className="student-action-card action-results" to="/module/results">
          <div className="action-card-top">
            <div className="action-icon"><Trophy size={21} /></div>
            <ArrowRight size={18} />
          </div>
          <strong>View results</strong>
          <span>See published marks, grades and performance.</span>
        </Link>
      </section>

      <section className="student-content-grid">
        <div className="student-panel timetable-panel">
          <div className="student-panel-header">
            <div>
              <span className="student-panel-kicker">TODAY</span>
              <h2>Today's timetable</h2>
              <p>Your published schedule for today.</p>
            </div>
            <Link to="/module/timetable" className="student-text-link">Full timetable <ArrowRight size={15} /></Link>
          </div>

          <div className="student-schedule-list">
            {today.map((entry, index) => (
              <div className="student-schedule-row" key={entry._id || `${entry.day}-${entry.periodNumber}-${index}`}>
                <div className="schedule-time">
                  <Clock3 size={15} />
                  <strong>{entry.startTime}</strong>
                  {entry.endTime && <span>{entry.endTime}</span>}
                </div>
                <div className="schedule-subject">
                  <strong>{entry.subject?.name || 'Subject'}</strong>
                  <span>{entry.teacher?.name || 'Teacher'} · {entry.room || 'Room not set'}</span>
                </div>
                <span className="period-pill">Period {entry.periodNumber || index + 1}</span>
              </div>
            ))}
            {!today.length && !loading && (
              <div className="student-empty-state">
                <div className="empty-icon"><CalendarDays size={22} /></div>
                <strong>No timetable periods published for today.</strong>
                <span>The principal's published timetable will appear here automatically.</span>
              </div>
            )}
            {loading && (
              <div className="student-loading-list">
                <span /><span /><span />
              </div>
            )}
          </div>
        </div>

        <div className="student-panel academic-panel">
          <div className="student-panel-header">
            <div>
              <span className="student-panel-kicker">ACADEMIC SNAPSHOT</span>
              <h2>Your progress</h2>
              <p>A quick look at your current academic status.</p>
            </div>
          </div>
          <div className="student-progress-list">
            <div className="progress-item">
              <div className="progress-item-icon"><GraduationCap size={18} /></div>
              <div><span>Class & section</span><strong>{enrollment?.class?.name || '—'}{enrollment?.section?.name ? ` · ${enrollment.section.name}` : ''}</strong></div>
            </div>
            <div className="progress-item">
              <div className="progress-item-icon"><CheckCircle2 size={18} /></div>
              <div><span>Present days</span><strong>{attendance?.present || 0}</strong></div>
            </div>
            <div className="progress-item">
              <div className="progress-item-icon"><Medal size={18} /></div>
              <div><span>Late days</span><strong>{attendance?.late || 0}</strong></div>
            </div>
            <div className="progress-item">
              <div className="progress-item-icon"><Award size={18} /></div>
              <div><span>Attendance status</span><strong>{attendancePercentage >= 75 ? 'On track' : 'Needs attention'}</strong></div>
            </div>
          </div>
          <div className="student-dashboard-links"><Link className="student-outline-button" to="/module/attendance">View attendance <ArrowRight size={16} /></Link><Link className="student-outline-button" to="/module/results">View published results <ArrowRight size={16} /></Link></div>
        </div>
      </section>
    </div>
  )
}

export default StudentDashboard
