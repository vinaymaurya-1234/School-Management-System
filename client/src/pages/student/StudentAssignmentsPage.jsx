import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, FileText, Loader2, Search } from 'lucide-react'
import apiClient from '../../api/client'
import './StudentAssignmentsPage.css'

const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date'

export default function StudentAssignmentsPage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await apiClient.get('/operations/assignments')
        if (!cancelled) setRecords(response.data.records || [])
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Unable to load your homework. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const visible = records.filter((record) => {
    const data = record.data || {}
    const text = [record.title, data.subject, data.message, data.className, data.sectionName, data.teacherName].join(' ').toLowerCase()
    return text.includes(query.trim().toLowerCase())
  })

  return <main className="student-assignments">
    <header className="student-assignments-heading">
      <div>
        <span className="student-assignments-eyebrow">MY LEARNING</span>
        <div className="student-assignments-title"><span className="student-assignments-icon"><BookOpen size={23} /></span><div><h1>Homework & Assignments</h1><p>View the classwork your teacher has assigned to your section.</p></div></div>
      </div>
      <div className="student-assignment-count"><strong>{loading ? '—' : visible.length}</strong><span>{visible.length === 1 ? 'assignment' : 'assignments'}</span></div>
    </header>

    {error && <div className="student-assignments-error">{error}<button onClick={() => window.location.reload()}>Retry</button></div>}

    <div className="student-assignments-toolbar"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search homework or subject…" /></label><span>{loading ? 'Loading assignments…' : visible.length + ' shown'}</span></div>

    {loading ? <section className="student-assignments-state"><Loader2 className="student-assignment-spinner" size={24} /><strong>Loading your assignments</strong></section>
      : visible.length === 0 ? <section className="student-assignments-state"><span className="student-assignments-icon"><FileText size={22} /></span><strong>{query ? 'No matching assignments' : 'No homework assigned yet'}</strong><p>{query ? 'Try a different search term.' : 'When your teacher assigns homework to your class and section, it will appear here.'}</p></section>
      : <section className="student-assignment-list">
        <div className="student-assignment-list-heading"><div><span className="student-assignments-eyebrow">CLASSWORK REGISTER</span><h2>Your assigned work</h2></div><span>{visible.length} {visible.length === 1 ? 'record' : 'records'}</span></div>
        {visible.map((record) => {
          const data = record.data || {}
          return <article className="student-assignment-card" key={record._id}>
            <span className="student-assignment-file"><FileText size={20} /></span>
            <div className="student-assignment-copy"><h3>{record.title}</h3><p>{data.message || 'No instructions provided.'}</p><div className="student-assignment-meta"><span><BookOpen size={14} />{data.className ? 'Class ' + data.className : 'My class'}{data.sectionName ? ' · Section ' + data.sectionName : ''}</span>{data.teacherName && <span>By {data.teacherName}</span>}</div></div>
            <div className="student-assignment-due"><span><CalendarDays size={14} /> DUE DATE</span><strong>{dateLabel(data.dueDate)}</strong></div>
          </article>
        })}
      </section>}
  </main>
}
