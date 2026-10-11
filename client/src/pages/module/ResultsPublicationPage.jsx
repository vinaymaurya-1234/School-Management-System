import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ClipboardCheck, Eye, Loader2, Search } from 'lucide-react'
import apiClient from '../../api/client'
import PrincipalMarksReview from './PrincipalMarksReview'
import './ResultsPublicationPage.css'

const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function progressLabel(summary, scheduledAt) {
  if (!summary || !summary.total) return new Date(scheduledAt) < new Date() ? 'Marks pending' : 'Scheduled'
  if (summary.published === summary.total) return 'Published'
  if (summary.approved + summary.published === summary.total) return 'Ready to publish'
  if (summary.submitted + summary.approved + summary.published === summary.total && summary.submitted > 0) return 'Pending review'
  if (summary.entered > 0) return 'Marks in progress'
  return 'Marks pending'
}
const statusClass = (status) => status.toLowerCase().replaceAll(' ', '-')

function ResultsPublicationPage() {
  const [exams, setExams] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [activeExam, setActiveExam] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await apiClient.get('/exams')
        const records = response.data.exams || []
        const summaries = await Promise.all(records.map(async (exam) => {
          try {
            const result = await apiClient.get(`/exams/${exam._id}/marks`)
            return [exam._id, result.data.summary || { total: 0, entered: 0, submitted: 0, approved: 0, published: 0 }]
          } catch {
            return [exam._id, null]
          }
        }))
        if (active) {
          setExams(records)
          setProgress(Object.fromEntries(summaries))
        }
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Unable to load exam results workflow.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [refreshKey])

  const rows = useMemo(() => {
    const value = query.trim().toLowerCase()
    return exams.map((exam) => {
      const summary = progress[exam._id]
      return { ...exam, summary, status: progressLabel(summary, exam.scheduledAt) }
    }).filter((exam) => {
      const matchesQuery = !value || [exam.subjectName, exam.class?.name, exam.section?.name].some((item) => String(item || '').toLowerCase().includes(value))
      const matchesFilter = filter === 'all' || (filter === 'review' && exam.status === 'Pending review') || (filter === 'publish' && exam.status === 'Ready to publish') || (filter === 'published' && exam.status === 'Published')
      return matchesQuery && matchesFilter
    }).sort((a, b) => {
      const order = { 'Pending review': 0, 'Ready to publish': 1, 'Marks in progress': 2, 'Marks pending': 3, Scheduled: 4, Published: 5 }
      return (order[a.status] ?? 6) - (order[b.status] ?? 6) || new Date(b.scheduledAt) - new Date(a.scheduledAt)
    })
  }, [exams, progress, query, filter])

  const counts = useMemo(() => ({
    review: exams.filter((exam) => progressLabel(progress[exam._id], exam.scheduledAt) === 'Pending review').length,
    publish: exams.filter((exam) => progressLabel(progress[exam._id], exam.scheduledAt) === 'Ready to publish').length,
    published: exams.filter((exam) => progressLabel(progress[exam._id], exam.scheduledAt) === 'Published').length,
  }), [exams, progress])

  return (
    <main className="results-pub-page">
      <header className="results-pub-hero">
        <div className="results-pub-title">
          <span className="results-pub-eyebrow">ASSESSMENT WORKSPACE</span>
          <div className="results-pub-title-line"><span className="results-pub-icon"><BarChart3 size={23} /></span><div><h1>Results &amp; Publication</h1><p>Review teacher submissions, approve marks and publish verified results.</p></div></div>
        </div>
      </header>

      {error && <div className="results-pub-alert" role="alert">{error}</div>}

      <section className="results-pub-stats">
        <article><span>Pending review</span><strong>{loading ? '—' : counts.review}</strong><small>Submitted by teachers</small></article>
        <article><span>Ready to publish</span><strong>{loading ? '—' : counts.publish}</strong><small>Approved by principal</small></article>
        <article><span>Published results</span><strong>{loading ? '—' : counts.published}</strong><small>Visible to students and parents</small></article>
      </section>

      <section className="results-pub-register">
        <div className="results-pub-register-head"><div><span className="results-pub-eyebrow">RESULTS REGISTER</span><h2>Exam result workflow</h2><p>Published exams remain in the schedule; this page manages review and result access.</p></div><label className="results-pub-search"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subject, class or section..." /></label></div>
        <div className="results-pub-tabs" role="group" aria-label="Filter results">
          {[['all','All exams'],['review','Pending review'],['publish','Ready to publish'],['published','Published']].map(([key,label]) => <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}
          <span>{rows.length} record{rows.length === 1 ? '' : 's'}</span>
        </div>
        {loading ? <div className="results-pub-empty"><Loader2 className="results-pub-spin" size={21}/> Loading results workflow…</div> : rows.length ? <div className="results-pub-list">{rows.map((exam) => {
          const summary = exam.summary || { total: 0, entered: 0, submitted: 0, approved: 0, published: 0 }
          const locked = exam.status === 'Published'
          const actionLabel = locked ? 'View results' : exam.status === 'Scheduled' || exam.status === 'Marks pending' ? 'View marks' : 'Review marks'
          return <article className="results-pub-row" key={exam._id}>
            <div className="results-pub-date"><strong>{new Date(exam.scheduledAt).toLocaleDateString('en-IN',{day:'2-digit'})}</strong><span>{new Date(exam.scheduledAt).toLocaleDateString('en-IN',{month:'short'})}</span></div>
            <div className="results-pub-main"><strong>{exam.subjectName}</strong><div className="results-pub-meta"><span>Class {exam.class?.name || '—'} · Section {exam.section?.name || '—'}</span><span>{dateLabel(exam.scheduledAt)}</span></div><div className="results-pub-progress"><span>{summary.entered || 0}/{summary.total || 0} marks entered</span><span>{summary.submitted || 0} submitted · {summary.approved || 0} approved</span></div></div>
            <span className={`results-pub-status ${statusClass(exam.status)}`}>{exam.status}</span>
            <button className="results-pub-action" type="button" onClick={() => setActiveExam(exam)}><Eye size={15}/>{actionLabel}</button>
          </article>
        })}</div> : <div className="results-pub-empty"><span className="results-pub-empty-icon"><ClipboardCheck size={23}/></span><h3>{filter === 'all' ? 'No exams found' : 'Nothing in this stage yet'}</h3><p>{filter === 'all' ? 'Scheduled exams will appear here when they are created.' : 'Exams will move here automatically as teachers submit marks and the principal reviews them.'}</p></div>}
      </section>
      {activeExam && <PrincipalMarksReview exam={activeExam} onClose={() => { setActiveExam(null); setRefreshKey((key) => key + 1) }} />}
    </main>
  )
}

export default ResultsPublicationPage
