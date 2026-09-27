import { ArrowDownRight, ArrowUpRight, MoreHorizontal, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { MODULES } from '../../config/moduleConfig'
import './ModulePage.css'

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

  if (!module) {
    return <div className="module-empty"><h2>Module not found</h2><p>The requested section is not configured yet.</p></div>
  }

  const Icon = module.icon

  return (
    <div className={`module-page module-${moduleKey.replace(/[^a-z0-9]+/gi, '-')}`}>
      <div className="module-heading">
        <div className="module-heading-copy">
          <div className="eyebrow">{module.eyebrow}</div>
          <div className="module-title-line">
            <div className="module-title-icon"><Icon size={22} /></div>
            <div>
              <h1>{module.title}</h1>
              <p>{module.description}</p>
            </div>
          </div>
        </div>
        <div className="module-heading-actions">
          <button className="icon-button" type="button" aria-label="More options"><MoreHorizontal size={18} /></button>
          {module.actions?.[0] && <button className="primary-button module-add"><Plus size={16} />{module.actions[0]}</button>}
        </div>
      </div>

      <div className="module-stats">
        {module.stats.map(([label, value, trend]) => (
          <div className="module-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            {trend && <small className={trend.startsWith('-') ? 'negative' : 'positive'}>{trend.startsWith('-') ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{trend.replace('-', '')}</small>}
          </div>
        ))}
      </div>

      <div className="module-toolbar">
        <div className="module-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${module.title.toLowerCase()}...`} /></div>
        <div className="toolbar-actions"><button type="button" className="secondary-button"><SlidersHorizontal size={15} /> Filters</button><button type="button" className="secondary-button">This month</button></div>
      </div>

      <div className="module-content-grid">
        <section className="module-table-card">
          <div className="section-card-header">
            <div><span className="table-kicker">LIVE REGISTER</span><h3>{module.title} overview</h3><p>{filteredRows.length} records shown</p></div>
            <button type="button" className="text-button">View all</button>
          </div>
          <div className="module-table-wrap">
            <table className="module-table">
              <thead><tr>{module.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>
                {filteredRows.map((row, rowIndex) => (
                  <tr key={`${row[0]}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${cell}-${cellIndex}`}>
                        {cellIndex === 0 ? <strong>{cell}</strong> : cellIndex === row.length - 1 ? <span className={`status-pill ${String(cell).toLowerCase().includes('due') || String(cell).toLowerCase().includes('attention') || String(cell).toLowerCase().includes('pending') || String(cell).toLowerCase() === 'review' || String(cell).toLowerCase() === 'leave' ? 'warning' : String(cell).toLowerCase() === 'active' || String(cell).toLowerCase() === 'paid' || String(cell).toLowerCase() === 'good' || String(cell).toLowerCase() === 'processed' || String(cell).toLowerCase() === 'published' ? 'success' : ''}`}>{cell}</span> : <span>{cell}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredRows.length && <div className="module-no-results">No matching records found.</div>}
          </div>
        </section>

        <aside className="module-side-stack">
          <section className="module-actions-card">
            <div className="section-card-header"><div><span className="table-kicker">SHORTCUTS</span><h3>Quick actions</h3><p>Frequently used actions</p></div></div>
            <div className="module-actions-list">
              {module.actions?.map((action) => <button type="button" key={action}>{action}<span>›</span></button>)}
            </div>
          </section>
          <section className="module-insight">
            <div className="eyebrow">SCHOOL INSIGHT</div>
            <h3>{user?.role === 'principal' ? 'A clearer way to run this area' : 'Your workspace'}</h3>
            <p>{user?.role === 'principal' ? `The ${module.title.toLowerCase()} section is ready for daily operations. Use the actions above to continue managing your school.` : `This view is filtered to the information available to your ${user?.role || 'account'} role.`}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default ModulePage
