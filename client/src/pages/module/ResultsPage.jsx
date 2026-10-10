import { useEffect, useMemo, useState } from 'react'
import { Award, BookOpenCheck, CheckCircle2, Loader2, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'
import './ResultsPage.css'

const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function ResultsPage() {
  const { user } = useAuth()
  const isParent = user?.role === 'parent'
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    apiClient.get('/exams/results')
      .then(({ data }) => { if (active) setResults(data.results || []) })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Unable to load published results.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const visibleResults = useMemo(() => {
    const value = query.trim().toLowerCase()
    return results.filter((result) => !value || [result.studentName, result.subjectName, result.className, result.sectionName].some((field) => String(field || '').toLowerCase().includes(value)))
  }, [results, query])
  const average = visibleResults.length ? visibleResults.reduce((sum, result) => sum + (Number(result.marksObtained) / Math.max(Number(result.maxMarks), 1)) * 100, 0) / visibleResults.length : 0
  const students = [...new Map(visibleResults.map((result) => [result.studentId, { id: result.studentId, name: result.studentName, admissionNumber: result.admissionNumber }])).values()]

  return (
    <main className="results-page">
      <header className="results-page-head">
        <div className="results-title-icon"><Award size={23} /></div>
        <div className="results-title-copy"><span className="results-eyebrow">ACADEMIC PERFORMANCE</span><h1>{isParent ? "Your children's results" : 'My results'}</h1><p>Only results published by the principal are shown here.</p></div>
      </header>

      <section className="results-summary">
        <article><span>Published subjects</span><strong>{loading ? '—' : visibleResults.length}</strong><small>Published marks only</small></article>
        <article><span>Average percentage</span><strong>{loading || !visibleResults.length ? '—' : `${average.toFixed(1)}%`}</strong><small>Across visible published subjects</small></article>
        {isParent && <article><span>Children with results</span><strong>{loading ? '—' : students.length}</strong><small>Linked children</small></article>}
      </section>

      <section className="results-register">
        <div className="results-register-head"><div><span className="results-eyebrow">PUBLISHED REPORT</span><h2>Exam results</h2><p>Draft, submitted and unapproved marks are never displayed here.</p></div><label className="results-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isParent ? 'Search child or subject…' : 'Search subject…'} /></label></div>
        {error && <div className="results-alert" role="alert">{error}</div>}
        {loading ? <div className="results-empty"><Loader2 size={20} className="results-spin" /> Loading published results…</div> : visibleResults.length ? (
          <div className="results-table-wrap"><table className="results-table"><thead><tr>{isParent && <th>Student</th>}<th>Subject</th><th>Class</th><th>Exam date</th><th>Marks</th><th>Percentage</th><th>Status</th></tr></thead><tbody>{visibleResults.map((result) => {
            const percentage = Number(result.marksObtained) / Math.max(Number(result.maxMarks), 1) * 100
            return <tr key={result.id}>{isParent && <td><strong>{result.studentName}</strong><small>{result.admissionNumber || ''}</small></td>}<td><strong>{result.subjectName}</strong></td><td>{result.className}{result.sectionName ? ` · ${result.sectionName}` : ''}</td><td>{dateLabel(result.examDate)}</td><td><strong>{result.marksObtained} / {result.maxMarks}</strong>{result.remarks && <small>{result.remarks}</small>}</td><td><strong>{percentage.toFixed(1)}%</strong></td><td><span className="results-published-pill"><CheckCircle2 size={13} /> Published</span></td></tr>
          })}</tbody></table></div>
        ) : <div className="results-empty"><div className="results-empty-icon"><BookOpenCheck size={23} /></div><h3>{query ? 'No matching published results' : 'No results published yet'}</h3><p>{query ? 'Try another student or subject name.' : 'When the teacher submits marks and the principal approves and publishes the result, it will appear here.'}</p></div>}
      </section>
    </main>
  )
}

export default ResultsPage
