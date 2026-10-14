import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CreditCard,
  ChevronRight,
  Clock3,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { MODULES } from '../../config/moduleConfig'
import apiClient from '../../api/client'
import './ModulePage.css'
import './ModuleRedesign.css'
import '../../styles/SchoolUX.css'
import '../../styles/SchoolUXFix.css'

const statusClass = (value) => {
  const text = String(value).toLowerCase()
  if (['active', 'paid', 'good', 'processed', 'published', 'open', 'up', 'stable'].some((item) => text.includes(item))) return 'success'
  if (['due', 'attention', 'pending', 'review', 'leave', 'watch', 'partial'].some((item) => text.includes(item))) return 'warning'
  return ''
}

const curriculum = {
  primary: {
    label: 'Primary · Classes 1–4',
    classes: {
      1: ['English', 'Hindi', 'Marathi', 'Mathematics', 'EVS', 'Computer Basics', 'General Knowledge'],
      2: ['English', 'Hindi', 'Marathi', 'Mathematics', 'EVS', 'Computer Basics', 'General Knowledge'],
      3: ['English', 'Hindi', 'Marathi', 'Mathematics', 'EVS', 'Computer Science', 'General Knowledge'],
      4: ['English', 'Hindi', 'Marathi', 'Mathematics', 'EVS', 'Computer Science', 'General Knowledge'],
    },
  },
  middle: {
    label: 'Middle & Secondary · Classes 5–10',
    classes: {
      5: ['English', 'Hindi', 'Marathi', 'Mathematics', 'Science', 'Social Science', 'Computer Science'],
      6: ['English', 'Hindi', 'Marathi', 'Mathematics', 'Science', 'History', 'Geography', 'Computer Science'],
      7: ['English', 'Hindi', 'Marathi', 'Mathematics', 'Science', 'History', 'Geography', 'Computer Science'],
      8: ['English', 'Hindi', 'Marathi', 'Mathematics', 'Science', 'History', 'Geography', 'Computer Science'],
      9: ['English', 'Hindi', 'Marathi', 'Mathematics', 'Science', 'History', 'Geography', 'Computer Science'],
      10: ['English', 'Hindi', 'Marathi', 'Mathematics', 'Science', 'History', 'Geography', 'Computer Science'],
    },
  },
  senior: {
    label: 'Senior Secondary · Classes 11–12',
    classes: {
      11: ['English', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science'],
      12: ['English', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science'],
    },
  },
}

const subjectTeachers = {
  Mathematics: 'Priya Nair',
  Science: 'Rahul Verma',
  English: 'Sneha Kapoor',
  'Social Science': 'Meera Iyer',
  History: 'Meera Iyer',
  Geography: 'Meera Iyer',
  'Computer Science': 'Amit Joshi',
  'Computer Basics': 'Amit Joshi',
  Hindi: 'Neha Patel',
  Marathi: 'Karan Shah',
  Physics: 'Rahul Verma',
  Chemistry: 'Rahul Verma',
  Biology: 'Neha Patel',
  EVS: 'Sneha Kapoor',
}

function DataTable({ columns, rows, className = '' }) {
  return (
    <div className="directory-table-wrap">
      {rows.length ? (
        <table className={`directory-table ${className}`}>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>{rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`}>
              {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cellIndex === 0 ? <strong>{cell}</strong> : cellIndex === row.length - 1 ? <span className={`status-pill ${statusClass(cell)}`}>{cell}</span> : cell}</td>)}
            </tr>
          ))}</tbody>
        </table>
      ) : <div className="module-no-results">No records match the current search.</div>}
    </div>
  )
}

function VariantHeader({ kicker, title, description, chip }) {
  return (
    <div className="variant-header">
      <div><span className="variant-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p></div>
      {chip && <span className="variant-chip">{chip}</span>}
    </div>
  )
}

function ModulePage({ moduleKey }) {
  const { user } = useAuth()
  const [teacherRows, setTeacherRows] = useState([])
  const [teacherAssignments, setTeacherAssignments] = useState([])
  const [teacherEnrollments, setTeacherEnrollments] = useState([])
  const [selectedStudentClass, setSelectedStudentClass] = useState('all')
  const [selectedStudentSection, setSelectedStudentSection] = useState('all')
  const [studentTab, setStudentTab] = useState('all')
  const [teacherLoading, setTeacherLoading] = useState(false)
  const [teacherLoadError, setTeacherLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedCurriculumClass, setSelectedCurriculumClass] = useState('6')
  const [customSubjects, setCustomSubjects] = useState({})
  const [newSubject, setNewSubject] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newType, setNewType] = useState('Elective')
  const [feeTab, setFeeTab] = useState('Overview')
  const [feeData, setFeeData] = useState({ summary: {}, accounts: [], payments: [], available: false })
  const [feeOptions, setFeeOptions] = useState({ academicYears: [], classes: [], sections: [] })
  const [feeStructures, setFeeStructures] = useState([])
  const [feeStudents, setFeeStudents] = useState([])
  const [feeLoading, setFeeLoading] = useState(false)
  const [feeError, setFeeError] = useState('')
  const [feeNotice, setFeeNotice] = useState('')
  const [feeSearch, setFeeSearch] = useState('')
  const [feeStatusFilter, setFeeStatusFilter] = useState('all')
  const [feeFiltersOpen, setFeeFiltersOpen] = useState(false)
  const [feePeriod, setFeePeriod] = useState('this-month')
  const [feeYear, setFeeYear] = useState('')
  const [feeClass, setFeeClass] = useState('')
  const [feeStructureName, setFeeStructureName] = useState('')
  const [feeComponents, setFeeComponents] = useState([{ name: 'Tuition fee', amount: '' }])
  const [feeInstalments, setFeeInstalments] = useState([{ name: 'Instalment 1', amount: '', dueDate: '' }])
  const [feeAssignStudent, setFeeAssignStudent] = useState('')
  const [feeAssignStructure, setFeeAssignStructure] = useState('')
  const [feePaymentAccount, setFeePaymentAccount] = useState('')
  const [feePaymentInstalment, setFeePaymentInstalment] = useState('')
  const [feePaymentAmount, setFeePaymentAmount] = useState('')
  const [feePaymentMethod, setFeePaymentMethod] = useState('cash')
  const [feePaymentReference, setFeePaymentReference] = useState('')
  const [feeBusy, setFeeBusy] = useState(false)
  const configuredModule = MODULES[moduleKey]

  useEffect(() => {
    if (user?.role !== 'teacher') {
      setTeacherRows([])
      setTeacherAssignments([])
      setTeacherEnrollments([])
      setTeacherLoadError('')
      return
    }
    let mounted = true
    setTeacherLoading(true)
    setTeacherLoadError('')
    ;(async () => {
      try {
        const yearResponse = await apiClient.get('/academic/years')
        const years = yearResponse.data.years || []
        const year = years.find((item) => item.isActive) || years[0]
        if (!year) {
          if (mounted) { setTeacherRows([]); setTeacherAssignments([]); setTeacherEnrollments([]) }
          return
        }
        const [assignmentResponse, enrollmentResponse] = await Promise.all([
          apiClient.get('/academic/teacher-assignments', { params: { academicYear: year._id, teacherId: user.id } }),
          apiClient.get('/academic/enrollments', { params: { academicYear: year._id } }),
        ])
        if (!mounted) return
        const assignments = assignmentResponse.data.assignments || []
        const enrollments = enrollmentResponse.data.enrollments || []
        setTeacherAssignments(assignments)
        setTeacherEnrollments(enrollments)
        const sectionIds = new Set(assignments.map((item) => String(item.section?._id || item.section || '')).filter(Boolean))
        if (['students', 'my-students'].includes(moduleKey)) {
          setTeacherRows(enrollments
            .filter((item) => sectionIds.has(String(item.section?._id || item.section || '')))
            .map((item) => [item.student?.name || 'Student record', item.class?.name ? `Class ${item.class.name}` : '—', item.section?.name || '—', 'Enrolled']))
        } else if (moduleKey === 'my-classes') {
          const seen = new Set()
          setTeacherRows(assignments.filter((item) => {
            const key = `${item.class?._id || item.class}:${item.section?._id || item.section}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          }).map((item) => [
            item.class?.name ? `Class ${item.class.name}` : 'Class',
            item.section?.name || '—',
            assignments.filter((assignment) => String(assignment.class?._id || assignment.class) === String(item.class?._id || item.class) && String(assignment.section?._id || assignment.section) === String(item.section?._id || item.section)).map((assignment) => assignment.subject?.name).filter(Boolean).join(', ') || '—',
            'Assigned',
          ]))
        } else {
          setTeacherRows([])
        }
      } catch (err) {
        if (mounted) {
          setTeacherRows([])
          setTeacherAssignments([])
          setTeacherEnrollments([])
          setTeacherLoadError(err.response?.data?.message || 'Unable to load records assigned to your teacher account.')
        }
      } finally {
        if (mounted) setTeacherLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [user?.id, user?.role, moduleKey])

  const module = user?.role === 'teacher' && configuredModule
    ? {
        ...configuredModule,
        stats: [],
        rows: teacherRows,
        columns: ['students', 'my-students'].includes(moduleKey)
          ? ['Student', 'Class', 'Section', 'Enrollment']
          : moduleKey === 'my-classes'
            ? ['Class', 'Section', 'Assigned subjects', 'Status']
            : configuredModule.columns,
        actions: [],
      }
    : configuredModule

  const filteredRows = useMemo(() => {
    if (!module) return []
    const value = query.trim().toLowerCase()
    if (!value) return module.rows
    return module.rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(value)))
  }, [module, query])

  const selectedClassNumber = Number(selectedCurriculumClass)
  const baseSubjects = useMemo(() => {
    for (const group of Object.values(curriculum)) {
      if (group.classes[selectedClassNumber]) return group.classes[selectedClassNumber]
    }
    return []
  }, [selectedClassNumber])

  const selectedSubjects = useMemo(() => [
    ...baseSubjects.map((name) => ({ name, type: ['Computer Basics', 'General Knowledge', 'EVS'].includes(name) ? 'Activity' : 'Core', code: name.split(' ').map((part) => part[0]).join('').slice(0, 4).toUpperCase(), teacher: subjectTeachers[name] || 'Not assigned' })),
    ...(customSubjects[selectedClassNumber] || []),
  ], [baseSubjects, customSubjects, selectedClassNumber])

  if (!module) return <div className="module-empty"><h2>Module not found</h2><p>The requested section is not configured yet.</p></div>

  const Icon = module.icon
  const actions = module.actions || []
  const searchable = !['profile', 'timetable', 'attendance', 'children', 'reports'].includes(moduleKey)

  const addCustomSubject = () => {
    const name = newSubject.trim()
    if (!name) return
    const exists = selectedSubjects.some((subject) => subject.name.toLowerCase() === name.toLowerCase())
    if (exists) return
    const subject = {
      name,
      type: newType,
      code: (newCode.trim() || name.split(' ').map((part) => part[0]).join('')).slice(0, 5).toUpperCase(),
      teacher: 'Not assigned',
      custom: true,
    }
    setCustomSubjects((current) => ({ ...current, [selectedClassNumber]: [...(current[selectedClassNumber] || []), subject] }))
    setNewSubject('')
    setNewCode('')
    setNewType('Elective')
  }

  const renderDirectory = () => (
    <section className="module-variant-panel directory-full-panel">
      <VariantHeader kicker="SCHOOL DIRECTORY" title={`${module.title} register`} description={module.description} chip={`${filteredRows.length} records`} />
      <DataTable columns={module.columns} rows={filteredRows} />
    </section>
  )

  const renderCardBoard = () => (
    <section className="module-variant-panel">
      <VariantHeader kicker="ACADEMIC SETUP" title={`${module.title} library`} description="Browse school structure as focused records instead of one long table." chip={`${filteredRows.length} records`} />
      <div className="card-board">{filteredRows.map((row, index) => (
        <article className="board-card" key={`${row[0]}-${index}`}>
          <div className="board-card-top"><span className="variant-chip">{row[1]}</span><ChevronRight size={15} color="#a52235" /></div>
          <h3>{row[0]}</h3><p>{row.slice(2, -1).filter(Boolean).join(' · ')}</p>
          <div className="board-meta">{row.slice(2).map((cell, cellIndex) => <span key={`${cell}-${cellIndex}`}>{cell}</span>)}</div>
        </article>
      ))}</div>
    </section>
  )

  const renderSubjects = () => (
    <div className="subjects-workspace">
      <section className="subjects-class-selector">
        <div className="subjects-selector-copy"><span className="variant-kicker">CURRICULUM PLANNER</span><h2>Set subjects class by class</h2><p>Choose any class to see its curriculum. Primary, secondary and senior-secondary classes can have different subjects.</p></div>
        <div className="subjects-class-groups">
          {Object.entries(curriculum).map(([groupKey, group]) => (
            <div className="subject-group" key={groupKey}>
              <span>{group.label}</span>
              <div>{Object.keys(group.classes).map((classNumber) => <button type="button" key={classNumber} className={selectedCurriculumClass === classNumber ? 'active' : ''} onClick={() => setSelectedCurriculumClass(classNumber)}>Class {classNumber}</button>)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="subjects-summary-row">
        <div><span>Selected class</span><strong>Class {selectedClassNumber}</strong><small>{selectedSubjects.length} subjects configured</small></div>
        <div><span>Curriculum level</span><strong>{selectedClassNumber <= 4 ? 'Primary' : selectedClassNumber <= 10 ? 'Middle & Secondary' : 'Senior Secondary'}</strong><small>Can be customised independently</small></div>
        <div><span>Custom subjects</span><strong>{(customSubjects[selectedClassNumber] || []).length}</strong><small>Added for this class</small></div>
      </section>

      <section className="subjects-list-panel">
        <VariantHeader kicker={`CLASS ${selectedClassNumber} CURRICULUM`} title={`Subjects for Class ${selectedClassNumber}`} description="Each class has its own subject mapping. A subject added here belongs to this class only." chip={`${selectedSubjects.length} subjects`} />
        <div className="subject-cards-grid">{selectedSubjects.map((subject) => (
          <article className={`subject-card ${subject.custom ? 'custom' : ''}`} key={`${subject.name}-${subject.code}`}>
            <div className="subject-card-top"><span className={`subject-type ${subject.type.toLowerCase().replace(/\s+/g, '-')}`}>{subject.type}</span><span className="subject-code">{subject.code}</span></div>
            <h3>{subject.name}</h3>
            <p>Teacher: <strong>{subject.teacher}</strong></p>
            <div className="subject-card-footer"><span>Class {selectedClassNumber}</span><span>{subject.custom ? 'Custom subject' : 'Standard curriculum'}</span></div>
          </article>
        ))}</div>
      </section>

      <section className="subject-add-panel">
        <div><span className="variant-kicker">ADD TO CLASS {selectedClassNumber}</span><h2>Add a new subject</h2><p>Example: add Political Science only to Class 8 without changing other classes.</p></div>
        <div className="subject-add-form">
          <label><span>Subject name</span><input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} placeholder="e.g. Political Science" /></label>
          <label><span>Code</span><input value={newCode} onChange={(event) => setNewCode(event.target.value)} placeholder="POL" /></label>
          <label><span>Type</span><select value={newType} onChange={(event) => setNewType(event.target.value)}><option>Elective</option><option>Core</option><option>Activity</option></select></label>
          <button type="button" className="primary-button" onClick={addCustomSubject}><Plus size={16} /> Add to Class {selectedClassNumber}</button>
        </div>
      </section>
    </div>
  )

  const renderTimetable = () => (
    <div className="module-variant-shell"><div className="schedule-toolbar"><div><strong>Weekly teaching grid</strong><span> · Main campus · 2026–27</span></div><span><Clock3 size={12} /> No scheduling conflicts</span></div>
      <section className="module-variant-panel" style={{ overflowX: 'auto' }}><div className="schedule-board">
        {module.columns.map((column, index) => <div className="schedule-head" key={column}>{index === 0 ? 'Period' : column}</div>)}
        {module.rows.map((row, rowIndex) => <div className="schedule-row" key={`row-${rowIndex}`}><div className="schedule-time">{row[0]}</div>{row.slice(1).map((cell, cellIndex) => <div className="schedule-cell" key={`${rowIndex}-${cellIndex}`}><strong>{cell}</strong><span>{cellIndex % 2 === 0 ? 'Room 204' : 'Main block'}</span></div>)}</div>)}
      </div></section>
    </div>
  )

  const renderAttendance = () => (
    <section className="module-variant-panel"><VariantHeader kicker="DAILY OPERATIONS" title="Attendance pulse" description="A visual read of class attendance before drilling into the register." chip="Today" />
      <div className="attendance-overview"><div className="attendance-ring-card"><div className="attendance-ring"><div><strong>{module.stats[0][1]}</strong><span>school average</span></div></div></div>
        <div className="attendance-bars">{filteredRows.map((row) => { const value = Number.parseFloat(row[row.length - 1]) || 0; return <div className="attendance-bar-row" key={row[0]}><span>{row[0]}</span><div className="attendance-bar-track"><div className="attendance-bar-fill" style={{ width: `${Math.min(value, 100)}%` }} /></div><strong>{value}%</strong></div> })}</div>
      </div>
    </section>
  )

  useEffect(() => {
    if (moduleKey !== 'fees' || !user) return
    let active = true
    const loadFees = async () => {
      setFeeLoading(true)
      setFeeError('')
      try {
        const summaryPromise = apiClient.get('/fees/summary')
        const finance = ['principal', 'accountant'].includes(user.role)
        const optional = finance ? [
          apiClient.get('/fees/options'),
          apiClient.get('/fees/structures'),
          apiClient.get('/fees/students'),
        ] : []
        const [summary, ...extras] = await Promise.all([summaryPromise, ...optional])
        if (!active) return
        setFeeData(summary.data || { summary: {}, accounts: [], payments: [], available: false })
        if (finance) {
          setFeeOptions(extras[0].data || { academicYears: [], classes: [], sections: [] })
          setFeeStructures(extras[1].data || [])
          setFeeStudents(extras[2].data || [])
          const activeYear = (extras[0].data?.academicYears || []).find((item) => item.isActive) || extras[0].data?.academicYears?.[0]
          if (activeYear) setFeeYear((current) => current || activeYear._id)
        }
      } catch (error) {
        if (active) setFeeError(error.response?.data?.message || 'Finance data could not be loaded. Check the server connection and try again.')
      } finally {
        if (active) setFeeLoading(false)
      }
    }
    loadFees()
    return () => { active = false }
  }, [moduleKey, user?.id, user?.role])

  const refreshFees = async () => {
    const response = await apiClient.get('/fees/summary')
    setFeeData(response.data || { summary: {}, accounts: [], payments: [], available: false })
    if (['principal', 'accountant'].includes(user?.role)) {
      const [options, structures, students] = await Promise.all([
        apiClient.get('/fees/options'), apiClient.get('/fees/structures'), apiClient.get('/fees/students'),
      ])
      setFeeOptions(options.data || { academicYears: [], classes: [], sections: [] })
      setFeeStructures(structures.data || [])
      setFeeStudents(students.data || [])
    }
  }

  const submitFeeStructure = async (event) => {
    event.preventDefault()
    setFeeBusy(true); setFeeError(''); setFeeNotice('')
    try {
      await apiClient.post('/fees/structures', {
        academicYear: feeYear, class: feeClass, name: feeStructureName,
        components: feeComponents.map((item) => ({ name: item.name, amount: Number(item.amount) })),
        instalments: feeInstalments.map((item) => ({ name: item.name, amount: Number(item.amount), dueDate: item.dueDate })),
      })
      setFeeNotice('Fee structure saved. You can now assign it to students in the matching class.')
      setFeeStructureName(''); setFeeComponents([{ name: 'Tuition fee', amount: '' }])
      setFeeInstalments([{ name: 'Instalment 1', amount: '', dueDate: '' }])
      await refreshFees()
      setFeeTab('Fee structure')
    } catch (error) { setFeeError(error.response?.data?.message || 'Could not save the fee structure.') }
    finally { setFeeBusy(false) }
  }

  const assignFeeAccount = async (event) => {
    event.preventDefault()
    setFeeBusy(true); setFeeError(''); setFeeNotice('')
    try {
      await apiClient.post('/fees/accounts/assign', { studentId: feeAssignStudent, feeStructureId: feeAssignStructure })
      setFeeNotice('Fee structure assigned to the student. Instalments are now available in Student dues.')
      await refreshFees()
      setFeeTab('Student dues')
    } catch (error) { setFeeError(error.response?.data?.message || 'Could not assign the fee structure.') }
    finally { setFeeBusy(false) }
  }

  const recordOfflinePayment = async (event) => {
    event.preventDefault()
    setFeeBusy(true); setFeeError(''); setFeeNotice('')
    try {
      await apiClient.post('/fees/payments/offline', {
        accountId: feePaymentAccount, instalmentId: feePaymentInstalment, amount: Number(feePaymentAmount),
        offlineMethod: feePaymentMethod, reference: feePaymentReference,
      })
      setFeeNotice('Payment recorded and sent for verification. It will count as collected after verification.')
      setFeePaymentAmount(''); setFeePaymentReference('')
      await refreshFees()
      setFeeTab('Payments')
    } catch (error) { setFeeError(error.response?.data?.message || 'Could not record this payment.') }
    finally { setFeeBusy(false) }
  }

  const printFeeReceipt = async (paymentId) => {
    const receiptWindow = window.open('', '_blank', 'width=720,height=800')
    if (!receiptWindow) { setFeeError('Allow pop-ups to print or save the receipt.'); return }
    try {
      const response = await apiClient.get(`/fees/payments/${paymentId}/receipt`)
      const receipt = response.data
      const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
      receiptWindow.document.write(`<!doctype html><html><head><title>Fee receipt ${escapeHtml(receipt.receiptNumber)}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:15px Arial,sans-serif;color:#111;padding:36px;max-width:700px;margin:auto}header{border-bottom:2px solid #111;padding-bottom:18px;margin-bottom:24px}h1{font-size:24px;margin:0 0 6px}p{color:#555}.row{display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-bottom:1px solid #ddd}.amount{font-size:24px;font-weight:800;margin-top:20px}.foot{margin-top:30px;color:#666;font-size:12px}@media print{button{display:none}body{padding:0}}</style></head><body><header><h1>School Fee Receipt</h1><p>Payment confirmation</p></header><div class="row"><span>Receipt number</span><strong>${escapeHtml(receipt.receiptNumber)}</strong></div><div class="row"><span>Student</span><strong>${escapeHtml(receipt.student)}</strong></div><div class="row"><span>Payment date</span><strong>${escapeHtml(new Date(receipt.paidAt).toLocaleString('en-IN'))}</strong></div><div class="row"><span>Payment method</span><strong>${escapeHtml(receipt.method)}</strong></div><div class="row"><span>Reference</span><strong>${escapeHtml(receipt.reference || '—')}</strong></div><div class="amount">Amount received: ${escapeHtml(new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(receipt.amount || 0)))}</div><p class="foot">This receipt represents a verified payment record. Keep it for your records.</p><button onclick="window.print()">Print / Save as PDF</button><script>window.onload=()=>window.print()</script></body></html>`)
      receiptWindow.document.close()
    } catch (error) {
      receiptWindow.close()
      setFeeError(error.response?.data?.message || 'Receipt could not be loaded.')
    }
  }

  const verifyOfflinePayment = async (paymentId, action = 'verify') => {
    setFeeBusy(true); setFeeError(''); setFeeNotice('')
    try {
      await apiClient.post(`/fees/payments/${paymentId}/${action}`, action === 'reject' ? { reason: 'Rejected by finance team' } : {})
      setFeeNotice(action === 'verify' ? 'Payment verified and receipt generated.' : 'Payment rejected. It has not been counted as collected.')
      await refreshFees()
    } catch (error) { setFeeError(error.response?.data?.message || 'Could not update the payment status.') }
    finally { setFeeBusy(false) }
  }

  const payOnline = async (account, instalment) => {
    setFeeError(''); setFeeNotice('')
    try {
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://checkout.razorpay.com/v1/checkout.js'
          script.onload = resolve; script.onerror = reject
          document.body.appendChild(script)
        })
      }
      const amount = window.prompt(`Enter amount to pay for ${instalment.name} (remaining ₹${Number(instalment.balance).toFixed(2)}):`, String(instalment.balance))
      if (amount === null) return
      const orderResponse = await apiClient.post('/fees/payments/online/order', { accountId: account._id, instalmentId: instalment._id, amount: Number(amount) })
      const { keyId, order, paymentId } = orderResponse.data
      const checkout = new window.Razorpay({
        key: keyId, order_id: order.id, amount: order.amount, currency: order.currency,
        name: 'School Fees', description: instalment.name, prefill: { name: user?.name },
        handler: async (response) => {
          try {
            await apiClient.post('/fees/payments/online/verify', { paymentId, razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature })
            setFeeNotice('Online payment verified successfully. Your receipt is ready.')
            await refreshFees()
          } catch (error) { setFeeError(error.response?.data?.message || 'Payment verification failed. Please contact the school finance office.') }
        },
        modal: { ondismiss: () => setFeeNotice('Checkout closed. No payment was marked as successful.') },
        theme: { color: '#171717' },
      })
      checkout.open()
    } catch (error) { setFeeError(error.response?.data?.message || 'Online checkout could not start. The school may need to configure its gateway keys.') }
  }

  const renderFees = () => {
    const financeRoles = ['principal', 'accountant'].includes(user?.role)
    const feeTabs = financeRoles ? ['Overview', 'Student dues', 'Payments', 'Fee structure', 'Reports'] : ['My fee account', 'Payment history', 'Receipts']
    const activeTab = financeRoles ? feeTab : feeTab === 'Overview' ? 'My fee account' : feeTab
    const accounts = feeData.accounts || []
    const payments = feeData.payments || []
    const visiblePayments = payments.filter((payment) => {
      const matchesSearch = !feeSearch.trim() || [payment.student?.name, payment.receiptNumber, payment.reference, payment.gatewayOrderId, payment.status, payment.offlineMethod].some((value) => String(value || '').toLowerCase().includes(feeSearch.trim().toLowerCase()))
      if (!matchesSearch) return false
      if (feePeriod === 'all') return true
      const paymentDate = new Date(payment.verifiedAt || payment.createdAt)
      const now = new Date()
      return paymentDate.getFullYear() === now.getFullYear() && paymentDate.getMonth() === now.getMonth()
    })
    const summary = feeData.summary || {}
    const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0))
    const date = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
    const visibleAccounts = accounts.filter((account) => {
      const studentName = account.student?.name || ''
      const className = account.class?.name || ''
      const statusMatch = feeStatusFilter === 'all' || account.instalments?.some((item) => item.status === feeStatusFilter)
      return statusMatch && [studentName, className, account.section?.name, account.feeStructure?.name, account.student?.email].some((value) => String(value || '').toLowerCase().includes(feeSearch.trim().toLowerCase()))
    })
    const activeAccount = accounts.find((item) => String(item._id) === String(feePaymentAccount)) || accounts[0]
    const pendingPayments = payments.filter((payment) => payment.status === 'pending_verification')
    const statusLabel = (value) => ({ pending: 'Pending', partial: 'Partially paid', paid: 'Paid', overdue: 'Overdue', pending_verification: 'Awaiting verification', pending_gateway: 'Payment pending', verified: 'Verified', rejected: 'Rejected', reversed: 'Reversed' }[value] || value || '—')
    const empty = (title, description) => <div className="fee-empty-state"><div className="fee-empty-icon"><CreditCard size={23} /></div><strong>{title}</strong><p>{description}</p></div>
    const accountTable = (rows) => rows.length ? <div className="fee-table-wrap"><table className="fee-table"><thead><tr><th>Student</th><th>Class</th><th>Fee structure</th><th>Assigned</th><th>Paid</th><th>Balance</th><th>Instalments</th></tr></thead><tbody>{rows.map((account) => <tr key={account._id}><td><strong>{account.student?.name || 'Student'}</strong><small>{account.student?.email || ''}</small></td><td>{account.class?.name || '—'} {account.section?.name || ''}</td><td>{account.feeStructure?.name || 'Fee account'}</td><td>{money(account.totalAmount)}</td><td>{money(account.paidAmount)}</td><td><strong>{money(account.balance)}</strong></td><td>{account.instalments?.filter((item) => item.balance > 0).length || 0} due</td></tr>)}</tbody></table></div> : empty('No fee accounts yet', financeRoles ? 'Create a fee structure, then assign it to a student. No sample students or balances are shown.' : 'The school has not assigned a fee structure to your account yet.')
    const paymentTable = (rows) => rows.length ? <div className="fee-table-wrap"><table className="fee-table"><thead><tr><th>Receipt / Reference</th><th>Student</th><th>Date</th><th>Method</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((payment) => <tr key={payment._id}><td><strong>{payment.receiptNumber || payment.gatewayOrderId || 'Awaiting receipt'}</strong><small>{payment.reference || 'No reference'}</small></td><td>{payment.student?.name || 'Student'}</td><td>{date(payment.verifiedAt || payment.createdAt)}</td><td>{payment.method === 'online' ? 'Online' : String(payment.offlineMethod || 'Offline').replace('_', ' ')}</td><td>{money(payment.amount)}</td><td><span className="fee-status">{statusLabel(payment.status)}</span></td><td>{payment.status === 'pending_verification' && financeRoles ? <div className="fee-row-actions"><button type="button" disabled={feeBusy} onClick={() => verifyOfflinePayment(payment._id, 'verify')}>Verify</button><button type="button" className="fee-reject" disabled={feeBusy} onClick={() => verifyOfflinePayment(payment._id, 'reject')}>Reject</button></div> : payment.status === 'verified' ? <button type="button" onClick={() => printFeeReceipt(payment._id)}>Print receipt</button> : '—'}</td></tr>)}</tbody></table></div> : empty('No payment records', 'Recorded payments will appear here. Only verified payments count towards collected fees.')
    return <div className="fees-workspace fees-stage-two">
      <section className="fee-workspace-intro"><div><span className="variant-kicker">{financeRoles ? 'SCHOOL FINANCE' : 'FAMILY FEE PORTAL'}</span><h2>{financeRoles ? 'Fees, instalments and payment records' : 'Your fee account and instalments'}</h2><p>{financeRoles ? 'Configure class-wise instalments, assign fees, verify payments and issue receipts.' : 'Review each instalment, due date, remaining balance and confirmed payment.'}</p></div><div className="fee-data-state"><span className="fee-state-dot" /> {feeLoading ? 'Loading finance data…' : feeError ? 'Connection needs attention' : 'Live finance records'}</div></section>
      {feeError && <div className="fee-feedback fee-feedback-error" role="alert">{feeError}<button type="button" onClick={() => setFeeError('')}>Dismiss</button></div>}
      {feeNotice && <div className="fee-feedback" role="status">{feeNotice}<button type="button" onClick={() => setFeeNotice('')}>Dismiss</button></div>}
      {financeRoles && <section className="fee-pulse-grid"><article><span>Fees assigned</span><strong>{feeData.available ? money(summary.feesAssigned) : '—'}</strong><small>Assigned fee accounts</small></article><article><span>Collected</span><strong>{feeData.available ? money(summary.collected) : '—'}</strong><small>Verified payments only</small></article><article><span>Outstanding</span><strong>{feeData.available ? money(summary.outstanding) : '—'}</strong><small>Remaining account balances</small></article><article><span>Overdue accounts</span><strong>{feeData.available ? Number(summary.overdueAccounts || 0) : '—'}</strong><small>Past-due instalments with balance</small></article></section>}
      <nav className="fee-workspace-tabs" aria-label="Fees and payments sections">{feeTabs.map((tab) => <button type="button" key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setFeeTab(tab === 'My fee account' ? 'Overview' : tab)}>{tab}</button>)}</nav>
      {activeTab === 'Overview' && financeRoles && <section className="fee-overview-grid"><article className="fee-overview-card fee-overview-primary"><span className="variant-kicker">COLLECTION WORKFLOW</span><h3>From fee setup to receipt</h3><p>Each instalment has a due date. Balances change only after a payment is verified.</p><div className="fee-workflow-steps"><button type="button" onClick={() => setFeeTab('Fee structure')}><span>01</span><strong>Fee structure</strong><small>Configure components and instalments</small></button><button type="button" onClick={() => setFeeTab('Student dues')}><span>02</span><strong>Student dues</strong><small>Assign fee plans to enrolled students</small></button><button type="button" onClick={() => setFeeTab('Payments')}><span>03</span><strong>Payments</strong><small>Record and verify offline payments</small></button><button type="button" onClick={() => setFeeTab('Reports')}><span>04</span><strong>Reports & receipts</strong><small>Review balances and confirmed receipts</small></button></div></article><article className="fee-overview-card"><span className="variant-kicker">QUICK ACCESS</span><h3>Finance registers</h3><p>Open a register to manage real records.</p><div className="fee-quick-links">{['Student dues', 'Payments', 'Fee structure', 'Reports'].map((tab) => <button type="button" key={tab} onClick={() => setFeeTab(tab)}><span>{tab}</span><strong>›</strong></button>)}</div></article></section>}
      {activeTab === 'Fee structure' && financeRoles && <section className="module-variant-panel fee-ledger-panel"><VariantHeader kicker="FEE CONFIGURATION" title="Create a class fee plan" description="The sum of all fee components must equal the sum of instalments." chip={`${feeStructures.length} structures`} /><form className="fee-form" onSubmit={submitFeeStructure}><div className="fee-form-grid"><label>Academic year<select required value={feeYear} onChange={(event) => setFeeYear(event.target.value)}><option value="">Select academic year</option>{feeOptions.academicYears.map((year) => <option key={year._id} value={year._id}>{year.name}{year.isActive ? ' · Active' : ''}</option>)}</select></label><label>Class<select required value={feeClass} onChange={(event) => setFeeClass(event.target.value)}><option value="">Select class</option>{feeOptions.classes.filter((item) => !feeYear || String(item.academicYear?._id || item.academicYear) === String(feeYear)).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label className="fee-form-wide">Fee plan name<input required value={feeStructureName} onChange={(event) => setFeeStructureName(event.target.value)} placeholder="e.g. Standard annual fee" /></label></div><div className="fee-form-section"><div><h3>Fee components</h3><p>Enter the real amounts configured by your school.</p></div><button type="button" className="fee-outline-button" onClick={() => setFeeComponents((items) => [...items, { name: '', amount: '' }])}>+ Add component</button></div>{feeComponents.map((item, index) => <div className="fee-repeat-row" key={index}><input aria-label="Component name" required placeholder="Component name" value={item.name} onChange={(event) => setFeeComponents((items) => items.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} /><input aria-label="Component amount" required type="number" min="0.01" step="0.01" placeholder="Amount ₹" value={item.amount} onChange={(event) => setFeeComponents((items) => items.map((row, i) => i === index ? { ...row, amount: event.target.value } : row))} />{feeComponents.length > 1 && <button type="button" aria-label="Remove component" onClick={() => setFeeComponents((items) => items.filter((_, i) => i !== index))}>Remove</button>}</div>)}<div className="fee-form-section"><div><h3>Instalment schedule</h3><p>Set a due date and amount for every instalment.</p></div><button type="button" className="fee-outline-button" onClick={() => setFeeInstalments((items) => [...items, { name: `Instalment ${items.length + 1}`, amount: '', dueDate: '' }])}>+ Add instalment</button></div>{feeInstalments.map((item, index) => <div className="fee-repeat-row fee-instalment-row" key={index}><input aria-label="Instalment name" required placeholder="Instalment name" value={item.name} onChange={(event) => setFeeInstalments((items) => items.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} /><input aria-label="Instalment amount" required type="number" min="0.01" step="0.01" placeholder="Amount ₹" value={item.amount} onChange={(event) => setFeeInstalments((items) => items.map((row, i) => i === index ? { ...row, amount: event.target.value } : row))} /><input aria-label="Instalment due date" required type="date" value={item.dueDate} onChange={(event) => setFeeInstalments((items) => items.map((row, i) => i === index ? { ...row, dueDate: event.target.value } : row))} />{feeInstalments.length > 1 && <button type="button" aria-label="Remove instalment" onClick={() => setFeeInstalments((items) => items.filter((_, i) => i !== index))}>Remove</button>}</div>)}<div className="fee-total-line"><span>Components total: <strong>{money(feeComponents.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></span><span>Instalments total: <strong>{money(feeInstalments.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></span></div><button className="fee-primary-button" disabled={feeBusy}>{feeBusy ? 'Saving…' : 'Save fee structure'}</button></form><div className="fee-existing-list"><h3>Existing fee structures</h3>{feeStructures.length ? feeStructures.map((item) => <div className="fee-existing-row" key={item._id}><div><strong>{item.name}</strong><small>{item.class?.name || 'Class'} · {item.academicYear?.name || 'Academic year'} · {item.instalments?.length || 0} instalments</small></div><strong>{money(item.totalAmount)}</strong></div>) : <p>No fee structures configured yet.</p>}</div></section>}
      {activeTab === 'Student dues' && financeRoles && <section className="module-variant-panel fee-ledger-panel"><VariantHeader kicker="STUDENT DUES" title="Assign fees and track instalments" description="Fee structures can only be assigned to a student in the matching class and academic year." chip={`${visibleAccounts.length} accounts`} /><form className="fee-inline-form" onSubmit={assignFeeAccount}><label>Student<select required value={feeAssignStudent} onChange={(event) => setFeeAssignStudent(event.target.value)}><option value="">Select enrolled student</option>{feeStudents.filter((student) => { const st = feeStructures.find((item) => String(item._id) === String(feeAssignStructure)); return !st || (String(student.classId) === String(st.class?._id || st.class) && String(student.academicYearId) === String(st.academicYear?._id || st.academicYear)) }).map((student) => <option key={student.studentId} value={student.studentId}>{student.name} · {student.className}-{student.sectionName}</option>)}</select></label><label>Fee structure<select required value={feeAssignStructure} onChange={(event) => setFeeAssignStructure(event.target.value)}><option value="">Select fee structure</option>{feeStructures.map((item) => <option key={item._id} value={item._id}>{item.name} · Class {item.class?.name || '—'} · {money(item.totalAmount)}</option>)}</select></label><button className="fee-primary-button" disabled={feeBusy}>{feeBusy ? 'Assigning…' : 'Assign fee'}</button></form><div className="fee-filter-row"><label><Search size={17} /><input value={feeSearch} onChange={(event) => setFeeSearch(event.target.value)} placeholder="Search student, class or fee plan" /></label><select value={feeStatusFilter} onChange={(event) => setFeeStatusFilter(event.target.value)}><option value="all">All instalment statuses</option><option value="pending">Pending</option><option value="partial">Partially paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option></select></div>{accountTable(visibleAccounts)}{visibleAccounts.length > 0 && <div className="fee-account-details"><h3>Instalment ledger</h3>{visibleAccounts.map((account) => <article key={account._id}><div><strong>{account.student?.name || 'Student'} · {account.class?.name || '—'}-{account.section?.name || '—'}</strong><span>{account.feeStructure?.name || 'Fee account'} · Balance {money(account.balance)}</span></div><div className="fee-instalment-list">{account.instalments.map((item) => <div key={item._id}><span><strong>{item.name}</strong><small>Due {date(item.dueDate)} · {statusLabel(item.status)}</small></span><span>{money(item.paid)} paid <strong>{money(item.balance)} due</strong></span></div>)}</div></article>)}</div>}</section>}
      {activeTab === 'Payments' && financeRoles && <section className="module-variant-panel fee-ledger-panel"><VariantHeader kicker="PAYMENT REGISTER" title="Record offline payment" description="Offline payments remain pending until an authorized finance user verifies them." chip={`${pendingPayments.length} awaiting verification`} /><form className="fee-inline-form fee-payment-form" onSubmit={recordOfflinePayment}><label>Student fee account<select required value={feePaymentAccount} onChange={(event) => { setFeePaymentAccount(event.target.value); setFeePaymentInstalment('') }}><option value="">Select fee account</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.student?.name || 'Student'} · {account.class?.name || '—'} · balance {money(account.balance)}</option>)}</select></label><label>Instalment<select required value={feePaymentInstalment} onChange={(event) => setFeePaymentInstalment(event.target.value)}><option value="">Select instalment</option>{(activeAccount?.instalments || []).filter((item) => item.balance > 0).map((item) => <option key={item._id} value={item._id}>{item.name} · remaining {money(item.balance)}</option>)}</select></label><label>Amount received<input required type="number" min="0.01" step="0.01" value={feePaymentAmount} onChange={(event) => setFeePaymentAmount(event.target.value)} placeholder="Amount ₹" /></label><label>Method<select value={feePaymentMethod} onChange={(event) => setFeePaymentMethod(event.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option></select></label><label>Reference / transaction ID<input value={feePaymentReference} onChange={(event) => setFeePaymentReference(event.target.value)} placeholder="Optional reference" /></label><button className="fee-primary-button" disabled={feeBusy}>{feeBusy ? 'Recording…' : 'Record payment'}</button></form><h3 className="fee-subheading">Transactions</h3>{paymentTable(visiblePayments)}</section>}
      {(activeTab === 'My fee account' || activeTab === 'Overview') && !financeRoles && <section className="module-variant-panel fee-ledger-panel"><VariantHeader kicker="MY FEE ACCOUNT" title="Your assigned fee instalments" description="Pay online through the school's configured payment gateway or review recorded payments." chip={`${accounts.length} fee accounts`} />{accounts.length ? accounts.map((account) => <article className="fee-family-account" key={account._id}><div className="fee-family-account-head"><div><h3>{account.feeStructure?.name || 'Fee account'}</h3><p>{account.class?.name || 'Class'} · {account.section?.name || 'Section'}</p></div><div><small>Remaining balance</small><strong>{money(account.balance)}</strong></div></div><div className="fee-instalment-list">{account.instalments.map((item) => <div key={item._id}><span><strong>{item.name}</strong><small>Due {date(item.dueDate)} · {statusLabel(item.status)}</small></span><span>{money(item.paid)} paid <strong>{money(item.balance)} due</strong>{item.balance > 0 && <button type="button" className="fee-outline-button" onClick={() => payOnline(account, item)}>Pay online</button>}</span></div>)}</div></article>) : empty('Your fee account is not available yet', 'The school has not assigned fees to your linked student account. Contact the school finance office if you think this is incorrect.')}</section>}
      {(activeTab === 'Payment history' || activeTab === 'Receipts' || activeTab === 'Payments' && !financeRoles) && <section className="module-variant-panel fee-ledger-panel"><VariantHeader kicker={activeTab === 'Receipts' ? 'RECEIPT REGISTER' : 'PAYMENT HISTORY'} title={activeTab === 'Receipts' ? 'Confirmed receipts' : 'Payments linked to your account'} description="Only confirmed transactions have receipts and affect your balance." />{paymentTable(activeTab === 'Receipts' ? visiblePayments.filter((item) => item.status === 'verified') : visiblePayments)}</section>}
      {activeTab === 'Reports' && financeRoles && <section className="module-variant-panel fee-ledger-panel"><VariantHeader kicker="FINANCE REPORTS" title="Collection and dues report" description="Export the current live account register as CSV for reconciliation." /><div className="fee-report-summary"><div><span>Fees assigned</span><strong>{money(summary.feesAssigned)}</strong></div><div><span>Collected</span><strong>{money(summary.collected)}</strong></div><div><span>Outstanding</span><strong>{money(summary.outstanding)}</strong></div><div><span>Overdue accounts</span><strong>{summary.overdueAccounts ?? '—'}</strong></div></div><button type="button" className="fee-primary-button" onClick={() => { const lines = [['Student','Class','Fee structure','Assigned','Paid','Balance','Instalment','Due date','Status']]; visibleAccounts.forEach((account) => account.instalments.forEach((item) => lines.push([account.student?.name || '', account.class?.name || '', account.feeStructure?.name || '', item.amount, item.paid, item.balance, item.name, date(item.dueDate), item.status]))); const csv = lines.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"','""')}"`).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); const link = document.createElement('a'); link.href = url; link.download = 'school-fee-report.csv'; link.click(); URL.revokeObjectURL(url) }}>Export CSV report</button></section>}
      {feeLoading && <p className="fee-loading-note">Loading the latest finance records…</p>}
      {!feeLoading && !feeError && !feeData.available && empty('Finance data unavailable', 'No live finance data was returned. Check the server and database connection; no sample values are being displayed.')}
    </div>
  }

  const renderFinance = () => (
    <section className="module-variant-panel"><VariantHeader kicker="FINANCE REGISTER" title={`${module.title} overview`} description={module.description} chip={`${filteredRows.length} records`} /><DataTable columns={module.columns} rows={filteredRows} className="finance-table" /></section>
  )

  const renderReports = () => (
    <div className="analytics-grid">{module.stats.slice(0, 3).map(([label, value, trend]) => <article className="analytics-card" key={label}><span className="variant-kicker">METRIC</span><h3>{label}</h3><strong>{value}</strong><small>{trend || 'Current period'}</small></article>)}
      <article className="analytics-card wide"><span className="variant-kicker">REPORT CENTER</span><h3>Available reports</h3><div className="report-list">{filteredRows.map((row, index) => <div className="report-row" key={`${row[0]}-${index}`}><strong>{row[0]}</strong><span>{row[1]} · {row[2]}</span><button type="button">Open</button></div>)}</div></article>
    </div>
  )

  const renderAssessment = () => (
    <div className="assessment-board"><section className="assessment-column"><span className="variant-kicker">WORKFLOW</span><h3>{module.title}</h3><div className="assessment-list">{filteredRows.slice(0, 4).map((row, index) => <article className="assessment-item" key={`${row[0]}-${index}`}><strong>{row[0]}</strong><span>{row.slice(1, -1).join(' · ')}</span><span className="variant-chip">{row[row.length - 1]}</span></article>)}</div></section>
      <section className="assessment-column"><span className="variant-kicker">QUICK ACTIONS</span><h3>Next steps</h3><div className="assessment-list">{actions.map((action, index) => <article className="assessment-item" key={action}><strong>{action}</strong><span>{index === 0 ? 'Start the next workflow from here.' : 'Open this section to continue managing school work.'}</span><span className="variant-chip">Ready</span></article>)}</div></section>
    </div>
  )

  const renderChildren = () => (
    <section className="module-variant-panel"><VariantHeader kicker="FAMILY PORTAL" title="Children at a glance" description="Each child gets a focused snapshot instead of a generic school table." chip="2 children" /><div className="child-board">{filteredRows.map((row) => <article className="child-card" key={row[0]}><div className="child-card-head"><div className="child-avatar">{row[0].split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><h3>{row[0]}</h3><p>{row[1]} · {row[4]}</p></div></div><div className="child-metrics"><div><span>Attendance</span><strong>{row[2]}</strong></div><div><span>Average</span><strong>{row[3]}</strong></div><div><span>Fee</span><strong>{row[4]}</strong></div></div></article>)}</div></section>
  )

  const renderProfile = () => (
    <section className="module-variant-panel"><VariantHeader kicker="ACCOUNT DETAILS" title="Personal information" description="Keep identity, contact and security details in one calm workspace." /><div className="profile-fields">{filteredRows.map((row) => <div className="profile-field" key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><small>{row[2]}</small></div>)}</div></section>
  )

  const renderCommunication = () => (
    <section className="module-variant-panel"><VariantHeader kicker="SCHOOL LIFE" title={module.title} description={module.description} chip="Live register" /><div className="communication-list">{filteredRows.map((row, index) => <article className="communication-item" key={`${row[0]}-${index}`}><div className="communication-icon"><FileText size={17} /></div><div><strong>{row[0]}</strong><span>{row.slice(1, -1).join(' · ')}</span></div><span className={`status-pill ${statusClass(row[row.length - 1])}`}>{row[row.length - 1]}</span></article>)}</div></section>
  )

  const renderDefault = () => <section className="module-variant-panel"><VariantHeader kicker="LIVE REGISTER" title={`${module.title} overview`} description={`${filteredRows.length} records shown`} /><DataTable columns={module.columns} rows={filteredRows} /></section>

  const renderBody = () => {
    if (user?.role === 'teacher') {
      if (teacherLoading) return <section className="module-variant-panel teacher-record-state"><strong>Loading your assigned records…</strong><span>Only records connected to your teacher account are shown.</span></section>
      if (teacherLoadError) return <section className="module-variant-panel teacher-record-state"><strong>Records could not be loaded</strong><span>{teacherLoadError}</span><button type="button" className="secondary-button" onClick={() => setQuery((value) => value)}>Retry after refreshing this page</button></section>
      if (moduleKey === 'my-classes') {
        return (
          <section className="teacher-classes-workspace">
            <div className="teacher-classes-heading">
              <div><span className="teacher-classes-eyebrow">YOUR TEACHING LOAD</span><h2>Classes you teach</h2><p>Only classes and sections assigned to your account are shown here.</p></div>
              <span className="teacher-classes-count">{filteredRows.length} {filteredRows.length === 1 ? 'class' : 'classes'}</span>
            </div>
            {filteredRows.length ? (
              <div className="teacher-classes-grid">
                {filteredRows.map((row, index) => {
                  const subjects = String(row[2] || '').split(',').map((subject) => subject.trim()).filter(Boolean)
                  return (
                    <article className="teacher-class-card" key={`${row[0]}-${row[1]}-${index}`}>
                      <div className="teacher-class-card-top">
                        <span className="teacher-class-symbol"><BookOpen size={21} /></span>
                        <span className="teacher-class-status">{row[3] || 'Assigned'}</span>
                      </div>
                      <div className="teacher-class-name"><span>CLASS</span><h3>{row[0]}</h3><p>Section {row[1]}</p></div>
                      <div className="teacher-class-subjects">
                        <span>ASSIGNED SUBJECTS</span>
                        <div>{subjects.length ? subjects.map((subject) => <span className="teacher-subject-chip" key={subject}>{subject}</span>) : <span className="teacher-class-empty">No subject listed</span>}</div>
                      </div>
                      <div className="teacher-class-card-footer"><span><Users size={15} /> Your assigned section</span><ChevronRight size={18} /></div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="teacher-classes-empty"><BookOpen size={26} /><strong>No classes assigned yet</strong><p>Your principal can assign classes, sections and subjects to your account.</p></div>
            )}
          </section>
        )
      }
      if (moduleKey === 'my-students' && user?.role === 'teacher') {
        const sectionKey = (item) => String(item.section?._id || item.section || '')
        const classKey = (item) => String(item.class?._id || item.class || '')
        const assignedPairs = new Map()
        teacherAssignments.forEach((assignment) => {
          const classId = classKey(assignment)
          const sectionId = sectionKey(assignment)
          if (!classId || !sectionId) return
          const key = `${classId}::${sectionId}`
          if (!assignedPairs.has(key)) assignedPairs.set(key, {
            key, classId, sectionId,
            className: assignment.class?.name ? `Class ${assignment.class.name}` : 'Assigned class',
            sectionName: assignment.section?.name || 'Section',
          })
        })
        const assignedSections = [...assignedPairs.values()]
        const assignedClassOptions = [...new Map(assignedSections.map((item) => [item.classId, { id: item.classId, label: item.className }])).values()]
        const availableSections = assignedSections.filter((item) => selectedStudentClass === 'all' || item.classId === selectedStudentClass)
        const visibleSections = availableSections.filter((item) => selectedStudentSection === 'all' || item.sectionId === selectedStudentSection)
        const eligibleEnrollments = teacherEnrollments.filter((enrollment) => assignedPairs.has(`${classKey(enrollment)}::${sectionKey(enrollment)}`))
        const studentRecords = eligibleEnrollments.map((enrollment) => {
          const pair = assignedPairs.get(`${classKey(enrollment)}::${sectionKey(enrollment)}`)
          const student = enrollment.student || {}
          return {
            id: String(enrollment._id || student._id || `${student.name}-${pair?.key}`),
            name: student.name || student.fullName || 'Student record',
            roll: enrollment.rollNumber || enrollment.rollNo || student.rollNumber || student.rollNo || '—',
            classId: pair?.classId || classKey(enrollment),
            className: pair?.className || 'Assigned class',
            sectionId: pair?.sectionId || sectionKey(enrollment),
            sectionName: pair?.sectionName || 'Section',
            status: enrollment.status || 'Enrolled',
          }
        }).filter((student) => {
          const matchesClass = selectedStudentClass === 'all' || student.classId === selectedStudentClass
          const matchesSection = selectedStudentSection === 'all' || student.sectionId === selectedStudentSection
          const matchesTab = studentTab === 'all' || `${student.classId}::${student.sectionId}` === studentTab
          const matchesQuery = !query.trim() || [student.name, student.roll, student.className, student.sectionName].some((value) => String(value).toLowerCase().includes(query.trim().toLowerCase()))
          return matchesClass && matchesSection && matchesTab && matchesQuery
        })
        const selectedClassLabel = assignedClassOptions.find((item) => item.id === selectedStudentClass)?.label
        return (
          <section className="my-students-workspace">
            <div className="my-students-metrics">
              <article><span className="my-students-metric-icon"><BookOpen size={20} /></span><div><strong>{assignedClassOptions.length}</strong><span>Assigned classes</span></div></article>
              <article><span className="my-students-metric-icon"><Users size={20} /></span><div><strong>{assignedSections.length}</strong><span>Assigned sections</span></div></article>
              <article><span className="my-students-metric-icon"><Users size={20} /></span><div><strong>{studentRecords.length}</strong><span>Students in assigned sections</span></div></article>
              <article><span className="my-students-metric-icon"><BookOpen size={20} /></span><div><strong>{visibleSections.length}</strong><span>Available sections</span></div></article>
            </div>
            <div className="my-students-filters">
              <label className="my-students-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student name or roll number..." /></label>
              <label><span>CLASS</span><select value={selectedStudentClass} onChange={(event) => { setSelectedStudentClass(event.target.value); setSelectedStudentSection('all'); setStudentTab('all') }}><option value="all">All assigned classes</option>{assignedClassOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
              <label><span>SECTION</span><select value={selectedStudentSection} onChange={(event) => { setSelectedStudentSection(event.target.value); setStudentTab('all') }}><option value="all">All assigned sections</option>{availableSections.map((item) => <option value={item.sectionId} key={item.sectionId}>{item.sectionName}</option>)}</select></label>
            </div>
            <div className="my-students-register">
              <header className="my-students-register-head"><div><span className="my-students-eyebrow">STUDENT LIST</span><h2>{selectedClassLabel ? `${selectedClassLabel} students` : 'Students in my assigned sections'}</h2><p>Choose a class and section to view only the students assigned to your teaching load.</p></div><span className="my-students-record-count">{studentRecords.length} {studentRecords.length === 1 ? 'record' : 'records'}</span></header>
              {teacherLoading ? <div className="my-students-empty">Loading your assigned students…</div> : teacherLoadError ? <div className="my-students-empty">{teacherLoadError}</div> : studentRecords.length ? (
                <div className="my-students-table-wrap"><table className="my-students-table"><thead><tr><th>STUDENT NAME</th><th>CLASS</th><th>SECTION</th><th>ENROLLMENT</th></tr></thead><tbody>{studentRecords.map((student) => <tr key={student.id}><td><strong>{student.name}</strong></td><td>{student.className}</td><td>{student.sectionName}</td><td><span className="my-students-status">{student.status}</span></td></tr>)}</tbody></table></div>
              ) : <div className="my-students-empty"><Users size={27} /><strong>No students found</strong><p>There are no enrolled students in this assigned class and section, or your search has no matches.</p></div>}
              <footer className="my-students-register-foot">Showing {studentRecords.length} {studentRecords.length === 1 ? 'student' : 'students'} from your assigned class sections.</footer>
            </div>
          </section>
        )
      }
      if (['students', 'my-students'].includes(moduleKey)) {
        return <section className="module-variant-panel directory-full-panel"><VariantHeader kicker="MY TEACHING" title="Students in my assigned sections" description="This list is limited to classes and sections assigned to your teacher account." chip={`${filteredRows.length} records`} /><DataTable columns={module.columns} rows={filteredRows} /></section>
      }
      return <section className="module-variant-panel teacher-record-state"><strong>No live records available here yet</strong><span>Demo records are hidden for teacher accounts. This section will show information once its school workflow is connected.</span></section>
    }
    if (moduleKey === 'timetable') return renderTimetable()
    if (moduleKey === 'attendance') return renderAttendance()
    if (moduleKey === 'fees') return renderFees()
    if (moduleKey === 'payroll') return renderFinance()
    if (moduleKey === 'reports') return renderReports()
    if (['assignments', 'exams', 'results'].includes(moduleKey)) return renderAssessment()
    if (moduleKey === 'children') return renderChildren()
    if (moduleKey === 'profile') return renderProfile()
    if (['notices', 'events'].includes(moduleKey)) return renderCommunication()
    if (moduleKey === 'subjects') return renderSubjects()
    if (moduleKey === 'classes') return renderCardBoard()
    if (['students', 'teachers', 'my-classes', 'my-students'].includes(moduleKey)) return renderDirectory()
    return renderDefault()
  }

  return (
    <div className={`module-page ${user?.role === 'teacher' ? 'teacher-module-page' : ''} module-${moduleKey.replace(/[^a-z0-9]+/gi, '-')}`}>
      <div className="module-heading"><div className="module-heading-copy"><div className="eyebrow">{module.eyebrow}</div><div className="module-title-line"><div className="module-title-icon"><Icon size={22} /></div><div><h1>{module.title}</h1><p>{module.description}</p></div></div></div>
        <div className="module-heading-actions">{user?.role !== 'teacher' && <button className="icon-button" type="button" aria-label="More options"><MoreHorizontal size={18} /></button>}{actions[0] && <button className="primary-button module-add" type="button"><Plus size={16} />{actions[0]}</button>}</div>
      </div>
      <div className="module-stats">{module.stats.map(([label, value, trend]) => <div className="module-stat" key={label}><span>{label}</span><strong>{value}</strong>{trend && <small className={trend.startsWith('-') ? 'negative' : 'positive'}>{trend.startsWith('-') ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{trend.replace('-', '')}</small>}</div>)}</div>
      {searchable && <div className="module-toolbar"><div className="module-search"><Search size={17} /><input value={moduleKey === 'fees' ? feeSearch : query} onChange={(event) => moduleKey === 'fees' ? setFeeSearch(event.target.value) : setQuery(event.target.value)} placeholder={moduleKey === 'fees' ? 'Search student, class, fee plan or payment...' : `Search ${module.title.toLowerCase()}...`} /></div><div className="toolbar-actions"><button type="button" className="secondary-button" onClick={() => moduleKey === 'fees' ? setFeeFiltersOpen((open) => !open) : undefined}><SlidersHorizontal size={15} /> Filters</button><button type="button" className="secondary-button" onClick={() => moduleKey === 'fees' ? setFeePeriod((period) => period === 'this-month' ? 'all' : 'this-month') : undefined}>{moduleKey === 'fees' && feePeriod === 'all' ? 'All time' : 'This month'}</button></div></div>}{moduleKey === 'fees' && feeFiltersOpen && <div className="fee-global-filter-panel"><label>Instalment status<select value={feeStatusFilter} onChange={(event) => setFeeStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="partial">Partially paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option></select></label><span>{feePeriod === 'this-month' ? 'Payment register is limited to the current month.' : 'Showing payment records across all dates.'}</span><button type="button" onClick={() => { setFeeStatusFilter('all'); setFeeSearch(''); setFeePeriod('this-month') }}>Reset filters</button></div>}
      {renderBody()}
    </div>
  )
}

export default ModulePage
