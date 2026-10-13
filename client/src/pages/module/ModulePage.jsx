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

  const renderFees = () => {
    const financeRoles = ['principal', 'accountant'].includes(user?.role)
    const feeTabs = financeRoles
      ? ['Overview', 'Student dues', 'Payments', 'Fee structure', 'Reports']
      : ['My fee account', 'Payment history', 'Receipts']
    const activeTab = financeRoles ? feeTab : feeTab === 'Overview' ? 'My fee account' : feeTab
    const emptyCopy = {
      Overview: ['Finance overview is not connected yet', 'Once fee records and payment transactions are connected, this area will show verified collections, outstanding balances and overdue accounts.'],
      'Student dues': ['No fee accounts to display', 'Student fee assignments and balances will appear here after the fee ledger is connected. No sample students or balances are shown.'],
      Payments: ['No payment transactions yet', 'Verified payments will appear here with date, student, method, reference and receipt status. Unconfirmed payments will not count as collected.'],
      'Fee structure': ['Fee structure is not configured', 'The school will be able to define fees by academic year and class, including components, installments and due dates after the setup workflow is connected.'],
      Reports: ['Finance reports are not available yet', 'Collection summaries, class-wise dues and overdue reports will be available once real fee and payment records exist.'],
      'My fee account': ['Your fee account is not connected yet', 'When the school publishes your fee details, you will be able to review the amount assigned, payments received and remaining balance here.'],
      'Payment history': ['No payment history available', 'Payments linked to your account will appear here after the school payment ledger is connected.'],
      Receipts: ['No receipts available', 'Receipts will appear here when a payment has been recorded and confirmed by the school.'],
    }
    const copy = emptyCopy[activeTab] || emptyCopy.Overview
    return (
      <div className="fees-workspace fees-stage-one">
        <section className="fee-workspace-intro">
          <div>
            <span className="variant-kicker">{financeRoles ? 'SCHOOL FINANCE' : 'FAMILY FEE PORTAL'}</span>
            <h2>{financeRoles ? 'Fees, balances and payment records' : 'Fee account and payment records'}</h2>
            <p>{financeRoles
              ? 'A single workspace for fee structures, student dues, verified payments and receipts.'
              : 'Review fee details and confirmed payments shared by your school.'}</p>
          </div>
          <div className="fee-data-state"><span className="fee-state-dot" /> <span>Live finance data not connected</span></div>
        </section>

        {financeRoles && (
          <section className="fee-pulse-grid fee-unavailable-metrics" aria-label="Finance metrics">
            {[
              ['Fees assigned', '—', 'Available after fee setup'],
              ['Collected', '—', 'Verified payments only'],
              ['Outstanding', '—', 'Calculated from live balances'],
              ['Overdue accounts', '—', 'Based on configured due dates'],
            ].map(([label, value, hint]) => (
              <article key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>
            ))}
          </section>
        )}

        <nav className="fee-workspace-tabs" aria-label="Fees and payments sections">
          {feeTabs.map((tab) => (
            <button type="button" key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setFeeTab(tab === 'My fee account' ? 'Overview' : tab)}>{tab}</button>
          ))}
        </nav>

        {activeTab === 'Overview' && financeRoles && (
          <section className="fee-overview-grid">
            <article className="fee-overview-card fee-overview-primary">
              <span className="variant-kicker">COLLECTION WORKFLOW</span>
              <h3>From fee assignment to receipt</h3>
              <p>Keep each step traceable. A payment should update a balance only after it is recorded and verified.</p>
              <div className="fee-workflow-steps">
                <div><span>01</span><strong>Fee structure</strong><small>Set class-wise components and due dates</small></div>
                <div><span>02</span><strong>Student dues</strong><small>Assign the applicable fee to each student</small></div>
                <div><span>03</span><strong>Record payment</strong><small>Capture amount, method and reference</small></div>
                <div><span>04</span><strong>Receipt & balance</strong><small>Confirm payment and recalculate dues</small></div>
              </div>
            </article>
            <article className="fee-overview-card">
              <span className="variant-kicker">QUICK ACCESS</span>
              <h3>Open a finance register</h3>
              <p>Choose a section to review its structure. Records will appear when the backend workflow is ready.</p>
              <div className="fee-quick-links">
                {['Student dues', 'Payments', 'Fee structure', 'Reports'].map((tab) => <button type="button" key={tab} onClick={() => setFeeTab(tab)}><span>{tab}</span><strong>›</strong></button>)}
              </div>
            </article>
          </section>
        )}

        <section className="module-variant-panel fee-ledger-panel fee-empty-panel">
          <div className="fee-ledger-header">
            <VariantHeader
              kicker={activeTab === 'Payments' || activeTab === 'Payment history' ? 'PAYMENT REGISTER' : activeTab === 'Fee structure' ? 'FEE CONFIGURATION' : activeTab === 'Reports' ? 'FINANCE REPORTS' : activeTab === 'Receipts' ? 'RECEIPT REGISTER' : 'FEE ACCOUNTS'}
              title={copy[0]}
              description={copy[1]}
              chip="Awaiting live data"
            />
          </div>
          <div className="fee-empty-state">
            <div className="fee-empty-icon"><CreditCard size={23} /></div>
            <strong>{copy[0]}</strong>
            <p>{copy[1]}</p>
            <span>Demo figures and sample student records have been removed to avoid misleading financial information.</span>
          </div>
        </section>

        <section className="fee-integrity-note">
          <div><strong>Keep finance records accurate</strong><p>Fees assigned, payments collected and outstanding dues are different figures. They will be calculated separately from confirmed records.</p></div>
          <span>Audit-friendly by design</span>
        </section>
      </div>
    )
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
      {searchable && <div className="module-toolbar"><div className="module-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${module.title.toLowerCase()}...`} /></div><div className="toolbar-actions"><button type="button" className="secondary-button"><SlidersHorizontal size={15} /> Filters</button><button type="button" className="secondary-button">This month</button></div></div>}
      {renderBody()}
    </div>
  )
}

export default ModulePage
