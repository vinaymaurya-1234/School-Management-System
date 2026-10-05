import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Clock3, FileText, Loader2, Plus, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './ExamSchedulePage.css'

const idOf = (value) => value?._id || value
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const formatTime = (value) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'

function ExamSchedulePage() {
  const { user } = useAuth()
  const isPrincipal = user?.role === 'principal'
  const [year, setYear] = useState(null)
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [exams, setExams] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ classId: '', sectionId: '', subjectName: '', scheduledAt: '' })

  const filteredSections = useMemo(() => sections.filter((section) => idOf(section.class) === form.classId), [sections, form.classId])
  const browseSections = useMemo(() => sections.filter((section) => !selectedClass || idOf(section.class) === selectedClass), [sections, selectedClass])

  const loadSetup = async () => {
    const yearResponse = await apiClient.get('/academic/years')
    const years = yearResponse.data.years || []
    const active = years.find((item) => item.isActive) || years[0]
    setYear(active || null)
    if (!active) return
    const [classResponse, sectionResponse] = await Promise.all([
      apiClient.get('/academic/classes', { params: { academicYear: active._id } }),
      apiClient.get('/academic/sections', { params: { academicYear: active._id } }),
    ])
    setClasses(classResponse.data.classes || [])
    setSections(sectionResponse.data.sections || [])
  }

  const loadExams = async () => {
    const params = year?._id ? { academicYear: year._id } : {}
    if (isPrincipal || user?.role === 'teacher') {
      if (selectedClass) params.classId = selectedClass
      if (selectedSection) params.sectionId = selectedSection
    }
    const response = await apiClient.get('/exams', { params })
    setExams(response.data.exams || [])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadSetup()
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Unable to load exam setup.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user?.role])

  useEffect(() => {
    if (!year?._id) return
    loadExams().catch((err) => setError(err.response?.data?.message || 'Unable to load exams.'))
  }, [year?._id, selectedClass, selectedSection, user?.role])

  const visibleExams = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return exams
    return exams.filter((exam) => [exam.subjectName, exam.class?.name, exam.section?.name].some((item) => String(item || '').toLowerCase().includes(value)))
  }, [exams, query])

  const upcoming = useMemo(() => exams.filter((exam) => new Date(exam.scheduledAt).getTime() >= Date.now()), [exams])
  const today = useMemo(() => exams.filter((exam) => new Date(exam.scheduledAt).toDateString() === new Date().toDateString()), [exams])
  const classCount = new Set(exams.map((exam) => idOf(exam.class))).size

  const openForm = () => {
    setForm({ classId: selectedClass || classes[0]?._id || '', sectionId: selectedSection || '', subjectName: '', scheduledAt: '' })
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const createExam = async () => {
    if (!year?._id || !form.classId || !form.sectionId || !form.subjectName.trim() || !form.scheduledAt) {
      setError('Class, section, subject name and exam date/time are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiClient.post('/exams', { academicYear: year._id, ...form, subjectName: form.subjectName.trim() })
      setNotice('Exam scheduled successfully. It is now visible to teachers and the selected class.')
      setShowForm(false)
      await loadExams()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create exam.')
    } finally {
      setSaving(false)
    }
  }

  const removeExam = async (exam) => {
    if (!window.confirm(`Remove ${exam.subjectName} exam for Class ${exam.class?.name} · Section ${exam.section?.name}?`)) return
    try {
      await apiClient.delete(`/exams/${exam._id}`)
      setNotice('Exam removed.')
      await loadExams()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to remove exam.')
    }
  }

  return (
    <div className="exam-page">
      <header className="exam-hero">
        <div>
          <span className="exam-eyebrow">ASSESSMENT · {year?.name || 'ACADEMIC YEAR'}</span>
          <div className="exam-title-row"><div className="exam-icon"><FileText size={22} /></div><div><h1>Exam schedule</h1><p>{isPrincipal ? 'Create and publish the school exam schedule by class and section.' : user?.role === 'teacher' ? 'View the complete school exam schedule across all classes.' : user?.role === 'parent' ? 'View exam dates and times for your linked children.' : 'View the exam schedule for your class and section.'}</p></div></div>
        </div>
        {isPrincipal && <button className="exam-primary-btn" type="button" onClick={openForm}><Plus size={17} /> Schedule exam</button>}
      </header>

      {error && <div className="exam-alert error"><span>{error}</span><button onClick={() => setError('')}><X size={15} /></button></div>}
      {notice && <div className="exam-alert success"><Check size={15} /><span>{notice}</span><button onClick={() => setNotice('')}><X size={15} /></button></div>}

      <section className="exam-stats">
        <article><span>Upcoming</span><strong>{upcoming.length}</strong><small><Clock3 size={13} /> Scheduled ahead</small></article>
        <article><span>Today</span><strong>{today.length}</strong><small><CalendarDays size={13} /> Exams today</small></article>
        <article><span>Classes</span><strong>{classCount}</strong><small><Users size={13} /> In this view</small></article>
        <article><span>Academic year</span><strong>{year?.name || '—'}</strong><small><Check size={13} /> Live database</small></article>
      </section>

      <section className="exam-toolbar">
        <div className="exam-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subject, class or section..." /></div>
        {(isPrincipal || user?.role === 'teacher') && <div className="exam-filters"><select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSection('') }}><option value="">All classes</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select><select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}><option value="">All sections</option>{browseSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></div>}
      </section>

      <section className="exam-list-panel">
        <div className="exam-list-head"><div><span className="exam-eyebrow">LIVE REGISTER</span><h2>{isPrincipal ? 'School examination schedule' : 'Your examination schedule'}</h2></div><span>{visibleExams.length} exam{visibleExams.length === 1 ? '' : 's'}</span></div>
        {loading ? <div className="exam-loading"><Loader2 className="spin" size={20} /> Loading schedule...</div> : visibleExams.length ? <div className="exam-list">{visibleExams.map((exam) => <article className="exam-row" key={exam._id}>
          <div className="exam-date"><strong>{new Date(exam.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit' })}</strong><span>{new Date(exam.scheduledAt).toLocaleDateString('en-IN', { month: 'short' })}</span></div>
          <div className="exam-main"><div className="exam-subject">{exam.subjectName}</div><div className="exam-meta"><span>Class {exam.class?.name}</span><span>Section {exam.section?.name}</span><span>{formatDate(exam.scheduledAt)}</span></div></div>
          <div className="exam-time"><Clock3 size={15} /><strong>{formatTime(exam.scheduledAt)}</strong></div>
          {isPrincipal && <button className="exam-delete" type="button" onClick={() => removeExam(exam)} aria-label="Remove exam"><Trash2 size={16} /></button>}
        </article>)}</div> : <div className="exam-empty"><div><CalendarDays size={22} /></div><h3>No exams scheduled</h3><p>{isPrincipal ? 'Create the first exam using the Schedule exam button.' : 'No exam has been scheduled for the classes available to you yet.'}</p></div>}
      </section>

      {isPrincipal && showForm && <div className="exam-modal-backdrop"><div className="exam-modal"><div className="exam-modal-head"><div><span className="exam-eyebrow">NEW ASSESSMENT</span><h2>Schedule an exam</h2><p>Only four inputs are needed to publish the schedule.</p></div><button className="exam-close" onClick={() => setShowForm(false)}><X size={17} /></button></div><div className="exam-form"><label><span>Class</span><select value={form.classId} onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value, sectionId: '' }))}><option value="">Select class</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label><label><span>Section</span><select value={form.sectionId} onChange={(event) => setForm((current) => ({ ...current, sectionId: event.target.value }))}><option value="">Select section</option>{filteredSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></label><label><span>Subject name</span><input value={form.subjectName} onChange={(event) => setForm((current) => ({ ...current, subjectName: event.target.value }))} placeholder="e.g. Mathematics" /></label><label><span>Exam date & time</span><input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))} /></label></div><div className="exam-modal-foot"><button className="exam-secondary-btn" type="button" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button className="exam-primary-btn" type="button" onClick={createExam} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Check size={16} />} {saving ? 'Saving...' : 'Schedule exam'}</button></div></div></div>}
    </div>
  )
}

export default ExamSchedulePage
