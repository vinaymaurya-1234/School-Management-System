import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Download, GraduationCap, Loader2, Plus, Search, UserRound, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'
import './PrincipalStudentsPage.css'

function idOf(value) {
  return value?._id || value
}

function responseData(response, key) {
  return response?.data?.[key] ?? response?.data ?? []
}

const emptyForm = {
  admissionNumber: '',
  name: '',
  loginEmail: '',
  loginPassword: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  parentLoginEmail: '',
  parentLoginPassword: '',
  parentRelationship: 'Parent',
  classId: '',
  sectionId: '',
}

export default function PrincipalStudentsPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [years, setYears] = useState([])
  const [query, setQuery] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const activeYear = useMemo(() => years.find((year) => year.isActive) || years[0] || null, [years])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const yearRes = await apiClient.get('/academic/years')
      const nextYears = responseData(yearRes, 'years')
      const year = nextYears.find((item) => item.isActive) || nextYears[0]
      setYears(nextYears)

      const [studentRes, classRes, sectionRes, enrollmentRes] = await Promise.all([
        apiClient.get('/students'),
        year ? apiClient.get('/academic/classes', { params: { academicYear: year._id } }) : Promise.resolve({ data: { classes: [] } }),
        year ? apiClient.get('/academic/sections', { params: { academicYear: year._id } }) : Promise.resolve({ data: { sections: [] } }),
        year ? apiClient.get('/academic/enrollments', { params: { academicYear: year._id } }) : Promise.resolve({ data: { enrollments: [] } }),
      ])

      setStudents(responseData(studentRes, 'students'))
      setClasses(responseData(classRes, 'classes'))
      setSections(responseData(sectionRes, 'sections'))
      setEnrollments(responseData(enrollmentRes, 'enrollments'))
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load student records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const getEnrollment = (student) => enrollments.find((item) => idOf(item.student) === student.userId && item.status === 'active') || enrollments.find((item) => idOf(item.student) === student.userId)

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students.filter((student) => {
      const enrollment = getEnrollment(student)
      const matchesClass = !selectedClass || idOf(enrollment?.class) === selectedClass
      if (!matchesClass) return false
      if (!q) return true
      return [
        student.name,
        student.admissionNumber,
        student.userId,
        student.loginEmail,
        student.email,
        student.guardianName,
        student.guardianPhone,
        student.guardianEmail,
      ].some((value) => String(value || '').toLowerCase().includes(q))
    })
  }, [students, enrollments, query, selectedClass])

  const suggestions = useMemo(() => {
    if (!query.trim()) return []
    return filteredStudents.slice(0, 6)
  }, [filteredStudents, query])

  const openStudent = (student) => {
    setSelectedStudent(student)
    setQuery(student.name || '')
  }

  const exportStudents = () => {
    const rows = [
      ['Name', 'Admission Number', 'Class', 'Section', 'Guardian', 'Guardian Phone', 'Guardian Email', 'Status'],
      ...filteredStudents.map((student) => {
        const enrollment = getEnrollment(student)
        return [
          student.name,
          student.admissionNumber,
          enrollment?.class?.name || '',
          enrollment?.section?.name || '',
          student.guardianName || '',
          student.guardianPhone || '',
          student.guardianEmail || '',
          student.active === false ? 'Inactive' : 'Active',
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'students.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const openAdd = () => {
    setForm({ ...emptyForm, classId: selectedClass })
    setModal(true)
    setError('')
    setNotice('')
  }

  const saveStudent = async () => {
    if (!form.name.trim() || !form.admissionNumber.trim() || !form.loginEmail.trim() || !form.loginPassword.trim()) {
      setError('Name, admission number, login email and login password are required.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await apiClient.post('/students', {
        admissionNumber: form.admissionNumber,
        name: form.name,
        loginEmail: form.loginEmail,
        loginPassword: form.loginPassword,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        guardianEmail: form.guardianEmail,
        parentLoginEmail: form.parentLoginEmail,
        parentLoginPassword: form.parentLoginPassword,
        parentRelationship: form.parentRelationship,
      })

      const student = response.data.student
      if (form.classId && form.sectionId && student?.userId && activeYear) {
        await apiClient.post('/academic/enrollments', {
          student: student.userId,
          academicYear: activeYear._id,
          class: form.classId,
          section: form.sectionId,
          status: 'active',
        })
      }

      setModal(false)
      setNotice('Student added successfully.')
      await load()
      if (student) setSelectedStudent(student)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to add student.')
    } finally {
      setSaving(false)
    }
  }

  const currentSections = sections.filter((section) => !form.classId || idOf(section.class) === form.classId)
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="principal-students-page">
      <header className="students-hero">
        <div>
          <div className="students-eyebrow"><span className="live-dot" /> ACADEMICS / STUDENT DIRECTORY</div>
          <h1>Students</h1>
          <p>Find any student instantly, review their complete school profile, and manage current-year enrollment.</p>
        </div>
        <div className="hero-actions">
          <button className="student-secondary-btn" onClick={exportStudents}><Download size={17} /> Export</button>
          <button className="student-primary-btn" onClick={openAdd}><Plus size={17} /> Add student</button>
        </div>
      </header>

      {error && <div className="student-alert error"><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}
      {notice && <div className="student-alert success"><Check size={16} /><span>{notice}</span><button onClick={() => setNotice('')}><X size={16} /></button></div>}

      <section className="student-search-panel">
        <div className="student-search-wrap">
          <Search size={21} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by student name, admission ID, email or guardian..."
            autoComplete="off"
          />
          {query && <button className="clear-search" onClick={() => setQuery('')}><X size={17} /></button>}
          {suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((student) => {
                const enrollment = getEnrollment(student)
                return (
                  <button key={student.id || student._id || student.userId} onClick={() => openStudent(student)}>
                    <span className="suggestion-avatar">{(student.name || 'S').slice(0, 1).toUpperCase()}</span>
                    <span className="suggestion-copy"><strong>{student.name}</strong><small>{student.admissionNumber || student.userId} · {enrollment ? `Class ${enrollment.class?.name || ''}` : 'Not enrolled'}</small></span>
                    <ArrowRight size={16} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <label className="student-filter">
          <span>CLASS</span>
          <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
            <option value="">All classes</option>
            {classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}
          </select>
        </label>
        <div className="directory-count"><strong>{filteredStudents.length}</strong><span>students</span></div>
      </section>

      <section className="student-directory">
        <div className="directory-head">
          <div><span>DIRECTORY</span><h2>Student records</h2></div>
          <span className="directory-year">{activeYear?.name || 'Current academic year'}</span>
        </div>
        {loading ? (
          <div className="student-empty"><Loader2 className="spin" size={25} /><strong>Loading student records...</strong></div>
        ) : filteredStudents.length ? (
          <div className="student-list">
            {filteredStudents.map((student) => {
              const enrollment = getEnrollment(student)
              const isSelected = selectedStudent?.id === student.id || selectedStudent?.userId === student.userId
              return (
                <button key={student.id || student._id || student.userId} className={`student-row ${isSelected ? 'selected' : ''}`} onClick={() => openStudent(student)}>
                  <span className="student-avatar">{(student.name || 'S').slice(0, 1).toUpperCase()}</span>
                  <span className="student-main"><strong>{student.name || 'Unnamed student'}</strong><small>{student.admissionNumber || student.userId || 'No admission ID'}</small></span>
                  <span className="student-meta"><small>CLASS</small><strong>{enrollment?.class?.name ? `Class ${enrollment.class.name}` : 'Not enrolled'}</strong></span>
                  <span className="student-meta"><small>SECTION</small><strong>{enrollment?.section?.name ? `Section ${enrollment.section.name}` : '—'}</strong></span>
                  <span className={`student-status ${student.active === false ? 'inactive' : ''}`}>{student.active === false ? 'Inactive' : 'Active'}</span>
                  <ArrowRight className="row-arrow" size={18} />
                </button>
              )
            })}
          </div>
        ) : (
          <div className="student-empty"><UserRound size={27} /><strong>No matching students</strong><span>Start typing a name or admission ID to find a student.</span></div>
        )}
      </section>

      <p className="students-footnote">Search results update as you type. Select a student to open their complete profile.</p>

      {selectedStudent && (
        <div className="student-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedStudent(null)}>
          <aside className="student-drawer">
            <div className="drawer-topbar"><span>STUDENT PROFILE</span><button onClick={() => setSelectedStudent(null)}><X size={19} /></button></div>
            <div className="drawer-identity">
              <div className="drawer-avatar">{(selectedStudent.name || 'S').slice(0, 1).toUpperCase()}</div>
              <div><h2>{selectedStudent.name || 'Unnamed student'}</h2><p>{selectedStudent.admissionNumber || 'No admission ID'}</p></div>
              <span className={`drawer-status ${selectedStudent.active === false ? 'inactive' : ''}`}>{selectedStudent.active === false ? 'Inactive' : 'Active'}</span>
            </div>

            <div className="drawer-grid">
              <Detail label="Student ID" value={selectedStudent.userId || selectedStudent.id || '—'} />
              <Detail label="Admission number" value={selectedStudent.admissionNumber || '—'} />
              <Detail label="Login email" value={selectedStudent.loginEmail || selectedStudent.email || '—'} />
              <Detail label="Class" value={getEnrollment(selectedStudent)?.class?.name ? `Class ${getEnrollment(selectedStudent).class.name}` : 'Not enrolled'} />
              <Detail label="Section" value={getEnrollment(selectedStudent)?.section?.name ? `Section ${getEnrollment(selectedStudent).section.name}` : '—'} />
              <Detail label="Academic year" value={activeYear?.name || '—'} />
            </div>

            <div className="drawer-section"><span>GUARDIAN</span><div className="drawer-card"><Detail label="Name" value={selectedStudent.guardianName || '—'} /><Detail label="Phone" value={selectedStudent.guardianPhone || '—'} /><Detail label="Email" value={selectedStudent.guardianEmail || '—'} /><Detail label="Relationship" value={selectedStudent.parentRelationship || 'Parent / Guardian'} /></div></div>

            <div className="drawer-section"><span>ACCOUNT</span><div className="drawer-card"><Detail label="Profile status" value={selectedStudent.active === false ? 'Inactive' : 'Active'} /><Detail label="Created" value={selectedStudent.createdAt ? new Date(selectedStudent.createdAt).toLocaleDateString() : '—'} /><Detail label="Last updated" value={selectedStudent.updatedAt ? new Date(selectedStudent.updatedAt).toLocaleDateString() : '—'} /></div></div>
          </aside>
        </div>
      )}

      {modal && (
        <div className="student-modal-backdrop">
          <div className="student-modal">
            <div className="modal-header"><div><span>NEW RECORD</span><h2>Add student</h2></div><button onClick={() => !saving && setModal(false)}><X size={18} /></button></div>
            <div className="modal-grid">
              <Field label="Full name" value={form.name} onChange={(v) => setField('name', v)} required />
              <Field label="Admission number" value={form.admissionNumber} onChange={(v) => setField('admissionNumber', v)} required />
              <Field label="Student login email" value={form.loginEmail} onChange={(v) => setField('loginEmail', v)} required />
              <Field label="Student login password" value={form.loginPassword} onChange={(v) => setField('loginPassword', v)} type="password" required />
              <Field label="Guardian name" value={form.guardianName} onChange={(v) => setField('guardianName', v)} />
              <Field label="Guardian phone" value={form.guardianPhone} onChange={(v) => setField('guardianPhone', v)} />
              <Field label="Guardian email" value={form.guardianEmail} onChange={(v) => setField('guardianEmail', v)} />
              <Field label="Relationship" value={form.parentRelationship} onChange={(v) => setField('parentRelationship', v)} />
              <Field label="Parent login email" value={form.parentLoginEmail} onChange={(v) => setField('parentLoginEmail', v)} />
              <Field label="Parent login password" value={form.parentLoginPassword} onChange={(v) => setField('parentLoginPassword', v)} type="password" />
              <label className="modal-field"><span>Class</span><select value={form.classId} onChange={(event) => { setField('classId', event.target.value); setField('sectionId', '') }}><option value="">Select class</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
              <label className="modal-field"><span>Section</span><select value={form.sectionId} onChange={(event) => setField('sectionId', event.target.value)}><option value="">Select section</option>{currentSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></label>
            </div>
            <div className="modal-footer"><button className="student-secondary-btn" onClick={() => setModal(false)} disabled={saving}>Cancel</button><button className="student-primary-btn" onClick={saveStudent} disabled={saving}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />} {saving ? 'Saving...' : 'Create student'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }) {
  return <div className="detail"><span>{label}</span><strong>{value || '—'}</strong></div>
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return <label className="modal-field"><span>{label}{required ? ' *' : ''}</span><input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} /></label>
}
