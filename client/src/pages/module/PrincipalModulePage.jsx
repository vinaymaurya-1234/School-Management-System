import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Download,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './PrincipalModulePage.css'

const MODULE_META = {
  students: { title: 'Students', eyebrow: 'ACADEMICS', description: 'Manage student profiles, login accounts and current-year class enrollment.', icon: Users },
  teachers: { title: 'Teachers', eyebrow: 'ACADEMICS', description: 'Manage teacher profiles, login accounts and teaching assignments.', icon: GraduationCap },
  classes: { title: 'Classes & Sections', eyebrow: 'ACADEMICS', description: 'Manage classes, automatic Section A creation and additional sections.', icon: BookOpen },
  subjects: { title: 'Subjects', eyebrow: 'ACADEMICS', description: 'Maintain the subjects actually configured for your school.', icon: BookOpen },
  timetable: { title: 'Timetable', eyebrow: 'ACADEMICS', description: 'Store and manage real timetable entries for the current academic year.', icon: CalendarDays },
  attendance: { title: 'Attendance', eyebrow: 'OPERATIONS', description: 'Record daily student attendance against real student profiles.', icon: ClipboardCheck },
  fees: { title: 'Fees & Payments', eyebrow: 'OPERATIONS', description: 'Record fee accounts and payment status against real students.', icon: Archive },
  exams: { title: 'Exams & Results', eyebrow: 'OPERATIONS', description: 'Create exam records and track their publishing state.', icon: ClipboardCheck },
  reports: { title: 'Reports', eyebrow: 'OPERATIONS', description: 'Live operational summary calculated from your database.', icon: Download },
  notices: { title: 'Notices', eyebrow: 'OPERATIONS', description: 'Publish and archive school notices.', icon: BookOpen },
  events: { title: 'Events', eyebrow: 'OPERATIONS', description: 'Manage school events and dates.', icon: CalendarDays },
  payroll: { title: 'Payroll', eyebrow: 'OPERATIONS', description: 'Record payroll entries for school staff.', icon: Archive },
  profile: { title: 'Settings & Profile', eyebrow: 'ACCOUNT', description: 'Manage your principal account and school information.', icon: Settings },
}

const operationModules = new Set(['subjects', 'timetable', 'attendance', 'fees', 'exams', 'notices', 'events', 'payroll'])

