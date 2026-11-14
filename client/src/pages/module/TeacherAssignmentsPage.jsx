import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, GraduationCap, Loader2, Plus, Search, Trash2, X, Users, Pencil } from 'lucide-react'
import apiClient from '../../api/client'
import './TeacherAssignmentsPage.css'

const blankForm = { teacher: '', classId: '', section: '', subject: '' }
const blankClassTeacherForm = { teacher: '', classId: '', section: '' }
const idOf = (value) => value?._id || value?.id || value || ''
const nameOf = (value) => value?.name || '—'

export default function TeacherAssignmentsPage() {
  const [years, setYears] = useState([])
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [subjectMappings, setSubjectMappings] = useState([])
  const [assignments, setAssignments] = useState([])
  const [yearId, setYearId] = useState('')
  const [query, setQuery] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [modal, setModal] = useState(false)
  const [classTeacherModal, setClassTeacherModal] = useState(false)
  const [classTeacherForm, setClassTeacherForm] = useState(blankClassTeacherForm)
  const [form, setForm] = useState(blankForm)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const activeYear = useMemo(() => years.find((year) => year._id === yearId) || years.find((year) => year.isActive) || years[0], [years, yearId])
  const yearClasses = useMemo(() => classes.filter((item) => idOf(item.academicYear) === idOf(activeYear)), [classes, activeYear])
  const availableSections = useMemo(() => sections.filter((item) => idOf(item.class) === form.classId), [sections, form.classId])
  const classSubjects = useMemo(() => subjectMappings.filter((item) => idOf(item.class) === form.classId), [subjectMappings, form.classId])
  const teacherChoices = useMemo(() => [...teachers].sort((a, b) => nameOf(a).localeCompare(nameOf(b))), [teachers])
  const visibleTeachers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return teacherChoices.filter((teacher) => [teacher.name, teacher.email, teacher.employeeId].join(' ').toLowerCase().includes(q))
  }, [teacherChoices, query])
  const selectedTeacher = teacherChoices.find((teacher) => idOf(teacher.user) === selectedTeacherId) || visibleTeachers[0] || teacherChoices[0]
  const selectedAssignments = useMemo(() => assignments.filter((item) => idOf(item.teacher) === idOf(selectedTeacher?.user)), [assignments, selectedTeacher])
  const coveredClasses = new Set(assignments.map((item) => idOf(item.class))).size
  const coveredSubjects = new Set(assignments.map((item) => idOf(item.subject))).size

  async function load(requestedYearId = yearId) {
    setLoading(true); setError('')
    try {
      const yearResponse = await apiClient.get('/academic/years')
      const nextYears = yearResponse.data.years || []
      const year = nextYears.find((item) => item._id === requestedYearId) || nextYears.find((item) => item.isActive) || nextYears[0]
      setYears(nextYears)
      if (!year) {
        setAssignments([]); setTeachers([]); setClasses([]); setSections([]); setSubjectMappings([])
        setError('Create an academic year, classes, sections and class subjects before assigning teachers.')
        return
      }
      setYearId(year._id)
      const [teacherResponse, classResponse, sectionResponse, subjectResponse, assignmentResponse] = await Promise.all([
        apiClient.get('/teachers'),
        apiClient.get('/academic/classes', { params: { academicYear: year._id } }),
        apiClient.get('/academic/sections', { params: { academicYear: year._id } }),
        apiClient.get('/subjects', { params: { academicYear: year._id } }),
        apiClient.get('/academic/teacher-assignments', { params: { academicYear: year._id } }),
      ])
      const activeTeachers = (teacherResponse.data.teachers || []).filter((item) => item.active !== false)
      setTeachers(activeTeachers)
      setSelectedTeacherId((current) => current || idOf(activeTeachers[0]?.user))
      setClasses(classResponse.data.classes || [])
      setSections(sectionResponse.data.sections || [])
      setSubjectMappings(subjectResponse.data.subjects || [])
      setAssignments(assignmentResponse.data.assignments || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load teacher assignment data.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(blankForm); setError(''); setModal(true) }
  const openEdit = (item) => {
    setEditing(item)
    setForm({ teacher: idOf(item.teacher), classId: idOf(item.class), section: idOf(item.section), subject: idOf(item.subject) })
    setError(''); setModal(true)
  }
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value, ...(key === 'classId' ? { section: '', subject: '' } : {}) }))

  async function saveClassTeacher() {
    if (!activeYear?._id || !classTeacherForm.teacher || !classTeacherForm.classId || !classTeacherForm.section) {
      setError('Select teacher, class and section to set a class teacher.')
      return
    }
    setSaving(true); setError('')
    try {
      await apiClient.post('/academic/class-teacher', { academicYear: activeYear._id, teacher: classTeacherForm.teacher, class: classTeacherForm.classId, section: classTeacherForm.section })
      setNotice('Class teacher assigned successfully.')
      setClassTeacherModal(false)
      setClassTeacherForm(blankClassTeacherForm)
      await load()
    } catch (err) { setError(err.response?.data?.message || 'Unable to assign class teacher.') }
    finally { setSaving(false) }
  }

  async function saveAssignment() {
    if (!activeYear?._id || !form.teacher || !form.classId || !form.section || !form.subject) {
      setError('Select teacher, class, section and subject to continue.')
      return
    }
    setSaving(true); setError('')
    try {
      const payload = { academicYear: activeYear._id, teacher: form.teacher, class: form.classId, section: form.section, subject: form.subject, isClassTeacher: Boolean(editing?.isClassTeacher) }
      if (editing) await apiClient.put('/academic/teacher-assignments/' + editing._id, payload)
      else await apiClient.post('/academic/teacher-assignments', payload)
      setNotice(editing ? 'Teacher assignment updated.' : 'Teacher assignment saved to the database.')
      setModal(false); await load()
    } catch (err) { setError(err.response?.data?.message || 'Unable to save this assignment.') }
    finally { setSaving(false) }
  }

  async function deactivate(item) {
    if (!window.confirm('Deactivate this assignment? It will remain in the database for history.')) return
    setError('')
    try {
      await apiClient.delete('/academic/teacher-assignments/' + item._id)
      setNotice('Assignment deactivated.')
      await load()
    } catch (err) { setError(err.response?.data?.message || 'Unable to deactivate assignment.') }
  }

  return <div className="teacher-assignments-page">
    <header className="ta-hero">
      <div className="ta-eyebrow"><span /> ACADEMICS / STAFF ALLOCATION</div>
      <div className="ta-heading-row">
        <div className="ta-title-icon"><GraduationCap size={24} /></div>
        <div><h1>Teacher Assignments</h1><p>Assign teachers to multiple classes, sections and subjects for each academic year.</p></div>
        <div className="ta-heading-actions"><button className="ta-secondary" onClick={() => { setClassTeacherForm(blankClassTeacherForm); setError(''); setClassTeacherModal(true) }}><Users size={16}/> Class Teacher</button><button className="ta-primary" onClick={openCreate}><Plus size={17}/> Assign teacher</button></div>
      </div>
    </header>
    {error && <div className="ta-alert ta-error"><span>{error}</span><button onClick={() => setError('')}><X size={16}/></button></div>}
    {notice && <div className="ta-alert ta-success"><Check size={16}/><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}
    <section className="ta-stats">
      <article><span>Total assignments</span><strong>{assignments.length}</strong></article>
      <article><span>Teachers assigned</span><strong>{new Set(assignments.map((item) => idOf(item.teacher))).size}</strong></article>
      <article><span>Classes covered</span><strong>{coveredClasses}</strong></article>
      <article><span>Subjects</span><strong>{coveredSubjects}</strong></article>
    </section>
    <section className="ta-split-workspace">
      <aside className="ta-teacher-sidebar">
        <div className="ta-sidebar-heading"><div><h2>Teachers</h2><span>{teachers.length} staff members</span></div></div>
        <label className="ta-sidebar-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teacher..."/></label>
        <div className="ta-teacher-list">
          {loading ? <div className="ta-empty"><Loader2 className="ta-spin" size={20}/> Loading teachers…</div> :
            visibleTeachers.length ? visibleTeachers.map((teacher) => {
              const teacherId = idOf(teacher.user)
              const count = assignments.filter((item) => idOf(item.teacher) === teacherId).length
              return <button type="button" key={teacherId} className={'ta-teacher-list-item ' + (idOf(selectedTeacher?.user) === teacherId ? 'selected' : '')} onClick={() => setSelectedTeacherId(teacherId)}>
                <span className="ta-avatar">{nameOf(teacher).slice(0,1).toUpperCase()}</span>
                <span className="ta-teacher-list-copy"><strong>{nameOf(teacher)}</strong><small>{count} {count === 1 ? 'assignment' : 'assignments'}</small></span>
                <span className="ta-list-chevron">›</span>
              </button>
            }) : <div className="ta-empty"><Users size={22}/><strong>No teachers found</strong><span>Try another name.</span></div>}
        </div>
      </aside>
      <section className="ta-selected-panel">
        {loading ? <div className="ta-empty"><Loader2 className="ta-spin" size={22}/> Loading assignments…</div> : selectedTeacher ? <>
          <header className="ta-selected-header">
            <div className="ta-selected-identity">
              <span className="ta-avatar large">{nameOf(selectedTeacher).slice(0,1).toUpperCase()}</span>
              <div><h2>{nameOf(selectedTeacher)}</h2><p>{selectedTeacher.email || selectedTeacher.user?.email || 'Teacher account'}</p></div>
            </div>
            <span className="ta-assignment-count">{selectedAssignments.length} {selectedAssignments.length === 1 ? 'Assignment' : 'Assignments'}</span>
          </header>
          <div className="ta-selected-summary">
            <span><strong>{new Set(selectedAssignments.map((item) => idOf(item.class))).size}</strong> Classes</span>
            <span><strong>{new Set(selectedAssignments.map((item) => idOf(item.subject))).size}</strong> Subjects</span>
            <span className="ta-selected-role">{selectedAssignments.find((item) => item.isClassTeacher) ? 'Class Teacher · Class ' + nameOf(selectedAssignments.find((item) => item.isClassTeacher).class) + ' · Section ' + nameOf(selectedAssignments.find((item) => item.isClassTeacher).section) : 'No Class Teacher role'}</span>
          </div>
          {selectedAssignments.length ? <div className="ta-selected-table-wrap"><table className="ta-selected-table">
            <thead><tr><th>Class</th><th>Section</th><th>Subject</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>{selectedAssignments.map((item) => <tr key={item._id}>
              <td>Class {nameOf(item.class)}</td><td>{nameOf(item.section)}</td><td><strong>{nameOf(item.subject)}</strong></td>
              <td>{item.isClassTeacher ? <span className="ta-class-teacher">Class Teacher</span> : <span className="ta-subject-teacher">Subject Teacher</span>}</td>
              <td><div className="ta-actions"><button onClick={() => openEdit(item)} aria-label="Edit assignment"><Pencil size={14}/></button><button className="ta-remove" onClick={() => deactivate(item)} aria-label="Deactivate assignment"><Trash2 size={14}/></button></div></td>
            </tr>)}</tbody>
          </table></div> : <div className="ta-no-assignment"><BookOpen size={24}/><strong>No assignments yet</strong><span>Assign this teacher to a class and subject to get started.</span><button className="ta-primary" onClick={openCreate}><Plus size={15}/> Assign teacher</button></div>}
        </> : <div className="ta-empty"><Users size={24}/><strong>No teachers available</strong><span>Add a teacher before creating allocations.</span></div>}
      </section>
    </section>
    <footer className="ta-footer"><span>Teacher allocation overview</span><span>Assignments are saved for the active academic year.</span></footer>
    {classTeacherModal && <div className="ta-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setClassTeacherModal(false)}><section className="ta-modal">
      <header><div><span>CLASS LEADERSHIP</span><h2>Assign Class Teacher</h2><p>Choose one teacher for a class and section.</p></div><button onClick={() => !saving && setClassTeacherModal(false)}><X size={19}/></button></header>
      <div className="ta-form-grid">
        <label><span>Teacher *</span><select value={classTeacherForm.teacher} onChange={(event) => setClassTeacherForm((current) => ({ ...current, teacher: event.target.value }))}><option value="">Select teacher</option>{teacherChoices.map((teacher) => <option key={idOf(teacher.user)} value={idOf(teacher.user)}>{teacher.name} · {teacher.employeeId || teacher.email}</option>)}</select></label>
        <label><span>Class *</span><select value={classTeacherForm.classId} onChange={(event) => setClassTeacherForm((current) => ({ ...current, classId: event.target.value, section: '' }))}><option value="">Select class</option>{yearClasses.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
        <label><span>Section *</span><select value={classTeacherForm.section} onChange={(event) => setClassTeacherForm((current) => ({ ...current, section: event.target.value }))}><option value="">Select section</option>{sections.filter((item) => idOf(item.class) === classTeacherForm.classId).map((item) => <option key={item._id} value={idOf(item)}>{item.name}</option>)}</select></label>
      </div>
      {error && <div className="ta-inline-error">{error}</div>}
      <footer><button className="ta-cancel" onClick={() => setClassTeacherModal(false)} disabled={saving}>Cancel</button><button className="ta-primary" onClick={saveClassTeacher} disabled={saving}>{saving ? <Loader2 className="ta-spin" size={16}/> : <Check size={16}/>} {saving ? 'Saving…' : 'Save class teacher'}</button></footer>
    </section></div>}
    {modal && <div className="ta-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setModal(false)}><section className="ta-modal">
      <header><div><span>{editing ? 'UPDATE ALLOCATION' : 'NEW ALLOCATION'}</span><h2>{editing ? 'Edit teacher assignment' : 'Assign a teacher'}</h2><p>Each row assigns one teacher to one class, section and subject.</p></div><button onClick={() => !saving && setModal(false)}><X size={19}/></button></header>
      <div className="ta-form-grid">
        <label><span>Teacher *</span><select value={form.teacher} onChange={(event) => setField('teacher', event.target.value)}><option value="">Select teacher</option>{teachers.map((teacher) => <option key={idOf(teacher.user)} value={idOf(teacher.user)}>{teacher.name} · {teacher.employeeId || teacher.email}</option>)}</select></label>
        <label><span>Class *</span><select value={form.classId} onChange={(event) => setField('classId', event.target.value)}><option value="">Select class</option>{yearClasses.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
        <label><span>Section *</span><select value={form.section} onChange={(event) => setField('section', event.target.value)}><option value="">Select section</option>{availableSections.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
        <label><span>Subject *</span><select value={form.subject} onChange={(event) => setField('subject', event.target.value)}><option value="">Select subject</option>{classSubjects.map((item) => <option key={idOf(item.subject)} value={idOf(item.subject)}>{nameOf(item.subject)}{item.subject?.code ? ' · ' + item.subject.code : ''}</option>)}</select></label>
      </div>
      <div className="ta-form-note">You can add more rows for the same teacher to assign additional subjects, sections or classes.</div>
      {error && <div className="ta-inline-error">{error}</div>}
      <footer><button className="ta-cancel" onClick={() => setModal(false)} disabled={saving}>Cancel</button><button className="ta-primary" onClick={saveAssignment} disabled={saving}>{saving ? <Loader2 className="ta-spin" size={16}/> : <Check size={16}/>} {saving ? 'Saving…' : editing ? 'Save changes' : 'Save assignment'}</button></footer>
    </section></div>}
  </div>
}
