import { useEffect, useMemo, useState } from 'react'
import { BellRing, CalendarDays, CheckCircle2, FileText, Loader2, MessageCircle, Search, Send, TrendingUp } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './TeacherWorkspacePage.css'

const views = {
  'notice-admin': ['SCHOOL COMMUNICATION', 'Notices & Announcements', 'Create and publish school announcements for teachers and families.', BellRing],
  notices: ['SCHOOL COMMUNICATION', 'Notices & Announcements', 'School updates relevant to your teaching role.', BellRing],
  events: ['SCHOOL CALENDAR', 'Events & Calendar', 'Upcoming school events, holidays and meetings.', CalendarDays],
  homework: ['CLASSWORK & HOMEWORK', 'Homework & Assignments', 'Create classwork and keep a record of tasks shared with students.', FileText],
  communication: ['FAMILY CONNECTION', 'Parent Communication', 'Share class-related updates with parents.', MessageCircle],
  review: ['ASSESSMENT WORKFLOW', 'Marks Review Status', 'Track submitted marks and result publishing.', CheckCircle2],
  performance: ['LEARNING INSIGHTS', 'Student Performance', 'Review student marks for scheduled exams.', TrendingUp],
}
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date not set'

export default function TeacherWorkspacePage({ mode }) {
  const { user } = useAuth()
  const meta = views[mode] || views.notices
  const Icon = meta[3]
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('All')
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [className, setClassName] = useState('')
  const [audienceKey, setAudienceKey] = useState('all')
  const noticeCategories = ['General Notice', 'Holiday', 'Examination', 'Event', 'Meeting', 'Fee Update', 'Urgent Notice']
  const [classOptions, setClassOptions] = useState([])
  const [classId, setClassId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const selectedClass = classOptions.find((item) => item.classId === classId)
  const availableSections = selectedClass?.sections || []

  const load = async () => {
    setLoading(true); setError('')
    try {
      if (mode === 'notices' || mode === 'notice-admin') {
        const r = await apiClient.get('/operations/notices')
        setRecords(r.data.records || [])
      } else if (mode === 'events') {
        const r = await apiClient.get('/events?year=' + new Date().getFullYear())
        setRecords(r.data.records || [])
      } else if (mode === 'communication' || mode === 'homework') {
        const r = await apiClient.get('/operations/' + (mode === 'homework' ? 'assignments' : mode === 'notice-admin' ? 'notices' : mode))
        setRecords(r.data.records || [])
      } else {
        const r = await apiClient.get('/exams')
        const detail = await Promise.all((r.data.exams || []).map(async (exam) => {
          try { const m = await apiClient.get('/exams/' + exam._id + '/marks'); return { exam, ...m.data } } catch { return null }
        }))
        setRecords(detail.filter(Boolean))
      }
    } catch (e) { setError(e.response?.data?.message || 'Could not load records. Check your connection and retry.'); setRecords([]) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let cancelled = false
    async function loadAssignedSections() {
      if (mode !== 'homework') return
      try {
        const yearsResponse = await apiClient.get('/academic/years')
        const years = yearsResponse.data.years || []
        const year = years.find((item) => item.isActive) || years[0]
        if (!year) return
        const response = await apiClient.get('/academic/teacher-assignments', { params: { academicYear: year._id } })
        const grouped = new Map()
        ;(response.data.assignments || []).forEach((assignment) => {
          const cls = assignment.class, section = assignment.section
          if (!cls?._id || !section?._id) return
          if (!grouped.has(cls._id)) grouped.set(cls._id, { classId: cls._id, className: cls.name, sections: [] })
          const item = grouped.get(cls._id)
          if (!item.sections.some((entry) => entry.sectionId === section._id)) item.sections.push({ sectionId: section._id, sectionName: section.name })
        })
        if (!cancelled) setClassOptions([...grouped.values()])
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Could not load your assigned classes and sections.')
      }
    }
    load()
    loadAssignedSections()
    return () => { cancelled = true }
  }, [mode])

  const visible = useMemo(() => records.filter((r) => {
    const exam = r.exam || {}, data = r.data || {}
    const parts = (mode === 'review' || mode === 'performance')
      ? [exam.subjectName, exam.class?.name, exam.section?.name]
      : mode === 'events' ? [r.title, r.type, r.description, r.location] : [r.title, data.message, data.className, data.sectionName, data.audience, data.description]
    const match = !query.trim() || parts.some((x) => String(x || '').toLowerCase().includes(query.trim().toLowerCase()))
    if (!match) return false
    if (mode === 'events' && eventTypeFilter !== 'All' && (r.type || 'School Event') !== eventTypeFilter) return false
    return true
  }), [records, query, mode, eventTypeFilter])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) { setError('Enter a subject and assignment instructions.'); return }
    if (mode === 'homework' && (!classId || !sectionId)) { setError('Choose a class and section assigned to you.'); return }
    setSaving(true); setError(''); setMessage('')
    try {
      const selectedSection = availableSections.find((item) => item.sectionId === sectionId)
      const yearsResponse = mode === 'homework' ? await apiClient.get('/academic/years') : null
      const year = yearsResponse ? (yearsResponse.data.years || []).find((item) => item.isActive) || yearsResponse.data.years?.[0] : null
      const isNotice = mode === 'notice-admin'
      const r = await apiClient.post('/operations/' + (mode === 'homework' ? 'assignments' : isNotice ? 'notices' : mode), { title: title.trim(), academicYear: year?._id, data: mode === 'homework' ? { message: body.trim(), classId, sectionId, className: selectedClass?.className || '', sectionName: selectedSection?.sectionName || '', subject: title.trim(), dueDate: dueDate || null, audience: 'Students', senderName: user?.name || 'Teacher' } : isNotice ? { message: body.trim(), category: title.trim(), audienceKey, senderName: user?.name || user?.fullName || 'Principal' } : { message: body.trim(), audience: 'Parents', senderName: user?.name || 'Teacher' } })
      setRecords((old) => [r.data.record, ...old]); setTitle(''); setBody(''); setClassName(''); setClassId(''); setSectionId(''); setDueDate(''); setAudienceKey('all'); setFormOpen(false)
      setMessage(mode === 'homework' ? 'Assignment saved to the classwork register.' : mode === 'notice-admin' ? 'Notice published to ' + ({ teachers: 'teachers', students: 'students', parents: 'parents', all: 'everyone' }[audienceKey]) + '.' : 'Message saved to the school communication register.')
    } catch (e) { setError(e.response?.data?.message || 'Message could not be saved. Please try again.') }
    finally { setSaving(false) }
  }

  const sum = (key) => records.reduce((n, r) => n + (r.summary?.[key] || 0), 0)
  return <main className="teacher-workspace">
    <header className="teacher-workspace-hero"><div><span className="teacher-workspace-eyebrow">{meta[0]}</span><div className="teacher-workspace-title"><span className="teacher-workspace-title-icon"><Icon size={23} /></span><div><h1>{meta[1]}</h1><p>{meta[2]}</p></div></div></div>
      {(mode === 'communication' || mode === 'homework' || mode === 'notice-admin') && <button className="teacher-workspace-primary" onClick={() => setFormOpen(!formOpen)}><Send size={16} /> {mode === 'homework' ? 'New assignment' : mode === 'notice-admin' ? 'Create notice' : 'New message'}</button>}
    </header>
    {error && <div className="teacher-workspace-alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    {message && <div className="teacher-workspace-alert success"><CheckCircle2 size={16} />{message}<button onClick={() => setMessage('')}>Dismiss</button></div>}
    {(mode === 'review' || mode === 'performance') && <section className="teacher-workspace-stats">
      <article><span>Exams in scope</span><strong>{loading ? '—' : records.length}</strong></article>
      <article><span>Marks submitted</span><strong>{loading ? '—' : sum('submitted')}</strong></article>
      <article><span>Marks entered</span><strong>{loading ? '—' : sum('entered')}</strong></article>
      <article><span>Marks published</span><strong>{loading ? '—' : sum('published')}</strong></article>
    </section>}
    {(mode === 'communication' || mode === 'homework' || mode === 'notice-admin') && formOpen && <form className="teacher-message-form" onSubmit={sendMessage}>
      <h2>{mode === 'homework' ? 'Create homework' : mode === 'notice-admin' ? 'Publish school notice' : 'Write to parents'}</h2>
      {mode === 'notice-admin' ? <label>Notice subject<select value={title} onChange={(e) => setTitle(e.target.value)} required><option value="">Choose notice subject</option>{noticeCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label> : <label>Subject<input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder={mode === 'homework' ? 'e.g. English chapter 4 questions' : 'e.g. English homework update'} /></label>}
      {mode === 'homework' && <>
        <label>Class<select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId('') }} required><option value="">Select your class</option>{classOptions.map((item) => <option value={item.classId} key={item.classId}>Class {item.className}</option>)}</select></label>
        <label>Section<select value={sectionId} onChange={(e) => setSectionId(e.target.value)} required disabled={!classId}><option value="">Select section</option>{availableSections.map((item) => <option value={item.sectionId} key={item.sectionId}>{item.sectionName}</option>)}</select></label>
        <label>Due date (optional)<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} /></label>
      </>}
      {mode === 'notice-admin' ? <label>Send notice to<select value={audienceKey} onChange={(e) => setAudienceKey(e.target.value)} required><option value="teachers">Teachers only</option><option value="students">Students only</option><option value="parents">Parents only</option><option value="all">Everyone (all roles)</option></select><span className="teacher-notice-audience-help">Only the selected audience will see this notice.</span></label> : mode !== 'homework' && <label>Class / section<input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Class 10 · A" /></label>}
      <label>{mode === 'homework' ? 'Instructions' : 'Message'}<textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} maxLength={4000} placeholder={mode === 'homework' ? 'Describe the homework or assignment…' : mode === 'notice-admin' ? 'Enter the notice details…' : 'Write the information parents need to know…'} /></label>
      <button className="teacher-workspace-primary" disabled={saving}>{saving ? 'Saving…' : mode === 'homework' ? 'Save assignment' : mode === 'notice-admin' ? 'Publish notice' : 'Save message'}</button>
    </form>}
    {mode === 'events' && <>
      <section className="teacher-event-summary">
        <article><span>Upcoming events</span><strong>{loading ? '—' : records.filter((r) => !r.isSystemHoliday && r.date && r.date >= new Date().toISOString().slice(0, 10)).length}</strong><small>School activities and meetings</small></article>
        <article><span>Holidays</span><strong>{loading ? '—' : records.filter((r) => r.type === 'Holiday').length}</strong><small>National and festival holidays</small></article>
        <article><span>Academic activities</span><strong>{loading ? '—' : records.filter((r) => ['PTM', 'Exam', 'Meeting', 'Activity'].includes(r.type)).length}</strong><small>Learning and school events</small></article>
      </section>
      <nav className="teacher-event-filters" aria-label="Filter calendar entries">
        {['All', 'School Event', 'Holiday', 'PTM', 'Exam', 'Meeting', 'Activity'].map((type) => <button type="button" key={type} className={eventTypeFilter === type ? 'active' : ''} onClick={() => setEventTypeFilter(type)}>{type === 'All' ? 'All dates' : type === 'PTM' ? 'Parent meetings' : type === 'Activity' ? 'Activities' : type}</button>)}
      </nav>
    </>}
    <section className="teacher-workspace-toolbar"><label><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, class or subject…" /></label><span>{loading ? 'Loading…' : visible.length + ' records'}</span></section>
    {loading ? <section className="teacher-workspace-empty"><Loader2 size={23} /><strong>Loading {meta[1].toLowerCase()}…</strong></section> : !visible.length ? <section className="teacher-workspace-empty"><span className="teacher-workspace-title-icon"><Icon size={22} /></span><strong>{error ? 'Records could not be loaded' : mode === 'review' ? 'No marks submitted for review yet' : mode === 'performance' ? 'No student performance data yet' : mode === 'events' ? 'No school events available' : mode === 'communication' ? 'No parent messages yet' : mode === 'homework' ? 'No assignments recorded yet' : mode === 'homework' ? 'No assignments recorded yet' : 'No notices available'}</strong><p>{mode === 'communication' ? 'Create a message to begin the recorded communication history.' : mode === 'homework' ? 'Create an assignment to save it in the classwork register.' : 'Only saved school records are shown here. No demo records are fabricated.'}</p>{error && <button className="teacher-workspace-secondary" onClick={load}>Retry</button>}</section> :
      <section className="teacher-workspace-list-panel"><div className="teacher-workspace-list-heading"><div><span className="teacher-workspace-eyebrow">{meta[0]}</span><h2>{mode === 'review' ? 'Marks workflow' : mode === 'performance' ? 'Exam performance registers' : mode === 'communication' ? 'Parent communication history' : mode === 'homework' ? 'Classwork register' : mode === 'homework' ? 'Classwork register' : mode === 'events' ? 'School events' : mode === 'notice-admin' ? 'Notice history' : 'Published notices for you'}</h2></div><span>{visible.length} records</span></div>
        {visible.map((r, i) => {
          if (mode === 'review' || mode === 'performance') {
            const ex = r.exam || {}, s = r.summary || {}
            const status = s.published === s.total && s.total ? 'Published' : s.approved ? 'Approved' : s.submitted ? 'Submitted for review' : s.entered ? 'Draft marks saved' : 'Marks not entered'
            return <article className={'teacher-workspace-record ' + (mode === 'performance' ? 'has-performance' : '')} key={ex._id || i}><span className="teacher-workspace-record-icon"><FileText size={18} /></span><div className="teacher-workspace-record-copy"><strong>{ex.subjectName || 'Exam'} · Class {ex.class?.name || '—'} · Section {ex.section?.name || '—'}</strong><span>{dateLabel(ex.scheduledAt)} · Maximum marks {ex.maxMarks ?? 'Not set'}</span><small>{s.entered || 0} / {s.total || 0} entered · {s.submitted || 0} submitted · {s.published || 0} published</small></div><span className="teacher-workspace-status">{status}</span>{mode === 'performance' && <div className="teacher-performance-students"><div className="teacher-performance-heading"><strong>Student marks</strong><span>Only published marks are treated as final results</span></div>{(r.students || []).map((student) => { const hasMark = student.marksObtained !== '' && student.marksObtained !== null && student.marksObtained !== undefined; const finalMark = student.status === 'published'; const score = hasMark && ex.maxMarks ? Math.round((Number(student.marksObtained) / Number(ex.maxMarks)) * 100) : null; return <div className="teacher-performance-student" key={student.studentId}><span className="teacher-performance-avatar">{String(student.name || 'S').charAt(0).toUpperCase()}</span><span className="teacher-performance-name"><strong>{student.name || 'Student'}</strong><small>{student.admissionNumber || 'Student record'}</small></span><span className="teacher-performance-score">{finalMark && hasMark ? Number(student.marksObtained) + ' / ' + ex.maxMarks : hasMark ? 'Saved · not final' : 'Not entered'}</span><span className="teacher-workspace-status">{finalMark && hasMark ? score + '%' : student.status || 'Not entered'}</span></div> })}</div>}</article>
          }
          if (mode === 'events') return <article className={'teacher-workspace-record teacher-event-record ' + ((r.type || '') === 'Holiday' ? 'is-holiday' : 'is-event')} key={r._id || i}><span className="teacher-workspace-record-icon"><CalendarDays size={18} /></span><div className="teacher-workspace-record-copy"><strong>{r.title || r.name || 'School event'}</strong><span>{dateLabel(r.date)} · {r.type || 'School Event'}{r.startTime ? ' · ' + r.startTime + (r.endTime ? '–' + r.endTime : '') : ''}{r.location ? ' · ' + r.location : ''}</span><small>{r.description || (r.type === 'Holiday' ? 'School holiday' : 'School calendar entry')}</small></div><span className={'teacher-event-type-badge ' + ((r.type || '') === 'Holiday' ? 'holiday' : 'event')}>{r.type || 'School Event'}</span></article>
          const d = r.data || {}
          return <article className="teacher-workspace-record" key={r._id || i}><span className="teacher-workspace-record-icon">{mode === 'communication' ? <MessageCircle size={18} /> : <BellRing size={18} />}</span><div className="teacher-workspace-record-copy"><strong>{r.title || 'School update'}</strong><span>{d.className ? d.className + ' · ' : ''}{d.audience || 'School'}{d.category && d.category !== r.title ? ' · ' + d.category : ''}{mode === 'notice-admin' && r.createdBy?.name ? ' · By ' + r.createdBy.name : ''} · {dateLabel(r.createdAt)}</span><small>{d.message || d.description || 'No message text was added.'}</small></div><span className="teacher-workspace-status">{mode === 'communication' ? 'Recorded' : mode === 'homework' ? 'Assigned' : 'Published'}</span></article>
        })}
      </section>}
  </main>
}