function responseData(response, key) {
  return response?.data?.[key] ?? response?.data
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function emptyForm(module) {
  const forms = {
    students: { admissionNumber: '', name: '', loginEmail: '', loginPassword: '', guardianName: '', guardianPhone: '', classId: '', sectionId: '' },
    teachers: { name: '', email: '', password: '', employeeId: '', phone: '', department: '', designation: 'Teacher', qualification: '' },
    subjects: { title: '', code: '', type: 'Core', classId: '', teacherId: '' },
    timetable: { title: '', day: 'Monday', startTime: '08:00', endTime: '09:00', classId: '', sectionId: '', subject: '', teacherId: '', room: '' },
    attendance: { title: '', date: new Date().toISOString().slice(0, 10), studentId: '', status: 'Present', remarks: '' },
    fees: { title: '', studentId: '', totalAmount: '', paidAmount: '', dueDate: '', status: 'Due', note: '' },
    exams: { title: '', subject: '', classId: '', date: '', status: 'Scheduled', note: '' },
    notices: { title: '', content: '', audience: 'All', publishDate: new Date().toISOString().slice(0, 10), status: 'Published' },
    events: { title: '', date: '', location: '', description: '', status: 'Planned' },
    payroll: { title: '', employeeId: '', month: new Date().toISOString().slice(0, 7), amount: '', status: 'Pending', note: '' },
  }
  return forms[module] || {}
}

function PrincipalModulePage({ moduleKey }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const meta = MODULE_META[moduleKey] || MODULE_META.profile
  const Icon = meta.icon
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [years, setYears] = useState([])
  const [records, setRecords] = useState([])
  const [school, setSchool] = useState(null)
  const [profile, setProfile] = useState(user || {})
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(() => emptyForm(moduleKey))

  const activeYear = useMemo(() => years.find((year) => year.isActive) || years[0] || null, [years])

  const loadBase = async () => {
    const requests = await Promise.allSettled([
      apiClient.get('/students'),
      apiClient.get('/teachers'),
      apiClient.get('/academic/classes', { params: activeYear?._id ? { academicYear: activeYear._id } : undefined }),
      apiClient.get('/academic/sections', { params: activeYear?._id ? { academicYear: activeYear._id } : undefined }),
      apiClient.get('/academic/years'),
      apiClient.get('/academic/enrollments', { params: activeYear?._id ? { academicYear: activeYear._id } : undefined }),
      apiClient.get('/auth/me'),
    ])
    const values = requests.map((item) => item.status === 'fulfilled' ? item.value : null)
    const [studentRes, teacherRes, classRes, sectionRes, yearRes, enrollmentRes, meRes] = values
    if (studentRes) setStudents(responseData(studentRes, 'students') || [])
    if (teacherRes) setTeachers(responseData(teacherRes, 'teachers') || [])
    if (classRes) setClasses(responseData(classRes, 'classes') || [])
    if (sectionRes) setSections(responseData(sectionRes, 'sections') || [])
    if (yearRes) setYears(responseData(yearRes, 'years') || [])
    if (enrollmentRes) setEnrollments(responseData(enrollmentRes, 'enrollments') || [])
    if (meRes) { setProfile(meRes.data.user || user); setSchool(meRes.data.school || null) }
  }

  const loadRecords = async () => {
    if (!operationModules.has(moduleKey)) return
    const response = await apiClient.get(`/operations/${moduleKey}`, { params: activeYear?._id ? { academicYear: activeYear._id } : undefined })
    setRecords(response.data.records || [])
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      await loadBase()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load school data.')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [moduleKey])
  useEffect(() => {
    if (activeYear && operationModules.has(moduleKey)) loadRecords().catch((err) => setError(err.response?.data?.message || 'Unable to load records.'))
  }, [activeYear?._id, moduleKey])

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const openCreate = () => { setEditingId(null); setForm(emptyForm(moduleKey)); setModal(true); setError(''); setNotice('') }
  const openEdit = (record) => { setEditingId(record._id); setForm({ ...emptyForm(moduleKey), ...(record.data || {}), title: record.title }); setModal(true); setError('') }
  const closeModal = () => { if (!saving) setModal(false) }

  const filteredStudents = useMemo(() => students.filter((item) => {
    const value = query.toLowerCase().trim()
    return !value || [item.name, item.admissionNumber, item.guardianName, item.guardianPhone].some((field) => String(field || '').toLowerCase().includes(value))
  }), [students, query])

  const filteredTeachers = useMemo(() => teachers.filter((item) => {
    const value = query.toLowerCase().trim()
    return !value || [item.name, item.email, item.employeeId, item.department].some((field) => String(field || '').toLowerCase().includes(value))
  }), [teachers, query])

  const classSections = (classId) => sections.filter((section) => (section.class?._id || section.class) === classId)

  const getStudentEnrollment = (studentId) => enrollments.find((item) => (item.student?._id || item.student) === studentId && item.status !== 'failed')

  const submitStudent = async () => {
    setSaving(true); setError('')
    try {
      const payload = { admissionNumber: form.admissionNumber, name: form.name, loginEmail: form.loginEmail, loginPassword: form.loginPassword, guardianName: form.guardianName, guardianPhone: form.guardianPhone }
      const response = editingId ? await apiClient.put(`/students/${editingId}`, payload) : await apiClient.post('/students', payload)
      const created = response.data.student
      if (!editingId && form.classId && form.sectionId && created?.userId && activeYear?._id) {
        await apiClient.post('/academic/enrollments', { student: created.userId, academicYear: activeYear._id, class: form.classId, section: form.sectionId, status: 'active' })
      }
      setNotice(editingId ? 'Student updated successfully.' : 'Student profile and login created successfully.')
      setModal(false); await load()
    } catch (err) { setError(err.response?.data?.message || 'Unable to save student.') }
    setSaving(false)
  }

  const submitTeacher = async () => {
    setSaving(true); setError('')
    try {
      if (editingId) {
        await apiClient.put(`/teachers/${editingId}`, { employeeId: form.employeeId, phone: form.phone, department: form.department, designation: form.designation, qualification: form.qualification })
      } else {
        const userResponse = await apiClient.post('/users', { name: form.name, email: form.email, password: form.password, role: 'teacher' })
        await apiClient.post('/teachers', { userId: userResponse.data.user.id, employeeId: form.employeeId, phone: form.phone, department: form.department, designation: form.designation, qualification: form.qualification })
      }
      setNotice(editingId ? 'Teacher updated successfully.' : 'Teacher login and profile created successfully.')
      setModal(false); await load()
    } catch (err) { setError(err.response?.data?.message || 'Unable to save teacher.') }
    setSaving(false)
  }

  const submitOperation = async () => {
    setSaving(true); setError('')
    try {
      const payload = { title: form.title || `${meta.title} record`, data: { ...form }, academicYear: activeYear?._id }
      delete payload.data.title
      if (editingId) await apiClient.put(`/operations/${moduleKey}/${editingId}`, payload)
      else await apiClient.post(`/operations/${moduleKey}`, payload)
      setNotice(editingId ? 'Record updated successfully.' : 'Record created successfully.')
      setModal(false); await loadRecords()
    } catch (err) { setError(err.response?.data?.message || 'Unable to save record.') }
    setSaving(false)
  }

  const submitProfile = async () => {
    setSaving(true); setError('')
    try {
      const response = await apiClient.put('/auth/me', { name: form.name, email: form.email, password: form.password || undefined })
      localStorage.setItem('school-management-auth', JSON.stringify({ ...profile, ...response.data.user, roleLabel: 'Principal' }))
      setProfile(response.data.user); setNotice('Profile updated successfully.'); setModal(false)
    } catch (err) { setError(err.response?.data?.message || 'Unable to update profile.') }
    setSaving(false)
  }

  const removeRecord = async (id) => {
    if (!window.confirm('Archive this record?')) return
    try { await apiClient.delete(`/operations/${moduleKey}/${id}`); setNotice('Record archived.'); await loadRecords() } catch (err) { setError(err.response?.data?.message || 'Unable to archive record.') }
  }

  const addSection = async (classId) => {
    try { await apiClient.post(`/academic/classes/${classId}/sections`, {}); setNotice('Next section created successfully.'); await load() } catch (err) { setError(err.response?.data?.message || 'Unable to create section.') }
  }

  const exportRows = (rows, filename) => {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url)
  }

  const renderStudents = () => (
    <>
      <Toolbar count={filteredStudents.length} query={query} setQuery={setQuery} placeholder="Search name, admission number or guardian" onAdd={openCreate} addLabel="Add student" onExport={() => exportRows([['Name','Admission Number','Guardian','Phone','Status'], ...filteredStudents.map((s) => [s.name,s.admissionNumber,s.guardianName,s.guardianPhone,s.active ? 'Active':'Inactive'])], 'students.csv')} />
      <div className="principal-data-table"><table><thead><tr><th>Student</th><th>Admission</th><th>Class / Section</th><th>Guardian</th><th>Status</th><th /></tr></thead><tbody>{filteredStudents.map((student) => { const enrollment = getStudentEnrollment(student.userId); return <tr key={student.id}><td><strong>{student.name}</strong><span>{student.guardianEmail || student.userId}</span></td><td>{student.admissionNumber}</td><td>{enrollment ? `${enrollment.class?.name || '—'} · ${enrollment.section?.name || '—'}` : 'Not enrolled'}</td><td>{student.guardianName || '—'}<span>{student.guardianPhone || ''}</span></td><td><Status value={student.active ? 'Active' : 'Inactive'} /></td><td><button className="icon-btn" onClick={() => { setEditingId(student.id); setForm({ ...emptyForm('students'), ...student, loginEmail: '', loginPassword: '' }); setModal(true) }}><Pencil size={15} /></button></td></tr> })}</tbody></table>{!filteredStudents.length && <EmptyState text="No students found in the database." />}</div>
    </>
  )

  const renderTeachers = () => (
    <>
      <Toolbar count={filteredTeachers.length} query={query} setQuery={setQuery} placeholder="Search teacher, employee ID or department" onAdd={openCreate} addLabel="Add teacher" onExport={() => exportRows([['Name','Employee ID','Department','Designation','Status'], ...filteredTeachers.map((t) => [t.name,t.employeeId,t.department,t.designation,t.active ? 'Active':'Inactive'])], 'teachers.csv')} />
      <div className="principal-data-table"><table><thead><tr><th>Teacher</th><th>Employee ID</th><th>Department</th><th>Designation</th><th>Status</th><th /></tr></thead><tbody>{filteredTeachers.map((teacher) => <tr key={teacher.id}><td><strong>{teacher.name}</strong><span>{teacher.email}</span></td><td>{teacher.employeeId}</td><td>{teacher.department || '—'}</td><td>{teacher.designation || 'Teacher'}</td><td><Status value={teacher.active ? 'Active':'Inactive'} /></td><td><button className="icon-btn" onClick={() => { setEditingId(teacher.id); setForm({ ...emptyForm('teachers'), ...teacher }); setModal(true) }}><Pencil size={15} /></button></td></tr>)}</tbody></table>{!filteredTeachers.length && <EmptyState text="No teacher profiles found." />}</div>
    </>
  )

  const renderClasses = () => (
    <>
      <div className="structure-toolbar"><div><span>ACADEMIC YEAR</span><strong>{activeYear?.name || 'No active year'}</strong></div><button className="secondary-btn" onClick={() => { setForm({ name: '', order: classes.length + 1, academicYear: activeYear?._id || '' }); setEditingId(null); setModal(true) }}><Plus size={15}/> Create class</button></div>
      <div className="class-grid">{classes.map((schoolClass) => { const classId = schoolClass._id || schoolClass.id; const classSections = classSectionsFor(classId, sections); return <article className="class-card" key={classId}><div className="class-card-top"><span>CLASS {schoolClass.order}</span><strong>{schoolClass.name}</strong></div><div className="section-list">{classSections.map((section) => <span key={section._id}>{section.name}</span>)}</div><button className="text-btn" onClick={() => addSection(classId)}><Plus size={14}/> Add next section</button></article> })}</div>{!classes.length && <EmptyState text="No classes have been created for this academic year." />}
    </>
  )

  const renderOperation = () => (
    <>
      <Toolbar count={records.length} query={query} setQuery={setQuery} placeholder={`Search ${meta.title.toLowerCase()} records`} onAdd={openCreate} addLabel={`Add ${moduleKey === 'fees' ? 'payment' : 'record'}`} onExport={() => exportRows([['Title','Details','Created'], ...records.map((r) => [r.title, JSON.stringify(r.data), formatDate(r.createdAt)])], `${moduleKey}.csv`)} />
      <div className="operation-cards">{records.filter((r) => !query || `${r.title} ${JSON.stringify(r.data)}`.toLowerCase().includes(query.toLowerCase())).map((record) => <article className="operation-card" key={record._id}><div className="operation-card-top"><span>{formatDate(record.createdAt)}</span><div><button className="icon-btn" onClick={() => openEdit(record)}><Pencil size={14}/></button><button className="icon-btn danger" onClick={() => removeRecord(record._id)}><Trash2 size={14}/></button></div></div><h3>{record.title}</h3><div className="operation-fields">{Object.entries(record.data || {}).filter(([key, value]) => key !== 'title' && value !== '' && value !== null && value !== undefined && !key.toLowerCase().includes('password')).slice(0, 8).map(([key, value]) => <span key={key}><small>{humanize(key)}</small><strong>{resolveDisplay(key, value, students, teachers, classes, sections)}</strong></span>)}</div></article>)}{!records.length && <EmptyState text={`No ${meta.title.toLowerCase()} records exist yet. Add the first real record to start this module.`} />}</div>
    </>
  )

  const renderReports = () => {
    const stats = [
      ['Students', students.filter((s) => s.active !== false).length, 'Active student profiles'],
      ['Teachers', teachers.filter((t) => t.active !== false).length, 'Active teacher profiles'],
      ['Classes', classes.length, `In ${activeYear?.name || 'current year'}`],
      ['Sections', sections.length, 'Current academic structure'],
      ['Enrollments', enrollments.length, 'Current-year enrollments'],
    ]
    return <><div className="report-grid">{stats.map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</div><div className="report-panel"><div><span>DATABASE SUMMARY</span><h2>Current school state</h2><p>These numbers are calculated from the APIs and MongoDB records. No demo numbers are shown.</p></div><button className="secondary-btn" onClick={() => { load(); setNotice('Report refreshed.') }}><RefreshCw size={15}/> Refresh</button></div></>
  }

  const renderProfile = () => <div className="profile-layout"><section className="profile-card"><div className="profile-avatar">{(profile.name || 'P').slice(0,1).toUpperCase()}</div><span>PRINCIPAL ACCOUNT</span><h2>{profile.name}</h2><p>{profile.email}</p><Status value={profile.active ? 'Active' : 'Inactive'} /><button className="primary-btn" onClick={() => { setForm({ name: profile.name || '', email: profile.email || '', password: '' }); setModal(true) }}><Pencil size={15}/> Edit profile</button></section><section className="profile-card school-profile"><span>SCHOOL</span><h2>{school?.name || 'School'}</h2><p>{school?.code || '—'}</p><div><small>Address</small><strong>{school?.address || 'No address configured'}</strong></div><div><small>Academic year</small><strong>{activeYear?.name || 'Not configured'}</strong></div></section></div>

  let content = null
  if (moduleKey === 'students') content = renderStudents()
  else if (moduleKey === 'teachers') content = renderTeachers()
  else if (moduleKey === 'classes') content = renderClasses()
  else if (moduleKey === 'reports') content = renderReports()
  else if (moduleKey === 'profile') content = renderProfile()
  else content = renderOperation()

  const submit = moduleKey === 'students' ? submitStudent : moduleKey === 'teachers' ? submitTeacher : moduleKey === 'profile' ? submitProfile : submitOperation

  return <div className="principal-module-page">
    <header className="module-page-header"><button className="back-btn" onClick={() => navigate('/dashboard/principal')}><ArrowLeft size={16}/> Dashboard</button><div className="module-title-row"><div className="module-title-icon"><Icon size={20}/></div><div><span>{meta.eyebrow}</span><h1>{meta.title}</h1><p>{meta.description}</p></div></div>{loading && <span className="loading-label"><Loader2 size={14} className="spin"/> Loading</span>}</header>
    {error && <div className="module-alert error"><span>{error}</span><button onClick={() => setError('')}><X size={15}/></button></div>}
    {notice && <div className="module-alert success"><Check size={15}/><span>{notice}</span><button onClick={() => setNotice('')}><X size={15}/></button></div>}
    <section className="module-surface">{content}</section>
    {modal && <Modal title={editingId ? `Edit ${meta.title.slice(0, -1)}` : `Add ${meta.title.slice(0, -1)}`} onClose={closeModal} saving={saving} onSubmit={submit}>{renderForm(moduleKey, form, setField, classes, sections, students, teachers, activeYear)}</Modal>}
  </div>
}

function classSectionsFor(classId, sections) { return sections.filter((section) => (section.class?._id || section.class) === classId) }
function humanize(value) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()) }
function resolveDisplay(key, value, students, teachers, classes, sections) {
  if (key.toLowerCase().includes('studentid')) return students.find((s) => s.id === value)?.name || value
  if (key.toLowerCase().includes('teacherid')) return teachers.find((t) => t.id === value)?.name || value
  if (key.toLowerCase().includes('classid')) return classes.find((c) => c._id === value || c.id === value)?.name || value
  if (key.toLowerCase().includes('sectionid')) return sections.find((s) => s._id === value)?.name || value
  return String(value)
}

