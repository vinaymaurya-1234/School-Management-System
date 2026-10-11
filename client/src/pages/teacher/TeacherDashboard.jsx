import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './TeacherDashboard.css'

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
        ])

        if (!mounted) return
        setAssignments(assignmentRes.data.assignments || [])
        setEnrollments(enrollmentRes.data.enrollments || [])
        setTimetable(timetableRes.data.entries || [])
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

  const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const todaySchedule = useMemo(
    () => timetable
      .filter((entry) => entry.day === todayKey && (!entry.teacher || String(entry.teacher?._id || entry.teacher) === String(user?.id)))
      .sort((a, b) => a.periodNumber - b.periodNumber),
    [timetable, todayKey, user?.id],
  )


  return (
    <main className="teacher-dashboard">
      <div className="teacher-date-only">
        <div className="teacher-date-card">
          <CalendarDays size={18} />
          <div><span>Today</span><strong>{formatDate()}</strong></div>
        </div>
      </div>

      {error && <div className="teacher-dashboard-alert">{error}</div>}

      <section className="teacher-quick-actions">
        <div className="teacher-panel-title-row">
          <div><span className="teacher-section-label">QUICK ACTIONS</span><h2>What would you like to do?</h2></div>
        </div>
        <div className="teacher-quick-action-grid">
          <Link className="teacher-quick-action primary" to="/module/class-attendance">
            <span className="teacher-quick-action-icon"><Users size={19} /></span>
            <span><strong>Mark class attendance</strong><small>Record today's student attendance</small></span>
            <ArrowRight size={17} />
          </Link>
          <Link className="teacher-quick-action" to="/module/exams">
            <span className="teacher-quick-action-icon"><FileText size={19} /></span>
            <span><strong>Enter exam marks</strong><small>Save marks for your assigned subjects</small></span>
            <ArrowRight size={17} />
          </Link>
          <Link className="teacher-quick-action" to="/module/assignments">
            <span className="teacher-quick-action-icon"><ClipboardList size={19} /></span>
            <span><strong>Homework & assignments</strong><small>Create or review classwork</small></span>
            <ArrowRight size={17} />
          </Link>
        </div>
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

    </main>
  )
}

export default TeacherDashboard
