import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, GraduationCap, Loader2, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import apiClient from '../../api/client'
import './TeacherAssignmentsPage.css'

const blankForm = { teacher: '', classId: '', section: '', subject: '', isClassTeacher: false }
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
  const [teacherFilter, setTeacherFilter] = useState('')
  const [modal, setModal] = useState(false)
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
  const filteredAssignments = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assignments.filter((item) => {
      if (teacherFilter && idOf(item.teacher) !== teacherFilter) return false
      const haystack = [nameOf(item.teacher), item.teacher?.email, nameOf(item.class), nameOf(item.section), nameOf(item.subject), activeYear?.name].join(' ').toLowerCase()
      return !q || haystack.includes(q)
    })
  }, [assignments, query, teacherFilter, activeYear])

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
      setTeachers((teacherResponse.data.teachers || []).filter((item) => item.active !== false))
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
    setForm({ teacher: idOf(item.teacher), classId: idOf(item.class), section: idOf(item.section), subject: idOf(item.subject), isClassTeacher: Boolean(item.isClassTeacher) })
    setError(''); setModal(true)
  }
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value, ...(key === 'classId' ? { section: '', subject: '' } : {}) }))

  async function saveAssignment() {
    if (!activeYear?._id || !form.teacher || !form.classId || !form.section || !form.subject) {
      setError('Select teacher, class, section and subject to continue.')
      return
    }
    setSaving(true); setError('')
    try {
      const payload = { academicYear: activeYear._id, teacher: form.teacher, class: form.classId, section: form.section, subject: form.subject, isClassTeacher: form.isClassTeacher }
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
        <button className="ta-primary" onClick={openCreate}><Plus size={17}/> Assign teacher</button>
      </div>
    </header>
    {error && <div className="ta-alert ta-error"><span>{error}</span><button onClick={() => setError('')}><X size={16}/></button></div>}
    {notice && <div className="ta-alert ta-success"><Check size={16}/><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}
    <section className="ta-stats">
      <article><span>Active assignments</span><strong>{assignments.length}</strong><small>Saved for selected year</small></article>
      <article><span>Teachers assigned</span><strong>{new Set(assignments.map((item) => idOf(item.teacher))).size}</strong><small>Unique teachers</small></article>
      <article><span>Unassigned teachers</span><strong>{teachers.filter((teacher) => !assignments.some((item) => idOf(item.teacher) === idOf(teacher.user))).length}</strong><small>Need allocation</small></article>
    </section>
    <section className="ta-panel">
      <div className="ta-toolbar">
        <label className="ta-year"><span>ACADEMIC YEAR</span><select value={activeYear?._id || ''} onChange={(event) => { setYearId(event.target.value); load(event.target.value) }}>{years.map((year) => <option key={year._id} value={year._id}>{year.name}{year.isActive ? ' · Active' : ''}</option>)}</select></label>
        <label className="ta-search"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teacher, class, section or subject"/></label>
        <label className="ta-filter"><span>TEACHER</span><select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}><option value="">All teachers</option>{teachers.map((teacher) => <option key={idOf(teacher.user)} value={idOf(teacher.user)}>{teacher.name}</option>)}</select></label>
        <button className="ta-refresh" onClick={load} aria-label="Refresh"><RefreshCw size={16}/></button>
      </div>
      {loading ? <div className="ta-empty"><Loader2 className="ta-spin" size={24}/> Loading assignments…</div> : filteredAssignments.length === 0 ? <div className="ta-empty"><BookOpen size={28}/><strong>No assignments found</strong><span>Assign an existing teacher or adjust your filters.</span><button className="ta-primary" onClick={openCreate}><Plus size={16}/> Assign teacher</button></div> :
        <div className="ta-table-wrap"><table className="ta-table"><thead><tr><th>Teacher</th><th>Class</th><th>Section</th><th>Subject</th><th>Role</th><th>Actions</th></tr></thead><tbody>
          {filteredAssignments.map((item) => <tr key={item._id}><td><div className="ta-teacher-cell"><span>{nameOf(item.teacher).slice(0,1).toUpperCase()}</span><div><strong>{nameOf(item.teacher)}</strong><small>{item.teacher?.email || 'Teacher account'}</small></div></div></td><td>Class {nameOf(item.class)}</td><td>{nameOf(item.section)}</td><td><span className="ta-subject">{nameOf(item.subject)}</span></td><td>{item.isClassTeacher ? <span className="ta-class-teacher">Class teacher</span> : <span className="ta-subject-teacher">Subject teacher</span>}</td><td><div className="ta-actions"><button onClick={() => openEdit(item)}>Edit</button><button className="ta-remove" onClick={() => deactivate(item)} aria-label="Deactivate assignment"><Trash2 size={15}/></button></div></td></tr>)}
        </tbody></table></div>}
      <footer className="ta-footer"><span>Showing {filteredAssignments.length} of {assignments.length} assignments</span><span>Changes are stored against the selected academic year.</span></footer>
    </section>
    {modal && <div className="ta-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setModal(false)}><section className="ta-modal">
      <header><div><span>{editing ? 'UPDATE ALLOCATION' : 'NEW ALLOCATION'}</span><h2>{editing ? 'Edit teacher assignment' : 'Assign a teacher'}</h2><p>Each row assigns one teacher to one class, section and subject.</p></div><button onClick={() => !saving && setModal(false)}><X size={19}/></button></header>
      <div className="ta-form-grid">
        <label><span>Teacher *</span><select value={form.teacher} onChange={(event) => setField('teacher', event.target.value)}><option value="">Select teacher</option>{teachers.map((teacher) => <option key={idOf(teacher.user)} value={idOf(teacher.user)}>{teacher.name} · {teacher.employeeId || teacher.email}</option>)}</select></label>
        <label><span>Class *</span><select value={form.classId} onChange={(event) => setField('classId', event.target.value)}><option value="">Select class</option>{yearClasses.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
        <label><span>Section *</span><select value={form.section} onChange={(event) => setField('section', event.target.value)}><option value="">Select section</option>{availableSections.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
        <label><span>Subject *</span><select value={form.subject} onChange={(event) => setField('subject', event.target.value)}><option value="">Select subject</option>{classSubjects.map((item) => <option key={idOf(item.subject)} value={idOf(item.subject)}>{nameOf(item.subject)}{item.subject?.code ? ' · ' + item.subject.code : ''}</option>)}</select></label>
      </div>
      <label className="ta-checkbox"><input type="checkbox" checked={form.isClassTeacher} onChange={(event) => setField('isClassTeacher', event.target.checked)}/><span><strong>Also class teacher</strong><small>Mark this teacher as the class teacher for the selected section.</small></span></label>
      <div className="ta-form-note">You can add more rows for the same teacher to assign additional subjects, sections or classes.</div>
      {error && <div className="ta-inline-error">{error}</div>}
      <footer><button className="ta-cancel" onClick={() => setModal(false)} disabled={saving}>Cancel</button><button className="ta-primary" onClick={saveAssignment} disabled={saving}>{saving ? <Loader2 className="ta-spin" size={16}/> : <Check size={16}/>} {saving ? 'Saving…' : editing ? 'Save changes' : 'Save assignment'}</button></footer>
    </section></div>}
  </div>
}
