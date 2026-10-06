import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Clock3, FileText, Loader2, Plus, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './ExamSchedulePage.css'

const idOf = (value) => value?._id || value
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const formatTime = (value) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'
const emptyExam = () => ({ subjectName: '', examDate: '', startTime: '', endTime: '' })

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
  const [form, setForm] = useState({ classId: '', sectionId: '', exams: [emptyExam()] })

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
      try { await loadSetup() } catch (err) { if (!cancelled) setError(err.response?.data?.message || 'Unable to load exam setup.') }
      finally { if (!cancelled) setLoading(false) }
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
    setForm({ classId: selectedClass || classes[0]?._id || '', sectionId: selectedSection || '', exams: [emptyExam()] })
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const updateExamRow = (index, key, value) => {
    setForm((current) => ({
      ...current,
      exams: current.exams.map((exam, rowIndex) => rowIndex === index ? { ...exam, [key]: value } : exam),
    }))
  }

  const addExamRow = () => {
    setForm((current) => ({ ...current, exams: [...current.exams, emptyExam()] }))
  }

  const removeExamRow = (index) => {
    setForm((current) => ({ ...current, exams: current.exams.filter((_, rowIndex) => rowIndex !== index) }))
  }

  const createExams = async () => {
    if (!year?._id || !form.classId || !form.sectionId) {
      setError('Class and section are required.')
      return
    }
    if (!form.exams.length) {
      setError('Add at least one exam.')
      return
    }

    const invalidIndex = form.exams.findIndex((exam) => !exam.subjectName.trim() || !exam.examDate || !exam.startTime || !exam.endTime)
    if (invalidIndex >= 0) {
      setError(`Complete all fields for Exam ${invalidIndex + 1}.`)
      return
    }

    const items = form.exams.map((exam) => ({
      subjectName: exam.subjectName.trim(),
      scheduledAt: `${exam.examDate}T${exam.startTime}`,
      endsAt: `${exam.examDate}T${exam.endTime}`,
    }))
    const invalidTime = items.findIndex((item) => new Date(item.endsAt) <= new Date(item.scheduledAt))
    if (invalidTime >= 0) {
      setError(`End time must be after start time for Exam ${invalidTime + 1}.`)
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await apiClient.post('/exams/bulk', {
        academicYear: year._id,
        classId: form.classId,
        sectionId: form.sectionId,
        items,
      })
      setNotice(response.data.message || `${items.length} exams scheduled successfully.`)
      setShowForm(false)
      await loadExams()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create exams.')
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
    } catch (err) { setError(err.response?.data?.message || 'Unable to remove exam.') }
  }

  return (
    <div className="exam-page">
      <header className="exam-hero">
        <div><span className="exam-eyebrow">ASSESSMENT · {year?.name || 'ACADEMIC YEAR'}</span><div className="exam-title-row"><div className="exam-icon"><FileText size={22} /></div><div><h1>Exam schedule</h1><p>{isPrincipal ? 'Create and publish the school exam schedule by class and section.' : user?.role === 'teacher' ? 'View the complete school exam schedule across all classes.' : user?.role === 'parent' ? 'View exam dates and times for your linked children.' : 'View the exam schedule for your class and section.'}</p></div></div></div>
        {isPrincipal && <button className="exam-primary-btn" type="button" onClick={openForm}><Plus size={17} /> Schedule exams</button>}
      </header>

      {error && <div className="exam-alert error"><span>{error}</span><button onClick={() => setError('')}><X size={15} /></button></div>}
      {notice && <div className="exam-alert success"><Check size={15} /><span>{notice}</span><button onClick={() => setNotice('')}><X size={15} /></button></div>}

      <section className="exam-stats"><article><span>Upcoming</span><strong>{upcoming.length}</strong><small><Clock3 size={13} /> Scheduled ahead</small></article><article><span>Today</span><strong>{today.length}</strong><small><CalendarDays size={13} /> Exams today</small></article><article><span>Classes</span><strong>{classCount}</strong><small><Users size={13} /> In this view</small></article><article><span>Academic year</span><strong>{year?.name || '—'}</strong><small><Check size={13} /> Live database</small></article></section>

      <section className="exam-toolbar"><div className="exam-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subject, class or section..." /></div>{(isPrincipal || user?.role === 'teacher') && <div className="exam-filters"><select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSection('') }}><option value="">All classes</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select><select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}><option value="">All sections</option>{browseSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></div>}</section>

      <section className="exam-list-panel"><div className="exam-list-head"><div><span className="exam-eyebrow">LIVE REGISTER</span><h2>{isPrincipal ? 'School examination schedule' : 'Your examination schedule'}</h2></div><span>{visibleExams.length} exam{visibleExams.length === 1 ? '' : 's'}</span></div>{loading ? <div className="exam-loading"><Loader2 className="spin" size={20} /> Loading schedule...</div> : visibleExams.length ? <div className="exam-list">{visibleExams.map((exam) => <article className="exam-row" key={exam._id}><div className="exam-date"><strong>{new Date(exam.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit' })}</strong><span>{new Date(exam.scheduledAt).toLocaleDateString('en-IN', { month: 'short' })}</span></div><div className="exam-main"><div className="exam-subject">{exam.subjectName}</div><div className="exam-meta"><span>Class {exam.class?.name}</span><span>Section {exam.section?.name}</span><span>{formatDate(exam.scheduledAt)}</span></div></div><div className="exam-time"><Clock3 size={15} /><strong>{formatTime(exam.scheduledAt)}{exam.endsAt ? ` – ${formatTime(exam.endsAt)}` : ''}</strong></div>{isPrincipal && <button className="exam-delete" type="button" onClick={() => removeExam(exam)} aria-label="Remove exam"><Trash2 size={16} /></button>}</article>)}</div> : <div className="exam-empty"><div><CalendarDays size={22} /></div><h3>No exams scheduled</h3><p>{isPrincipal ? 'Create the first exam using the Schedule exams button.' : 'No exam has been scheduled for the classes available to you yet.'}</p></div>}</section>

      {isPrincipal && showForm && <div className="exam-modal-backdrop"><div className="exam-modal exam-bulk-modal"><div className="exam-modal-head"><div><span className="exam-eyebrow">BULK ASSESSMENT SETUP</span><h2>Schedule class exams</h2><p>Select one class and section, then add all subjects with their individual dates and time windows.</p></div><button className="exam-close" onClick={() => setShowForm(false)}><X size={17} /></button></div>
        <div className="exam-form exam-bulk-form">
          <label><span>Class</span><select value={form.classId} onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value, sectionId: '' }))}><option value="">Select class</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
          <label><span>Section</span><select value={form.sectionId} onChange={(event) => setForm((current) => ({ ...current, sectionId: event.target.value }))}><option value="">Select section</option>{filteredSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></label>
          <div className="exam-bulk-header"><div><strong>Exam plan</strong><span>{form.exams.length} subject{form.exams.length === 1 ? '' : 's'} added</span></div><button type="button" className="exam-add-row-btn" onClick={addExamRow}><Plus size={15} /> Add exam</button></div>
          <div className="exam-bulk-table">
            <div className="exam-bulk-grid exam-bulk-grid-head"><span>#</span><span>Subject</span><span>Date</span><span>Start</span><span>End</span><span /></div>
            {form.exams.map((exam, index) => <div className="exam-bulk-grid" key={`exam-row-${index}`}><span className="exam-row-number">{index + 1}</span><input value={exam.subjectName} onChange={(event) => updateExamRow(index, 'subjectName', event.target.value)} placeholder="Mathematics" /><input type="date" value={exam.examDate} onChange={(event) => updateExamRow(index, 'examDate', event.target.value)} /><input type="time" value={exam.startTime} onChange={(event) => updateExamRow(index, 'startTime', event.target.value)} /><input type="time" min={exam.startTime || undefined} value={exam.endTime} onChange={(event) => updateExamRow(index, 'endTime', event.target.value)} /><button type="button" className="exam-row-remove" onClick={() => removeExamRow(index)} disabled={form.exams.length === 1} aria-label="Remove exam"><Trash2 size={15} /></button></div>)}
          </div>
        </div>
        <div className="exam-modal-foot"><button className="exam-secondary-btn" type="button" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button className="exam-primary-btn" type="button" onClick={createExams} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Check size={16} />} {saving ? 'Saving exams...' : `Schedule ${form.exams.length} exam${form.exams.length === 1 ? '' : 's'}`}</button></div>
      </div></div>}
    </div>
  )
}

export default ExamSchedulePage
