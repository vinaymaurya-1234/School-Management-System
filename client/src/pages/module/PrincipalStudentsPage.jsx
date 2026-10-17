import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Download, FileSpreadsheet, Loader2, Plus, Search, Upload, UserRound, X, Copy } from 'lucide-react'
import apiClient from '../../api/client'
import './PrincipalStudentsPage.css'

const idOf = (value) => value?._id || value || ''
const emptyForm = {
  name: '', admissionNumber: '', dateOfBirth: '', gender: '', admissionDate: new Date().toISOString().slice(0, 10),
  academicYearId: '', classId: '', sectionId: '', guardianName: '', parentRelationship: 'Father',
  guardianPhone: '', parentEmail: '', address: '',
}
const normal = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []; cell = ''
    } else cell += char
  }
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  if (rows.length < 2) throw new Error('The file has no student rows. Fill the template and save it as CSV UTF-8.')
  const headers = rows[0].map((value) => normal(value.replace(/^\uFEFF/, '')))
  return rows.slice(1).map((values, index) => {
    const item = {}
    headers.forEach((header, col) => { item[header] = String(values[col] ?? '').trim() })
    item._sourceRow = index + 2
    return item
  })
}

async function parseXlsx(buffer) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read XLSX files. Please save the workbook as CSV UTF-8 and upload it again.')
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const u32 = (offset) => view.getUint32(offset, true)
  let endRecord = -1
  for (let offset = Math.max(0, bytes.length - 65557); offset <= bytes.length - 22; offset += 1) {
    if (u32(offset) === 0x06054b50) endRecord = offset
  }
  if (endRecord < 0) throw new Error('This is not a valid XLSX workbook.')
  const entryCount = view.getUint16(endRecord + 10, true)
  let cursor = u32(endRecord + 16)
  const decoder = new TextDecoder()
  const entries = new Map()
  for (let index = 0; index < entryCount; index += 1) {
    if (u32(cursor) !== 0x02014b50) throw new Error('Could not read the XLSX workbook directory.')
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = u32(cursor + 20)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = u32(cursor + 42)
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength))
    entries.set(name, { method, compressedSize, localOffset })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  const readEntry = async (name) => {
    const entry = entries.get(name)
    if (!entry) return ''
    const offset = entry.localOffset
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const start = offset + 30 + nameLength + extraLength
    const compressed = bytes.slice(start, start + entry.compressedSize)
    if (entry.method === 0) return decoder.decode(compressed)
    if (entry.method !== 8) throw new Error('This XLSX file uses an unsupported compression method.')
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return decoder.decode(await new Response(stream).arrayBuffer())
  }
  const parseXml = (text) => new DOMParser().parseFromString(text, 'application/xml')
  const findAll = (node, name) => Array.from(node.getElementsByTagNameNS('*', name))
  const sharedXml = await readEntry('xl/sharedStrings.xml')
  const sharedStrings = sharedXml ? findAll(parseXml(sharedXml), 'si').map((item) => findAll(item, 't').map((part) => part.textContent || '').join('')) : []
  const sheetXml = await readEntry('xl/worksheets/sheet1.xml')
  if (!sheetXml) throw new Error('The first worksheet could not be found in this workbook.')
  const sheet = parseXml(sheetXml)
  const rowElements = findAll(sheet, 'row')
  const matrix = rowElements.map((rowElement) => {
    const cells = Array.from(rowElement.children).filter((child) => child.localName === 'c')
    const values = []
    cells.forEach((cell) => {
      const ref = cell.getAttribute('r') || ''
      const letters = ref.match(/^[A-Z]+/i)?.[0] || 'A'
      let column = 0
      for (const letter of letters.toUpperCase()) column = column * 26 + letter.charCodeAt(0) - 64
      column -= 1
      const valueNode = findAll(cell, 'v')[0]
      let value = valueNode?.textContent || ''
      if (cell.getAttribute('t') === 's' && value !== '') value = sharedStrings[Number(value)] ?? ''
      else if (cell.getAttribute('t') === 'inlineStr') value = findAll(cell, 't').map((part) => part.textContent || '').join('')
      values[column] = value
    })
    return values.map((value) => value ?? '')
  })
  const csv = matrix.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
  return parseCsv(csv)
}

