import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, CheckCircle2, Clock3, Search, ShieldCheck, UserCheck, Users, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './AttendanceRedesign.css'

const STUDENT_STATUS = {
  present: { label: 'Present' },
  absent: { label: 'Absent' },
  late: { label: 'Late' },
  half_day: { label: 'Half day' },
}

const today = new Date().toISOString().slice(0, 10)

function initials(name = '') { return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() }
function formatDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
function formatTime(value) { return value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—' }
function statusLabel(status) { return String(status || 'not_marked').replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }

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
  const [requests, setRequests] = useState([])
  const [summary, setSummary] = useState(null)
  const [pendingSections, setPendingSections] = useState([])
  const [parentNotifications, setParentNotifications] = useState([])
  const [canEditRegister, setCanEditRegister] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [reviewing, setReviewing] = useState('')
  const teacherLoadSequence = useRef(0)

  const activeYear = useMemo(() => years.find((year) => year.isActive) || years[0] || null, [years])
  const selectedClassName = classes.find((item) => item._id === selectedClass)?.name || ''
  const availableSections = useMemo(() => sections.filter((section) => (section.class?._id || section.class) === selectedClass), [sections, selectedClass])

  const loadAcademicSetup = async () => {
    try {
      const yearRes = await apiClient.get('/academic/years')
      const nextYears = yearRes.data.years || []
      setYears(nextYears)
      const year = nextYears.find((item) => item.isActive) || nextYears[0]
      if (!year) return
      const requestList = [
        apiClient.get('/academic/classes', { params: { academicYear: year._id } }),
        apiClient.get('/academic/sections', { params: { academicYear: year._id } }),
      ]
      if (isTeacher) requestList.push(apiClient.get('/academic/teacher-assignments', { params: { academicYear: year._id, teacherId: user.id } }))
      if (isParent) requestList.push(apiClient.get('/parents/me/children'))
      const results = await Promise.all(requestList)
      setClasses(results[0].data.classes || [])
      setSections(results[1].data.sections || [])
      if (isTeacher) {
        const nextAssignments = results[2].data.assignments || []
        setAssignments(nextAssignments)
        const first = nextAssignments.find((item) => item.section)
        if (first) { setSelectedClass(first.class?._id || first.class); setSelectedSection(first.section?._id || first.section) }
      }
      if (isParent) {
        const nextChildren = results[2].data.children || []
        setChildren(nextChildren)
        if (!selectedChild && nextChildren[0]) setSelectedChild(nextChildren[0]._id)
      }
      if (!selectedClass && results[0].data.classes?.[0]) setSelectedClass(results[0].data.classes[0]._id)
    } catch (err) { setError(err.response?.data?.message || 'Unable to load attendance setup.') }
  }

  const loadStudents = async () => {
    try {
      const params = { date }
      if (activeYear?._id) params.academicYear = activeYear._id
      if (isPrincipal || isTeacher) params.sectionId = selectedSection
      if (isParent && selectedChild) params.studentId = selectedChild
      const response = await apiClient.get('/attendance', { params })
      setStudents(response.data.students || [])
      setCanEditRegister(Boolean(response.data.canEdit))
      if (isPrincipal) {
        const pendingRes = await apiClient.get('/attendance/pending', { params: { date, ...(activeYear?._id ? { academicYear: activeYear._id } : {}) } })
        setPendingSections(pendingRes.data.pending || [])
      }
      if (isParent) {
        const notificationRes = await apiClient.get('/attendance/notifications')
        setParentNotifications(notificationRes.data.notifications || [])
      }
      if (isParent && selectedChild) {
        const summaryRes = await apiClient.get('/attendance/summary', { params: { studentId: selectedChild } })
        setSummary(summaryRes.data)
      }
    } catch (err) { setError(err.response?.data?.message || 'Unable to load student attendance.') }
  }

  const loadTeacherRegister = async () => {
    const sequence = ++teacherLoadSequence.current
    try {
      const [registerRes, requestRes] = await Promise.all([
        apiClient.get('/teacher-attendance', { params: { date } }),
        apiClient.get('/teacher-attendance/requests', { params: { date } }),
      ])

      // A previous register request can finish after an approval request. Never
      // allow that stale response to overwrite the newer authoritative state.
      if (sequence !== teacherLoadSequence.current) return

      setTeachers(registerRes.data.teachers || [])
      setRequests(requestRes.data.requests || [])
    } catch (err) {
      if (sequence === teacherLoadSequence.current) setError(err.response?.data?.message || 'Unable to load teacher attendance.')
    }
  }

  useEffect(() => {
    setLoading(true)
    loadAcademicSetup().finally(() => setLoading(false))
  }, [user?.role])

  useEffect(() => {
    if (mode === 'teachers' && isPrincipal) loadTeacherRegister()
    else if (activeYear && (isParent ? selectedChild : (isPrincipal || isTeacher ? selectedSection : true))) loadStudents()
  }, [activeYear?._id, selectedSection, selectedChild, date, mode])

  const teacherCounts = teachers.reduce((acc, item) => {
    const status = item.status === 'late' ? 'present' : item.status
    return { ...acc, [status]: (acc[status] || 0) + 1 }
  }, { present: 0, absent: 0, on_leave: 0 })
  const lateCount = teachers.filter((item) => item.status === 'late').length
  const filteredTeachers = teachers.filter((teacher) => `${teacher.name} ${teacher.employeeId} ${teacher.department}`.toLowerCase().includes(query.toLowerCase()))
  const filteredStudents = students.filter((student) => `${student.name} ${student.admissionNumber} ${student.rollNumber}`.toLowerCase().includes(query.toLowerCase()))
  const selectedTeachers = selectedStatus ? filteredTeachers.filter((teacher) => selectedStatus === 'present' ? ['present', 'late'].includes(teacher.status) : teacher.status === selectedStatus) : []

  const updateStudentStatus = (userId, status) => setStudents((current) => current.map((student) => student.userId === userId ? { ...student, status } : student))
  const markAllPresent = () => setStudents((current) => current.map((student) => ({ ...student, status: 'present' })))
  const markedCount = students.filter((student) => Object.hasOwn(STUDENT_STATUS, student.status)).length

  const saveStudents = async () => {
    if (!selectedSection) return setError('Select a section first.')
    if (!canEditRegister) return setError('Only the assigned class teacher or principal can submit this register.')
    if (students.some((student) => !Object.hasOwn(STUDENT_STATUS, student.status))) return setError('Mark every student before saving attendance.')
    try {
      await apiClient.post('/attendance/session', { academicYear: activeYear._id, section: selectedSection, date, records: students.map((student) => ({ student: student.userId, status: student.status, note: student.note })) })
      setNotice('Student attendance saved successfully.')
      await loadStudents()
    } catch (err) { setError(err.response?.data?.message || 'Unable to save student attendance.') }
  }

  const reviewRequest = async (requestId, status) => {
    // Invalidate every register request already in flight. Otherwise an older
    // GET can resolve after the approval and visually revert the register.
    ++teacherLoadSequence.current
    setReviewing(requestId); setError(''); setNotice('')
    try {
      const response = await apiClient.patch(`/teacher-attendance/requests/${requestId}/approve`, { status })
      const persistedRecord = response.data?.record
      if (!persistedRecord) throw new Error('The server did not return the updated attendance record.')

      setTeachers((current) => current.map((teacher) => String(teacher.id) === String(persistedRecord.teacher)
        ? { ...teacher, status: persistedRecord.status, checkIn: persistedRecord.checkIn, checkOut: persistedRecord.checkOut, note: persistedRecord.note, verification: persistedRecord.verification }
        : teacher))
      setRequests((current) => current.filter((request) => request._id !== requestId))
      setNotice(`Request approved as ${statusLabel(status)}. Attendance register updated.`)

      // Re-fetch only after the approval has been persisted. The sequence guard
      // ensures this fresh response is the only response allowed to win.
      await loadTeacherRegister()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to approve attendance request.')
      await loadTeacherRegister()
    } finally { setReviewing('') }
  }

  const rejectRequest = async (requestId) => {
    ++teacherLoadSequence.current
    setReviewing(requestId); setError(''); setNotice('')
    try {
      await apiClient.patch(`/teacher-attendance/requests/${requestId}/reject`)
      setNotice('Attendance request rejected.')
      await loadTeacherRegister()
    } catch (err) { setError(err.response?.data?.message || 'Unable to reject attendance request.') }
    finally { setReviewing('') }
  }

  return (
    <div className="attendance-redesign">
      <header className="attendance-page-header">
        <div><span className="attendance-kicker">SCHOOL OPERATIONS</span><h1>Attendance</h1><p>{isPrincipal ? 'A daily presence view for staff and students, with controlled approval for exceptions.' : 'Review and record daily attendance for your assigned students.'}</p></div>
        <div className="attendance-date-control"><CalendarDays size={17} /><div><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div></div>
      </header>

      {isPrincipal && <div className="attendance-mode-switch" role="tablist" aria-label="Attendance type"><button type="button" className={mode === 'teachers' ? 'active' : ''} onClick={() => { setMode('teachers'); setQuery(''); setSelectedStatus('') }}><ShieldCheck size={17} /><span><strong>Teacher attendance</strong><small>Staff presence & approvals</small></span></button><button type="button" className={mode === 'students' ? 'active' : ''} onClick={() => { setMode('students'); setQuery(''); setSelectedStatus('') }}><Users size={17} /><span><strong>Student attendance</strong><small>Class-wise daily register</small></span></button></div>}

      {error && <div className="attendance-alert error"><span>{error}</span><button type="button" onClick={() => setError('')}><X size={15} /></button></div>}
      {notice && <div className="attendance-alert success"><Check size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={15} /></button></div>}

      {mode === 'teachers' && isPrincipal && <main className="attendance-workspace">
        <section className="attendance-command-card"><div><span className="attendance-kicker">STAFF REGISTER</span><h2>{formatDate(date)}</h2><p>Late teachers are included in Present. Absence is generated automatically after the 08:00 check-in close.</p></div><label className="attendance-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teacher, ID or department" /></label></section>

        <section className="attendance-summary-row teacher-summary">
          <button type="button" className={`attendance-stat-card present ${selectedStatus === 'present' ? 'active' : ''}`} onClick={() => setSelectedStatus(selectedStatus === 'present' ? '' : 'present')}><span>Present</span><strong>{teacherCounts.present}</strong><small>{lateCount ? `${lateCount} late included` : 'On duty'}</small></button>
          <button type="button" className={`attendance-stat-card absent ${selectedStatus === 'absent' ? 'active' : ''}`} onClick={() => setSelectedStatus(selectedStatus === 'absent' ? '' : 'absent')}><span>Absent</span><strong>{teacherCounts.absent}</strong><small>Needs coverage</small></button>
          <button type="button" className={`attendance-stat-card late ${selectedStatus === 'late' ? 'active' : ''}`} onClick={() => setSelectedStatus(selectedStatus === 'late' ? '' : 'late')}><span>Late</span><strong>{lateCount}</strong><small>Late check-ins</small></button>
          <button type="button" className={`attendance-stat-card leave ${selectedStatus === 'on_leave' ? 'active' : ''}`} onClick={() => setSelectedStatus(selectedStatus === 'on_leave' ? '' : 'on_leave')}><span>On leave</span><strong>{teacherCounts.on_leave}</strong><small>Approved leave</small></button>
        </section>

        {selectedStatus && <section className="attendance-detail-panel"><div className="attendance-detail-head"><div><span className="attendance-kicker">FILTERED VIEW</span><h3>{statusLabel(selectedStatus)} teachers</h3><p>{selectedTeachers.length} teacher{selectedTeachers.length === 1 ? '' : 's'} in this category.</p></div><button type="button" onClick={() => setSelectedStatus('')}><X size={16} /></button></div><div className="attendance-detail-list">{selectedTeachers.length ? selectedTeachers.map((teacher) => <div className="attendance-detail-row" key={teacher.id}><div className="attendance-person"><span className="attendance-avatar">{initials(teacher.name)}</span><div><strong>{teacher.name}</strong><small>{teacher.employeeId || 'No employee ID'} · {teacher.department || 'General'}</small></div></div><div><span>Check-in</span><strong>{formatTime(teacher.checkIn)}</strong></div><div><span>Check-out</span><strong>{formatTime(teacher.checkOut)}</strong></div><b className={`attendance-inline-status ${teacher.status}`}>{statusLabel(teacher.status)}</b></div>) : <div className="attendance-empty compact"><Users size={20} /><strong>No teachers in this category</strong></div>}</div></section>}

        <section className="attendance-register-card"><div className="attendance-register-title"><div><span className="attendance-kicker">ALL STAFF</span><h2>Daily teacher register</h2></div><span>{filteredTeachers.length} teachers</span></div><div className="attendance-register-head teacher-register"><span>Teacher</span><span>Employee ID</span><span>Department</span><span>Check-in</span><span>Check-out</span><span>Status</span></div><div className="attendance-register-list">{filteredTeachers.map((teacher) => <article className="attendance-register-row teacher-register" key={teacher.id}><div className="attendance-person"><span className="attendance-avatar">{initials(teacher.name)}</span><div><strong>{teacher.name}</strong><small>{teacher.designation}</small></div></div><span className="attendance-meta">{teacher.employeeId || '—'}</span><span className="attendance-meta">{teacher.department || 'General'}</span><span className="attendance-time">{formatTime(teacher.checkIn)}</span><span className="attendance-time">{formatTime(teacher.checkOut)}</span><span className={`attendance-status-badge ${teacher.status}`}>{statusLabel(teacher.status)}</span></article>)}{!filteredTeachers.length && <div className="attendance-empty"><Users size={22} /><strong>No teachers found</strong><span>Try another search.</span></div>}</div></section>

        <section className="attendance-requests-card"><div className="attendance-register-title"><div><span className="attendance-kicker">EXCEPTIONS</span><h2>Attendance requests</h2></div><span>{requests.length} pending</span></div>{requests.length ? <div className="attendance-request-list">{requests.map((request) => <article className="attendance-request-row" key={request._id}><div className="attendance-person"><span className="attendance-avatar">{initials(request.teacher?.user?.name)}</span><div><strong>{request.teacher?.user?.name || 'Teacher'}</strong><small>{request.teacher?.employeeId || 'Staff'} · {new Date(request.date).toLocaleDateString('en-IN')}</small></div></div><p>{request.reason}</p><div className="attendance-request-actions"><button type="button" className="request-reject" disabled={reviewing === request._id} onClick={() => rejectRequest(request._id)}>Reject</button><button type="button" disabled={reviewing === request._id} onClick={() => reviewRequest(request._id, 'late')}>Approve late</button><button type="button" className="request-approve" disabled={reviewing === request._id} onClick={() => reviewRequest(request._id, 'present')}>Approve present</button></div></article>)}</div> : <div className="attendance-request-empty"><CheckCircle2 size={22} /><div><strong>No pending attendance requests</strong><span>Exceptions submitted by teachers will appear here after the check-in window closes.</span></div></div>}</section>
      </main>}

      {mode === 'students' && <main className="attendance-workspace">
        {(isPrincipal || isTeacher) && <section className="attendance-filter-bar"><div className="attendance-filter-title"><UserCheck size={18} /><div><strong>Student register</strong><span>Choose a class and section to open today's register.</span></div></div><label><span>Class</span><select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSection('') }} disabled={isTeacher}>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label><label><span>Section</span><select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}><option value="">Select section</option>{(isTeacher ? assignments.filter((item) => item.section) : availableSections).map((item) => <option key={item.section?._id || item._id} value={item.section?._id || item._id}>Section {item.section?.name || item.name}</option>)}</select></label></section>}
        {isParent && <section className="attendance-filter-bar compact"><div className="attendance-filter-title"><Users size={18} /><div><strong>Child attendance</strong><span>Attendance recorded by the school.</span></div></div><label><span>Child</span><select value={selectedChild} onChange={(event) => setSelectedChild(event.target.value)}>{children.map((child) => <option key={child._id} value={child._id}>{child.name} · {child.admissionNumber}</option>)}</select></label></section>}
        {summary && <section className="attendance-summary-row personal"><div><span>Attendance</span><strong>{summary.percentage}%</strong><small>Overall record</small></div><div><span>Present</span><strong>{summary.present}</strong><small>Days present</small></div><div className="danger"><span>Absent</span><strong>{summary.absent}</strong><small>Days absent</small></div><div className="warning"><span>Late</span><strong>{summary.late}</strong><small>Late days</small></div></section>}
        {(isPrincipal || isTeacher) && <section className="attendance-board"><div className="attendance-board-head"><div><span className="attendance-kicker">DAILY REGISTER</span><h2>Class {selectedClassName || '—'} <em>·</em> {availableSections.find((item) => item._id === selectedSection)?.name || assignments.find((item) => (item.section?._id || item.section) === selectedSection)?.section?.name || '—'}</h2><p>{students.length} students · {formatDate(date)} · {markedCount}/{students.length} marked</p></div><div className="attendance-board-actions"><label className="attendance-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student..." /></label><button className="attendance-secondary-action" type="button" onClick={markAllPresent} disabled={!selectedSection || !canEditRegister}>Mark all present</button><button className="attendance-save" type="button" onClick={saveStudents} disabled={!selectedSection || !canEditRegister || markedCount !== students.length}>{'Save attendance'}</button></div></div><div className="attendance-register-head student"><span>Student</span><span>Admission</span><span>Roll</span><span>Status</span></div><div className="attendance-register-list">{filteredStudents.map((student) => <article className="attendance-register-row student" key={student.userId}><div className="attendance-person"><span className="attendance-avatar">{initials(student.name)}</span><div><strong>{student.name}</strong><small>{student.email || 'Student record'}</small></div></div><span className="attendance-meta">{student.admissionNumber}</span><span className="attendance-meta">#{student.rollNumber}</span><div className="attendance-status-group">{Object.entries(STUDENT_STATUS).map(([key, item]) => <button key={key} type="button" className={`attendance-status-button ${student.status === key ? `is-selected ${key}` : ''}`} onClick={() => updateStudentStatus(student.userId, key)} disabled={!canEditRegister}>{item.label}</button>)}</div></article>)}{!canEditRegister && isTeacher && <div className="attendance-alert"><ShieldCheck size={15} /><span>View only: only the class teacher can edit the official daily register.</span></div>}{isPrincipal && <section className="attendance-requests-card"><div className="attendance-register-title"><div><span className="attendance-kicker">PRINCIPAL MONITORING</span><h2>Pending class attendance</h2></div><span>{pendingSections.length} sections pending</span></div>{pendingSections.length ? <div className="attendance-request-list">{pendingSections.map((item) => <article className="attendance-request-row" key={item.sectionId}><div><strong>Class {item.className} · Section {item.section}</strong><small>{item.classTeacher}</small></div><p>Daily attendance has not been submitted for {formatDate(date)}.</p><div className="attendance-request-actions"><button type="button" onClick={() => { setSelectedClass(item.classId); setSelectedSection(item.sectionId) }}>Open register</button></div></article>)}</div> : <div className="attendance-request-empty"><CheckCircle2 size={20} /><div><strong>All class registers submitted</strong><span>No pending sections for this date.</span></div></div>}</section>}{!filteredStudents.length && <div className="attendance-empty"><Users size={22} /><strong>{selectedSection ? 'No students in this section' : 'Select a section to begin'}</strong><span>{selectedSection ? 'Enroll students from the Students module first.' : 'Choose a class and section above.'}</span></div>}</div></section>}
        {isParent && parentNotifications.length > 0 && <section className="attendance-requests-card"><div className="attendance-register-title"><div><span className="attendance-kicker">SCHOOL NOTIFICATIONS</span><h2>Absence alerts</h2></div><span>{parentNotifications.length} alerts</span></div><div className="attendance-request-list">{parentNotifications.map((item) => <article className="attendance-request-row" key={item._id}><div><strong>{item.title}</strong><small>{new Date(item.date).toLocaleDateString('en-IN')}</small></div><p>{item.message}</p></article>)}</div></section>}{!isPrincipal && !isTeacher && summary && <section className="attendance-personal-card"><span className="attendance-kicker">MY ATTENDANCE</span><h2>Your attendance record</h2><div className="attendance-personal-grid"><div><strong>{summary.present}</strong><span>Present</span></div><div><strong>{summary.absent}</strong><span>Absent</span></div><div><strong>{summary.late}</strong><span>Late</span></div><div><strong>{summary.halfDay}</strong><span>Half day</span></div></div><p>Attendance is calculated from saved daily school registers.</p></section>}
      </main>}
    </div>
  )
}

export default AttendancePage
