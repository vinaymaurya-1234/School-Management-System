import { useEffect, useMemo, useState } from 'react'
import { BellRing, CalendarDays, CheckCircle2, FileText, Loader2, MessageCircle, Search, Send, TrendingUp } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './TeacherWorkspacePage.css'

const views = {
  notices: ['SCHOOL COMMUNICATION', 'Notices & Announcements', 'School updates relevant to your teaching role.', BellRing],
  events: ['SCHOOL CALENDAR', 'Events & Calendar', 'Upcoming school events, holidays and meetings.', CalendarDays],
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
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [className, setClassName] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      if (mode === 'notices') {
        const r = await apiClient.get('/operations/notices')
        setRecords(r.data.records || [])
      } else if (mode === 'events') {
        const r = await apiClient.get('/events?year=' + new Date().getFullYear())
        setRecords(r.data.records || [])
      } else if (mode === 'communication') {
        const r = await apiClient.get('/operations/communication')
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
  useEffect(() => { load() }, [mode])

  const visible = useMemo(() => records.filter((r) => {
    const exam = r.exam || {}, data = r.data || {}
    const parts = (mode === 'review' || mode === 'performance')
      ? [exam.subjectName, exam.class?.name, exam.section?.name]
      : mode === 'events' ? [r.title, r.type, r.description, r.location] : [r.title, data.message, data.className, data.audience, data.description]
    const match = !query.trim() || parts.some((x) => String(x || '').toLowerCase().includes(query.trim().toLowerCase()))
    if (!match) return false
    if (mode === 'notices') {
      const audience = String(data.audience || 'Entire school').toLowerCase()
      return ['entire school', 'teachers', 'all', 'staff'].includes(audience) || !audience
    }
    return true
  }), [records, query, mode])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) { setError('Enter a subject and message.'); return }
    setSaving(true); setError(''); setMessage('')
    try {
      const r = await apiClient.post('/operations/communication', { title: title.trim(), data: { message: body.trim(), className: className.trim(), audience: 'Parents', senderName: user?.name || 'Teacher' } })
      setRecords((old) => [r.data.record, ...old]); setTitle(''); setBody(''); setClassName(''); setFormOpen(false)
      setMessage('Message saved to the school communication register.')
    } catch (e) { setError(e.response?.data?.message || 'Message could not be saved. Please try again.') }
    finally { setSaving(false) }
  }

  const sum = (key) => records.reduce((n, r) => n + (r.summary?.[key] || 0), 0)
  return <main className="teacher-workspace">
    <header className="teacher-workspace-hero"><div><span className="teacher-workspace-eyebrow">{meta[0]}</span><div className="teacher-workspace-title"><span className="teacher-workspace-title-icon"><Icon size={23} /></span><div><h1>{meta[1]}</h1><p>{meta[2]}</p></div></div></div>
      {mode === 'communication' && <button className="teacher-workspace-primary" onClick={() => setFormOpen(!formOpen)}><Send size={16} /> New message</button>}
    </header>
    {error && <div className="teacher-workspace-alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    {message && <div className="teacher-workspace-alert success"><CheckCircle2 size={16} />{message}<button onClick={() => setMessage('')}>Dismiss</button></div>}
    {(mode === 'review' || mode === 'performance') && <section className="teacher-workspace-stats">
      <article><span>Exams in scope</span><strong>{loading ? '—' : records.length}</strong></article>
      <article><span>Marks submitted</span><strong>{loading ? '—' : sum('submitted')}</strong></article>
      <article><span>Marks entered</span><strong>{loading ? '—' : sum('entered')}</strong></article>
      <article><span>Marks published</span><strong>{loading ? '—' : sum('published')}</strong></article>
    </section>}
    {mode === 'communication' && formOpen && <form className="teacher-message-form" onSubmit={sendMessage}>
      <h2>Write to parents</h2>
      <label>Subject<input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="e.g. English homework update" /></label>
      <label>Class / section<input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Class 10 · A" /></label>
      <label>Message<textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} maxLength={4000} placeholder="Write the information parents need to know…" /></label>
      <button className="teacher-workspace-primary" disabled={saving}>{saving ? 'Saving…' : 'Save message'}</button>
    </form>}
    <section className="teacher-workspace-toolbar"><label><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, class or subject…" /></label><span>{loading ? 'Loading…' : visible.length + ' records'}</span></section>
    {loading ? <section className="teacher-workspace-empty"><Loader2 size={23} /><strong>Loading {meta[1].toLowerCase()}…</strong></section> : !visible.length ? <section className="teacher-workspace-empty"><span className="teacher-workspace-title-icon"><Icon size={22} /></span><strong>{error ? 'Records could not be loaded' : mode === 'review' ? 'No marks submitted for review yet' : mode === 'performance' ? 'No student performance data yet' : mode === 'events' ? 'No school events available' : mode === 'communication' ? 'No parent messages yet' : 'No notices available'}</strong><p>{mode === 'communication' ? 'Create a message to begin the recorded communication history.' : 'Only saved school records are shown here. No demo records are fabricated.'}</p>{error && <button className="teacher-workspace-secondary" onClick={load}>Retry</button>}</section> :
      <section className="teacher-workspace-list-panel"><div className="teacher-workspace-list-heading"><div><span className="teacher-workspace-eyebrow">{meta[0]}</span><h2>{mode === 'review' ? 'Marks workflow' : mode === 'performance' ? 'Exam performance registers' : mode === 'communication' ? 'Parent communication history' : mode === 'events' ? 'School events' : 'Published notices for teachers'}</h2></div><span>{visible.length} records</span></div>
        {visible.map((r, i) => {
          if (mode === 'review' || mode === 'performance') {
            const ex = r.exam || {}, s = r.summary || {}
            const status = s.published === s.total && s.total ? 'Published' : s.approved ? 'Approved' : s.submitted ? 'Submitted for review' : s.entered ? 'Draft marks saved' : 'Marks not entered'
            return <article className="teacher-workspace-record" key={ex._id || i}><span className="teacher-workspace-record-icon"><FileText size={18} /></span><div className="teacher-workspace-record-copy"><strong>{ex.subjectName || 'Exam'} · Class {ex.class?.name || '—'} · Section {ex.section?.name || '—'}</strong><span>{dateLabel(ex.scheduledAt)} · Maximum marks {ex.maxMarks ?? 'Not set'}</span><small>{s.entered || 0} / {s.total || 0} entered · {s.submitted || 0} submitted · {s.published || 0} published</small></div><span className="teacher-workspace-status">{status}</span></article>
          }
          if (mode === 'events') return <article className="teacher-workspace-record" key={r._id || i}><span className="teacher-workspace-record-icon"><CalendarDays size={18} /></span><div className="teacher-workspace-record-copy"><strong>{r.title || r.name || 'School event'}</strong><span>{dateLabel(r.date)} · {r.type || 'School event'}{r.location ? ' · ' + r.location : ''}</span><small>{r.description || r.audience || 'School calendar entry'}</small></div><span className="teacher-workspace-status">{r.audience || 'School calendar'}</span></article>
          const d = r.data || {}
          return <article className="teacher-workspace-record" key={r._id || i}><span className="teacher-workspace-record-icon">{mode === 'communication' ? <MessageCircle size={18} /> : <BellRing size={18} />}</span><div className="teacher-workspace-record-copy"><strong>{r.title || 'School update'}</strong><span>{d.className ? d.className + ' · ' : ''}{d.audience || 'School'} · {dateLabel(r.createdAt)}</span><small>{d.message || d.description || 'No message text was added.'}</small></div><span className="teacher-workspace-status">{mode === 'communication' ? 'Recorded' : 'Published'}</span></article>
        })}
      </section>}
  </main>
}
