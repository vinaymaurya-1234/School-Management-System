import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, CircleAlert, RefreshCw, Search, Users, Plus, X } from 'lucide-react'
import apiClient from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './PayrollPage.css'

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0))
const today = new Date()
const defaultMonth = String(today.getMonth() + 1)
const defaultYear = String(today.getFullYear())
const isoToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const blankStaff = { employeeId: '', name: '', email: '', phone: '', designation: 'Teacher', department: '', category: 'teaching', employmentType: 'full_time', joiningDate: isoToday(), userId: '', teacherId: '' }
const blankSalary = { basicSalary: '', allowances: [{ name: 'HRA', amount: '' }], recurringDeductions: [], pfEnabled: true, pfRate: '12', effectiveFrom: isoToday() }

function PayrollPage() {
  const { user } = useAuth()
  const isPrincipal = user?.role === 'principal'
  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)
  const [data, setData] = useState(null)
  const [employees, setEmployees] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [salaryTarget, setSalaryTarget] = useState(null)
  const [salaryForm, setSalaryForm] = useState(blankSalary)
  const [staffOpen, setStaffOpen] = useState(false)
  const [staffForm, setStaffForm] = useState(blankStaff)
  const [staffCandidates, setStaffCandidates] = useState([])
  const [staffCandidateQuery, setStaffCandidateQuery] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [expandedItem, setExpandedItem] = useState(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'bank_transfer', date: isoToday(), reference: '' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [payrollResponse, staffResponse] = await Promise.all([
        apiClient.get('/payroll/monthly', { params: { month, year } }),
        apiClient.get('/payroll/staff', { params: { active: true, q: query.trim() || undefined } }),
      ])
      setData(payrollResponse.data)
      setEmployees(staffResponse.data?.employees || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load payroll. Please check your connection and try again.')
    } finally { setLoading(false) }
  }, [month, year, query])

  useEffect(() => { load() }, [load])
  const run = data?.run
  const items = run?.items || data?.items || []
  const preview = !run
  const totals = useMemo(() => items.reduce((acc, item) => {
    if (item.needsSalarySetup) acc.missing += 1
    else {
      acc.gross += Number(item.grossSalary || 0)
      acc.deductions += Number(item.totalDeductions || 0)
      acc.net += Number(item.netPayable || 0)
      acc.paid += Number(item.paidAmount || 0)
    }
    return acc
  }, { gross: 0, deductions: 0, net: 0, paid: 0, missing: 0 }), [items])

  const saveSalary = async (event) => {
    event.preventDefault(); if (!salaryTarget) return
    setSaving(true); setError(''); setNotice('')
    try {
      const payload = {
        basicSalary: Number(salaryForm.basicSalary), effectiveFrom: salaryForm.effectiveFrom,
        allowances: salaryForm.allowances.filter(x => x.name.trim() && x.amount !== '').map(x => ({ name: x.name.trim(), amount: Number(x.amount) })),
        recurringDeductions: salaryForm.recurringDeductions.filter(x => x.name.trim() && x.amount !== '').map(x => ({ name: x.name.trim(), amount: Number(x.amount) })),
        statutorySettings: { pfEnabled: salaryForm.pfEnabled, pfRate: Number(salaryForm.pfRate) },
      }
      await apiClient.put(`/payroll/staff/${salaryTarget.id}/salary-structure`, payload)
      setSalaryTarget(null); setNotice(`Salary structure saved for ${salaryTarget.name}.`); await load()
    } catch (err) { setError(err.response?.data?.message || 'Could not save salary structure.') }
    finally { setSaving(false) }
  }

  const openSalary = (employee) => {
    setSalaryTarget(employee)
    const current = employee.currentSalaryStructure
    setSalaryForm({
      ...blankSalary, basicSalary: current?.basicSalary ?? '',
      allowances: current?.allowances?.length ? current.allowances.map(x => ({ name: x.name, amount: String(x.amount) })) : [{ name: 'HRA', amount: '' }],
      recurringDeductions: current?.recurringDeductions?.filter(x => !/^pf$|^provident fund$/i.test(x.name.trim())).map(x => ({ name: x.name, amount: String(x.amount) })) || [],
      pfEnabled: true, pfRate: String(current?.statutorySettings?.pfRate ?? 12),
      effectiveFrom: isoToday(),
    })
  }

  const loadStaffCandidates = async () => {
    setError('')
    try {
      const response = await apiClient.get('/payroll/staff/candidates', { params: { q: staffCandidateQuery.trim() || undefined } })
      setStaffCandidates(response.data?.candidates || [])
    } catch (err) { setError(err.response?.data?.message || 'Could not load staff list.') }
  }

  const selectStaffCandidate = (candidate) => {
    setSelectedCandidate(candidate)
    setStaffForm({
      employeeId: candidate.employeeId || '',
      name: candidate.name || '',
      email: candidate.email || '',
      phone: candidate.phone || '',
      designation: candidate.designation || 'Teacher',
      department: candidate.department || '',
      category: candidate.category || 'teaching',
      employmentType: 'full_time',
      joiningDate: candidate.joiningDate ? String(candidate.joiningDate).slice(0, 10) : isoToday(),
      userId: candidate.userId || '',
      teacherId: candidate.teacherId || '',
    })
  }

  const createStaff = async (event) => {
    event.preventDefault()
    if (!selectedCandidate) { setError('Please select a teacher or staff member first.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      await apiClient.post('/payroll/staff', { ...staffForm, userId: selectedCandidate.userId, teacherId: selectedCandidate.teacherId })
      setStaffOpen(false); setSelectedCandidate(null); setStaffForm(blankStaff); setStaffCandidates([])
      setNotice('Selected staff member added to payroll. Now set their salary structure.'); await load()
    } catch (err) { setError(err.response?.data?.message || 'Could not add selected staff member.') }
    finally { setSaving(false) }
  }

  const generate = async () => {
    if (!window.confirm(`Generate draft payroll for ${month}/${year}? Review the preview before continuing.`)) return
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await apiClient.post('/payroll/monthly/generate', { month: Number(month), year: Number(year) })
      setData({ run: response.data.run, preview: false }); setNotice('Monthly payroll generated as a draft. Review it and approve when ready.')
    } catch (err) { setError(err.response?.data?.message || 'Could not generate payroll.') ; if (err.response?.data?.run) setData({ run: err.response.data.run, preview: false }) }
    finally { setSaving(false) }
  }

  const approve = async () => {
    if (!run?._id || !window.confirm('Approve this payroll? After approval, the snapshot is locked and payments can be recorded.')) return
    setSaving(true); setError(''); setNotice('')
    try { const response = await apiClient.post(`/payroll/monthly/${run._id}/approve`); setData({ run: response.data.run, preview: false }); setNotice('Payroll approved successfully.') }
    catch (err) { setError(err.response?.data?.message || 'Could not approve payroll.') }
    finally { setSaving(false) }
  }

  const recordPayment = async (event) => {
    event.preventDefault(); if (!paymentTarget || !run?._id) return
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await apiClient.post(`/payroll/monthly/${run._id}/items/${paymentTarget._id}/payment`, { ...paymentForm, amount: Number(paymentForm.amount) })
      setData({ run: response.data.run, preview: false }); setPaymentTarget(null); setNotice('Payment recorded successfully.')
    } catch (err) { setError(err.response?.data?.message || 'Could not record payment.') }
    finally { setSaving(false) }
  }

  const changeComponent = (field, index, key, value) => setSalaryForm(old => ({ ...old, [field]: old[field].map((x, i) => i === index ? { ...x, [key]: value } : x) }))
  const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return <main className="payroll-page">
    <header className="payroll-page-header">
      <div><h1>Salary & Payroll</h1><p>Manage staff salaries and monthly payments.</p></div>
      <div className="payroll-header-actions"> {isPrincipal && <button type="button" className="payroll-primary-button" onClick={() => { const next = !staffOpen; setStaffOpen(next); if (next) { setSelectedCandidate(null); setStaffForm(blankStaff); loadStaffCandidates() } }}><Plus size={16}/> Add staff</button>}</div>
    </header>

    {error && <div className="payroll-alert payroll-alert-error" role="alert"><CircleAlert size={18}/><span>{error}</span></div>}
    {notice && <div className="payroll-alert payroll-alert-success" role="status"><Check size={18}/><span>{notice}</span></div>}

    <section className="payroll-period-panel">
      <div className="payroll-period-copy"><span className="payroll-eyebrow">PAY PERIOD</span><h2>{monthLabel}</h2> </div>
      <div className="payroll-period-controls"><label>Month<select value={month} onChange={e => setMonth(e.target.value)}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{new Date(Number(defaultYear), i, 1).toLocaleDateString('en-IN', { month: 'long' })}</option>)}</select></label><label>Year<select value={year} onChange={e => setYear(e.target.value)}>{Array.from({ length: 7 }, (_, i) => Number(defaultYear) - 3 + i).map(y => <option key={y} value={String(y)}>{y}</option>)}</select></label></div>
      <div className="payroll-period-actions">{isPrincipal && preview && <button type="button" className="payroll-primary-button" onClick={generate} disabled={saving || loading || !items.length || totals.missing > 0}>{saving ? 'Processing…' : 'Generate payroll'}</button>}{isPrincipal && run?.status === 'draft' && <button type="button" className="payroll-primary-button" onClick={approve} disabled={saving}>{saving ? 'Processing…' : 'Approve payroll'}</button>}</div>
    </section>

 
    <section className="payroll-summary" aria-label="Payroll summary">
      <article><span>Staff in payroll</span><strong>{items.length}</strong></article>
      <article><span>Total net payable</span><strong>{money(totals.net)}</strong></article>
      <article><span>Amount paid</span><strong>{money(totals.paid)}</strong></article>
    </section>

    {staffOpen && isPrincipal && <section className="payroll-panel">
      <div className="payroll-panel-heading"><div><h2>Add staff</h2><p>Search and select an existing school staff member.</p></div><button className="payroll-icon-button" type="button" onClick={() => { setStaffOpen(false); setSelectedCandidate(null) }} aria-label="Close"><X size={18}/></button></div>
      <div className="payroll-staff-picker">
        <label className="payroll-search"><Search size={17}/><input value={staffCandidateQuery} onChange={e => setStaffCandidateQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); loadStaffCandidates() } }} placeholder="Search teachers by name, employee ID or subject…"/></label>
        <button type="button" className="payroll-secondary-button" onClick={loadStaffCandidates} disabled={saving}><RefreshCw size={15}/> Search</button>
      </div>
      <div className="payroll-staff-candidate-list">
        {staffCandidates.length ? staffCandidates.map(candidate => <button type="button" key={candidate.teacherId} className={selectedCandidate?.teacherId === candidate.teacherId ? 'payroll-staff-candidate is-selected' : 'payroll-staff-candidate'} onClick={() => selectStaffCandidate(candidate)}>
          <span className="payroll-staff-avatar">{(candidate.name || 'S').trim().charAt(0).toUpperCase()}</span><span className="payroll-staff-candidate-copy"><strong>{candidate.name}</strong><small>{candidate.employeeId} · {candidate.designation || 'Teacher'}{candidate.department ? ` · ${candidate.department}` : ''}</small><small>{candidate.email || 'No email'}{candidate.phone ? ` · ${candidate.phone}` : ''}</small></span><span className="payroll-staff-select-mark">{selectedCandidate?.teacherId === candidate.teacherId ? 'Selected' : 'Select'}</span>
        </button>) : <div className="payroll-empty"><Users size={22}/><strong>No available staff found</strong><span>They may already be linked to payroll, or try another search.</span></div>}
      </div>
      {selectedCandidate && <form className="payroll-form-grid payroll-selected-staff-form" onSubmit={createStaff}>
        <div className="payroll-selected-staff-summary"><span className="payroll-staff-avatar">{(staffForm.name || 'S').trim().charAt(0).toUpperCase()}</span><div><strong>{staffForm.name}</strong><small>{staffForm.employeeId} · {staffForm.designation}</small></div></div>
        <div className="payroll-form-footer"><span>Salary will be set after adding this staff member.</span><button className="payroll-primary-button" disabled={saving}>{saving ? 'Adding…' : 'Add staff'}</button></div>
      </form>}
    </section>}

    <section className="payroll-panel">
      <div className="payroll-toolbar"><div><h2>Staff salary</h2><p>View salary details and record payments.</p></div><label className="payroll-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter staff by name or employee ID…"/></label></div>
      {loading ? <div className="payroll-empty"><RefreshCw size={22}/><strong>Loading payroll…</strong></div> : !items.length ? <div className="payroll-empty"><CalendarDays size={24}/><strong>No staff records found</strong><span>Add staff profiles and set salary structures to start.</span></div> : <div className="payroll-table-wrap"><table className="payroll-table payroll-compact-table"><thead><tr><th>Employee</th><th>Attendance</th><th>Net salary</th><th>Payment status</th><th aria-label="Salary slip details"></th></tr></thead><tbody>
        {items.filter(x => !query.trim() || `${x.name} ${x.employeeId}`.toLowerCase().includes(query.trim().toLowerCase())).map((item, index) => {
          const staff = employees.find(x => String(x.id) === String(item.employee))
          const isMissing = item.needsSalarySetup
          const paymentStatus = item.paymentStatus || (preview ? 'Preview' : 'unpaid')
          const isExpanded = expandedItem === (item._id || item.employee || index)
          const rowKey = item._id || item.employee || index
          return <Fragment key={rowKey}><tr className={isExpanded ? 'payroll-employee-row is-expanded' : 'payroll-employee-row'}><td><strong>{item.name}</strong><span className="payroll-table-subtext">{item.employeeId} · {item.designation || 'Staff'}</span></td><td><span className="payroll-count">{item.presentDays ?? '—'} present</span><span className="payroll-table-subtext">{item.absentDays ?? '—'} absent</span></td><td><strong>{isMissing ? 'Salary setup needed' : money(item.netPayable)}</strong></td><td><span className={`payroll-status ${isMissing ? 'payroll-status-missing' : item.paymentStatus === 'paid' ? 'payroll-status-ready' : ''}`}>{isMissing ? 'Setup needed' : item.paymentStatus === 'paid' ? 'Paid' : Number(item.paidAmount || 0) > 0 ? 'Partially paid' : run?.status === 'approved' ? 'Unpaid' : run?.status === 'draft' ? 'Draft' : 'Preview'}</span></td><td><button type="button" className="payroll-slip-toggle" aria-label={isExpanded ? `Hide ${item.name} salary slip` : `View ${item.name} salary slip`} aria-expanded={isExpanded} onClick={() => setExpandedItem(isExpanded ? null : rowKey)}><span>{isExpanded ? 'Hide' : 'View slip'}</span>{isExpanded ? <X size={16}/> : <span className="payroll-chevron">⌄</span>}</button></td></tr>
          {isExpanded && <tr key={`${rowKey}-details`} className="payroll-slip-detail-row"><td colSpan={5}><div className="payroll-slip-details">
            <div className="payroll-slip-heading"><div><span className="payroll-eyebrow">SALARY SLIP · {monthLabel}</span><h3>{item.name}</h3><p>{item.employeeId} · {item.designation || 'Staff'} · {paymentStatus}</p></div><div className="payroll-slip-net"><span>Net payable</span><strong>{isMissing ? 'Salary setup needed' : money(item.netPayable)}</strong></div></div>
            <div className="payroll-slip-grid">
              <div className="payroll-slip-section"><h4>Attendance summary</h4><dl><div><dt>Working days (Sundays excluded)</dt><dd>{item.workingDays ?? '—'}</dd></div><div><dt>Per-day salary</dt><dd>{isMissing ? '—' : money(item.perDayRate)}</dd></div><div><dt>Present days</dt><dd>{item.presentDays ?? '—'}</dd></div><div><dt>Absent days</dt><dd>{item.absentDays ?? '—'}</dd></div><div><dt>Late days</dt><dd>{item.lateDays ?? '—'}</dd></div><div><dt>Paid leave</dt><dd>{item.paidLeaveDays ?? '—'} days</dd></div><div><dt>Unpaid leave</dt><dd>{item.unpaidLeaveDays ?? '—'} days</dd></div></dl></div>
              <div className="payroll-slip-section"><h4>Earnings & deductions</h4><dl><div><dt>Gross salary</dt><dd>{isMissing ? '—' : money(item.grossSalary)}</dd></div><div><dt>Attendance deduction</dt><dd>{isMissing ? '—' : money(item.attendanceDeduction)}</dd></div><div><dt>Unpaid leave deduction</dt><dd>{isMissing ? '—' : money(item.unpaidLeaveDeduction)}</dd></div><div><dt>PF deduction</dt><dd>{isMissing ? '—' : money(item.pfDeduction)}</dd></div><div><dt>Total deductions</dt><dd>{isMissing ? '—' : money(item.totalDeductions)}</dd></div><div className="payroll-slip-total"><dt>Net payable</dt><dd>{isMissing ? '—' : money(item.netPayable)}</dd></div></dl></div>
              <div className="payroll-slip-section"><h4>Payment & status</h4><dl><div><dt>Payroll status</dt><dd>{run?.status || 'Live preview'}</dd></div><div><dt>Payment status</dt><dd>{paymentStatus}</dd></div><div><dt>Amount paid</dt><dd>{money(item.paidAmount)}</dd></div><div><dt>Balance remaining</dt><dd>{money(Math.max(0, Number(item.netPayable || 0) - Number(item.paidAmount || 0)))}</dd></div></dl></div>
            </div>
            {item.calculationNotes?.length > 0 && <div className="payroll-slip-notes"><strong>Calculation notes</strong>{item.calculationNotes.map((note, i) => <p key={i}>{note}</p>)}</div>}
            <div className="payroll-slip-actions">{isPrincipal && preview && staff && <button className="payroll-secondary-button" type="button" onClick={() => openSalary(staff)}>{staff.currentSalaryStructure ? 'Revise salary structure' : 'Set salary structure'}</button>}{isPrincipal && run?.status === 'approved' && item._id && item.paymentStatus !== 'paid' && <button className="payroll-primary-button" type="button" onClick={() => { setPaymentTarget(item); setPaymentForm({ amount: String(Math.max(0, Number(item.netPayable || 0) - Number(item.paidAmount || 0))), method: 'bank_transfer', date: isoToday(), reference: '' }) }}>Record payment</button>}</div>
          </div></td></tr>}</Fragment>
        })}
      </tbody></table></div>}
      {totals.missing > 0 && <p className="payroll-inline-warning"><CircleAlert size={16}/> {totals.missing} staff member(s) need a salary structure effective for this month before payroll can be generated.</p>}
      <div className="payroll-table-footer">Open View slip for attendance, leave, salary breakdown and payment details.</div>
    </section>

    {salaryTarget && <div className="payroll-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setSalaryTarget(null) }}>
      <section className="payroll-modal payroll-editor" role="dialog" aria-modal="true" aria-labelledby="payroll-salary-modal-title">
        <div className="payroll-panel-heading"><div><span className="payroll-eyebrow">SALARY SETUP</span><h2 id="payroll-salary-modal-title">{salaryTarget.name}</h2><p>Enter the monthly salary details.</p></div><button className="payroll-icon-button" type="button" onClick={() => setSalaryTarget(null)} aria-label="Close" disabled={saving}><X size={18}/></button></div>
        <form onSubmit={saveSalary}>
          <div className="payroll-form-grid payroll-salary-grid">
            <label>Basic monthly salary (₹) *<input type="number" min="0" step="0.01" value={salaryForm.basicSalary} onChange={e => setSalaryForm({ ...salaryForm, basicSalary: e.target.value })} required autoFocus/></label>
            <label>Effective from *<input type="date" value={salaryForm.effectiveFrom} onChange={e => setSalaryForm({ ...salaryForm, effectiveFrom: e.target.value })} required/></label>
          </div>
          <div className="payroll-component-box payroll-pf-settings">
            <div className="payroll-component-heading"><h3>PF deduction</h3><label className="payroll-pf-toggle"><input type="checkbox" checked={salaryForm.pfEnabled} onChange={e => setSalaryForm({ ...salaryForm, pfEnabled: e.target.checked })}/> Enable PF</label></div>
            <label className="payroll-pf-rate">PF rate (%)<input type="number" min="0" max="100" step="0.01" value={salaryForm.pfRate} onChange={e => setSalaryForm({ ...salaryForm, pfRate: e.target.value })} disabled={!salaryForm.pfEnabled} required={salaryForm.pfEnabled}/></label>
          </div>
          <details className="payroll-optional-components"><summary>Additional salary components (optional)</summary>
            <div className="payroll-component-columns">{['allowances', 'recurringDeductions'].map(field => <div className="payroll-component-box" key={field}><div className="payroll-component-heading"><h3>{field === 'allowances' ? 'Allowances' : 'Other deductions'}</h3><button type="button" className="payroll-text-button" onClick={() => setSalaryForm(old => ({ ...old, [field]: [...old[field], { name: '', amount: '' }] }))}><Plus size={14}/> Add</button></div>{salaryForm[field].map((item, i) => <div className="payroll-component-row" key={i}><input aria-label="Component name" placeholder="Name" value={item.name} onChange={e => changeComponent(field, i, 'name', e.target.value)}/><input aria-label="Component amount" type="number" min="0" step="0.01" placeholder="Amount ₹" value={item.amount} onChange={e => changeComponent(field, i, 'amount', e.target.value)}/><button className="payroll-remove-row" type="button" onClick={() => setSalaryForm(old => ({ ...old, [field]: old[field].filter((_, j) => j !== i) }))} aria-label="Remove component"><X size={15}/></button></div>)}</div>)}</div>
          </details>
          <div className="payroll-modal-footer"><span>Monthly gross: <strong>{money(Number(salaryForm.basicSalary || 0) + salaryForm.allowances.reduce((sum, x) => sum + Number(x.amount || 0), 0))}</strong></span><div><button type="button" className="payroll-secondary-button" onClick={() => setSalaryTarget(null)} disabled={saving}>Cancel</button><button className="payroll-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save salary'}</button></div></div>
        </form>
      </section>
    </div>}

    {paymentTarget && <section className="payroll-panel payroll-editor"><div className="payroll-panel-heading"><div><span className="payroll-eyebrow">PAYMENT ENTRY</span><h2>{paymentTarget.name}</h2><p>Record the actual payment made. The remaining balance cannot exceed the approved net salary.</p></div><button className="payroll-icon-button" type="button" onClick={() => setPaymentTarget(null)} aria-label="Close"><X size={18}/></button></div>
      <form className="payroll-form-grid" onSubmit={recordPayment}><label>Amount (₹) *<input type="number" min="0.01" step="0.01" max={Math.max(0, paymentTarget.netPayable - paymentTarget.paidAmount)} value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} required/></label><label>Payment method<select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label><label>Payment date<input type="date" value={paymentForm.date} onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} required/></label><label>Reference / transaction ID<input value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} maxLength={120}/></label><div className="payroll-form-footer"><span>Remaining: <strong>{money(paymentTarget.netPayable - paymentTarget.paidAmount)}</strong></span><button className="payroll-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save payment'}</button></div></form>
    </section>}
    </main>
}

export default PayrollPage