function dateValue(value) {
  const input = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input
  if (/^\d{4,5}(\.\d+)?$/.test(input) && Number(input) > 20000 && Number(input) < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(input) * 86400000))
    return date.toISOString().slice(0, 10)
  }
  const match = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return ''
}

function csvDownload(filename, rows) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function downloadTemplate(yearName) {
  csvDownload('student-admission-template.csv', [
    ['Student Name', 'Admission Number', 'Date of Birth (YYYY-MM-DD)', 'Gender (male/female/other)', 'Admission Date (YYYY-MM-DD)', 'Academic Year', 'Class', 'Section', 'Parent Name', 'Relationship (Father/Mother/Guardian)', 'Parent Mobile', 'Parent Email (optional)', 'Address (optional)'],
    ['Rahul Sharma', 'ADM001', '2010-05-12', 'male', '2026-10-17', yearName || '2026-27', '11', 'A', 'Rajesh Sharma', 'Father', '9876543210', '', 'Mumbai'],
  ])
}

function credentialsCsv(imported) {
  const rows = [['Account Type', 'Name', 'Login ID', 'Temporary Password', 'Admission Number', 'Parent Login ID']]
  imported.forEach((item) => {
    rows.push(['Student', item.credentials?.student?.name || item.student?.name, item.credentials?.student?.loginId || '', item.credentials?.student?.temporaryPassword || '', item.student?.admissionNumber || '', item.credentials?.parent?.loginId || ''])
    if (item.credentials?.parent?.temporaryPassword) rows.push(['Parent', item.credentials.parent.name, item.credentials.parent.loginId, item.credentials.parent.temporaryPassword, item.student?.admissionNumber || '', item.credentials.parent.loginId])
  })
  csvDownload('temporary-login-credentials.csv', rows)
}

