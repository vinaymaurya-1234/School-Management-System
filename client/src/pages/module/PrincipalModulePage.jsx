import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Download, GraduationCap, Loader2, Pencil, Plus, RefreshCw, Search, Settings, Users, X, IndianRupee, ClipboardList, CalendarDays, FileSpreadsheet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './PrincipalModulePage.css'

const META = {
  students: { title: 'Students', description: 'Manage student profiles, parent access and current-year enrollment.', icon: Users },
  teachers: { title: 'Teachers', description: 'Manage teacher accounts and their class, section and subject assignments.', icon: GraduationCap },
  reports: { title: 'Reports', description: 'Live operational summary calculated from your school database.', icon: Download },
  profile: { title: 'Settings & Profile', description: 'Manage your principal account and school information.', icon: Settings },
}

const DEPARTMENTS = ['Academic', 'Administration', 'Sports & Activities', 'Student Support', 'Other']

function idOf(value) { return value?._id || value }
function responseData(response, key) { return response?.data?.[key] ?? response?.data ?? [] }
const emptyStudent = { admissionNumber: '', name: '', loginEmail: '', loginPassword: '', guardianName: '', guardianPhone: '', guardianEmail: '', parentLoginEmail: '', parentLoginPassword: '', parentRelationship: 'Parent', classId: '', sectionId: '' }
const emptyTeacher = { name: '', email: '', password: '', employeeId: '', phone: '', department: 'Academic', designation: 'Teacher', qualification: '', classId: '', sectionId: '', subjectId: '', isClassTeacher: true }

