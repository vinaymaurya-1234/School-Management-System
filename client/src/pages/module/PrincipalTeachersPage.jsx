import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Download, GraduationCap, Loader2, Plus, Search, X } from 'lucide-react'
import apiClient from '../../api/client'
import './PrincipalStudentsPage.css'
import './PrincipalTeachersPage.css'

function idOf(value) {
  return value?._id || value?.id || value
}

function responseData(response, key) {
  return response?.data?.[key] ?? response?.data ?? []
}

const emptyForm = {
  name: '',
  email: '',
  password: '',
  employeeId: '',
  phone: '',
  department: 'Academic',
  designation: 'Teacher',
  qualification: '',
  classId: '',
  sectionId: '',
  subjectId: '',
  isClassTeacher: true,
}

const departments = ['Academic', 'Administration', 'Sports & Activities', 'Student Support', 'Other']

export default function PrincipalTeachersPage() {
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [subjects, setSubjects] = useState([])
  const [years, setYears] = useState([])
  const [query, setQuery] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const activeYear = useMemo(() => years.find((year) => year.isActive) || years[0] || null, [years])

  const availableSections = useMemo(() => {
    if (!form.classId) return []
    return sections.filter((section) => idOf(section.class) === form.classId)
  }, [sections, form.classId])

  const availableSubjects = useMemo(() => {
    if (!form.classId) return subjects
    return subjects.filter((subject) => !subject.class || idOf(subject.class) === form.classId)
  }, [subjects, form.classId])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const yearRes = await apiClient.get('/academic/years')
      const nextYears = responseData(yearRes, 'years')
      const year = nextYears.find((item) => item.isActive) || nextYears[0]
      setYears(nextYears)

      const [teacherRes, classRes, sectionRes, subjectRes] = await Promise.all([
        apiClient.get('/teachers'),
        year ? apiClient.get('/academic/classes', { params: { academicYear: year._id } }) : Promise.resolve({ data: { classes: [] } }),
        year ? apiClient.get('/academic/sections', { params: { academicYear: year._id } }) : Promise.resolve({ data: { sections: [] } }),
        year ? apiClient.get('/subjects', { params: { academicYear: year._id } }) : Promise.resolve({ data: { subjects: [] } }),
      ])

      setTeachers(responseData(teacherRes, 'teachers'))
      setClasses(responseData(classRes, 'classes'))
      setSections(responseData(sectionRes, 'sections'))
      setSubjects(responseData(subjectRes, 'subjects'))
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load teacher records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredTeachers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return teachers.filter((teacher) => {
      const matchesDepartment = !selectedDepartment || teacher.department === selectedDepartment
      if (!matchesDepartment) return false
      if (!q) return true
      return [
        teacher.name,
        teacher.email,
        teacher.employeeId,
        teacher.department,
        teacher.designation,
        teacher.phone,
        teacher.qualification,
      ].some((value) => String(value || '').toLowerCase().includes(q))
    })
  }, [teachers, query, selectedDepartment])

  const suggestions = useMemo(() => {
    if (!query.trim()) return []
    return filteredTeachers.slice(0, 6)
  }, [filteredTeachers, query])

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openTeacher = (teacher) => {
    setSelectedTeacher(teacher)
    setQuery(teacher.name || '')
  }

  const exportTeachers = () => {
    const rows = [
      ['Name', 'Employee ID', 'Email', 'Phone', 'Department', 'Designation', 'Qualification', 'Status'],
      ...filteredTeachers.map((teacher) => [
        teacher.name,
        teacher.employeeId,
        teacher.email,
        teacher.phone,
        teacher.department,
        teacher.designation,
        teacher.qualification,
        teacher.active === false ? 'Inactive' : 'Active',
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'teachers.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...emptyForm })
    setModal(true)
    setError('')
    setNotice('')
  }

  const openEdit = (teacher) => {
    setEditingId(teacher.id)
    setForm({
      ...emptyForm,
      ...teacher,
      password: '',
      userId: teacher.user,
    })
    setSelectedTeacher(null)
    setModal(true)
    setError('')
    setNotice('')
  }

  const saveTeacher = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Teacher name and email are required.')
      return
    }
    if (!editingId && !form.password.trim()) {
      setError('A login password is required for a new teacher.')
      return
    }

    setSaving(true)
    setError('')
    try {
      let teacherUserId = form.userId

      if (editingId) {
        await apiClient.put(`/teachers/${editingId}`, {
          name: form.name,
          email: form.email,
          employeeId: form.employeeId,
          phone: form.phone,
          department: form.department,
          designation: form.designation,
          qualification: form.qualification,
        })
      } else {
        const userResponse = await apiClient.post('/users', {
          name: form.name,
          email: form.email,
          password: form.password,
          role: 'teacher',
        })
        teacherUserId = userResponse.data.user.id

        await apiClient.post('/teachers', {
          userId: teacherUserId,
          employeeId: form.employeeId,
          phone: form.phone,
          department: form.department,
          designation: form.designation,
          qualification: form.qualification,
        })
      }

      if (!editingId && form.classId && activeYear && teacherUserId) {
        await apiClient.post('/academic/teacher-assignments', {
          academicYear: activeYear._id,
          teacher: teacherUserId,
          class: form.classId,
          section: form.sectionId || undefined,
          subject: form.subjectId || undefined,
          isClassTeacher: Boolean(form.isClassTeacher),
        })
      }

      setModal(false)
      setNotice(editingId ? 'Teacher updated successfully.' : 'Teacher login and profile created successfully.')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save teacher.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="principal-students-page principal-teachers-page">
      <header className="students-hero">
        <div>
          <div className="students-eyebrow"><span className="live-dot" /> ACADEMICS / TEACHER DIRECTORY</div>
          <h1>Teachers</h1>
          <p>Find teacher accounts instantly, review their professional details, and manage school staff access.</p>
        </div>
        <div className="hero-actions">
          <button className="student-secondary-btn" onClick={exportTeachers}><Download size={17} /> Export</button>
          <button className="student-primary-btn" onClick={openAdd}><Plus size={17} /> Add teacher</button>
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
            placeholder="Search by teacher name, employee ID, email or department..."
            autoComplete="off"
          />
          {query && <button className="clear-search" onClick={() => setQuery('')}><X size={17} /></button>}
          {suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((teacher) => (
                <button key={teacher.id || teacher._id} onClick={() => openTeacher(teacher)}>
                  <span className="suggestion-avatar teacher-suggestion-avatar">{(teacher.name || 'T').slice(0, 1).toUpperCase()}</span>
                  <span className="suggestion-copy"><strong>{teacher.name}</strong><small>{teacher.employeeId || 'No employee ID'} · {teacher.department || 'No department'}</small></span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="student-filter">
          <span>DEPARTMENT</span>
          <select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}>
            <option value="">All departments</option>
            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
        </label>

        <div className="teacher-filter-note">
          <span>ACADEMIC YEAR</span>
          <strong>{activeYear?.name || 'Current year'}</strong>
        </div>

        <div className="directory-count"><strong>{filteredTeachers.length}</strong><span>teachers</span></div>
      </section>

      <section className="student-directory">
        <div className="directory-head">
          <div><span>STAFF DIRECTORY</span><h2>Teacher records</h2></div>
          <span className="directory-year">{activeYear?.name || 'Current academic year'}</span>
        </div>

        {loading ? (
          <div className="student-empty"><Loader2 className="spin" size={25} /><strong>Loading teacher records...</strong></div>
        ) : filteredTeachers.length ? (
          <div className="student-list teacher-list">
            {filteredTeachers.map((teacher) => {
              const isSelected = selectedTeacher?.id === teacher.id || selectedTeacher?._id === teacher._id
              return (
                <button key={teacher.id || teacher._id} className={`student-row teacher-row ${isSelected ? 'selected' : ''}`} onClick={() => openTeacher(teacher)}>
                  <span className="student-avatar teacher-avatar"><GraduationCap size={19} /></span>
                  <span className="student-main"><strong>{teacher.name || 'Unnamed teacher'}</strong><small>{teacher.email || teacher.employeeId || 'No email'}</small></span>
                  <span className="student-meta"><small>EMPLOYEE ID</small><strong>{teacher.employeeId || '—'}</strong></span>
                  <span className="student-meta"><small>DEPARTMENT</small><strong>{teacher.department || '—'}</strong></span>
                  <span className={`student-status ${teacher.active === false ? 'inactive' : ''}`}>{teacher.active === false ? 'Inactive' : 'Active'}</span>
                  <ArrowRight className="row-arrow" size={18} />
                </button>
              )
            })}
          </div>
        ) : (
          <div className="student-empty"><GraduationCap size={27} /><strong>No matching teachers</strong><span>Try a different name, employee ID, email or department.</span></div>
        )}
      </section>

      <p className="students-footnote">Search results update as you type. Select a teacher to open their complete profile.</p>

      {selectedTeacher && (
        <div className="student-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedTeacher(null)}>
          <aside className="student-drawer">
            <div className="drawer-topbar"><span>TEACHER PROFILE</span><button onClick={() => setSelectedTeacher(null)}><X size={19} /></button></div>
            <div className="drawer-identity">
              <div className="drawer-avatar teacher-drawer-avatar"><GraduationCap size={23} /></div>
              <div><h2>{selectedTeacher.name || 'Unnamed teacher'}</h2><p>{selectedTeacher.employeeId || 'No employee ID'}</p></div>
              <span className={`drawer-status ${selectedTeacher.active === false ? 'inactive' : ''}`}>{selectedTeacher.active === false ? 'Inactive' : 'Active'}</span>
            </div>

            <div className="drawer-grid">
              <Detail label="Teacher ID" value={selectedTeacher.user || selectedTeacher.userId || selectedTeacher.id || '—'} />
              <Detail label="Employee ID" value={selectedTeacher.employeeId || '—'} />
              <Detail label="Email" value={selectedTeacher.email || '—'} />
              <Detail label="Phone" value={selectedTeacher.phone || '—'} />
              <Detail label="Department" value={selectedTeacher.department || '—'} />
              <Detail label="Designation" value={selectedTeacher.designation || '—'} />
            </div>

            <div className="drawer-section"><span>PROFESSIONAL DETAILS</span><div className="drawer-card"><Detail label="Qualification" value={selectedTeacher.qualification || '—'} /><Detail label="Academic year" value={activeYear?.name || '—'} /><Detail label="Profile status" value={selectedTeacher.active === false ? 'Inactive' : 'Active'} /><Detail label="Created" value={selectedTeacher.createdAt ? new Date(selectedTeacher.createdAt).toLocaleDateString() : '—'} /></div></div>

            <div className="teacher-drawer-actions"><button className="student-secondary-btn" onClick={() => openEdit(selectedTeacher)}>Edit teacher</button></div>
          </aside>
        </div>
      )}

      {modal && (
        <div className="student-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setModal(false)}>
          <div className="student-modal">
            <div className="modal-header">
              <div><span>{editingId ? 'EDIT TEACHER' : 'NEW TEACHER'}</span><h2>{editingId ? 'Update teacher profile' : 'Add teacher'}</h2></div>
              <button onClick={() => !saving && setModal(false)}><X size={19} /></button>
            </div>

            <div className="modal-grid">
              <Field label="Full name" value={form.name} onChange={(value) => setField('name', value)} required />
              <Field label="Email" type="email" value={form.email} onChange={(value) => setField('email', value)} required />
              {!editingId && <Field label="Login password" type="password" value={form.password} onChange={(value) => setField('password', value)} required />}
              <Field label="Employee ID" value={form.employeeId} onChange={(value) => setField('employeeId', value)} />
              <Field label="Phone" value={form.phone} onChange={(value) => setField('phone', value)} />
              <SelectField label="Department" value={form.department} onChange={(value) => setField('department', value)} options={departments.map((item) => ({ value: item, label: item }))} />
              <Field label="Designation" value={form.designation} onChange={(value) => setField('designation', value)} />
              <Field label="Qualification" value={form.qualification} onChange={(value) => setField('qualification', value)} />

              {!editingId && <>
                <SelectField label="Class assignment" value={form.classId} onChange={(value) => { setField('classId', value); setField('sectionId', ''); }} options={[{ value: '', label: 'No class assignment' }, ...classes.map((item) => ({ value: item._id, label: `Class ${item.name}` }))]} />
                <SelectField label="Section" value={form.sectionId} onChange={(value) => setField('sectionId', value)} options={[{ value: '', label: form.classId ? 'All / no section' : 'Select class first' }, ...availableSections.map((item) => ({ value: item._id, label: `Section ${item.name}` }))]} disabled={!form.classId} />
                <SelectField label="Subject" value={form.subjectId} onChange={(value) => setField('subjectId', value)} options={[{ value: '', label: 'No subject assignment' }, ...availableSubjects.map((item) => ({ value: item._id, label: item.name || item.subjectName || 'Subject' }))]} />
                <label className="teacher-checkbox"><input type="checkbox" checked={Boolean(form.isClassTeacher)} onChange={(event) => setField('isClassTeacher', event.target.checked)} /><span>Mark as class teacher</span></label>
              </>}
            </div>

            <div className="modal-footer"><button className="student-secondary-btn" onClick={() => !saving && setModal(false)}>Cancel</button><button className="student-primary-btn" onClick={saveTeacher} disabled={saving}>{saving ? <Loader2 className="spin" size={17} /> : null}{editingId ? 'Save changes' : 'Create teacher'}</button></div>
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
  return <label className="modal-field"><span>{label}{required ? ' *' : ''}</span><input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return <label className="modal-field"><span>{label}</span><select value={value || ''} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{options.map((option) => <option key={`${label}-${option.value || 'empty'}`} value={option.value}>{option.label}</option>)}</select></label>
}
