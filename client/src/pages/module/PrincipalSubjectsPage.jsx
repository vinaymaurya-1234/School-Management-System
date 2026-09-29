import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Check, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'
import './PrincipalModulePage.css'

function PrincipalSubjectsPage() {
  const navigate = useNavigate()
  const [years, setYears] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ name: '', code: '', weeklyPeriods: 5, teacherId: '' })

  const activeYear = useMemo(() => years.find((year) => year.isActive) || years[0], [years])
  const filteredSections = useMemo(() => sections.filter((section) => (section.class?._id || section.class) === selectedClass), [sections, selectedClass])
  const selectedClassName = classes.find((item) => item._id === selectedClass)?.name || '—'
  const selectedSectionName = filteredSections.find((item) => item._id === selectedSection)?.name || 'All sections'

  const load = async () => {
    setLoading(true); setError('')
    try {
      const yearRes = await apiClient.get('/academic/years')
      const nextYears = yearRes.data.years || []
      setYears(nextYears)
      const year = nextYears.find((item) => item.isActive) || nextYears[0]
      if (!year) return
      const [classRes, sectionRes, teacherRes] = await Promise.all([
        apiClient.get('/academic/classes', { params: { academicYear: year._id } }),
        apiClient.get('/academic/sections', { params: { academicYear: year._id } }),
        apiClient.get('/teachers'),
      ])
      const nextClasses = classRes.data.classes || []
      const nextSections = sectionRes.data.sections || []
      setClasses(nextClasses); setSections(nextSections); setTeachers(teacherRes.data.teachers || [])
      const classId = selectedClass || nextClasses[0]?._id || ''
      setSelectedClass(classId)
      const firstSection = nextSections.find((item) => (item.class?._id || item.class) === classId)?._id || ''
      setSelectedSection(selectedSection || firstSection)
      if (classId) {
        const subjectRes = await apiClient.get('/subjects', { params: { academicYear: year._id, classId } })
        setSubjects(subjectRes.data.subjects || [])
      } else setSubjects([])
    } catch (err) { setError(err.response?.data?.message || 'Unable to load subjects.') }
    finally { setLoading(false) }
  }

  const loadSubjects = async (classId = selectedClass) => {
    if (!activeYear || !classId) return setSubjects([])
    try {
      const response = await apiClient.get('/subjects', { params: { academicYear: activeYear._id, classId } })
      setSubjects(response.data.subjects || [])
    } catch (err) { setError(err.response?.data?.message || 'Unable to load subjects.') }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (activeYear && selectedClass) loadSubjects(selectedClass) }, [selectedClass, activeYear?._id])

  const openCreate = () => { setForm({ name: '', code: '', weeklyPeriods: 5, teacherId: '' }); setModal(true); setError('') }

  const createSubject = async () => {
    if (!activeYear || !selectedClass) return setError('Select a class first.')
    if (!form.name.trim()) return setError('Subject name is required.')
    setSaving(true); setError('')
    try {
      await apiClient.post('/subjects', {
        academicYear: activeYear._id,
        classId: selectedClass,
        name: form.name.trim(),
        code: form.code.trim(),
        weeklyPeriods: Number(form.weeklyPeriods) || 5,
        teacherId: form.teacherId || undefined,
        sectionId: selectedSection || undefined,
      })
      setNotice(`${form.name} mapped to Class ${selectedClassName}.`)
      setModal(false); await loadSubjects()
    } catch (err) { setError(err.response?.data?.message || 'Unable to add subject.') }
    finally { setSaving(false) }
  }

  const removeSubject = async (mappingId, name) => {
    if (!window.confirm(`Remove ${name} from Class ${selectedClassName}?`)) return
    try { await apiClient.delete(`/subjects/${mappingId}`); setNotice(`${name} removed from the class.`); await loadSubjects() }
    catch (err) { setError(err.response?.data?.message || 'Unable to remove subject.') }
  }

  return <div className="principal-module-page">
    <header className="module-page-header">
      <button className="back-btn" onClick={() => navigate('/dashboard/principal')}><ArrowLeft size={16}/> Dashboard</button>
      <div className="module-title-row"><div className="module-title-icon"><BookOpen size={20}/></div><div><span>ACADEMICS</span><h1>Subjects</h1><p>Select a class and section to see the real subjects and assigned teachers.</p></div></div>
      {loading && <span className="loading-label"><Loader2 size={14} className="spin"/> Loading</span>}
    </header>
    {error && <div className="module-alert error"><span>{error}</span><button onClick={() => setError('')}><X size={15}/></button></div>}
    {notice && <div className="module-alert success"><Check size={15}/><span>{notice}</span><button onClick={() => setNotice('')}><X size={15}/></button></div>}
    <section className="module-surface">
      <div className="structure-toolbar"><div><span>ACADEMIC YEAR</span><strong>{activeYear?.name || 'Not configured'}</strong></div><div style={{ display: 'flex', gap: 8 }}><button className="secondary-btn" onClick={load}><RefreshCw size={15}/> Refresh</button><button className="primary-btn" onClick={openCreate}><Plus size={15}/> Add subject</button></div></div>
      <div className="form-grid" style={{ marginBottom: 22 }}>
        <label className="form-field"><span>Class</span><select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection('') }}>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
        <label className="form-field"><span>Section</span><select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}><option value="">All sections</option>{filteredSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></label>
      </div>
      <div className="report-panel" style={{ marginBottom: 18 }}><div><span>SELECTED SCOPE</span><h2>Class {selectedClassName} · {selectedSectionName}</h2><p>{subjects.length} subject mappings found for this class.</p></div><div className="record-count">{subjects.length} subjects</div></div>
      <div className="operation-cards">
        {subjects.map((mapping) => {
          const visibleTeachers = (mapping.teachers || []).filter((teacher) => !selectedSection || teacher.section === selectedSectionName || teacher.section === 'All sections')
          return <article className="operation-card" key={mapping._id}><div className="operation-card-top"><span>{mapping.subject?.code || 'SUBJECT'}</span><div><button className="icon-btn danger" onClick={() => removeSubject(mapping._id, mapping.subject?.name || 'subject')}><Trash2 size={14}/></button></div></div><h3>{mapping.subject?.name || 'Subject'}</h3><div className="operation-fields"><span><small>Teacher</small><strong>{visibleTeachers.length ? visibleTeachers.map((item) => `${item.name}${item.section === 'All sections' ? '' : ` · ${item.section}`}`).join(', ') : 'Not assigned'}</strong></span><span><small>Weekly periods</small><strong>{mapping.weeklyPeriods}</strong></span><span><small>Type</small><strong>{mapping.subject?.isOptional ? 'Optional' : 'Core'}</strong></span></div></article>
        })}
        {!subjects.length && <div className="empty-state"><BookOpen size={22}/><strong>No subjects mapped to Class {selectedClassName} yet.</strong><span>Use “Add subject” to create the real class curriculum and assign a teacher.</span></div>}
      </div>
    </section>
    {modal && <div className="modal-backdrop"><div className="modal-card"><div className="modal-head"><div><span>ACADEMIC SETUP</span><h2>Add subject</h2></div><button className="icon-btn" onClick={() => setModal(false)}><X size={17}/></button></div><div className="modal-body"><div className="form-grid"><label className="form-field"><span>Subject name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mathematics" autoFocus/></label><label className="form-field"><span>Code</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MAT"/></label><label className="form-field"><span>Weekly periods</span><input value={form.weeklyPeriods} onChange={(e) => setForm({ ...form, weeklyPeriods: e.target.value })} type="number" min="1" max="36"/></label><label className="form-field"><span>Teacher</span><select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}><option value="">Assign later</option>{teachers.map((teacher) => <option key={teacher.user} value={teacher.user}>{teacher.name} · {teacher.employeeId}</option>)}</select></label><div className="form-help full">This creates the real subject mapping for Class {selectedClassName}. The selected teacher can then be used by the timetable generator.</div></div></div><div className="modal-foot"><button className="secondary-btn" onClick={() => setModal(false)} disabled={saving}>Cancel</button><button className="primary-btn" onClick={createSubject} disabled={saving}>{saving ? <Loader2 size={15} className="spin"/> : <Plus size={15}/>} {saving ? 'Saving...' : 'Add subject'}</button></div></div></div>}
  </div>
}

export default PrincipalSubjectsPage