function PrincipalModulePage({ moduleKey }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const meta = META[moduleKey] || META.profile
  const Icon = meta.icon
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [years, setYears] = useState([])
  const [subjectMappings, setSubjectMappings] = useState([])
  const [school, setSchool] = useState(null)
  const [profile, setProfile] = useState(user || {})
  const [query, setQuery] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({})
  const [reportData, setReportData] = useState({ fees: null, exams: [], pendingLeaves: [], loaded: false })

  const activeYear = useMemo(() => years.find((year) => year.isActive) || years[0] || null, [years])
  const filteredSections = useMemo(() => sections.filter((section) => !selectedClass || idOf(section.class) === selectedClass), [sections, selectedClass])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const yearRes = await apiClient.get('/academic/years')
      const nextYears = responseData(yearRes, 'years')
      setYears(nextYears)
      const year = nextYears.find((item) => item.isActive) || nextYears[0]

      const [studentRes, teacherRes, meRes] = await Promise.all([
        apiClient.get('/students'),
        apiClient.get('/teachers'),
        apiClient.get('/auth/me'),
      ])
      setStudents(responseData(studentRes, 'students'))
      setTeachers(responseData(teacherRes, 'teachers'))
      setProfile(meRes.data.user || user)
      setSchool(meRes.data.school || null)

      if (!year) {
        setClasses([])
        setSections([])
        setEnrollments([])
        setSubjectMappings([])
        return
      }

      const [classRes, sectionRes, enrollmentRes, subjectRes] = await Promise.all([
        apiClient.get('/academic/classes', { params: { academicYear: year._id } }),
        apiClient.get('/academic/sections', { params: { academicYear: year._id } }),
        apiClient.get('/academic/enrollments', { params: { academicYear: year._id } }),
        apiClient.get('/subjects', { params: { academicYear: year._id } }),
      ])
      const nextClasses = responseData(classRes, 'classes')
      const nextSections = responseData(sectionRes, 'sections')
      setClasses(nextClasses)
      setSections(nextSections)
      setEnrollments(responseData(enrollmentRes, 'enrollments'))
      setSubjectMappings(responseData(subjectRes, 'subjects'))
      if (moduleKey === 'reports') {
        const [feeResult, examResult, leaveResult] = await Promise.allSettled([
          apiClient.get('/fees/summary'),
          apiClient.get('/exams', { params: { academicYear: year._id } }),
          apiClient.get('/leave', { params: { status: 'pending' } }),
        ])
        setReportData({
          fees: feeResult.status === 'fulfilled' ? feeResult.value.data?.summary || null : null,
          exams: examResult.status === 'fulfilled' ? responseData(examResult.value, 'exams') : [],
          pendingLeaves: leaveResult.status === 'fulfilled' ? responseData(leaveResult.value, 'requests') : [],
          loaded: true,
          errors: [feeResult, examResult, leaveResult].filter((item) => item.status === 'rejected').length,
        })
      }
      if (!selectedClass && nextClasses[0]) setSelectedClass(nextClasses[0]._id)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load school data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [moduleKey])

  const filteredStudents = useMemo(() => students.filter((student) => {
    const enrollment = enrollments.find((item) => idOf(item.student) === student.userId)
    if (selectedClass && idOf(enrollment?.class) !== selectedClass) return false
    if (selectedSection && idOf(enrollment?.section) !== selectedSection) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [student.name, student.admissionNumber, student.guardianName, student.guardianPhone, student.guardianEmail].some((value) => String(value || '').toLowerCase().includes(q))
  }), [students, enrollments, selectedClass, selectedSection, query])

  const filteredTeachers = useMemo(() => teachers.filter((teacher) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [teacher.name, teacher.email, teacher.employeeId, teacher.department].some((value) => String(value || '').toLowerCase().includes(q))
  }), [teachers, query])

  const classSubjects = useMemo(() => subjectMappings.filter((item) => !form.classId || idOf(item.class) === form.classId), [subjectMappings, form.classId])
  const getEnrollment = (studentId) => enrollments.find((item) => idOf(item.student) === studentId && item.status === 'active')
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const closeModal = () => { if (!saving) setModal(false) }

  const exportRows = (rows, filename) => {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const submitStudent = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        admissionNumber: form.admissionNumber,
        name: form.name,
        loginEmail: form.loginEmail,
        loginPassword: form.loginPassword,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        guardianEmail: form.guardianEmail,
        parentLoginEmail: form.parentLoginEmail,
        parentLoginPassword: form.parentLoginPassword,
        parentRelationship: form.parentRelationship,
      }
      const response = editingId ? await apiClient.put(`/students/${editingId}`, payload) : await apiClient.post('/students', payload)
      const student = response.data.student
      if (!editingId && form.classId && form.sectionId && student?.userId && activeYear) {
        await apiClient.post('/academic/enrollments', {
          student: student.userId,
          academicYear: activeYear._id,
          class: form.classId,
          section: form.sectionId,
          status: 'active',
        })
      }
      setNotice(editingId ? 'Student updated successfully.' : response.data.parent ? 'Student and parent login created successfully.' : 'Student profile and login created successfully.')
      setModal(false)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save student.')
    } finally {
      setSaving(false)
    }
  }

  const submitTeacher = async () => {
    setSaving(true)
    setError('')
    try {
      let teacherUserId = form.userId
      if (editingId) {
        await apiClient.put(`/teachers/${editingId}`, {
          name: form.name,
          email: form.email,
          employeeId: form.employeeId,
          phone: form.phone,
          department: form.department,
          designation: form.designation,
          qualification: form.qualification,
        })
        teacherUserId = teachers.find((item) => item.id === editingId)?.user
      } else {
        const userResponse = await apiClient.post('/users', {
          name: form.name,
          email: form.email,
          password: form.password,
          role: 'teacher',
        })
        teacherUserId = userResponse.data.user.id
        await apiClient.post('/teachers', {
          userId: teacherUserId,
          employeeId: form.employeeId,
          phone: form.phone,
          department: form.department,
          designation: form.designation,
          qualification: form.qualification,
        })
      }

      if (form.classId && activeYear && teacherUserId) {
        await apiClient.post('/academic/teacher-assignments', {
          academicYear: activeYear._id,
          teacher: teacherUserId,
          class: form.classId,
          section: form.sectionId || undefined,
          subject: form.subjectId || undefined,
          isClassTeacher: Boolean(form.isClassTeacher),
        })
      }

      setNotice(editingId ? 'Teacher updated and assignment saved.' : 'Teacher login, profile and assignment created successfully.')
      setModal(false)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save teacher.')
    } finally {
      setSaving(false)
    }
  }

  const submitProfile = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await apiClient.put('/auth/me', { name: form.name, email: form.email, password: form.password || undefined })
      setProfile(response.data.user)
      setNotice('Profile updated successfully.')
      setModal(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const openCreate = (kind) => {
    setEditingId(null)
    setForm(kind === 'students'
      ? { ...emptyStudent, classId: selectedClass, sectionId: selectedSection }
      : { ...emptyTeacher, classId: selectedClass, sectionId: selectedSection })
    setModal(true)
    setError('')
    setNotice('')
  }

  const openEditStudent = (student) => {
    setEditingId(student.id)
    const enrollment = getEnrollment(student.userId)
    setForm({ ...emptyStudent, ...student, classId: idOf(enrollment?.class) || '', sectionId: idOf(enrollment?.section) || '', loginEmail: '', loginPassword: '' })
    setModal(true)
  }

  const openEditTeacher = (teacher) => {
    setEditingId(teacher.id)
    setForm({ ...emptyTeacher, ...teacher, userId: teacher.user })
    setModal(true)
  }

  const renderStudents = () => <>
    <FilterBar
      classes={classes}
      filteredSections={filteredSections}
      selectedClass={selectedClass}
      setSelectedClass={(value) => { setSelectedClass(value); setSelectedSection('') }}
      selectedSection={selectedSection}
      setSelectedSection={setSelectedSection}
      query={query}
      setQuery={setQuery}
      count={filteredStudents.length}
      onAdd={() => openCreate('students')}
      addLabel="Add student"
      onExport={() => exportRows([
        ['Name', 'Admission', 'Class', 'Section', 'Guardian', 'Guardian email', 'Status'],
        ...filteredStudents.map((student) => {
          const enrollment = getEnrollment(student.userId)
          return [student.name, student.admissionNumber, enrollment?.class?.name || '', enrollment?.section?.name || '', student.guardianName || '', student.guardianEmail || '', student.active ? 'Active' : 'Inactive']
        }),
      ], 'students.csv')}
    />
    <div className="principal-data-table">
      <table>
        <thead><tr><th>Student</th><th>Admission</th><th>Class / Section</th><th>Guardian</th><th>Status</th><th /></tr></thead>
        <tbody>{filteredStudents.map((student) => {
          const enrollment = getEnrollment(student.userId)
          return <tr key={student.id}>
            <td><strong>{student.name}</strong><span>{student.guardianEmail || student.userId}</span></td>
            <td>{student.admissionNumber}</td>
            <td>{enrollment ? `Class ${enrollment.class?.name} · Section ${enrollment.section?.name}` : 'Not enrolled'}</td>
            <td>{student.guardianName || '—'}<span>{student.guardianPhone || ''}</span></td>
            <td><Status value={student.active ? 'Active' : 'Inactive'} /></td>
            <td><button className="icon-btn" onClick={() => openEditStudent(student)}><Pencil size={15}/></button></td>
          </tr>
        })}</tbody>
      </table>
      {!filteredStudents.length && <Empty text="No students match the selected class / section." />}
    </div>
  </>

  const renderTeachers = () => <>
    <Toolbar
      count={filteredTeachers.length}
      query={query}
      setQuery={setQuery}
      placeholder="Search teacher, employee ID or department"
      onAdd={() => openCreate('teachers')}
      addLabel="Add teacher"
      onExport={() => exportRows([
        ['Name', 'Employee ID', 'Department', 'Designation', 'Status'],
        ...filteredTeachers.map((teacher) => [teacher.name, teacher.employeeId, teacher.department, teacher.designation, teacher.active ? 'Active' : 'Inactive']),
      ], 'teachers.csv')}
    />
    <div className="principal-data-table">
      <table>
        <thead><tr><th>Teacher</th><th>Employee ID</th><th>Department</th><th>Assignments</th><th>Status</th><th /></tr></thead>
        <tbody>{filteredTeachers.map((teacher) => <tr key={teacher.id}>
          <td><strong>{teacher.name}</strong><span>{teacher.email}</span></td>
          <td>{teacher.employeeId}</td>
          <td>{teacher.department || '—'}</td>
          <td><TeacherAssignments teacherId={teacher.user} yearId={activeYear?._id}/></td>
          <td><Status value={teacher.active ? 'Active' : 'Inactive'} /></td>
          <td><button className="icon-btn" onClick={() => openEditTeacher(teacher)}><Pencil size={15}/></button></td>
        </tr>)}</tbody>
      </table>
      {!filteredTeachers.length && <Empty text="No teacher profiles found." />}
    </div>
  </>

  const reportClassRows = useMemo(() => {
    const groups = new Map()
    enrollments.filter((item) => item.status === 'active').forEach((item) => {
      const name = item.class?.name || 'Unassigned'
      groups.set(name, (groups.get(name) || 0) + 1)
    })
    return [...groups.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
  }, [enrollments])
  const reportMaxClassCount = Math.max(1, ...reportClassRows.map(([, count]) => count))
  const exportSchoolReport = () => {
    const rows = [
      ['School report', 'Value'],
      ['Academic year', activeYear?.name || '—'],
      ['Active students', students.filter((item) => item.active !== false).length],
      ['Active teachers', teachers.filter((item) => item.active !== false).length],
      ['Classes', classes.length],
      ['Sections', sections.length],
      ['Active enrollments', enrollments.filter((item) => item.status === 'active').length],
      ['Fees assigned', reportData.fees?.feesAssigned ?? 'Not available'],
      ['Fees collected', reportData.fees?.collected ?? 'Not available'],
      ['Fees outstanding', reportData.fees?.outstanding ?? 'Not available'],
      ['Overdue fee accounts', reportData.fees?.overdueAccounts ?? 'Not available'],
      ['Exams scheduled', reportData.exams.length],
      ['Pending leave requests', reportData.pendingLeaves.length],
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'school-overview-report.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0)
  const renderReports = () => <>
    <div className="principal-report-heading">
      <div><span className="report-kicker">SCHOOL PERFORMANCE</span><h2>Overview & key reports</h2><p>Live figures from the school database for {activeYear?.name || 'the active academic year'}.</p></div>
      <div className="principal-report-actions">
        <button className="secondary-btn" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button>
        <button className="primary-btn" onClick={exportSchoolReport}><Download size={15}/> Export report</button>
      </div>
    </div>
    <div className="report-grid">
      {[
        ['Students', students.filter((item) => item.active !== false).length, 'Active student profiles', Users],
        ['Teachers', teachers.filter((item) => item.active !== false).length, 'Active teacher profiles', GraduationCap],
        ['Classes', classes.length, 'Academic structure', ClipboardList],
        ['Sections', sections.length, 'Across all classes', CalendarDays],
        ['Enrollments', enrollments.filter((item) => item.status === 'active').length, 'Active this academic year', FileSpreadsheet],
      ].map(([label, value, detail, CardIcon]) => <article key={label}><div className="report-card-icon"><CardIcon size={17}/></div><span>{label}</span><strong>{loading ? '—' : value}</strong><small>{detail}</small></article>)}
    </div>
    <div className="principal-report-grid">
      <section className="principal-report-card report-finance-card">
        <div className="principal-report-card-head"><div><span className="report-kicker">FEE COLLECTION</span><h3>Financial overview</h3></div><IndianRupee size={19}/></div>
        {reportData.fees ? <>
          <div className="report-finance-total">{money(reportData.fees.collected)}<small>Collected</small></div>
          <div className="report-finance-lines">
            <div><span>Fees assigned</span><strong>{money(reportData.fees.feesAssigned)}</strong></div>
            <div><span>Outstanding</span><strong>{money(reportData.fees.outstanding)}</strong></div>
            <div><span>Overdue accounts</span><strong>{reportData.fees.overdueAccounts ?? 0}</strong></div>
          </div>
          <div className="report-progress-track"><span style={{ width: `${Math.min(100, reportData.fees.feesAssigned > 0 ? reportData.fees.collected / reportData.fees.feesAssigned * 100 : 0)}%` }}/></div>
          <small className="report-muted">Collection progress against assigned fees</small>
        </> : <div className="report-unavailable">{reportData.loaded ? 'Financial summary is currently unavailable.' : 'Loading financial summary…'}</div>}
      </section>
      <section className="principal-report-card">
        <div className="principal-report-card-head"><div><span className="report-kicker">ACADEMICS</span><h3>Examination activity</h3></div><ClipboardList size={19}/></div>
        <div className="report-highlight-number">{reportData.loaded ? reportData.exams.length : '—'}<small>Exams in this academic year</small></div>
        <div className="report-finance-lines">
          <div><span>Upcoming</span><strong>{reportData.exams.filter((exam) => new Date(exam.scheduledAt) > new Date()).length}</strong></div>
          <div><span>Completed</span><strong>{reportData.exams.filter((exam) => new Date(exam.scheduledAt) <= new Date()).length}</strong></div>
        </div>
        <p className="report-muted">Based on the active academic year's exam schedule.</p>
      </section>
      <section className="principal-report-card">
        <div className="principal-report-card-head"><div><span className="report-kicker">STAFF OPERATIONS</span><h3>Leave requests</h3></div><CalendarDays size={19}/></div>
        <div className="report-highlight-number">{reportData.loaded ? reportData.pendingLeaves.length : '—'}<small>Pending staff requests</small></div>
        <p className="report-muted">Requests waiting for principal review.</p>
        <button className="report-text-action" onClick={() => navigate('/module/leave')}>Review leave requests <span>→</span></button>
      </section>
    </div>
    <section className="principal-report-card report-class-card">
      <div className="principal-report-card-head"><div><span className="report-kicker">ENROLLMENT DISTRIBUTION</span><h3>Students by class</h3><p>Active enrollments grouped by class for the current academic year.</p></div><Users size={19}/></div>
      {reportClassRows.length ? <div className="report-class-bars">{reportClassRows.map(([name, count]) => <div className="report-class-bar-row" key={name}><span>Class {name}</span><div className="report-bar-track"><i style={{ width: `${count / reportMaxClassCount * 100}%` }}/></div><strong>{count}</strong></div>)}</div> : <div className="report-unavailable">{loading ? 'Loading enrollment data…' : 'No active enrollments found for this academic year.'}</div>}
    </section>
    {reportData.errors > 0 && <p className="report-data-note">Some report sections could not be loaded. Refresh to try again; unavailable figures are not replaced with sample data.</p>}
  </>

  const renderProfile = () => <div className="profile-layout">
    <section className="profile-card">
      <div className="profile-avatar">{(profile.name || 'P').slice(0, 1).toUpperCase()}</div>
      <span>PRINCIPAL ACCOUNT</span>
      <h2>{profile.name}</h2>
      <p>{profile.email}</p>
      <Status value={profile.active ? 'Active' : 'Inactive'} />
      <button className="primary-btn" onClick={() => { setForm({ name: profile.name || '', email: profile.email || '', password: '' }); setEditingId(null); setModal(true) }}><Pencil size={15}/> Edit profile</button>
    </section>
    <section className="profile-card school-profile">
      <span>SCHOOL</span>
      <h2>{school?.name || 'School'}</h2>
      <p>{school?.code || '—'}</p>
      <div><small>Address</small><strong>{school?.address || 'No address configured'}</strong></div>
      <div><small>Academic year</small><strong>{activeYear?.name || 'Not configured'}</strong></div>
    </section>
  </div>

  const content = moduleKey === 'students' ? renderStudents() : moduleKey === 'teachers' ? renderTeachers() : moduleKey === 'reports' ? renderReports() : renderProfile()
  const modalTitle = editingId ? `Edit ${moduleKey === 'profile' ? 'profile' : moduleKey === 'students' ? 'student' : 'teacher'}` : `Add ${moduleKey === 'students' ? 'student' : 'teacher'}`

  return <div className="principal-module-page">
    <header className="module-page-header">
      <button className="back-btn" onClick={() => navigate('/dashboard/principal')}><ArrowLeft size={16}/> Dashboard</button>
      <div className="module-title-row"><div className="module-title-icon"><Icon size={20}/></div><div><span>{moduleKey === 'profile' ? 'ACCOUNT' : moduleKey === 'reports' ? 'INSIGHTS' : 'ACADEMICS'}</span><h1>{meta.title}</h1><p>{meta.description}</p></div></div>
      {loading && <span className="loading-label"><Loader2 size={14} className="spin"/> Loading</span>}
    </header>
    {error && <div className="module-alert error"><span>{error}</span><button onClick={() => setError('')}><X size={15}/></button></div>}
    {notice && <div className="module-alert success"><Check size={15}/><span>{notice}</span><button onClick={() => setNotice('')}><X size={15}/></button></div>}
    <section className="module-surface">{content}</section>
    {modal && <Modal title={modalTitle} saving={saving} onClose={closeModal} onSubmit={moduleKey === 'students' ? submitStudent : moduleKey === 'teachers' ? submitTeacher : submitProfile}>
      {moduleKey === 'students'
        ? <StudentForm form={form} setField={setField} classes={classes} sections={sections} activeYear={activeYear} editing={Boolean(editingId)} />
        : moduleKey === 'teachers'
          ? <TeacherForm form={form} setField={setField} classes={classes} sections={sections} subjects={classSubjects} activeYear={activeYear} editing={Boolean(editingId)} />
          : <ProfileForm form={form} setField={setField} />}
    </Modal>}
  </div>
}

function FilterBar({ classes, filteredSections, selectedClass, setSelectedClass, selectedSection, setSelectedSection, query, setQuery, count, onAdd, addLabel, onExport }) {
  return <div>
    <div className="module-toolbar">
      <div className="search-box"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student, admission or guardian"/></div>
      <span className="record-count">{count} records</span>
      <button className="secondary-btn" onClick={onExport}><Download size={15}/> Export</button>
      <button className="primary-btn" onClick={onAdd}><Plus size={15}/> {addLabel}</button>
    </div>
    <div className="form-grid" style={{ marginBottom: 18 }}>
      <label className="form-field"><span>Class</span><select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}><option value="">All classes</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
      <label className="form-field"><span>Section</span><select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}><option value="">All sections</option>{filteredSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></label>
    </div>
  </div>
}

function Toolbar({ count, query, setQuery, placeholder, onAdd, addLabel, onExport }) {
  return <div className="module-toolbar"><div className="search-box"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder}/></div><span className="record-count">{count} records</span><button className="secondary-btn" onClick={onExport}><Download size={15}/> Export</button><button className="primary-btn" onClick={onAdd}><Plus size={15}/> {addLabel}</button></div>
}

function Status({ value }) { return <span className={`status ${String(value).toLowerCase().replace(/\s+/g, '-')}`}>{value}</span> }
function Empty({ text }) { return <div className="empty-state"><Users size={22}/><strong>{text}</strong><span>Use the action above to add real data.</span></div> }

function Modal({ title, children, onClose, onSubmit, saving }) {
  return <div className="modal-backdrop"><div className="modal-card"><div className="modal-head"><div><span>DATABASE ACTION</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose}><X size={17}/></button></div><div className="modal-body">{children}</div><div className="modal-foot"><button className="secondary-btn" onClick={onClose} disabled={saving}>Cancel</button><button className="primary-btn" onClick={onSubmit} disabled={saving}>{saving ? <Loader2 size={15} className="spin"/> : <Check size={15}/>} {saving ? 'Saving...' : 'Save'}</button></div></div></div>
}