export default function PrincipalStudentsPage() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [years, setYears] = useState([])
  const [yearId, setYearId] = useState('')
  const [query, setQuery] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [importOpen, setImportOpen] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [credentials, setCredentials] = useState(null)
  const fileRef = useRef(null)

  const activeYear = useMemo(() => years.find((year) => year._id === yearId) || years.find((year) => year.isActive) || years[0] || null, [years, yearId])

  const load = useCallback(async (preferredYearId = '') => {
    setLoading(true)
    setError('')
    try {
      const yearResponse = await apiClient.get('/academic/years')
      const nextYears = yearResponse.data.years || []
      const targetYear = nextYears.find((year) => year._id === preferredYearId) || nextYears.find((year) => year.isActive) || nextYears[0] || null
      setYears(nextYears)
      setYearId(targetYear?._id || '')
      const [studentResponse, classResponse, sectionResponse, enrollmentResponse] = await Promise.all([
        apiClient.get('/students'),
        targetYear ? apiClient.get('/academic/classes', { params: { academicYear: targetYear._id } }) : Promise.resolve({ data: { classes: [] } }),
        targetYear ? apiClient.get('/academic/sections', { params: { academicYear: targetYear._id } }) : Promise.resolve({ data: { sections: [] } }),
        targetYear ? apiClient.get('/academic/enrollments', { params: { academicYear: targetYear._id } }) : Promise.resolve({ data: { enrollments: [] } }),
      ])
      setStudents(studentResponse.data.students || [])
      setClasses(classResponse.data.classes || [])
      setSections(sectionResponse.data.sections || [])
      setEnrollments(enrollmentResponse.data.enrollments || [])
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load student records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const getEnrollment = (student) => enrollments.find((item) => idOf(item.student) === student.userId && item.status === 'active') || enrollments.find((item) => idOf(item.student) === student.userId)
  const availableSections = useMemo(() => sections.filter((section) => !form.classId || idOf(section.class) === form.classId), [sections, form.classId])
  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students.filter((student) => {
      const enrollment = getEnrollment(student)
      if (selectedClass && idOf(enrollment?.class) !== selectedClass) return false
      if (selectedSection && idOf(enrollment?.section) !== selectedSection) return false
      if (!q) return true
      return [student.name, student.admissionNumber, student.userId, student.loginId, student.loginEmail, student.guardianName, student.guardianPhone].some((value) => String(value || '').toLowerCase().includes(q))
    })
  }, [students, enrollments, query, selectedClass, selectedSection])

  const openAdd = () => {
    setForm({ ...emptyForm, academicYearId: activeYear?._id || '', classId: selectedClass, sectionId: selectedSection })
    setModal(true); setError(''); setNotice('')
  }

  const changeYear = async (nextYearId) => {
    setForm((current) => ({ ...current, academicYearId: nextYearId, classId: '', sectionId: '' }))
    try {
      const [classResponse, sectionResponse] = await Promise.all([
        apiClient.get('/academic/classes', { params: { academicYear: nextYearId } }),
        apiClient.get('/academic/sections', { params: { academicYear: nextYearId } }),
      ])
      setClasses(classResponse.data.classes || [])
      setSections(sectionResponse.data.sections || [])
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load classes for this academic year.')
    }
  }

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const saveStudent = async () => {
    const required = ['name', 'admissionNumber', 'dateOfBirth', 'gender', 'admissionDate', 'academicYearId', 'classId', 'sectionId', 'guardianName', 'parentRelationship', 'guardianPhone']
    const missing = required.find((key) => !String(form[key] || '').trim())
    if (missing) { setError('Please fill all mandatory student, academic and parent fields.'); return }
    setSaving(true); setError('')
    try {
      const response = await apiClient.post('/students', {
        name: form.name.trim(), admissionNumber: form.admissionNumber.trim(), dateOfBirth: form.dateOfBirth,
        gender: form.gender, admissionDate: form.admissionDate, academicYear: form.academicYearId,
        classId: form.classId, sectionId: form.sectionId, guardianName: form.guardianName.trim(),
        parentRelationship: form.parentRelationship, guardianPhone: form.guardianPhone.trim(),
        parentEmail: form.parentEmail.trim(), address: form.address.trim(),
      })
      setModal(false)
      setCredentials({ type: 'single', student: response.data.credentials.student, parent: { ...response.data.credentials.parent, reusedExistingAccount: response.data.parent?.reusedExistingAccount } })
      setNotice('Student admission and account creation completed.')
      await load(form.academicYearId)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to add student.')
    } finally { setSaving(false) }
  }

  const validateCsvRows = (rows) => {
    const errors = []
    const valid = []
    const seenAdmission = new Set()
    rows.forEach((row) => {
      const read = (...keys) => {
        for (const key of keys) if (row[normal(key)]) return row[normal(key)]
        return ''
      }
      const name = read('Student Name', 'Name', 'Full Name')
      const admissionNumber = read('Admission Number', 'Admission No', 'Admission ID')
      const dateOfBirth = dateValue(read('Date of Birth (YYYY-MM-DD)', 'Date of Birth', 'DOB'))
      const genderRaw = normal(read('Gender (male/female/other)', 'Gender'))
      const gender = ({ m: 'male', f: 'female', male: 'male', female: 'female', other: 'other' })[genderRaw] || ''
      const admissionDate = dateValue(read('Admission Date (YYYY-MM-DD)', 'Admission Date'))
      const className = read('Class', 'Standard', 'Class Name')
      const sectionName = read('Section', 'Division', 'Class Section')
      const guardianName = read('Parent Name', 'Guardian Name', 'Parent/Guardian Name')
      const parentRelationship = read('Relationship (Father/Mother/Guardian)', 'Relationship', 'Parent Relationship', 'Parent/Guardian Relationship')
      const guardianPhone = read('Parent Mobile', 'Parent Phone', 'Guardian Phone', 'Mobile Number')
      const parentEmail = read('Parent Email (optional)', 'Parent Email', 'Guardian Email')
      const address = read('Address (optional)', 'Address', 'Residential Address')
      const rowErrors = []
      if (!name) rowErrors.push('Student name missing')
      if (!admissionNumber) rowErrors.push('Admission number missing')
      if (!dateOfBirth) rowErrors.push('DOB missing or invalid (use YYYY-MM-DD)')
      if (!gender) rowErrors.push('Gender must be male, female or other')
      if (!admissionDate) rowErrors.push('Admission date missing or invalid (use YYYY-MM-DD)')
      if (!parentRelationship) rowErrors.push('Parent relationship missing')
      const fileYear = read('Academic Year')
      if (fileYear && activeYear && normal(fileYear) !== normal(activeYear.name)) rowErrors.push(`Academic year "${fileYear}" does not match selected year ${activeYear.name}`)
      if (!guardianName) rowErrors.push('Parent name missing')
      if (!guardianPhone) rowErrors.push('Parent mobile missing')
      const classItem = classes.find((item) => normal(item.name) === normal(className))
      if (!classItem) rowErrors.push(`Class "${className || 'blank'}" not found in selected academic year`)
      const sectionItem = classItem && sections.find((item) => idOf(item.class) === idOf(classItem) && normal(item.name) === normal(sectionName))
      if (!sectionItem) rowErrors.push(`Section "${sectionName || 'blank'}" not found for class`)
      const rowKey = normal(admissionNumber)
      if (rowKey && seenAdmission.has(rowKey)) rowErrors.push('Duplicate admission number in this file')
      if (rowKey) seenAdmission.add(rowKey)
      if (students.some((student) => normal(student.admissionNumber) === rowKey)) rowErrors.push('Admission number already exists in school')
      if (rowErrors.length) errors.push({ row: row._sourceRow, admissionNumber, message: rowErrors.join('; ') })
      else valid.push({
        _sourceRow: row._sourceRow, name, admissionNumber, dateOfBirth, gender, admissionDate,
        academicYear: yearId, classId: idOf(classItem), sectionId: idOf(sectionItem),
        guardianName, parentRelationship, guardianPhone, parentEmail, address,
      })
    })
    return { valid, errors }
  }

  const chooseFile = async (file) => {
    setError(''); setImportResult(null); setImportPreview(null)
    if (!file) return
    const extension = file.name.toLowerCase().split('.').pop()
    if (!['csv', 'xlsx'].includes(extension)) {
      setError('Please upload an Excel workbook (.xlsx) or CSV file.')
      return
    }
    try {
      const rows = extension === 'xlsx' ? await parseXlsx(await file.arrayBuffer()) : parseCsv(await file.text())
      if (rows.length > 500) throw new Error('Import is limited to 500 students per batch. Split the file into smaller batches.')
      const preview = validateCsvRows(rows)
      setImportPreview({ ...preview, filename: file.name, total: rows.length })
    } catch (fileError) { setError(fileError.message || 'Could not read the uploaded file.') }
  }

  const runImport = async () => {
    if (!importPreview?.valid?.length) return
    setImportBusy(true); setError('')
    try {
      const response = await apiClient.post('/students/bulk-import', { students: importPreview.valid })
      setImportResult({ ...response.data, localErrors: importPreview.errors })
      await load(yearId)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Bulk import failed.')
    } finally { setImportBusy(false) }
  }

  const exportStudents = () => csvDownload('students.csv', [
    ['Student Name', 'Admission Number', 'Class', 'Section', 'Parent Name', 'Parent Mobile', 'Parent Email', 'Login ID', 'Status'],
    ...filteredStudents.map((student) => {
      const enrollment = getEnrollment(student)
      return [student.name, student.admissionNumber, enrollment?.class?.name || '', enrollment?.section?.name || '', student.guardianName || '', student.guardianPhone || '', student.guardianEmail || '', student.loginId || '', student.active === false ? 'Inactive' : 'Active']
    }),
  ])

  return (
    <div className="principal-students-page">
      <header className="students-hero">
        <div><div className="students-eyebrow"><span className="live-dot" /> ACADEMICS / STUDENT DIRECTORY</div><h1>Student Admission</h1><p>Add one student with a guided form or import a whole class list. Student and parent login accounts are created automatically.</p></div>
        <div className="hero-actions">
          <button className="student-secondary-btn" onClick={exportStudents}><Download size={17} /> Export list</button>
          <button className="student-secondary-btn" onClick={() => { setImportOpen(true); setImportPreview(null); setImportResult(null); setError('') }}><Upload size={17} /> Import Excel/CSV</button>
          <button className="student-primary-btn" onClick={openAdd}><Plus size={17} /> Add single student</button>
        </div>
      </header>

      {error && <div className="student-alert error"><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}
      {notice && <div className="student-alert success"><Check size={16} /><span>{notice}</span><button onClick={() => setNotice('')}><X size={16} /></button></div>}

      <section className="student-search-panel">
        <div className="student-search-wrap"><Search size={21} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, admission number, login ID or guardian…" autoComplete="off" />{query && <button className="clear-search" onClick={() => setQuery('')}><X size={17} /></button>}</div>
        <label className="student-filter"><span>CLASS</span><select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSection('') }}><option value="">All classes</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
        <label className={`student-filter ${!selectedClass ? 'disabled-filter' : ''}`}><span>SECTION</span><select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)} disabled={!selectedClass}><option value="">{selectedClass ? 'All sections' : 'Select class first'}</option>{sections.filter((item) => idOf(item.class) === selectedClass).map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></label>
        <div className="directory-count"><strong>{filteredStudents.length}</strong><span>students</span></div>
      </section>

      <section className="student-directory">
        <div className="directory-head"><div><span>DIRECTORY</span><h2>Student records</h2></div><span className="directory-year">{activeYear?.name || 'Current academic year'}</span></div>
        {loading ? <div className="student-empty"><Loader2 className="spin" size={25} /><strong>Loading student records…</strong></div> : filteredStudents.length ? <div className="student-list">{filteredStudents.map((student) => {
          const enrollment = getEnrollment(student)
          return <button key={student.id || student._id || student.userId} className={`student-row ${selectedStudent?.id === student.id ? 'selected' : ''}`} onClick={() => setSelectedStudent(student)}>
            <span className="student-avatar">{(student.name || 'S').slice(0, 1).toUpperCase()}</span><span className="student-main"><strong>{student.name}</strong><small>{student.admissionNumber} · {student.loginId || 'Login ID not assigned'}</small></span>
            <span className="student-meta"><small>CLASS</small><strong>{enrollment?.class?.name ? `Class ${enrollment.class.name}` : 'Not enrolled'}</strong></span><span className="student-meta"><small>SECTION</small><strong>{enrollment?.section?.name ? `Section ${enrollment.section.name}` : '—'}</strong></span><span className={`student-status ${student.active === false ? 'inactive' : ''}`}>{student.active === false ? 'Inactive' : 'Active'}</span><ArrowRight className="row-arrow" size={18} />
          </button>
        })}</div> : <div className="student-empty"><UserRound size={27} /><strong>No matching students</strong><span>Use Add single student or Import Excel/CSV to begin.</span></div>}
      </section>

      {selectedStudent && <div className="student-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedStudent(null)}><aside className="student-drawer">
        <div className="drawer-topbar"><span>STUDENT PROFILE</span><button onClick={() => setSelectedStudent(null)}><X size={19} /></button></div>
        <div className="drawer-identity"><div className="drawer-avatar">{(selectedStudent.name || 'S').slice(0, 1).toUpperCase()}</div><div><h2>{selectedStudent.name}</h2><p>{selectedStudent.admissionNumber}</p></div><span className="drawer-status">{selectedStudent.active === false ? 'Inactive' : 'Active'}</span></div>
        <div className="drawer-grid"><Detail label="Student Login ID" value={selectedStudent.loginId} /><Detail label="Login email" value={selectedStudent.loginEmail} /><Detail label="Admission number" value={selectedStudent.admissionNumber} /><Detail label="Date of birth" value={selectedStudent.dateOfBirth ? new Date(selectedStudent.dateOfBirth).toLocaleDateString() : '—'} /><Detail label="Parent / Guardian" value={selectedStudent.guardianName} /><Detail label="Parent mobile" value={selectedStudent.guardianPhone} /><Detail label="Parent email" value={selectedStudent.guardianEmail} /></div>
        <p className="students-footnote">For password reset and parent account details, open Explore → Student & Parent Login Credentials.</p>
      </aside></div>}

      {modal && <div className="student-modal-backdrop"><div className="student-modal">
        <div className="modal-header"><div><span>NEW ADMISSION</span><h2>Add single student</h2></div><button onClick={() => !saving && setModal(false)}><X size={18} /></button></div>
        <div className="modal-grid">
          <Field label="Student full name" value={form.name} onChange={(v) => setField('name', v)} required />
          <Field label="Admission number" value={form.admissionNumber} onChange={(v) => setField('admissionNumber', v)} required />
          <Field label="Date of birth" value={form.dateOfBirth} onChange={(v) => setField('dateOfBirth', v)} type="date" required />
          <label className="modal-field"><span>Gender *</span><select value={form.gender} onChange={(event) => setField('gender', event.target.value)} required><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
          <Field label="Admission date" value={form.admissionDate} onChange={(v) => setField('admissionDate', v)} type="date" required />
          <label className="modal-field"><span>Academic year *</span><select value={form.academicYearId} onChange={(event) => changeYear(event.target.value)} required><option value="">Select academic year</option>{years.map((item) => <option key={item._id} value={item._id}>{item.name}{item.isActive ? ' (Active)' : ''}</option>)}</select></label>
          <label className="modal-field"><span>Class / Standard *</span><select value={form.classId} onChange={(event) => { setField('classId', event.target.value); setField('sectionId', '') }} required><option value="">Select class</option>{classes.map((item) => <option key={item._id} value={item._id}>Class {item.name}</option>)}</select></label>
          <label className="modal-field"><span>Division / Section *</span><select value={form.sectionId} onChange={(event) => setField('sectionId', event.target.value)} required><option value="">Select section</option>{availableSections.map((item) => <option key={item._id} value={item._id}>Section {item.name}</option>)}</select></label>
          <Field label="Parent / guardian name" value={form.guardianName} onChange={(v) => setField('guardianName', v)} required />
          <label className="modal-field"><span>Relationship *</span><select value={form.parentRelationship} onChange={(event) => setField('parentRelationship', event.target.value)} required><option>Father</option><option>Mother</option><option>Guardian</option><option>Parent</option></select></label>
          <Field label="Parent mobile number" value={form.guardianPhone} onChange={(v) => setField('guardianPhone', v)} type="tel" required />
          <Field label="Parent email (optional)" value={form.parentEmail} onChange={(v) => setField('parentEmail', v)} type="email" />
          <label className="modal-field modal-field-wide"><span>Residential address (optional)</span><input value={form.address} onChange={(event) => setField('address', event.target.value)} /></label>
        </div>
        <div className="modal-note">Student/parent login IDs and temporary passwords are generated automatically. No Gmail or password entry is required.</div>
        <div className="modal-footer"><button className="student-secondary-btn" onClick={() => setModal(false)} disabled={saving}>Cancel</button><button className="student-primary-btn" onClick={saveStudent} disabled={saving}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />}{saving ? 'Creating…' : 'Create admission'}</button></div>
      </div></div>}

      {importOpen && <div className="student-modal-backdrop"><div className="student-modal import-modal">
        <div className="modal-header"><div><span>BULK ADMISSION</span><h2>Import students from Excel/CSV</h2></div><button onClick={() => !importBusy && setImportOpen(false)}><X size={18} /></button></div>
        {!importResult ? <>
          <div className="import-instructions">
            <div className="import-instruction-icon"><FileSpreadsheet size={23} /></div><div><strong>1. Download the template</strong><p>Open it in Excel and fill one student per row. You can upload a CSV UTF-8 file or an .xlsx workbook.</p><button className="student-secondary-btn" onClick={() => downloadTemplate(activeYear?.name)}><Download size={16} /> Download CSV template</button></div>
          </div>
          <div className="import-instructions"><div className="import-instruction-icon"><Upload size={23} /></div><div><strong>2. Upload the completed CSV</strong><p>Required: student name, admission number, DOB, gender, admission date, class, section, parent name, relationship and mobile. Parent email and address are optional.</p><input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => chooseFile(event.target.files?.[0])} /></div></div>
          {importPreview && <div className="import-preview">
            <div className="import-preview-stats"><span><strong>{importPreview.total}</strong> rows</span><span><strong>{importPreview.valid.length}</strong> ready to import</span><span><strong>{importPreview.errors.length}</strong> errors</span></div>
            <p>File: {importPreview.filename}. The active selection is academic year <strong>{activeYear?.name || 'not set'}</strong>.</p>
            {importPreview.errors.length > 0 && <div className="import-errors"><strong>Rows needing correction</strong>{importPreview.errors.slice(0, 12).map((item) => <p key={item.row}>Row {item.row} · {item.admissionNumber || 'No admission number'}: {item.message}</p>)}{importPreview.errors.length > 12 && <p>And {importPreview.errors.length - 12} more rows…</p>}</div>}
            <button className="student-primary-btn" disabled={importBusy || !importPreview.valid.length} onClick={runImport}>{importBusy ? <Loader2 className="spin" size={16} /> : <Upload size={16} />} Import {importPreview.valid.length} valid rows</button>
          </div>}
        </> : <div className="import-result">
          <div className="import-result-icon"><Check size={25} /></div><h3>{importResult.message}</h3><div className="import-preview-stats"><span><strong>{importResult.importedCount}</strong> imported</span><span><strong>{importResult.failedCount + (importResult.localErrors?.length || 0)}</strong> failed / skipped</span></div>
          {(importResult.errors?.length || importResult.localErrors?.length) > 0 && <div className="import-errors"><strong>Import errors</strong>{[...(importResult.localErrors || []), ...(importResult.errors || [])].slice(0, 20).map((item, index) => <p key={`${item.row}-${index}`}>Row {item.row}: {item.message}</p>)}</div>}
          {importResult.imported?.length > 0 && <button className="student-primary-btn" onClick={() => credentialsCsv(importResult.imported)}><Download size={16} /> Download one-time credentials CSV</button>}
          <p>Credentials contain temporary passwords. Download and distribute them privately now; passwords are not saved for later viewing.</p>
        </div>}
        <div className="modal-footer"><button className="student-secondary-btn" onClick={() => { setImportOpen(false); setImportPreview(null); setImportResult(null) }} disabled={importBusy}>Close</button></div>
      </div></div>}

      {credentials && <div className="student-modal-backdrop"><div className="credential-result-modal">
        <div className="modal-header"><div><span>ACCOUNT CREATED</span><h2>Student and parent credentials</h2></div><button onClick={() => setCredentials(null)}><X size={18} /></button></div>
        <p className="credential-warning">These temporary passwords are shown once. Copy or write them down and share privately before closing.</p>
        <CredentialBlock title="Student account" name={credentials.student?.name} loginId={credentials.student?.loginId} password={credentials.student?.temporaryPassword} />
        <CredentialBlock title="Parent account" name={credentials.parent?.name} loginId={credentials.parent?.loginId} password={credentials.parent?.temporaryPassword} note={credentials.parent?.reusedExistingAccount ? 'An existing parent account was reused. No password was reset.' : ''} />
        <div className="modal-footer"><button className="student-primary-btn" onClick={() => setCredentials(null)}>Done</button></div>
      </div></div>}
    </div>
  )
}

function Detail({ label, value }) { return <div className="detail"><span>{label}</span><strong>{value || '—'}</strong></div> }
function Field({ label, value, onChange, type = 'text', required = false }) {
  return <label className="modal-field"><span>{label}{required ? ' *' : ''}</span><input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} required={required} /></label>
}
function CredentialBlock({ title, name, loginId, password, note }) {
  return <section className="credential-result-block"><h3>{title}</h3><p>{name || 'Account'}</p><div><span>Login ID</span><strong>{loginId || 'Not assigned'}</strong><button onClick={() => navigator.clipboard?.writeText(loginId || '')} disabled={!loginId} aria-label="Copy login ID"><Copy size={15} /></button></div>{password ? <div><span>Temporary password</span><strong>{password}</strong><button onClick={() => navigator.clipboard?.writeText(password)} aria-label="Copy temporary password"><Copy size={15} /></button></div> : <small>{note || 'Password was not generated for an existing account. Use the credentials page to reset it if needed.'}</small>}</section>
}
