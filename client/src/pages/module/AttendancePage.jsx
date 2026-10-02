import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './AttendanceRedesign.css'

const STUDENT_STATUS = {
  present: { label: 'Present' },
  absent: { label: 'Absent' },
  late: { label: 'Late' },
  half_day: { label: 'Half day' },
}

const TEACHER_STATUS = {
  present: { label: 'Present' },
  absent: { label: 'Absent' },
  late: { label: 'Late' },
  on_leave: { label: 'On leave' },
}

const today = new Date().toISOString().slice(0, 10)

function initials(name = '') {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function StatusButton({ status, selected, disabled, onClick, label }) {
  return (
    <button
      type="button"
      className={`attendance-status-button ${selected ? `is-selected ${status}` : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function AttendancePage() {
  const { user } = useAuth()
  const isPrincipal = user?.role === 'principal'
  const isTeacher = user?.role === 'teacher'
  const isParent = user?.role === 'parent'
  const [mode, setMode] = useState(isPrincipal ? 'teachers' : 'students')
  const [date, setDate] = useState(today)
  const [years, setYears] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [assignments, setAssignments] = useState([])
  const [children, setChildren] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedChild, setSelectedChild] = useState('')
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')

  const activeYear = useMemo(() => years.find((year) => year.isActive) || years[0] || null, [years])
  const selectedClassName = classes.find((item) => item._id === selectedClass)?.name || ''
  const availableSections = useMemo(
    () => sections.filter((section) => (section.class?._id || section.class) === selectedClass),
    [sections, selectedClass],
  )

  const loadAcademicSetup = async () => {
    try {
      const yearRes = await apiClient.get('/academic/years')
      const nextYears = yearRes.data.years || []
      setYears(nextYears)
      const year = nextYears.find((item) => item.isActive) || nextYears[0]
      if (!year) return

      const requests = [
        apiClient.get('/academic/classes', { params: { academicYear: year._id } }),
        apiClient.get('/academic/sections', { params: { academicYear: year._id } }),
      ]
      if (isTeacher) requests.push(apiClient.get('/academic/teacher-assignments', { params: { academicYear: year._id, teacherId: user.id } }))
      if (isParent) requests.push(apiClient.get('/parents/me/children'))

      const results = await Promise.all(requests)
      setClasses(results[0].data.classes || [])
      setSections(results[1].data.sections || [])

      if (isTeacher) {
        const nextAssignments = results[2].data.assignments || []
        setAssignments(nextAssignments)
        const first = nextAssignments.find((item) => item.section)
        if (first) {
          setSelectedClass(first.class?._id || first.class)
          setSelectedSection(first.section?._id || first.section)
        }
      }

      if (isParent) {
        const nextChildren = results[2].data.children || []
        setChildren(nextChildren)
        if (!selectedChild && nextChildren[0]) setSelectedChild(nextChildren[0]._id)
      }

      if (!selectedClass && results[0].data.classes?.[0]) setSelectedClass(results[0].data.classes[0]._id)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load attendance setup.')
    }
  }

  const loadStudents = async () => {
    try {
      const params = { date }
      if (activeYear?._id) params.academicYear = activeYear._id
      if (isPrincipal || isTeacher) params.sectionId = selectedSection
      if (isParent && selectedChild) params.studentId = selectedChild
      const response = await apiClient.get('/attendance', { params })
      setStudents(response.data.students || [])
      if (user?.role === 'student' || (isParent && selectedChild)) {
        const summaryRes = await apiClient.get('/attendance/summary', { params: { studentId: selectedChild || user.id } })
        setSummary(summaryRes.data)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load student attendance.')
    }
  }

  const loadTeachers = async () => {
    try {
      const response = await apiClient.get('/teacher-attendance', { params: { date } })
      setTeachers(response.data.teachers || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load teacher attendance.')
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([loadAcademicSetup(), isPrincipal ? loadTeachers() : Promise.resolve()]).finally(() => setLoading(false))
  }, [user?.role])

  useEffect(() => {
    if (!activeYear) return
    if (mode === 'teachers' && isPrincipal) {
      loadTeachers()
      return
    }
    if (isParent ? selectedChild : (isPrincipal || isTeacher ? selectedSection : true)) loadStudents()
  }, [activeYear?._id, selectedSection, selectedChild, date, mode])

  const teacherCounts = teachers.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), { present: 0, absent: 0, late: 0, on_leave: 0 })
  const studentCounts = students.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), { present: 0, absent: 0, late: 0, half_day: 0 })
  const filteredTeachers = teachers.filter((teacher) => `${teacher.name} ${teacher.employeeId} ${teacher.department}`.toLowerCase().includes(query.toLowerCase()))
  const filteredStudents = students.filter((student) => `${student.name} ${student.admissionNumber} ${student.rollNumber}`.toLowerCase().includes(query.toLowerCase()))

  const updateTeacherStatus = (teacherId, status) => {
    setTeachers((current) => current.map((teacher) => teacher.id === teacherId ? { ...teacher, status } : teacher))
  }

  const updateStudentStatus = (userId, status) => {
    setStudents((current) => current.map((student) => student.userId === userId ? { ...student, status } : student))
  }

  const saveTeachers = async () => {
    setSaving(true)
    try {
      await apiClient.post('/teacher-attendance/session', {
        date,
        records: teachers.map((teacher) => ({ teacher: teacher.id, status: teacher.status, note: teacher.note })),
      })
      setNotice('Teacher attendance saved successfully.')
      await loadTeachers()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save teacher attendance.')
    } finally {
      setSaving(false)
    }
  }

  const saveStudents = async () => {
    if (!selectedSection) return setError('Select a section first.')
    setSaving(true)
    try {
      await apiClient.post('/attendance/session', {
        academicYear: activeYear._id,
        section: selectedSection,
        date,
        records: students.map((student) => ({ student: student.userId, status: student.status, note: student.note })),
      })
      setNotice('Student attendance saved successfully.')
      await loadStudents()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save student attendance.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="attendance-redesign">
      <header className="attendance-page-header">
        <div>
          <span className="attendance-kicker">SCHOOL OPERATIONS</span>
          <h1>Attendance</h1>
          <p>One place to review and record daily presence across your school.</p>
        </div>
        <div className="attendance-date-control">
          <CalendarDays size={17} />
          <div>
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
        </div>
      </header>

      {isPrincipal && (
        <div className="attendance-mode-switch" role="tablist" aria-label="Attendance type">
          <button type="button" className={mode === 'teachers' ? 'active' : ''} onClick={() => { setMode('teachers'); setQuery('') }}>
            <ShieldCheck size={17} />
            <span><strong>Teacher attendance</strong><small>Staff presence & exceptions</small></span>
          </button>
          <button type="button" className={mode === 'students' ? 'active' : ''} onClick={() => { setMode('students'); setQuery('') }}>
            <Users size={17} />
            <span><strong>Student attendance</strong><small>Class-wise daily register</small></span>
          </button>
        </div>
      )}

      {error && <div className="attendance-alert error"><span>{error}</span><button type="button" onClick={() => setError('')}><X size={15} /></button></div>}
      {notice && <div className="attendance-alert success"><Check size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={15} /></button></div>}

      {mode === 'teachers' && isPrincipal && (
        <main className="attendance-workspace">
          <section className="attendance-summary-row">
            <div><span>Present</span><strong>{teacherCounts.present}</strong><small>Teachers on duty</small></div>
            <div className="danger"><span>Absent</span><strong>{teacherCounts.absent}</strong><small>Requires coverage</small></div>
            <div className="warning"><span>Late</span><strong>{teacherCounts.late}</strong><small>Late arrivals</small></div>
            <div className="leave"><span>On leave</span><strong>{teacherCounts.on_leave}</strong><small>Approved leave</small></div>
          </section>

          <section className="attendance-board">
            <div className="attendance-board-head">
              <div>
                <span className="attendance-kicker">STAFF REGISTER</span>
                <h2>{formatDate(date)}</h2>
              </div>
              <div className="attendance-board-actions">
                <label className="attendance-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teacher..." /></label>
                <button className="attendance-save" type="button" onClick={saveTeachers} disabled={saving || loading}>{saving ? 'Saving...' : 'Save attendance'}</button>
              </div>
            </div>
            <div className="attendance-register-head"><span>Teacher</span><span>Employee ID</span><span>Department</span><span>Status</span></div>
            <div className="attendance-register-list">
              {filteredTeachers.map((teacher) => (
                <article className="attendance-register-row" key={teacher.id}>
                  <div className="attendance-person"><span className="attendance-avatar">{initials(teacher.name)}</span><div><strong>{teacher.name}</strong><small>{teacher.designation}</small></div></div>
                  <span className="attendance-meta">{teacher.employeeId || '—'}</span>
                  <span className="attendance-meta">{teacher.department || 'General'}</span>
                  <div className="attendance-status-group">
                    {Object.entries(TEACHER_STATUS).map(([key, item]) => <StatusButton key={key} status={key} label={item.label} selected={teacher.status === key} onClick={() => updateTeacherStatus(teacher.id, key)} />)}
                  </div>
                </article>
              ))}
              {!filteredTeachers.length && <div className="attendance-empty"><Users size={22} /><strong>No teachers found</strong><span>Create teacher profiles first, then they will appear here.</span></div>}
            </div>
          </section>
        </main>
      )}

      {mode === 'students' && (
        <main className="attendance-workspace">
          {(isPrincipal || isTeacher) && (
            <section className="attendance-filter-bar">
              <div className="attendance-filter-title"><UserCheck size={18} /><div><strong>Student register</strong><span>Choose a class and section to open today's register.</span></div></div>
              <label><span>Class</span><select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSection('') }} disabled={isTeacher}>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
              <label><span>Section</span><select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}><option value="">Select section</option>{(isTeacher ? assignments.filter((item) => item.section) : availableSections).map((item) => <option key={item.section?._id || item._id} value={item.section?._id || item._id}>Section {item.section?.name || item.name}</option>)}</select></label>
            </section>
          )}

          {isParent && (
            <section className="attendance-filter-bar compact"><div className="attendance-filter-title"><Users size={18} /><div><strong>Child attendance</strong><span>Attendance recorded by the school.</span></div></div><label><span>Child</span><select value={selectedChild} onChange={(event) => setSelectedChild(event.target.value)}>{children.map((child) => <option key={child._id} value={child._id}>{child.name} · {child.admissionNumber}</option>)}</select></label></section>
          )}

          {summary && <section className="attendance-summary-row personal"><div><span>Attendance</span><strong>{summary.percentage}%</strong><small>Overall record</small></div><div><span>Present</span><strong>{summary.present}</strong><small>Days present</small></div><div className="danger"><span>Absent</span><strong>{summary.absent}</strong><small>Days absent</small></div><div className="warning"><span>Late</span><strong>{summary.late}</strong><small>Late days</small></div></section>}

          {(isPrincipal || isTeacher) && <section className="attendance-board">
            <div className="attendance-board-head">
              <div><span className="attendance-kicker">DAILY REGISTER</span><h2>Class {selectedClassName || '—'} <em>·</em> {availableSections.find((item) => item._id === selectedSection)?.name || assignments.find((item) => (item.section?._id || item.section) === selectedSection)?.section?.name || '—'}</h2><p>{students.length} students · {formatDate(date)}</p></div>
              <div className="attendance-board-actions"><label className="attendance-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student..." /></label><button className="attendance-save" type="button" onClick={saveStudents} disabled={saving || !selectedSection}>{saving ? 'Saving...' : 'Save attendance'}</button></div>
            </div>
            <div className="attendance-register-head student"><span>Student</span><span>Admission</span><span>Roll</span><span>Status</span></div>
            <div className="attendance-register-list">
              {filteredStudents.map((student) => <article className="attendance-register-row student" key={student.userId}><div className="attendance-person"><span className="attendance-avatar">{initials(student.name)}</span><div><strong>{student.name}</strong><small>{student.email || 'Student record'}</small></div></div><span className="attendance-meta">{student.admissionNumber}</span><span className="attendance-meta">#{student.rollNumber}</span><div className="attendance-status-group">{Object.entries(STUDENT_STATUS).map(([key, item]) => <StatusButton key={key} status={key} label={item.label} selected={student.status === key} onClick={() => updateStudentStatus(student.userId, key)} />)}</div></article>)}
              {!filteredStudents.length && <div className="attendance-empty"><Users size={22} /><strong>{selectedSection ? 'No students in this section' : 'Select a section to begin'}</strong><span>{selectedSection ? 'Enroll students from the Students module first.' : 'Choose a class and section above.'}</span></div>}
            </div>
          </section>}

          {!isPrincipal && !isTeacher && summary && <section className="attendance-personal-card"><span className="attendance-kicker">MY ATTENDANCE</span><h2>Your attendance record</h2><div className="attendance-personal-grid"><div><strong>{summary.present}</strong><span>Present</span></div><div><strong>{summary.absent}</strong><span>Absent</span></div><div><strong>{summary.late}</strong><span>Late</span></div><div><strong>{summary.halfDay}</strong><span>Half day</span></div></div><p>Attendance is calculated from saved daily school registers.</p></section>}
        </main>
      )}

      <footer className="attendance-footer"><Clock3 size={14} /> Attendance changes are recorded against the selected school date.<ChevronRight size={14} /></footer>
    </div>
  )
}

export default AttendancePage
