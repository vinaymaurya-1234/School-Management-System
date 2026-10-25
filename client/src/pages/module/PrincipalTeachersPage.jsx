import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Download, FileSpreadsheet, GraduationCap, Loader2, Plus, Search, Upload, X } from 'lucide-react'
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
  employeeId: '',
  phone: '',
  department: 'Academic',
  designation: 'Teacher',
  qualification: '',
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


function downloadTeacherTemplate() {
  const rows = [
    ['Full Name', 'Employee ID', 'Phone', 'Department', 'Designation', 'Qualification'],
    ['Soma Prasad', 'TCH001', '9876543210', 'Academic', 'Teacher', 'B.Ed'], 
  ]
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'teacher-import-template.csv'; anchor.click(); URL.revokeObjectURL(url)
}

const departments = ['Academic', 'Administration', 'Sports & Activities', 'Student Support', 'Other']

export default function PrincipalTeachersPage() {
  const [teachers, setTeachers] = useState([])
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
  const [importOpen, setImportOpen] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [createdCredential, setCreatedCredential] = useState(null)
  const fileRef = useRef(null)

  const activeYear = useMemo(() => years.find((year) => year.isActive) || years[0] || null, [years])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const yearRes = await apiClient.get('/academic/years')
      const nextYears = responseData(yearRes, 'years')
      const year = nextYears.find((item) => item.isActive) || nextYears[0]
      setYears(nextYears)

      const teacherRes = await apiClient.get('/teachers')
      setTeachers(responseData(teacherRes, 'teachers'))
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

  const chooseImportFile = async (file) => {
    setError(''); setImportPreview(null); setImportResult(null)
    if (!file) return
    const extension = file.name.toLowerCase().split('.').pop()
    if (!['csv', 'xlsx'].includes(extension)) { setError('Please upload an Excel workbook (.xlsx) or CSV file.'); return }
    try {
      const rows = extension === 'xlsx' ? await parseXlsx(await file.arrayBuffer()) : parseCsv(await file.text())
      if (rows.length > 500) throw new Error('Import is limited to 500 teachers per batch. Split the file into smaller batches.')
      const valid = []; const errors = []; const seenIds = new Set()
      rows.forEach((row) => {
        const name = row.fullname || row.name || ''
        const employeeId = row.employeeid || row.employeeidnumber || ''
        const phone = row.phone || ''
        const department = row.department || 'Academic'
        const designation = row.designation || 'Teacher'
        const qualification = row.qualification || ''
        const problems = []
        if (!name.trim()) problems.push('Full Name is required')
        if (!employeeId.trim()) problems.push('Employee ID is required')
        const idKey = normal(employeeId)
        if (idKey && seenIds.has(idKey)) problems.push('Duplicate Employee ID in this file')
        if (teachers.some((teacher) => normal(teacher.employeeId) === idKey)) problems.push('Employee ID already exists in school')
        if (idKey) seenIds.add(idKey)
        if (problems.length) errors.push({ row: row._sourceRow, name: name || 'Unnamed teacher', message: problems.join('; ') })
        else valid.push({ _sourceRow: row._sourceRow, name: name.trim(), employeeId: employeeId.trim(), phone: phone.trim(), department: department.trim(), designation: designation.trim(), qualification: qualification.trim() })
      })
      setImportPreview({ valid, errors, total: rows.length, filename: file.name })
    } catch (fileError) { setError(fileError.message || 'Could not read the uploaded file.') }
  }

  const runTeacherImport = async () => {
    if (!importPreview?.valid?.length) return
    setImportBusy(true); setError('')
    const imported = []; const failed = [...importPreview.errors]; const credentials = []
    for (const item of importPreview.valid) {
      try {
        const response = await apiClient.post('/teachers/create-account', {
          name: item.name, employeeId: item.employeeId,
          phone: item.phone, department: item.department, designation: item.designation,
          qualification: item.qualification,
        })
        imported.push({ row: item._sourceRow, name: item.name, employeeId: item.employeeId })
        if (response.data?.credentials) credentials.push({ row: item._sourceRow, ...response.data.credentials })
      } catch (requestError) {
        failed.push({ row: item._sourceRow, name: item.name, message: requestError.response?.data?.message || requestError.message || 'Could not create teacher account' })
      }
    }
    setImportResult({ imported, failed, credentials })
    if (credentials.length) {
      const rows = [['Row', 'Teacher', 'Login ID', 'Temporary Password'], ...credentials.map((item) => [item.row, item.name, item.loginId, item.temporaryPassword])]
      const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'teacher-login-credentials.csv'; anchor.click(); URL.revokeObjectURL(url)
    }
    if (imported.length) { setNotice(`Imported ${imported.length} teacher account(s). Login IDs and temporary passwords are in the downloaded credentials CSV.`); await load() }
    setImportBusy(false)
  }

  const saveTeacher = async () => {
    if (!form.name.trim() || !form.employeeId.trim()) {
      setError('Teacher name and employee ID are required.')
      return
    }

    setSaving(true)
    setError('')
    try {
      let teacherUserId = form.userId

      if (editingId) {
        await apiClient.put(`/teachers/${editingId}`, {
          name: form.name,
          employeeId: form.employeeId,
          phone: form.phone,
          department: form.department,
          designation: form.designation,
          qualification: form.qualification,
        })
      } else {
        const response = await apiClient.post('/teachers/create-account', {
          name: form.name,
          employeeId: form.employeeId,
          phone: form.phone,
          department: form.department,
          designation: form.designation,
          qualification: form.qualification,
        })
        setCreatedCredential(response.data.credentials)
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
          <button className="student-secondary-btn" onClick={() => { setImportOpen(true); setImportPreview(null); setImportResult(null); setError('') }}><Upload size={17} /> Import Excel/CSV</button>
          <button className="student-primary-btn" onClick={openAdd}><Plus size={17} /> Add single teacher</button>
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


      {importOpen && <div className="student-modal-backdrop teacher-import-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !importBusy && setImportOpen(false)}><div className="student-modal import-modal teacher-import-modal">
        <div className="modal-header"><div><span>BULK STAFF SETUP</span><h2>Import teachers from Excel/CSV</h2></div><button onClick={() => !importBusy && setImportOpen(false)}><X size={18}/></button></div>
        {!importResult ? <>
          <div className="import-instructions"><div className="import-instruction-icon"><FileSpreadsheet size={23}/></div><div><strong>1. Download the template</strong><p>Fill one teacher per row with a unique employee ID. Login IDs and temporary passwords are generated automatically for each teacher.</p><button className="student-secondary-btn" onClick={downloadTeacherTemplate}><Download size={16}/> Download CSV template</button></div></div>
          <div className="import-instructions"><div className="import-instruction-icon"><Upload size={23}/></div><div><strong>2. Upload completed file</strong><p>Required columns: Full Name and Employee ID. Email is not collected here; teachers can add it later in their profile. Login credentials are generated automatically. Maximum 500 rows per batch.</p><input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => chooseImportFile(event.target.files?.[0])}/></div></div>
          {importPreview && <div className="import-preview"><div className="import-preview-stats"><span><strong>{importPreview.total}</strong> rows</span><span><strong>{importPreview.valid.length}</strong> ready to import</span><span><strong>{importPreview.errors.length}</strong> errors</span></div><p>File: {importPreview.filename}. Invalid rows are skipped and shown below.</p>{importPreview.errors.length>0 && <div className="import-errors"><strong>Rows needing correction</strong>{importPreview.errors.slice(0,12).map((item)=><p key={item.row}>Row {item.row} · {item.name}: {item.message}</p>)}{importPreview.errors.length>12 && <p>And {importPreview.errors.length-12} more rows…</p>}</div>}<button className="student-primary-btn" disabled={importBusy||!importPreview.valid.length} onClick={runTeacherImport}>{importBusy?<Loader2 className="spin" size={16}/>:<Upload size={16}/>} Import {importPreview.valid.length} valid rows</button></div>}
        </> : <div className="import-result"><div className="import-result-icon"><Check size={25}/></div><h3>Teacher import finished</h3><div className="import-preview-stats"><span><strong>{importResult.imported.length}</strong> imported</span><span><strong>{importResult.failed.length}</strong> failed / skipped</span></div><p>Imported profiles are available in the teacher directory. Assign classes, sections, subjects and class-teacher roles from Teacher Assignments.</p>{importResult.failed.length>0 && <div className="import-errors"><strong>Rows needing attention</strong>{importResult.failed.slice(0,20).map((item)=><p key={item.row}>Row {item.row} · {item.name}: {item.message}</p>)}</div>}<button className="student-secondary-btn" onClick={()=>{const rows=[['Row','Name','Status / Error'],...importResult.imported.map(x=>[x.row,x.name,'Imported']),...importResult.failed.map(x=>[x.row,x.name,x.message])];const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\\r\\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='teacher-import-results.csv';a.click();URL.revokeObjectURL(url)}}><Download size={16}/> Download results</button></div>}
        <div className="modal-footer"><button className="student-secondary-btn" onClick={()=>!importBusy&&setImportOpen(false)} disabled={importBusy}>{importResult?'Close':'Cancel'}</button></div>
      </div></div>}

      {createdCredential && <div className="student-modal-backdrop"><div className="student-modal credential-result-modal"><div className="modal-header"><div><span>TEACHER ACCOUNT CREATED</span><h2>Teacher login credentials</h2></div><button onClick={() => setCreatedCredential(null)}><X size={18} /></button></div><div className="drawer-grid"><Detail label="Teacher" value={createdCredential.name} /><Detail label="Login ID" value={createdCredential.loginId} /><Detail label="Temporary password" value={createdCredential.temporaryPassword} /></div><p className="students-footnote">Share these credentials privately. The teacher must change the temporary password after first login.</p><div className="modal-footer"><button className="student-secondary-btn" onClick={() => navigator.clipboard?.writeText(`Teacher: ${createdCredential.name}\\nLogin ID: ${createdCredential.loginId}\\nTemporary password: ${createdCredential.temporaryPassword}`)}>Copy credentials</button><button className="student-primary-btn" onClick={() => setCreatedCredential(null)}>Done</button></div></div></div>}

      {modal && (
        <div className="student-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setModal(false)}>
          <div className="student-modal">
            <div className="modal-header">
              <div><span>{editingId ? 'EDIT TEACHER' : 'NEW TEACHER'}</span><h2>{editingId ? 'Update teacher profile' : 'Add teacher'}</h2></div>
              <button onClick={() => !saving && setModal(false)}><X size={19} /></button>
            </div>

            <div className="modal-grid">
              <Field label="Full name" value={form.name} onChange={(value) => setField('name', value)} required />
              
              <Field label="Employee ID" value={form.employeeId} onChange={(value) => setField('employeeId', value)} />
              <Field label="Phone" value={form.phone} onChange={(value) => setField('phone', value)} />
              <SelectField label="Department" value={form.department} onChange={(value) => setField('department', value)} options={departments.map((item) => ({ value: item, label: item }))} />
              <Field label="Designation" value={form.designation} onChange={(value) => setField('designation', value)} />
              <Field label="Qualification" value={form.qualification} onChange={(value) => setField('qualification', value)} />

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
