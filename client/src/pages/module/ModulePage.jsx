import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Clock3,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { MODULES } from '../../config/moduleConfig'
import './ModulePage.css'
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
  const module = MODULES[moduleKey]
  const [query, setQuery] = useState('')
  const [selectedCurriculumClass, setSelectedCurriculumClass] = useState('6')
  const [customSubjects, setCustomSubjects] = useState({})
  const [newSubject, setNewSubject] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newType, setNewType] = useState('Elective')
  const [feeFilter, setFeeFilter] = useState('All')

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
    const feeRows = filteredRows.filter((row) => feeFilter === 'All' || String(row[4]).toLowerCase() === feeFilter.toLowerCase())
    return (
      <div className="fees-workspace">
        <section className="fee-pulse-grid">
          {module.stats.map(([label, value, trend]) => <article key={label}><span>{label}</span><strong>{value}</strong><small className={trend?.startsWith('-') ? 'negative' : 'positive'}>{trend || 'Current academic year'}</small></article>)}
        </section>

        <section className="fee-cycle-panel">
          <div><span className="variant-kicker">FEE COLLECTION WORKSPACE</span><h2>Track the fee cycle without leaving the register</h2><p>Use the status filter to move from paid students to partial and due accounts.</p></div>
          <div className="fee-cycle"><span className="done">Fee assigned</span><ChevronRight size={15} /><span className="done">Payment received</span><ChevronRight size={15} /><span className="current">Receipt / balance</span><ChevronRight size={15} /><span>Follow-up</span></div>
        </section>

        <section className="module-variant-panel fee-ledger-panel">
          <div className="fee-ledger-header"><VariantHeader kicker="PAYMENT REGISTER" title="Student fee accounts" description="Review total fee, amount paid and the current collection state." chip={`${feeRows.length} visible`} />
            <div className="fee-filter-tabs">{['All', 'Paid', 'Partial', 'Due'].map((filter) => <button type="button" key={filter} className={feeFilter === filter ? 'active' : ''} onClick={() => setFeeFilter(filter)}>{filter}</button>)}</div>
          </div>
          <div className="fee-table-wrap"><table className="fee-table"><thead><tr><th>Student</th><th>Class</th><th>Total fee</th><th>Paid</th><th>Balance</th><th>Status</th><th /></tr></thead>
            <tbody>{feeRows.map((row) => { const total = Number(String(row[2]).replace(/[^0-9]/g, '')) || 0; const paid = Number(String(row[3]).replace(/[^0-9]/g, '')) || 0; const balance = Math.max(total - paid, 0); return <tr key={row[0]}><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td>{balance ? `₹${balance.toLocaleString('en-IN')}` : '₹0'}</td><td><span className={`status-pill ${statusClass(row[4])}`}>{row[4]}</span></td><td><button type="button" className="table-action">View</button></td></tr> })}</tbody>
          </table></div>
        </section>

        <section className="fee-attention-panel">
          <div><span className="variant-kicker">FOLLOW-UP QUEUE</span><h2>Accounts needing attention</h2><p>These are the students from the current register with a balance or partial payment.</p></div>
          <div className="fee-attention-list">{module.rows.filter((row) => ['Partial', 'Due'].includes(row[4])).map((row) => <div key={row[0]}><div><strong>{row[0]}</strong><span>{row[1]} · {row[4]}</span></div><strong>{row[2]} total · {row[3]} paid</strong></div>)}</div>
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
    <div className={`module-page module-${moduleKey.replace(/[^a-z0-9]+/gi, '-')}`}>
      <div className="module-heading"><div className="module-heading-copy"><div className="eyebrow">{module.eyebrow}</div><div className="module-title-line"><div className="module-title-icon"><Icon size={22} /></div><div><h1>{module.title}</h1><p>{module.description}</p></div></div></div>
        <div className="module-heading-actions"><button className="icon-button" type="button" aria-label="More options"><MoreHorizontal size={18} /></button>{actions[0] && <button className="primary-button module-add" type="button"><Plus size={16} />{actions[0]}</button>}</div>
      </div>
      <div className="module-stats">{module.stats.map(([label, value, trend]) => <div className="module-stat" key={label}><span>{label}</span><strong>{value}</strong>{trend && <small className={trend.startsWith('-') ? 'negative' : 'positive'}>{trend.startsWith('-') ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{trend.replace('-', '')}</small>}</div>)}</div>
      {searchable && <div className="module-toolbar"><div className="module-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${module.title.toLowerCase()}...`} /></div><div className="toolbar-actions"><button type="button" className="secondary-button"><SlidersHorizontal size={15} /> Filters</button><button type="button" className="secondary-button">This month</button></div></div>}
      {renderBody()}
    </div>
  )
}

export default ModulePage
