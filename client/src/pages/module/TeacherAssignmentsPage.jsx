import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, GraduationCap, Loader2, Plus, RefreshCw, Search, Trash2, X, Users, School, ListFilter, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const [view, setView] = useState('teacher')
  const [classFilter, setClassFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 12
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
      if (classFilter && idOf(item.class) !== classFilter) return false
      if (sectionFilter && idOf(item.section) !== sectionFilter) return false
      const haystack = [nameOf(item.teacher), item.teacher?.email, nameOf(item.class), nameOf(item.section), nameOf(item.subject), activeYear?.name].join(' ').toLowerCase()
      return !q || haystack.includes(q)
    })
  }, [assignments, query, teacherFilter, classFilter, sectionFilter, activeYear])
  const visibleAssignments = useMemo(() => filteredAssignments.slice((page - 1) * pageSize, page * pageSize), [filteredAssignments, page])
  const pageCount = Math.max(1, Math.ceil(filteredAssignments.length / pageSize))
  const selectedTeacher = teachers.find((item) => idOf(item.user) === teacherFilter)
  const selectedClass = yearClasses.find((item) => idOf(item) === classFilter)
  const selectedSection = sections.find((item) => idOf(item) === sectionFilter)
  const teacherChoices = useMemo(() => [...teachers].sort((a, b) => nameOf(a).localeCompare(nameOf(b))), [teachers])
  const sectionChoices = useMemo(() => sections.filter((item) => !classFilter || idOf(item.class) === classFilter), [sections, classFilter])

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
        <label className="ta-year"><span>ACADEMIC YEAR</span><select value={activeYear?._id || ''} onChange={(event) => { setPage(1); setYearId(event.target.value); load(event.target.value) }}>{years.map((year) => <option key={year._id} value={year._id}>{year.name}{year.isActive ? ' · Active' : ''}</option>)}</select></label>
        <label className="ta-search"><Search size={17}/><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search teacher, class, section or subject"/></label>
        <label className="ta-filter"><span>TEACHER</span><select value={teacherFilter} onChange={(event) => { setTeacherFilter(event.target.value); setPage(1) }}><option value="">All teachers</option>{teacherChoices.map((teacher) => <option key={idOf(teacher.user)} value={idOf(teacher.user)}>{teacher.name}</option>)}</select></label>
        <button className="ta-refresh" onClick={() => load()} aria-label="Refresh assignments"><RefreshCw size={16}/></button>
      </div>
      <div className="ta-view-tabs" role="tablist" aria-label="Assignment views">
        <button className={view === 'teacher' ? 'active' : ''} onClick={() => { setView('teacher'); setPage(1) }}><Users size={16}/> Teacher-wise</button>
        <button className={view === 'class' ? 'active' : ''} onClick={() => { setView('class'); setPage(1) }}><School size={16}/> Class-wise</button>
        <button className={view === 'all' ? 'active' : ''} onClick={() => { setView('all'); setPage(1) }}><ListFilter size={16}/> All assignments</button>
      </div>
      {view === 'class' && <div className="ta-view-filters">
        <label className="ta-filter"><span>CLASS</span><select value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setSectionFilter(''); setPage(1) }}><option value="">All classes</option>{yearClasses.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
        <label className="ta-filter"><span>SECTION</span><select value={sectionFilter} onChange={(event) => { setSectionFilter(event.target.value); setPage(1) }}><option value="">All sections</option>{sectionChoices.map((item) => <option key={item._id} value={item._id}>{nameOf(item.class)} · {item.name}</option>)}</select></label>
        <span className="ta-view-hint">Choose a class and section to review its teachers and subjects.</span>
      </div>}
      {loading ? <div className="ta-empty"><Loader2 className="ta-spin" size={24}/> Loading assignments…</div> :
        view === 'teacher' ? <div className="ta-directory">
          {teachers.filter((item) => !teacherFilter || idOf(item.user) === teacherFilter).filter((item) => {
            const own = assignments.filter((assignment) => idOf(assignment.teacher) === idOf(item.user))
            const q = query.trim().toLowerCase()
            return !q || [item.name, item.email, ...own.flatMap((assignment) => [nameOf(assignment.class), nameOf(assignment.section), nameOf(assignment.subject)])].join(' ').toLowerCase().includes(q)
          }).sort((a,b) => nameOf(a).localeCompare(nameOf(b))).map((teacher) => {
            const own = assignments.filter((assignment) => idOf(assignment.teacher) === idOf(teacher.user)).filter((assignment) => {
              const q = query.trim().toLowerCase()
              return !q || [nameOf(assignment.class), nameOf(assignment.section), nameOf(assignment.subject), nameOf(assignment.teacher)].join(' ').toLowerCase().includes(q)
            })
            const classRole = own.find((item) => item.isClassTeacher)
            return <article className="ta-teacher-card" key={idOf(teacher.user)}>
              <div className="ta-teacher-card-head"><span className="ta-avatar">{nameOf(teacher).slice(0,1).toUpperCase()}</span><div className="ta-teacher-card-name"><strong>{nameOf(teacher)}</strong><small>{teacher.email || teacher.user?.email || 'Teacher account'}</small></div><span className="ta-assignment-count">{own.length} {own.length === 1 ? 'assignment' : 'assignments'}</span></div>
              <div className="ta-teacher-summary"><span><strong>{new Set(own.map((item) => idOf(item.class))).size}</strong> classes</span><span><strong>{new Set(own.map((item) => idOf(item.subject))).size}</strong> subjects</span><span className="ta-homeroom">{classRole ? `Class Teacher · Class ${nameOf(classRole.class)}-${nameOf(classRole.section)}` : 'No Class Teacher role'}</span></div>
              {own.length ? <div className="ta-assignment-chips">{own.map((item) => <div className="ta-assignment-chip" key={item._id}><div><strong>{nameOf(item.subject)}</strong><small>Class {nameOf(item.class)} · Section {nameOf(item.section)}</small></div><div className="ta-actions"><button onClick={() => openEdit(item)}>Edit</button><button className="ta-remove" onClick={() => deactivate(item)} aria-label="Deactivate assignment"><Trash2 size={14}/></button></div></div>)}</div> : <div className="ta-no-assignment">No assignments match this teacher and search.</div>}
            </article>
          })}
          {!teachers.length && <div className="ta-empty"><Users size={25}/><strong>No teachers found</strong></div>}
        </div> :
        view === 'class' ? <div className="ta-class-directory">
          {yearClasses.filter((item) => !classFilter || idOf(item) === classFilter).map((schoolClass) => {
            const classSections = sections.filter((section) => idOf(section.class) === idOf(schoolClass) && (!sectionFilter || idOf(section) === sectionFilter))
            return classSections.map((section) => {
              const own = assignments.filter((item) => idOf(item.class) === idOf(schoolClass) && idOf(item.section) === idOf(section) && (!teacherFilter || idOf(item.teacher) === teacherFilter) && (!query.trim() || [nameOf(item.teacher), item.teacher?.email, nameOf(item.subject)].join(' ').toLowerCase().includes(query.trim().toLowerCase())))
              return <article className="ta-class-card" key={idOf(section)}><div className="ta-class-card-head"><div><h3>Class {nameOf(schoolClass)} · Section {nameOf(section)}</h3></div><span className="ta-assignment-count">{own.length} subjects</span></div>
                {own.find((item) => item.isClassTeacher) ? <div className="ta-class-teacher-banner"><Users size={15}/><span>Class Teacher: <strong>{nameOf(own.find((item) => item.isClassTeacher).teacher)}</strong></span></div> : <div className="ta-unassigned-banner">Class Teacher not assigned</div>}
                {own.length ? <div className="ta-class-subjects">{own.map((item) => <div className="ta-class-subject-row" key={item._id}><div><strong>{nameOf(item.subject)}</strong><small>{nameOf(item.teacher)}</small></div>{item.isClassTeacher && <span className="ta-class-teacher">Class Teacher</span>}<div className="ta-actions"><button onClick={() => openEdit(item)}>Edit</button><button className="ta-remove" onClick={() => deactivate(item)} aria-label="Deactivate assignment"><Trash2 size={14}/></button></div></div>)}</div> : <div className="ta-no-assignment">No assignments match these filters.</div>}
              </article>
            })
          })}
          {!yearClasses.length && <div className="ta-empty"><School size={25}/><strong>No classes configured</strong></div>}
        </div> :
        filteredAssignments.length === 0 ? <div className="ta-empty"><BookOpen size={28}/><strong>No assignments found</strong><span>Assign an existing teacher or adjust your filters.</span><button className="ta-primary" onClick={openCreate}><Plus size={16}/> Assign teacher</button></div> :
        <div className="ta-table-wrap"><table className="ta-table"><thead><tr><th>Teacher</th><th>Class</th><th>Section</th><th>Subject</th><th>Role</th><th>Actions</th></tr></thead><tbody>
          {visibleAssignments.map((item) => <tr key={item._id}><td><div className="ta-teacher-cell"><span>{nameOf(item.teacher).slice(0,1).toUpperCase()}</span><div><strong>{nameOf(item.teacher)}</strong><small>{item.teacher?.email || 'Teacher account'}</small></div></div></td><td>Class {nameOf(item.class)}</td><td>{nameOf(item.section)}</td><td><span className="ta-subject">{nameOf(item.subject)}</span></td><td>{item.isClassTeacher ? <span className="ta-class-teacher">Class teacher</span> : <span className="ta-subject-teacher">Subject teacher</span>}</td><td><div className="ta-actions"><button onClick={() => openEdit(item)}>Edit</button><button className="ta-remove" onClick={() => deactivate(item)} aria-label="Deactivate assignment"><Trash2 size={15}/></button></div></td></tr>)}
        </tbody></table></div>}
      {view === 'all' && <div className="ta-pagination"><span>Showing {filteredAssignments.length ? (page-1)*pageSize+1 : 0}–{Math.min(page*pageSize, filteredAssignments.length)} of {filteredAssignments.length} assignments</span><div><button disabled={page<=1} onClick={() => setPage((p)=>Math.max(1,p-1))}><ChevronLeft size={15}/> Previous</button><span>Page {page} of {pageCount}</span><button disabled={page>=pageCount} onClick={() => setPage((p)=>Math.min(pageCount,p+1))}>Next <ChevronRight size={15}/></button></div></div>}
      <footer className="ta-footer"><span>{view === 'teacher' ? 'Teacher-wise overview' : view === 'class' ? 'Class and section overview' : `Showing ${visibleAssignments.length} of ${filteredAssignments.length} assignments`}</span><span>Changes are stored against the selected academic year.</span></footer>
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
