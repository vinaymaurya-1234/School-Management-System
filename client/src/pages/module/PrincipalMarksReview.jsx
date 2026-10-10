import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Loader2, Send, X } from 'lucide-react'
import apiClient from '../../api/client'
import './PrincipalMarksReview.css'

function PrincipalMarksReview({ exam, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    const response = await apiClient.get(`/exams/${exam._id}/marks`)
    setData(response.data)
  }

  useEffect(() => {
    let active = true
    apiClient.get(`/exams/${exam._id}/marks`)
      .then(({ data: result }) => { if (active) setData(result) })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Could not load marks for review.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [exam._id])

  const review = async (action) => {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const response = await apiClient.put(`/exams/${exam._id}/marks/review`, { action })
      setNotice(response.data.message)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update marks review status.')
    } finally { setWorking(false) }
  }

  const students = data?.students || []
  const summary = data?.summary || { total: 0, entered: 0, submitted: 0, approved: 0, published: 0 }
  const canApprove = summary.total > 0 && summary.entered === summary.total && summary.submitted + summary.approved + summary.published === summary.total && summary.submitted > 0
  const canPublish = summary.total > 0 && summary.approved + summary.published === summary.total && summary.published < summary.total
  const isPublished = summary.total > 0 && summary.published === summary.total

  return (
    <div className="principal-marks-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose() }}>
      <section className="principal-marks-modal" role="dialog" aria-modal="true" aria-labelledby="principal-marks-title">
        <header className="principal-marks-head">
          <div className="principal-marks-icon"><ClipboardCheck size={21} /></div>
          <div><span className="principal-marks-kicker">PRINCIPAL REVIEW</span><h2 id="principal-marks-title">Review exam marks</h2><p>Class {exam.class?.name || '—'} · Section {exam.section?.name || '—'} · {exam.subjectName}</p></div>
          <button type="button" onClick={onClose} disabled={working} aria-label="Close review"><X size={18} /></button>
        </header>
        <div className="principal-marks-summary">
          <div><span>Students</span><strong>{loading ? '—' : summary.total}</strong></div>
          <div><span>Marks entered</span><strong>{loading ? '—' : summary.entered}</strong></div>
          <div><span>Submitted</span><strong>{loading ? '—' : summary.submitted + summary.approved + summary.published}</strong></div>
        </div>
        {error && <div className="principal-marks-alert">{error}</div>}
        {notice && <div className="principal-marks-notice"><CheckCircle2 size={16} />{notice}</div>}
        {loading ? <div className="principal-marks-loading"><Loader2 size={20} /> Loading marks…</div> : students.length ? <div className="principal-marks-table-wrap"><table className="principal-marks-table"><thead><tr><th>Student</th><th>Admission no.</th><th>Marks</th><th>Remarks</th><th>Status</th></tr></thead><tbody>{students.map((student) => <tr key={student.studentId}><td><strong>{student.name}</strong></td><td>{student.admissionNumber || '—'}</td><td><strong>{student.marksObtained === '' ? '—' : student.marksObtained}</strong><span className="principal-marks-outof"> / {data.exam.maxMarks}</span></td><td>{student.remarks || '—'}</td><td><span className={`principal-marks-status ${student.status}`}>{student.status === 'not-entered' ? 'Not entered' : student.status}</span></td></tr>)}</tbody></table></div> : <div className="principal-marks-loading">No active students are enrolled in this class and section.</div>}
        <footer className="principal-marks-footer"><span>{isPublished ? 'Results are published and ready for student/parent access when their results view is connected.' : 'Approve submitted marks before publishing the class results.'}</span><div>{canApprove && <button type="button" className="principal-marks-secondary" onClick={() => review('approve')} disabled={working}>{working ? <Loader2 size={15} /> : <CheckCircle2 size={15} />}Approve marks</button>}{canPublish && <button type="button" className="principal-marks-primary" onClick={() => review('publish')} disabled={working}>{working ? <Loader2 size={15} /> : <Send size={15} />}Publish results</button>}{isPublished && <span className="principal-marks-published"><CheckCircle2 size={15} /> Published</span>}</div></footer>
      </section>
    </div>
  )
}

export default PrincipalMarksReview
