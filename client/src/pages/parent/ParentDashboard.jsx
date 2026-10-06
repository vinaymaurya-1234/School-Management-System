import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, GraduationCap, LayoutGrid, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './ParentDashboard.css'

function ParentDashboard() {
  const { user } = useAuth()
  const [children, setChildren] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [attendance, setAttendance] = useState({})
  const [timetables, setTimetables] = useState({})
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
        const childRes = await apiClient.get('/parents/me/children')
        const nextChildren = childRes.data.children || []

        if (cancelled) return
        setChildren(nextChildren)

        if (!year) {
          setLoading(false)
          return
        }

        const enrollmentRes = await apiClient.get('/academic/enrollments', { params: { academicYear: year._id } })

        if (cancelled) return
        setEnrollments(enrollmentRes.data.enrollments || [])

        const summaries = {}
        const schedules = {}

        await Promise.all(
          nextChildren.map(async (child) => {
            try {
              const summaryRes = await apiClient.get('/attendance/summary', {
                params: { studentId: child.user?._id || child.user },
              })
              summaries[child._id] = summaryRes.data
            } catch {
              summaries[child._id] = null
            }

            try {
              const timetableRes = await apiClient.get(`/parents/me/children/${child._id}/timetable`)
              schedules[child._id] = timetableRes.data.entries || []
            } catch {
              schedules[child._id] = []
            }
          }),
        )

        if (!cancelled) {
          setAttendance(summaries)
          setTimetables(schedules)
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Unable to load parent data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const childCards = useMemo(
    () =>
      children.map((child) => {
        const enrollment = enrollments.find(
          (item) => (item.student?._id || item.student) === (child.user?._id || child.user),
        )
        return {
          ...child,
          enrollment,
          attendance: attendance[child._id] || null,
          timetable: timetables[child._id] || [],
        }
      }),
    [children, enrollments, attendance, timetables],
  )

  const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const today = useMemo(
    () =>
      childCards.flatMap((child) =>
        child.timetable
          .filter((entry) => entry.day === todayKey)
          .map((entry) => ({ ...entry, childName: child.name })),
      ).sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0)),
    [childCards, todayKey],
  )

  const attendanceValues = childCards
    .map((child) => Number(child.attendance?.percentage))
    .filter((value) => Number.isFinite(value))
  const averageAttendance = attendanceValues.length
    ? Math.round((attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length) * 10) / 10
    : null
  const totalLessons = childCards.reduce((sum, child) => sum + child.timetable.length, 0)
  const activeClasses = new Set(
    childCards
      .map((child) => child.enrollment?.class?._id || child.enrollment?.class)
      .filter(Boolean),
  ).size
  const firstName = user?.name?.split(' ')[0] || 'Parent'
  const selectedChild = childCards[0]

  return (
    <div className="parent-dashboard">
      <section className="parent-hero">
        <div>
          <span className="parent-eyebrow">PARENT PORTAL</span>
          <h1>Welcome back, {firstName}.</h1>
          <p>View your linked children's real enrollment, attendance and school schedule.</p>
        </div>
        {selectedChild && (
          <div className="parent-child-selector">
            <div className="parent-child-avatar">{selectedChild.name?.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{selectedChild.name}</strong>
              <span>
                {selectedChild.enrollment
                  ? `Class ${selectedChild.enrollment.class?.name || '—'} · Section ${selectedChild.enrollment.section?.name || '—'}`
                  : 'Current enrollment not available'}
              </span>
            </div>
          </div>
        )}
      </section>

      {error && <div className="parent-alert">{error}</div>}

      <section className="parent-stat-grid" aria-label="Parent overview">
        <div className="parent-stat-card">
          <div className="parent-stat-icon"><Users size={19} /></div>
          <span>Linked children</span>
          <strong>{children.length || '—'}</strong>
          <small>{children.length ? 'Parent records linked to this account' : 'No linked child record'}</small>
        </div>
        <div className="parent-stat-card attendance">
          <div className="parent-stat-icon"><CheckCircle2 size={19} /></div>
          <span>Attendance</span>
          <strong>{averageAttendance === null ? '—' : `${averageAttendance}%`}</strong>
          <small>{attendanceValues.length ? 'From saved attendance registers' : 'No attendance recorded yet'}</small>
        </div>
        <div className="parent-stat-card">
          <div className="parent-stat-icon"><BookOpen size={19} /></div>
          <span>Weekly lessons</span>
          <strong>{totalLessons || '—'}</strong>
          <small>{totalLessons ? 'Published timetable entries' : 'No published timetable yet'}</small>
        </div>
        <div className="parent-stat-card">
          <div className="parent-stat-icon"><GraduationCap size={19} /></div>
          <span>Active classes</span>
          <strong>{activeClasses || '—'}</strong>
          <small>{activeClasses ? 'Current academic year' : 'No active enrollment found'}</small>
        </div>
      </section>

      <section className="parent-content-grid parent-main-grid">
        <div className="parent-panel">
          <div className="parent-panel-header">
            <div>
              <span className="parent-panel-kicker">TODAY</span>
              <h2>Today's timetable</h2>
              <p>Your children's published schedule for today.</p>
            </div>
            <Link to="/module/timetable" className="parent-text-link">Full timetable <ArrowRight size={15} /></Link>
          </div>
          <div className="parent-schedule-list">
            {today.map((entry, index) => (
              <div className="parent-schedule-row" key={entry._id || `${entry.childName}-${entry.periodNumber}-${index}`}>
                <div className="parent-time">
                  <Clock3 size={14} />
                  <strong>{entry.startTime}</strong>
                  {entry.endTime && <span>{entry.endTime}</span>}
                </div>
                <div className="parent-subject">
                  <strong>{entry.subject?.name || 'Subject'}</strong>
                  <span>{entry.childName} · {entry.teacher?.name || 'Teacher'} · {entry.room || 'Room not set'}</span>
                </div>
                <span className="parent-pill">Period {entry.periodNumber || index + 1}</span>
              </div>
            ))}
            {!today.length && !loading && (
              <div className="parent-empty">
                <div className="parent-empty-icon"><CalendarDays size={21} /></div>
                <strong>No published timetable for today.</strong>
                <span>Your child's weekly schedule will appear here after the principal publishes it.</span>
              </div>
            )}
            {loading && <div className="parent-loading"><span /><span /><span /></div>}
          </div>
        </div>

        <div className="parent-panel parent-children-panel">
          <div className="parent-panel-header">
            <div>
              <span className="parent-panel-kicker">MY CHILDREN</span>
              <h2>Linked student records</h2>
              <p>Live school records available to this parent account.</p>
            </div>
          </div>
          <div className="parent-children-list">
            {childCards.map((child) => (
              <div className="parent-child-row" key={child._id}>
                <div className="avatar">{child.name?.charAt(0).toUpperCase()}</div>
                <div className="parent-child-copy">
                  <strong>{child.name}</strong>
                  <span>
                    {child.enrollment
                      ? `Class ${child.enrollment.class?.name || '—'} · Section ${child.enrollment.section?.name || '—'} · Attendance ${child.attendance?.percentage ?? '—'}%`
                      : 'Not enrolled for the current academic year'}
                  </span>
                </div>
                {child.enrollment?.class?.name && <span className="class-badge">Class {child.enrollment.class.name}</span>}
              </div>
            ))}
            {!childCards.length && !loading && (
              <div className="parent-empty">
                <div className="parent-empty-icon"><Users size={21} /></div>
                <strong>No child is linked to this parent account.</strong>
                <span>The principal must link a student to this parent login.</span>
              </div>
            )}
            {loading && <div className="parent-loading"><span /><span /></div>}
          </div>
        </div>
      </section>

      <section className="parent-exam-action parent-panel">
        <div>
          <span className="parent-panel-kicker">EXAMINATION</span>
          <h2>Exam timetable</h2>
          <p>Open the examination timetable for your linked children.</p>
        </div>
        <Link to="/module/exams" className="parent-primary-button">
          View exam timetable <ArrowRight size={16} />
        </Link>
      </section>

      <section className="parent-panel parent-attendance-panel">
        <div className="parent-panel-header">
          <div>
            <span className="parent-panel-kicker">ATTENDANCE</span>
            <h2>Attendance summary</h2>
            <p>Real saved attendance registers.</p>
          </div>
        </div>
        <div className="parent-attendance-list">
          {childCards.map((child) => {
            const percentage = Number(child.attendance?.percentage)
            const hasAttendance = Number.isFinite(percentage)
            return (
              <div className="parent-attendance-row" key={child._id}>
                <div className="parent-attendance-name">
                  <strong>{child.name}</strong>
                  <span>{hasAttendance ? 'Saved attendance' : 'No attendance recorded yet'}</span>
                </div>
                <div className="attendance-track"><div className="attendance-fill" style={{ width: `${hasAttendance ? Math.min(Math.max(percentage, 0), 100) : 0}%` }} /></div>
                <div className="attendance-value">{hasAttendance ? `${percentage}%` : '—'}</div>
              </div>
            )
          })}
          {!childCards.length && !loading && (
            <div className="parent-empty"><strong>No attendance records available.</strong></div>
          )}
          {loading && <div className="parent-loading"><span /><span /></div>}
        </div>
      </section>

      <div className="parent-actions" aria-label="Parent academic links">
        <Link to="/module/timetable" className="parent-action"><span className="parent-action-icon"><LayoutGrid size={16} /></span>Timetable</Link>
        <Link to="/module/exams" className="parent-action"><span className="parent-action-icon"><CalendarDays size={16} /></span>Exam timetable</Link>
      </div>
    </div>
  )
}

export default ParentDashboard
