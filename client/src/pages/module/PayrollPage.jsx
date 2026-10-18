import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeIndianRupee, CircleAlert, CircleCheck, Plus, RefreshCw, Search, Users, Wallet } from 'lucide-react'
import apiClient from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './PayrollPage.css'

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0))
const dateInput = () => new Date().toISOString().slice(0, 10)
const blankStaff = { employeeId: '', name: '', email: '', phone: '', designation: '', department: '', category: 'teaching', employmentType: 'full_time', joiningDate: dateInput(), userId: '', teacherId: '' }
const blankSalary = { basicSalary: '', allowances: [{ name: 'HRA', amount: '' }], recurringDeductions: [], effectiveFrom: dateInput(), pfEnabled: false, esicEnabled: false, professionalTaxEnabled: false, tdsEnabled: false, notes: '' }

function PayrollPage() {
  const { user } = useAuth()
  const isPrincipal = user?.role === 'principal'
  const [employees, setEmployees] = useState([])
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('true')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [staffFormOpen, setStaffFormOpen] = useState(false)
  const [staffForm, setStaffForm] = useState(blankStaff)
  const [salaryEmployee, setSalaryEmployee] = useState(null)
  const [salaryForm, setSalaryForm] = useState(blankSalary)
  const [salaryHistory, setSalaryHistory] = useState([])

  const loadEmployees = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get('/payroll/staff', { params: { active: activeFilter, q: query.trim() || undefined } })
      setEmployees(response.data?.employees || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load staff records. Check the server and database connection.')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }, [activeFilter, query])

  useEffect(() => { loadEmployees() }, [loadEmployees])

  const configuredCount = useMemo(() => employees.filter((item) => item.currentSalaryStructure).length, [employees])
  const grossFor = (structure) => Number(structure?.basicSalary || 0) + (structure?.allowances || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const totals = useMemo(() => employees.reduce((sum, item) => {
    sum.gross += grossFor(item.currentSalaryStructure)
    sum.configured += item.currentSalaryStructure ? 1 : 0
    return sum
  }, { gross: 0, configured: 0 }), [employees])

  const openSalary = async (employee) => {
    setSalaryEmployee(employee)
    setError('')
    setNotice('')
    setSalaryHistory([])
    setSalaryForm({
      ...blankSalary,
      basicSalary: employee.currentSalaryStructure?.basicSalary ?? '',
      allowances: employee.currentSalaryStructure?.allowances?.length ? employee.currentSalaryStructure.allowances.map((item) => ({ name: item.name, amount: String(item.amount) })) : [{ name: 'HRA', amount: '' }],
      recurringDeductions: employee.currentSalaryStructure?.recurringDeductions?.map((item) => ({ name: item.name, amount: String(item.amount) })) || [],
      effectiveFrom: dateInput(),
      pfEnabled: employee.currentSalaryStructure?.statutorySettings?.pfEnabled === true,
      esicEnabled: employee.currentSalaryStructure?.statutorySettings?.esicEnabled === true,
      professionalTaxEnabled: employee.currentSalaryStructure?.statutorySettings?.professionalTaxEnabled === true,
      tdsEnabled: employee.currentSalaryStructure?.statutorySettings?.tdsEnabled === true,
      notes: employee.currentSalaryStructure?.statutorySettings?.notes || '',
    })
    try {
      const response = await apiClient.get(`/payroll/staff/${employee.id}/salary-structures`)
      setSalaryHistory(response.data?.history || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load salary history.')
    }
  }

  const saveStaff = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = { ...staffForm }
      if (!payload.userId) delete payload.userId
      if (!payload.teacherId) delete payload.teacherId
      if (!payload.joiningDate) delete payload.joiningDate
      await apiClient.post('/payroll/staff', payload)
      setStaffForm(blankStaff)
      setStaffFormOpen(false)
      setNotice('Staff profile created successfully.')
      await loadEmployees()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save staff profile.')
    } finally {
      setSaving(false)
    }
  }

  const updateComponent = (field, index, key, value) => setSalaryForm((current) => ({
    ...current,
    [field]: current[field].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
  }))

  const saveSalary = async (event) => {
    event.preventDefault()
    if (!salaryEmployee) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        basicSalary: Number(salaryForm.basicSalary),
        effectiveFrom: salaryForm.effectiveFrom,
        allowances: salaryForm.allowances.filter((item) => item.name.trim() && item.amount !== '').map((item) => ({ name: item.name.trim(), amount: Number(item.amount) })),
        recurringDeductions: salaryForm.recurringDeductions.filter((item) => item.name.trim() && item.amount !== '').map((item) => ({ name: item.name.trim(), amount: Number(item.amount) })),
        statutorySettings: {
          pfEnabled: salaryForm.pfEnabled,
          esicEnabled: salaryForm.esicEnabled,
          professionalTaxEnabled: salaryForm.professionalTaxEnabled,
          tdsEnabled: salaryForm.tdsEnabled,
          notes: salaryForm.notes,
        },
      }
      await apiClient.put(`/payroll/staff/${salaryEmployee.id}/salary-structure`, payload)
      setNotice(`Salary structure saved for ${salaryEmployee.name}.`)
      setSalaryEmployee(null)
      await loadEmployees()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save salary structure.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="payroll-page">
      <header className="payroll-page-header">
        <div><span className="payroll-eyebrow">STAFF FINANCE</span><h1>Payroll</h1><p>Manage staff records and effective-dated salary structures. Monthly processing and payments will build on these verified records.</p></div>
        <div className="payroll-header-actions"><button type="button" className="payroll-secondary-button" onClick={loadEmployees}><RefreshCw size={16} /> Refresh</button>{isPrincipal && <button type="button" className="payroll-primary-button" onClick={() => { setStaffFormOpen((open) => !open); setSalaryEmployee(null); setError(''); setNotice('') }}><Plus size={17} /> Add staff</button>}</div>
      </header>

      {error && <div className="payroll-alert payroll-alert-error" role="alert"><CircleAlert size={18} />{error}</div>}
      {notice && <div className="payroll-alert payroll-alert-success" role="status"><CircleCheck size={18} />{notice}</div>}

      <section className="payroll-metrics">
        <article><span className="payroll-metric-icon"><Users size={19} /></span><div><small>Staff shown</small><strong>{employees.length}</strong><span>Current filter</span></div></article>
        <article><span className="payroll-metric-icon"><CircleCheck size={19} /></span><div><small>Salary configured</small><strong>{configuredCount}</strong><span>Effective today</span></div></article>
        <article><span className="payroll-metric-icon"><CircleAlert size={19} /></span><div><small>Needs salary setup</small><strong>{employees.length - configuredCount}</strong><span>Requires review</span></div></article>
        <article><span className="payroll-metric-icon"><Wallet size={19} /></span><div><small>Monthly gross estimate</small><strong>{money(totals.gross)}</strong><span>Configured staff in this view</span></div></article>
      </section>

      {staffFormOpen && isPrincipal && <section className="payroll-panel">
        <div className="payroll-panel-heading"><div><h2>Add staff profile</h2><p>Link an existing login or teacher profile when applicable. This form does not create login credentials.</p></div><button type="button" className="payroll-text-button" onClick={() => setStaffFormOpen(false)}>Cancel</button></div>
        <form className="payroll-form-grid" onSubmit={saveStaff}>
          <label>Employee ID *<input value={staffForm.employeeId} onChange={(e) => setStaffForm({ ...staffForm, employeeId: e.target.value })} required maxLength={40} /></label>
          <label>Full name *<input value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} required maxLength={120} /></label>
          <label>Designation *<input value={staffForm.designation} onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })} required maxLength={100} placeholder="e.g. Teacher, Accountant" /></label>
          <label>Department<input value={staffForm.department} onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })} /></label>
          <label>Email<input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} /></label>
          <label>Phone<input value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} /></label>
          <label>Staff category<select value={staffForm.category} onChange={(e) => setStaffForm({ ...staffForm, category: e.target.value })}><option value="teaching">Teaching</option><option value="administration">Administration</option><option value="finance">Finance</option><option value="support">Support</option><option value="other">Other</option></select></label>
          <label>Employment type<select value={staffForm.employmentType} onChange={(e) => setStaffForm({ ...staffForm, employmentType: e.target.value })}><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option></select></label>
          <label>Joining date<input type="date" value={staffForm.joiningDate} onChange={(e) => setStaffForm({ ...staffForm, joiningDate: e.target.value })} /></label>
          <label>Existing user ID (optional)<input value={staffForm.userId} onChange={(e) => setStaffForm({ ...staffForm, userId: e.target.value })} placeholder="MongoDB User ID" /></label>
          <label>Teacher profile ID (optional)<input value={staffForm.teacherId} onChange={(e) => setStaffForm({ ...staffForm, teacherId: e.target.value })} placeholder="MongoDB Teacher ID" /></label>
          <div className="payroll-form-footer"><span>Required fields are marked with *.</span><button className="payroll-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Create staff profile'}</button></div>
        </form>
      </section>}

      <section className="payroll-panel">
        <div className="payroll-toolbar"><div><h2>Staff & salary structures</h2><p>Salary values are shown only for the effective structure.</p></div><div className="payroll-filters"><label className="payroll-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID, department…" /></label><select aria-label="Staff status" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}><option value="true">Active staff</option><option value="false">Inactive staff</option></select></div></div>
        <div className="payroll-table-wrap"><table className="payroll-table"><thead><tr><th>Employee</th><th>Designation / Department</th><th>Basic salary</th><th>Allowances</th><th>Gross monthly</th><th>Salary setup</th>{isPrincipal && <th>Action</th>}</tr></thead>
          <tbody>{loading ? <tr><td colSpan={isPrincipal ? 7 : 6} className="payroll-table-state">Loading staff records…</td></tr> : employees.length ? employees.map((employee) => {
            const salary = employee.currentSalaryStructure
            const allowanceTotal = (salary?.allowances || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
            return <tr key={employee.id}><td><strong>{employee.name}</strong><span className="payroll-table-subtext">{employee.employeeId}{employee.user?.role ? ` · ${employee.user.role}` : ''}</span></td><td>{employee.designation}<span className="payroll-table-subtext">{employee.department || employee.category}</span></td><td>{salary ? money(salary.basicSalary) : '—'}</td><td>{salary ? money(allowanceTotal) : '—'}</td><td><strong>{salary ? money(grossFor(salary)) : '—'}</strong></td><td><span className={salary ? 'payroll-status payroll-status-ready' : 'payroll-status payroll-status-missing'}>{salary ? 'Configured' : 'Needs setup'}</span></td>{isPrincipal && <td><button type="button" className="payroll-row-action" onClick={() => openSalary(employee)}>{salary ? 'Revise salary' : 'Set salary'}</button></td>}</tr>
          }) : <tr><td colSpan={isPrincipal ? 7 : 6} className="payroll-table-state">{error ? 'Staff could not be loaded.' : 'No staff records match this filter. Add staff profiles to begin.'}</td></tr>}</tbody>
        </table></div>
        <div className="payroll-table-footer">{employees.length} staff record{employees.length === 1 ? '' : 's'} · Monthly gross is an estimate from configured fixed components, not a processed payroll total.</div>
      </section>

      {salaryEmployee && isPrincipal && <section className="payroll-panel payroll-salary-editor">
        <div className="payroll-panel-heading"><div><span className="payroll-eyebrow">SALARY SETUP</span><h2>{salaryEmployee.name}</h2><p>Employee ID {salaryEmployee.employeeId} · Previous structures are retained for history.</p></div><button type="button" className="payroll-text-button" onClick={() => setSalaryEmployee(null)}>Close</button></div>
        <form onSubmit={saveSalary}>
          <div className="payroll-form-grid payroll-salary-grid">
            <label>Basic monthly salary (₹) *<input type="number" min="0" step="0.01" value={salaryForm.basicSalary} onChange={(e) => setSalaryForm({ ...salaryForm, basicSalary: e.target.value })} required /></label>
            <label>Effective from *<input type="date" value={salaryForm.effectiveFrom} onChange={(e) => setSalaryForm({ ...salaryForm, effectiveFrom: e.target.value })} required /></label>
          </div>
          <div className="payroll-component-columns">
            {['allowances', 'recurringDeductions'].map((field) => <div className="payroll-component-box" key={field}><div className="payroll-component-heading"><h3>{field === 'allowances' ? 'Monthly allowances' : 'Recurring deductions'}</h3><button type="button" className="payroll-text-button" onClick={() => setSalaryForm((current) => ({ ...current, [field]: [...current[field], { name: '', amount: '' }] }))}>+ Add row</button></div>{salaryForm[field].map((item, index) => <div className="payroll-component-row" key={index}><input aria-label={`${field} name ${index + 1}`} placeholder="Component name" value={item.name} onChange={(e) => updateComponent(field, index, 'name', e.target.value)} /><input aria-label={`${field} amount ${index + 1}`} type="number" min="0" step="0.01" placeholder="Amount ₹" value={item.amount} onChange={(e) => updateComponent(field, index, 'amount', e.target.value)} /><button type="button" className="payroll-remove-row" aria-label="Remove component" onClick={() => setSalaryForm((current) => ({ ...current, [field]: current[field].filter((_, rowIndex) => rowIndex !== index) }))}>×</button></div>)}{!salaryForm[field].length && <p className="payroll-muted">No components added.</p>}</div>)}
          </div>
          <div className="payroll-statutory-box"><h3>Statutory calculation flags</h3><p>These flags record whether the item should be assessed. They do not calculate statutory amounts yet.</p><div className="payroll-checkboxes">{[['pfEnabled', 'PF'], ['esicEnabled', 'ESIC'], ['professionalTaxEnabled', 'Professional tax'], ['tdsEnabled', 'TDS']].map(([field, label]) => <label key={field}><input type="checkbox" checked={salaryForm[field]} onChange={(e) => setSalaryForm({ ...salaryForm, [field]: e.target.checked })} />{label}</label>)}</div><label className="payroll-notes-label">Payroll notes<textarea rows="2" maxLength={1000} value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })} placeholder="Eligibility or review notes (do not store bank passwords or sensitive credentials)" /></label></div>
          <div className="payroll-form-footer"><span>Monthly gross estimate: <strong>{money(Number(salaryForm.basicSalary || 0) + salaryForm.allowances.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></span><button className="payroll-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save salary structure'}</button></div>
        </form>
        <div className="payroll-history"><h3>Salary structure history</h3>{salaryHistory.length ? salaryHistory.map((item) => <div className="payroll-history-row" key={item._id}><span><strong>{money(item.basicSalary + (item.allowances || []).reduce((sum, component) => sum + Number(component.amount || 0), 0))}</strong><small>Effective {new Date(item.effectiveFrom).toLocaleDateString('en-IN')} {item.effectiveTo ? `– ${new Date(item.effectiveTo).toLocaleDateString('en-IN')}` : 'onward'}</small></span><span className="payroll-status">{item.status}</span></div>) : <p className="payroll-muted">No salary structure history loaded.</p>}</div>
      </section>}
      <p className="payroll-privacy-note"><BadgeIndianRupee size={15} /> Payroll records are school-scoped. This initial step manages staff and salary structures; it does not yet calculate monthly payable salary or record payments.</p>
    </main>
  )
}

export default PayrollPage