function Status({ value }) { return <span className={`status ${String(value).toLowerCase().replace(/\s+/g, '-')}`}>{value}</span> }
function EmptyState({ text }) { return <div className="empty-state"><Users size={22}/><strong>{text}</strong><span>Use the action above to add real data.</span></div> }

function Toolbar({ count, query, setQuery, placeholder, onAdd, addLabel, onExport }) { return <div className="module-toolbar"><div className="search-box"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder}/></div><span className="record-count">{count} records</span><button className="secondary-btn" onClick={onExport}><Download size={15}/> Export</button><button className="primary-btn" onClick={onAdd}><Plus size={15}/> {addLabel}</button></div> }

function Modal({ title, children, onClose, onSubmit, saving }) { return <div className="modal-backdrop"><div className="modal-card"><div className="modal-head"><div><span>DATABASE ACTION</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose}><X size={17}/></button></div><div className="modal-body">{children}</div><div className="modal-foot"><button className="secondary-btn" onClick={onClose} disabled={saving}>Cancel</button><button className="primary-btn" onClick={onSubmit} disabled={saving}>{saving ? <Loader2 size={15} className="spin"/> : <Check size={15}/>} {saving ? 'Saving...' : 'Save'}</button></div></div></div> }

function Field({ label, children, full = false }) { return <label className={`form-field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label> }
function Input({ value, onChange, type = 'text', placeholder }) { return <input value={value ?? ''} type={type} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/> }
function Select({ value, onChange, options, placeholder = 'Select' }) { return <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}><option value="">{placeholder}</option>{options.map((item) => <option key={item.value ?? item} value={item.value ?? item}>{item.label ?? item}</option>)}</select> }

function renderForm(module, form, setField, classes, sections, students, teachers, activeYear) {
  if (module === 'students') return <div className="form-grid"><Field label="Admission number"><Input value={form.admissionNumber} onChange={(v) => setField('admissionNumber', v)} placeholder="STU003"/></Field><Field label="Full name"><Input value={form.name} onChange={(v) => setField('name', v)} placeholder="Student name"/></Field><Field label="Login email"><Input value={form.loginEmail} onChange={(v) => setField('loginEmail', v)} placeholder="student@school.com"/></Field><Field label="Login password"><Input value={form.loginPassword} onChange={(v) => setField('loginPassword', v)} type="password" placeholder="Minimum 6 characters"/></Field><Field label="Guardian name"><Input value={form.guardianName} onChange={(v) => setField('guardianName', v)}/></Field><Field label="Guardian phone"><Input value={form.guardianPhone} onChange={(v) => setField('guardianPhone', v)}/></Field><Field label="Class"><Select value={form.classId} onChange={(v) => { setField('classId', v); setField('sectionId', '') }} options={classes.map((c) => ({ value: c._id || c.id, label: `Class ${c.name}` }))}/></Field><Field label="Section"><Select value={form.sectionId} onChange={(v) => setField('sectionId', v)} options={classSectionsFor(form.classId, sections).map((s) => ({ value: s._id, label: `Section ${s.name}` }))}/></Field><div className="form-help full">Creates the student login + profile first. If Class and Section are selected, the new student is also enrolled in the current academic year {activeYear?.name || ''}.</div></div>
  if (module === 'teachers') return <div className="form-grid"><Field label="Full name"><Input value={form.name} onChange={(v) => setField('name', v)}/></Field><Field label="Login email"><Input value={form.email} onChange={(v) => setField('email', v)}/></Field><Field label="Login password"><Input value={form.password} onChange={(v) => setField('password', v)} type="password"/></Field><Field label="Employee ID"><Input value={form.employeeId} onChange={(v) => setField('employeeId', v)}/></Field><Field label="Phone"><Input value={form.phone} onChange={(v) => setField('phone', v)}/></Field><Field label="Department"><Input value={form.department} onChange={(v) => setField('department', v)} placeholder="Mathematics"/></Field><Field label="Designation"><Input value={form.designation} onChange={(v) => setField('designation', v)}/></Field><Field label="Qualification"><Input value={form.qualification} onChange={(v) => setField('qualification', v)}/></Field></div>
  if (module === 'profile') return <div className="form-grid"><Field label="Full name"><Input value={form.name} onChange={(v) => setField('name', v)}/></Field><Field label="Email"><Input value={form.email} onChange={(v) => setField('email', v)}/></Field><Field label="New password"><Input value={form.password} onChange={(v) => setField('password', v)} type="password" placeholder="Leave empty to keep current"/></Field><div className="form-help full">Changing your email or password updates the real login account. Your current session remains active.</div></div>
  if (module === 'subjects') return <div className="form-grid"><Field label="Subject name"><Input value={form.title} onChange={(v) => setField('title', v)} placeholder="Mathematics"/></Field><Field label="Code"><Input value={form.code} onChange={(v) => setField('code', v)} placeholder="MAT"/></Field><Field label="Type"><Select value={form.type} onChange={(v) => setField('type', v)} options={['Core','Elective','Activity']}/></Field><Field label="Class"><Select value={form.classId} onChange={(v) => setField('classId', v)} options={classes.map((c) => ({ value: c._id, label: `Class ${c.name}` }))}/></Field><Field label="Teacher"><Select value={form.teacherId} onChange={(v) => setField('teacherId', v)} options={teachers.map((t) => ({ value: t.id, label: t.name }))}/></Field></div>
  if (module === 'timetable') return <div className="form-grid"><Field label="Entry title"><Input value={form.title} onChange={(v) => setField('title', v)} placeholder="Mathematics Period 1"/></Field><Field label="Day"><Select value={form.day} onChange={(v) => setField('day', v)} options={['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']}/></Field><Field label="Start"><Input value={form.startTime} onChange={(v) => setField('startTime', v)} type="time"/></Field><Field label="End"><Input value={form.endTime} onChange={(v) => setField('endTime', v)} type="time"/></Field><Field label="Class"><Select value={form.classId} onChange={(v) => { setField('classId', v); setField('sectionId', '') }} options={classes.map((c) => ({ value: c._id, label: `Class ${c.name}` }))}/></Field><Field label="Section"><Select value={form.sectionId} onChange={(v) => setField('sectionId', v)} options={classSectionsFor(form.classId, sections).map((s) => ({ value: s._id, label: `Section ${s.name}` }))}/></Field><Field label="Subject"><Input value={form.subject} onChange={(v) => setField('subject', v)} placeholder="Mathematics"/></Field><Field label="Teacher"><Select value={form.teacherId} onChange={(v) => setField('teacherId', v)} options={teachers.map((t) => ({ value: t.id, label: t.name }))}/></Field><Field label="Room"><Input value={form.room} onChange={(v) => setField('room', v)} placeholder="204"/></Field></div>
  if (module === 'attendance') return <div className="form-grid"><Field label="Date"><Input value={form.date} onChange={(v) => setField('date', v)} type="date"/></Field><Field label="Student"><Select value={form.studentId} onChange={(v) => setField('studentId', v)} options={students.map((s) => ({ value: s.id, label: `${s.name} · ${s.admissionNumber}` }))}/></Field><Field label="Status"><Select value={form.status} onChange={(v) => setField('status', v)} options={['Present','Absent','Late','Half Day']}/></Field><Field label="Remarks"><Input value={form.remarks} onChange={(v) => setField('remarks', v)}/></Field></div>
  if (module === 'fees') return <div className="form-grid"><Field label="Account title"><Input value={form.title} onChange={(v) => setField('title', v)} placeholder="Term 1 fee"/></Field><Field label="Student"><Select value={form.studentId} onChange={(v) => setField('studentId', v)} options={students.map((s) => ({ value: s.id, label: `${s.name} · ${s.admissionNumber}` }))}/></Field><Field label="Total amount"><Input value={form.totalAmount} onChange={(v) => setField('totalAmount', v)} type="number"/></Field><Field label="Paid amount"><Input value={form.paidAmount} onChange={(v) => setField('paidAmount', v)} type="number"/></Field><Field label="Due date"><Input value={form.dueDate} onChange={(v) => setField('dueDate', v)} type="date"/></Field><Field label="Status"><Select value={form.status} onChange={(v) => setField('status', v)} options={['Paid','Partial','Due','Overdue']}/></Field><Field label="Note"><Input value={form.note} onChange={(v) => setField('note', v)}/></Field></div>
  if (module === 'exams') return <div className="form-grid"><Field label="Exam name"><Input value={form.title} onChange={(v) => setField('title', v)} placeholder="Mid-term Mathematics"/></Field><Field label="Subject"><Input value={form.subject} onChange={(v) => setField('subject', v)}/></Field><Field label="Class"><Select value={form.classId} onChange={(v) => setField('classId', v)} options={classes.map((c) => ({ value: c._id, label: `Class ${c.name}` }))}/></Field><Field label="Date"><Input value={form.date} onChange={(v) => setField('date', v)} type="date"/></Field><Field label="Status"><Select value={form.status} onChange={(v) => setField('status', v)} options={['Scheduled','Marks Pending','Published','Cancelled']}/></Field><Field label="Note"><Input value={form.note} onChange={(v) => setField('note', v)}/></Field></div>
  if (module === 'notices') return <div className="form-grid"><Field label="Title"><Input value={form.title} onChange={(v) => setField('title', v)}/></Field><Field label="Audience"><Select value={form.audience} onChange={(v) => setField('audience', v)} options={['All','Teachers','Students','Parents','Staff']}/></Field><Field label="Publish date"><Input value={form.publishDate} onChange={(v) => setField('publishDate', v)} type="date"/></Field><Field label="Status"><Select value={form.status} onChange={(v) => setField('status', v)} options={['Published','Draft','Archived']}/></Field><Field label="Content" full><textarea value={form.content} onChange={(e) => setField('content', e.target.value)} rows="5" placeholder="Write the announcement..."/></Field></div>
  if (module === 'events') return <div className="form-grid"><Field label="Event"><Input value={form.title} onChange={(v) => setField('title', v)}/></Field><Field label="Date"><Input value={form.date} onChange={(v) => setField('date', v)} type="date"/></Field><Field label="Location"><Input value={form.location} onChange={(v) => setField('location', v)}/></Field><Field label="Status"><Select value={form.status} onChange={(v) => setField('status', v)} options={['Planned','Confirmed','Completed','Cancelled']}/></Field><Field label="Description" full><textarea value={form.description} onChange={(e) => setField('description', e.target.value)} rows="4"/></Field></div>
  if (module === 'payroll') return <div className="form-grid"><Field label="Payroll entry"><Input value={form.title} onChange={(v) => setField('title', v)} placeholder="September salary"/></Field><Field label="Employee"><Select value={form.employeeId} onChange={(v) => setField('employeeId', v)} options={teachers.map((t) => ({ value: t.id, label: `${t.name} · ${t.employeeId}` }))}/></Field><Field label="Month"><Input value={form.month} onChange={(v) => setField('month', v)} type="month"/></Field><Field label="Amount"><Input value={form.amount} onChange={(v) => setField('amount', v)} type="number"/></Field><Field label="Status"><Select value={form.status} onChange={(v) => setField('status', v)} options={['Pending','Processed','Paid']}/></Field><Field label="Note"><Input value={form.note} onChange={(v) => setField('note', v)}/></Field></div>
  return null
}

export default PrincipalModulePage
