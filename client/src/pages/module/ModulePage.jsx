import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { MODULES } from '../../config/moduleConfig'
import './ModulePage.css'
import '../../styles/SchoolUX.css'

const statusClass = (value) => {
  const text = String(value).toLowerCase()
  if (['active', 'paid', 'good', 'processed', 'published', 'open', 'up', 'stable'].some((item) => text.includes(item))) return 'success'
  if (['due', 'attention', 'pending', 'review', 'leave', 'watch'].some((item) => text.includes(item))) return 'warning'
  return ''
}

function DataTable({ columns, rows, className = '' }) {
  return (
    <div className="directory-table-wrap">
      <table className={`directory-table ${className}`}>
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => (
          <tr key={`${row[0]}-${rowIndex}`}>
            {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cellIndex === 0 ? <strong>{cell}</strong> : cellIndex === row.length - 1 ? <span className={`status-pill ${statusClass(cell)}`}>{cell}</span> : cell}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function VariantHeader({ kicker, title, description, chip }) {
  return <div className="variant-header"><div><span className="variant-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p></div>{chip && <span className="variant-chip">{chip}</span>}</div>
}

function ModulePage({ moduleKey }) {
  const { user } = useAuth()
  const module = MODULES[moduleKey]
  const [query, setQuery] = useState('')

  const filteredRows = useMemo(() => {
    if (!module) return []
    const value = query.trim().toLowerCase()
    if (!value) return module.rows
    return module.rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(value)))
  }, [module, query])

  if (!module) return <div className="module-empty"><h2>Module not found</h2><p>The requested section is not configured yet.</p></div>

  const Icon = module.icon
  const actions = module.actions || []
  const searchable = !['profile', 'timetable', 'attendance', 'children', 'reports'].includes(moduleKey)

  const renderDirectory = () => (
    <div className="module-variant-shell directory-grid">
      <aside className="directory-spotlight">
        <span className="variant-kicker">SCHOOL DIRECTORY</span><h2>{module.title}</h2><p>{module.description}</p>
        <div className="directory-total"><strong>{module.stats[0]?.[1]}</strong><span>{module.stats[0]?.[0]}</span></div>
        <div className="directory-actions">{actions.slice(0, 3).map((action) => <button type="button" key={action}>{action} <ChevronRight size={13} /></button>)}</div>
      </aside>
      <section className="module-variant-panel"><VariantHeader kicker="LIVE REGISTER" title={`${module.title} register`} description={`${filteredRows.length} records currently visible`} chip="Updated today" /><DataTable columns={module.columns} rows={filteredRows} /></section>
    </div>
  )

  const renderCardBoard = () => (
    <section className="module-variant-panel"><VariantHeader kicker="ACADEMIC SETUP" title={`${module.title} library`} description="Browse school structure as focused records instead of one long table." chip={`${filteredRows.length} records`} />
      <div className="card-board">{filteredRows.map((row, index) => <article className="board-card" key={`${row[0]}-${index}`}><div className="board-card-top"><span className="variant-chip">{row[1]}</span><ChevronRight size={15} color="#a52235" /></div><h3>{row[0]}</h3><p>{row.slice(2, -1).filter(Boolean).join(' · ')}</p><div className="board-meta">{row.slice(2).map((cell, cellIndex) => <span key={`${cell}-${cellIndex}`}>{cell}</span>)}</div></article>)}</div>
    </section>
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

  const renderFinance = () => (
    <div className="finance-ledger"><aside className="finance-summary"><span className="variant-kicker">COLLECTION SNAPSHOT</span><h2>{module.stats[0][1]}</h2><p>{module.stats[0][0]} this academic year</p>{module.stats.slice(1).map(([label, value]) => <div className="finance-summary-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</aside>
      <section className="module-variant-panel"><VariantHeader kicker="PAYMENT LEDGER" title="Recent financial activity" description="Keep the money context visible while reviewing individual records." chip="Current month" /><DataTable columns={module.columns} rows={filteredRows} className="finance-table" /></section>
    </div>
  )

  const renderReports = () => (
    <div className="analytics-grid">{module.stats.slice(0, 3).map(([label, value, trend]) => <article className="analytics-card" key={label}><span className="variant-kicker">METRIC</span><h3>{label}</h3><strong>{value}</strong><small>{trend || 'Current period'}</small></article>)}
      <article className="analytics-card wide"><span className="variant-kicker">REPORT CENTER</span><h3>Available reports</h3><div className="report-list">{filteredRows.map((row, index) => <div className="report-row" key={`${row[0]}-${index}`}><strong>{row[0]}</strong><span>{row[1]} · {row[2]}</span><button type="button">Open</button></div>)}</div></article>
      <article className="analytics-card"><span className="variant-kicker">TREND</span><h3>Academic signal</h3><strong>{module.stats[3]?.[1]}</strong><small>Compared with the previous reporting period</small></article>
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
    <div className="profile-layout"><aside className="profile-card"><div className="child-avatar">{(user?.name || 'DU').split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><h2>{user?.name || 'Demo User'}</h2><p>{user?.role || 'school'} account · Academy School</p><span className="variant-chip" style={{ marginTop: 16 }}>Account active</span></aside>
      <section className="module-variant-panel"><VariantHeader kicker="ACCOUNT DETAILS" title="Personal information" description="Keep identity, contact and security details in one calm workspace." /><div className="profile-fields">{filteredRows.map((row) => <div className="profile-field" key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><small style={{ display: 'block', marginTop: 5, color: '#a52235', fontSize: 8 }}>{row[2]}</small></div>)}</div></section>
    </div>
  )

  const renderCommunication = () => (
    <section className="module-variant-panel"><VariantHeader kicker="SCHOOL LIFE" title={module.title} description={module.description} chip="Live register" /><div className="communication-list">{filteredRows.map((row, index) => <article className="communication-item" key={`${row[0]}-${index}`}><div className="communication-icon"><FileText size={17} /></div><div><strong>{row[0]}</strong><span>{row.slice(1, -1).join(' · ')}</span></div><span className={`status-pill ${statusClass(row[row.length - 1])}`}>{row[row.length - 1]}</span></article>)}</div></section>
  )

  const renderDefault = () => <section className="module-variant-panel"><VariantHeader kicker="LIVE REGISTER" title={`${module.title} overview`} description={`${filteredRows.length} records shown`} /><DataTable columns={module.columns} rows={filteredRows} /></section>

  const renderBody = () => {
    if (moduleKey === 'timetable') return renderTimetable()
    if (moduleKey === 'attendance') return renderAttendance()
    if (moduleKey === 'fees' || moduleKey === 'payroll') return renderFinance()
    if (moduleKey === 'reports') return renderReports()
    if (['assignments', 'exams', 'results'].includes(moduleKey)) return renderAssessment()
    if (moduleKey === 'children') return renderChildren()
    if (moduleKey === 'profile') return renderProfile()
    if (['notices', 'events'].includes(moduleKey)) return renderCommunication()
    if (['classes', 'subjects'].includes(moduleKey)) return renderCardBoard()
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