function Field({ label, children, full = false }) { return <label className={`form-field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label> }
function Input({ value, onChange, type = 'text', placeholder }) { return <input value={value ?? ''} type={type} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/> }

function StudentForm({ form, setField, classes, sections, activeYear, editing }) {
  const currentSections = sections.filter((section) => idOf(section.class) === form.classId)
  return <div className="form-grid">
    <Field label="Admission number"><Input value={form.admissionNumber} onChange={(v) => setField('admissionNumber', v)} placeholder="STU003"/></Field>
    <Field label="Full name"><Input value={form.name} onChange={(v) => setField('name', v)} placeholder="Student name"/></Field>
    {!editing && <><Field label="Student login email"><Input value={form.loginEmail} onChange={(v) => setField('loginEmail', v)} placeholder="student@school.com"/></Field><Field label="Student login password"><Input value={form.loginPassword} onChange={(v) => setField('loginPassword', v)} type="password" placeholder="Minimum 6 characters"/></Field></>}
    <Field label="Guardian name"><Input value={form.guardianName} onChange={(v) => setField('guardianName', v)}/></Field>
    <Field label="Guardian phone"><Input value={form.guardianPhone} onChange={(v) => setField('guardianPhone', v)}/></Field>
    <Field label="Guardian email"><Input value={form.guardianEmail} onChange={(v) => setField('guardianEmail', v)} placeholder="parent@school.com"/></Field>
    {!editing && <><Field label="Parent login email"><Input value={form.parentLoginEmail} onChange={(v) => setField('parentLoginEmail', v)} placeholder="Use guardian email if preferred"/></Field><Field label="Parent login password"><Input value={form.parentLoginPassword} onChange={(v) => setField('parentLoginPassword', v)} type="password" placeholder="Minimum 6 characters"/></Field><Field label="Relationship"><Input value={form.parentRelationship} onChange={(v) => setField('parentRelationship', v)} placeholder="Father / Mother / Guardian"/></Field></>}
    <Field label="Class"><select value={form.classId} onChange={(e) => { setField('classId', e.target.value); setField('sectionId', '') }}><option value="">Select class</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></Field>
    <Field label="Section"><select value={form.sectionId} onChange={(e) => setField('sectionId', e.target.value)}><option value="">Select section</option>{currentSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></Field>
    <div className="form-help full">{editing ? 'Profile details are editable here. Existing login credentials remain unchanged.' : `Creates the student account and, when parent credentials are supplied, the linked parent account. Enrollment is created for ${activeYear?.name || 'the active year'} when Class and Section are selected.`}</div>
  </div>
}

function TeacherForm({ form, setField, classes, sections, subjects, activeYear, editing }) {
  const currentSections = sections.filter((section) => idOf(section.class) === form.classId)
  return <div className="form-grid">
    <Field label="Full name"><Input value={form.name} onChange={(v) => setField('name', v)} /></Field>
    <Field label="Login email"><Input value={form.email} onChange={(v) => setField('email', v)} /></Field>
    {!editing && <Field label="Login password"><Input value={form.password} onChange={(v) => setField('password', v)} type="password" placeholder="Minimum 6 characters"/></Field>}
    <Field label="Employee ID"><Input value={form.employeeId} onChange={(v) => setField('employeeId', v)} /></Field>
    <Field label="Phone"><Input value={form.phone} onChange={(v) => setField('phone', v)} /></Field>
    <Field label="Department"><select value={form.department} onChange={(e) => setField('department', e.target.value)}><option value="">Select department</option>{DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}</select></Field>
    <Field label="Designation"><select value={form.designation} onChange={(e) => setField('designation', e.target.value)}><option value="Teacher">Teacher</option><option value="Senior Teacher">Senior Teacher</option><option value="Head of Department">Head of Department</option><option value="Coordinator">Coordinator</option><option value="Vice Principal">Vice Principal</option></select></Field>
    <Field label="Qualification"><Input value={form.qualification} onChange={(v) => setField('qualification', v)} placeholder="B.Ed / M.Ed / B.Sc / M.Sc" /></Field>
    <Field label="Assign class"><select value={form.classId} onChange={(e) => { setField('classId', e.target.value); setField('sectionId', ''); setField('subjectId', '') }}><option value="">Assign later</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></Field>
    <Field label="Section"><select value={form.sectionId} onChange={(e) => setField('sectionId', e.target.value)}><option value="">All sections</option>{currentSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></Field>
    <Field label="Subject"><select value={form.subjectId} onChange={(e) => setField('subjectId', e.target.value)} disabled={!form.classId}><option value="">{form.classId ? 'Select subject' : 'Select class first'}</option>{subjects.map((item) => <option key={item.subject?._id || item._id} value={item.subject?._id || item._id}>{item.subject?.name || item.name}{item.subject?.code ? ` (${item.subject.code})` : ''}</option>)}</select></Field>
    <Field label="Teacher role for class"><select value={form.isClassTeacher ? 'class' : 'subject'} onChange={(e) => setField('isClassTeacher', e.target.value === 'class')}><option value="class">Class teacher</option><option value="subject">Subject teacher</option></select></Field>
    <div className="form-help full">Subject options come from the subjects actually mapped to the selected class. Choose Class Teacher when this teacher owns the section's daily attendance; choose Subject Teacher for a subject-specific teaching assignment.</div>
    {!subjects.length && form.classId && <div className="form-help full">No subjects are mapped to this class yet. Add the subject from the Subjects module first, then it will appear here.</div>}
    <div className="form-help full">Teacher assignment is saved for {activeYear?.name || 'the active year'} and will be used by the teacher timetable, subjects and attendance modules.</div>
  </div>
}

function ProfileForm({ form, setField }) { return <div className="form-grid"><Field label="Full name"><Input value={form.name} onChange={(v) => setField('name', v)} /></Field><Field label="Email"><Input value={form.email} onChange={(v) => setField('email', v)} /></Field><Field label="New password"><Input value={form.password} onChange={(v) => setField('password', v)} type="password" placeholder="Leave empty to keep current"/></Field><div className="form-help full">Changes are saved to your real principal login account.</div></div> }

function TeacherAssignments({ teacherId, yearId }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    if (!teacherId || !yearId) return
    apiClient.get('/academic/teacher-assignments', { params: { teacherId, academicYear: yearId } }).then((response) => setItems(response.data.assignments || [])).catch(() => setItems([]))
  }, [teacherId, yearId])
  return <span>{items.length ? items.map((item) => `${item.class?.name || 'Class'}${item.section?.name ? `-${item.section.name}` : ''}${item.subject?.name ? ` · ${item.subject.name}` : ''}`).join(', ') : 'Not assigned'}</span>
}

export default PrincipalModulePage
