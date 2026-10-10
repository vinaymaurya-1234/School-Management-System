import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Loader2, Save, Send, X } from 'lucide-react'
import apiClient from '../../api/client'
import './TeacherMarksEntry.css'

function TeacherMarksEntry({ exam, onClose }) {
  const [students, setStudents] = useState([])
  const [maxMarks, setMaxMarks] = useState(exam?.maxMarks || 100)
  const [summary, setSummary] = useState({ total: 0, entered: 0, submitted: 0 })
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    apiClient.get(`/exams/${exam._id}/marks`)
      .then(({ data }) => {
        if (!active) return
        setStudents((data.students || []).map((student) => ({ ...student, marksObtained: student.marksObtained === '' ? '' : String(student.marksObtained) })))
        setMaxMarks(data.exam?.maxMarks || 100)
        setLocked(Boolean(data.locked))
        setSummary(data.summary || { total: 0, entered: 0, submitted: 0 })
      })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Could not load the student register.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [exam._id])

  const enteredCount = useMemo(() => students.filter((student) => student.marksObtained !== '' && student.marksObtained !== null && Number.isFinite(Number(student.marksObtained))).length, [students])
  const updateStudent = (studentId, key, value) => setStudents((current) => current.map((student) => student.studentId === studentId ? { ...student, [key]: value } : student))

  const save = async (submit) => {
    setError('')
    setNotice('')
    const rows = students.filter((student) => student.marksObtained !== '' && student.marksObtained !== null).map((student) => ({
      studentId: student.studentId,
      marksObtained: Number(student.marksObtained),
      remarks: student.remarks || '',
    }))
    if (!rows.length) { setError('Enter marks for at least one student first.'); return }
    const invalid = rows.find((row) => !Number.isFinite(row.marksObtained) || row.marksObtained < 0 || row.marksObtained > maxMarks)
    if (invalid) { setError(`Marks must be between 0 and ${maxMarks}.`); return }
    if (submit && rows.length !== students.length) { setError('Fill in marks for every student before submitting.'); return }
    setSaving(true)
    try {
      const { data } = await apiClient.put(`/exams/${exam._id}/marks`, { marks: rows, submit })
      setNotice(data.message || (submit ? 'Marks submitted.' : 'Draft saved.'))
      setSummary((current) => ({ ...current, entered: rows.length, submitted: submit ? rows.length : 0 }))
      if (submit) setStudents((current) => current.map((student) => ({ ...student, status: 'submitted' })))
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save marks.')
    } finally { setSaving(false) }
  }

  return (
    <div className="marks-entry-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <section className="marks-entry-modal" role="dialog" aria-modal="true" aria-labelledby="marks-entry-title">
        <header className="marks-entry-head">
          <div className="marks-entry-heading-icon"><ClipboardList size={21} /></div>
          <div className="marks-entry-heading-copy">
            <span className="marks-entry-eyebrow">ASSESSMENT WORKSPACE</span>
            <h2 id="marks-entry-title">Enter student marks</h2>
            <p>Class {exam.class?.name || '—'} · Section {exam.section?.name || '—'} · {exam.subjectName}</p>
          </div>
          <button className="marks-entry-close" type="button" onClick={onClose} disabled={saving} aria-label="Close marks entry"><X size={18} /></button>
        </header>
        <div className="marks-entry-summary">
          <div><span>Students</span><strong>{loading ? '—' : summary.total}</strong></div>
          <div><span>Marks entered</span><strong>{loading ? '—' : enteredCount}</strong></div>
          <div><span>Maximum marks</span><strong>{maxMarks}</strong></div>
        </div>
        {error && <div className="marks-entry-alert error" role="alert">{error}</div>}
        {notice && <div className="marks-entry-alert success" role="status"><CheckCircle2 size={16} />{notice}</div>}
        <div className="marks-entry-instructions">{locked ? 'These marks have been approved or published. Editing is locked.' : <>Enter each student's marks out of <strong>{maxMarks}</strong>. Saving as draft does not submit the marks for review.</>}</div>
        {loading ? <div className="marks-entry-loading"><Loader2 size={20} className="marks-entry-spin" /> Loading class register…</div> : students.length ? (
          <div className="marks-entry-table-wrap">
            <table className="marks-entry-table">
              <thead><tr><th>Student</th><th>Admission no.</th><th>Marks / {maxMarks}</th><th>Remarks (optional)</th></tr></thead>
              <tbody>{students.map((student) => <tr key={student.studentId}>
                <td><strong>{student.name}</strong><small>{student.status === 'submitted' ? 'Submitted' : student.status === 'draft' ? 'Draft saved' : 'Not entered'}</small></td>
                <td>{student.admissionNumber || '—'}</td>
                <td><input aria-label={`Marks for ${student.name}`} type="number" min="0" max={maxMarks} step="0.5" inputMode="decimal" placeholder="—" value={student.marksObtained} onChange={(event) => updateStudent(student.studentId, 'marksObtained', event.target.value)} disabled={saving || locked} /></td>
                <td><input aria-label={`Remarks for ${student.name}`} type="text" maxLength="300" placeholder="Optional note" value={student.remarks} onChange={(event) => updateStudent(student.studentId, 'remarks', event.target.value)} disabled={saving || locked} /></td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : <div className="marks-entry-empty">No active students are enrolled in this class and section for the selected academic year.</div>}
        <footer className="marks-entry-footer">
          <span className="marks-entry-footer-note">Submitted marks are sent to the principal for review.</span>
          <div><button type="button" className="marks-entry-secondary" onClick={() => save(false)} disabled={loading || saving || locked || !students.length}><Save size={16} />{saving ? 'Saving…' : 'Save draft'}</button><button type="button" className="marks-entry-primary" onClick={() => save(true)} disabled={loading || saving || locked || !students.length}><Send size={16} />{saving ? 'Submitting…' : 'Submit marks'}</button></div>
        </footer>
      </section>
    </div>
  )
}

export default TeacherMarksEntry
