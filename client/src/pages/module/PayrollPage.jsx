import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeIndianRupee, CalendarDays, Check, CircleAlert, Clock3, Download, RefreshCw, Search, Users, Wallet, Plus, X } from 'lucide-react'
import apiClient from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './PayrollPage.css'

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0))
const today = new Date()
const defaultMonth = String(today.getMonth() + 1)
const defaultYear = String(today.getFullYear())
const isoToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const blankStaff = { employeeId: '', name: '', email: '', phone: '', designation: 'Teacher', department: '', category: 'teaching', employmentType: 'full_time', joiningDate: isoToday(), userId: '', teacherId: '' }
const blankSalary = { basicSalary: '', allowances: [{ name: 'HRA', amount: '' }], recurringDeductions: [], effectiveFrom: isoToday() }

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
      recurringDeductions: current?.recurringDeductions?.map(x => ({ name: x.name, amount: String(x.amount) })) || [],
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

  const csvExport = () => {
    const rows = [['Employee ID', 'Employee', 'Gross', 'Present', 'Paid leave', 'Unpaid leave', 'Absent', 'Deductions', 'Net payable', 'Paid', 'Payment status'], ...items.map(x => [x.employeeId, x.name, x.grossSalary ?? '', x.presentDays ?? '', x.paidLeaveDays ?? '', x.unpaidLeaveDays ?? '', x.absentDays ?? '', x.totalDeductions ?? '', x.netPayable ?? '', x.paidAmount ?? 0, x.paymentStatus || (preview ? 'Preview' : 'unpaid')])]
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = `payroll-${year}-${month.padStart(2, '0')}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  const changeComponent = (field, index, key, value) => setSalaryForm(old => ({ ...old, [field]: old[field].map((x, i) => i === index ? { ...x, [key]: value } : x) }))
  const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return <main className="payroll-page">
    <header className="payroll-page-header">
      <div><span className="payroll-eyebrow">STAFF FINANCE · PAYROLL OPERATIONS</span><h1>Salary & Payroll</h1><p>Set salary structures, review attendance and approved leave, calculate monthly pay, and track payments in one place.</p></div>
      <div className="payroll-header-actions"><button type="button" className="payroll-secondary-button" onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh</button>{isPrincipal && <button type="button" className="payroll-primary-button" onClick={() => { const next = !staffOpen; setStaffOpen(next); if (next) { setSelectedCandidate(null); setStaffForm(blankStaff); loadStaffCandidates() } }}><Plus size={16}/> Add staff</button>}</div>
    </header>

    {error && <div className="payroll-alert payroll-alert-error" role="alert"><CircleAlert size={18}/><span>{error}</span></div>}
    {notice && <div className="payroll-alert payroll-alert-success" role="status"><Check size={18}/><span>{notice}</span></div>}

    <section className="payroll-period-panel">
      <div className="payroll-period-copy"><span className="payroll-eyebrow">PAY PERIOD</span><h2>{monthLabel}</h2><p>{preview ? 'Live preview from current salary, attendance and approved leave records.' : `Saved payroll snapshot · ${run.status}`}</p></div>
      <div className="payroll-period-controls"><label>Month<select value={month} onChange={e => setMonth(e.target.value)}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{new Date(2026, i, 1).toLocaleDateString('en-IN', { month: 'long' })}</option>)}</select></label><label>Year<select value={year} onChange={e => setYear(e.target.value)}>{Array.from({ length: 7 }, (_, i) => Number(defaultYear) - 3 + i).map(y => <option key={y} value={String(y)}>{y}</option>)}</select></label></div>
      <div className="payroll-period-actions"><button type="button" className="payroll-secondary-button" onClick={csvExport} disabled={!items.length}><Download size={15}/> Export CSV</button>{isPrincipal && preview && <button type="button" className="payroll-primary-button" onClick={generate} disabled={saving || loading || !items.length || totals.missing > 0}>{saving ? 'Processing…' : 'Generate payroll'}</button>}{isPrincipal && run?.status === 'draft' && <button type="button" className="payroll-primary-button" onClick={approve} disabled={saving}>{saving ? 'Processing…' : 'Approve payroll'}</button>}</div>
    </section>

    <section className="payroll-metrics">
      <article><span className="payroll-metric-icon"><Users size={19}/></span><div><small>Staff in payroll</small><strong>{items.length}</strong><span>{totals.missing ? `${totals.missing} need salary setup` : 'Based on active staff'}</span></div></article>
      <article><span className="payroll-metric-icon"><Wallet size={19}/></span><div><small>Gross salary</small><strong>{money(totals.gross)}</strong><span>Before deductions</span></div></article>
      <article><span className="payroll-metric-icon"><CircleAlert size={19}/></span><div><small>Total deductions</small><strong>{money(totals.deductions)}</strong><span>Attendance, unpaid leave and recurring</span></div></article>
      <article><span className="payroll-metric-icon"><BadgeIndianRupee size={19}/></span><div><small>Net payable</small><strong>{money(totals.net)}</strong><span>{money(totals.paid)} paid so far</span></div></article>
    </section>

    {staffOpen && isPrincipal && <section className="payroll-panel">
      <div className="payroll-panel-heading"><div><span className="payroll-eyebrow">STAFF RECORD</span><h2>Add existing staff to payroll</h2><p>Select a teacher from the school list. Available profile details will fill automatically.</p></div><button className="payroll-icon-button" type="button" onClick={() => { setStaffOpen(false); setSelectedCandidate(null) }} aria-label="Close"><X size={18}/></button></div>
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
        <div className="payroll-staff-section-title"><h3>Selected staff details</h3><p>Fetched from the existing teacher and login records. Confirm the details below.</p></div>
        <label>Employee ID<input value={staffForm.employeeId} readOnly/></label>
        <label>Full name<input value={staffForm.name} readOnly/></label>
        <label>Designation<input value={staffForm.designation} readOnly/></label>
        <label>Department<input value={staffForm.department} readOnly/></label>
        <label>Email<input value={staffForm.email} readOnly/></label>
        <label>Phone<input value={staffForm.phone} readOnly/></label>
        <label>Joining date<input type="date" value={staffForm.joiningDate} readOnly/></label>
        <label>Qualification<input value={selectedCandidate.qualification || 'Not provided'} readOnly/></label>
        <label>Specialization / subject<input value={selectedCandidate.specialization || 'Not provided'} readOnly/></label>
        <label>Gender<input value={selectedCandidate.gender || 'Not provided'} readOnly/></label>
        <label>Date of birth<input value={selectedCandidate.dateOfBirth ? String(selectedCandidate.dateOfBirth).slice(0, 10) : 'Not provided'} readOnly/></label>
        <label>Address<input value={selectedCandidate.address || 'Not provided'} readOnly/></label>
        <label>Employment type<select value={staffForm.employmentType} onChange={e => setStaffForm({ ...staffForm, employmentType: e.target.value })}><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option></select></label>
        <label>Payroll category<select value={staffForm.category} onChange={e => setStaffForm({ ...staffForm, category: e.target.value })}><option value="teaching">Teaching</option><option value="administration">Administration</option><option value="finance">Finance</option><option value="support">Support</option><option value="other">Other</option></select></label>
        <div className="payroll-form-footer"><span>Login credentials are not created or changed. Salary is set in the next step.</span><button className="payroll-primary-button" disabled={saving}>{saving ? 'Adding…' : 'Add selected staff'}</button></div>
      </form>}
    </section>}

    <section className="payroll-panel">
      <div className="payroll-toolbar"><div><span className="payroll-eyebrow">MONTHLY REGISTER</span><h2>Salary calculation</h2><p>Per-day rate uses monthly gross divided by calendar days in the selected month. Missing attendance is flagged, not automatically deducted.</p></div><label className="payroll-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter staff by name or employee ID…"/></label></div>
      {loading ? <div className="payroll-empty"><RefreshCw size={22}/><strong>Loading payroll…</strong></div> : !items.length ? <div className="payroll-empty"><CalendarDays size={24}/><strong>No staff records found</strong><span>Add staff profiles and set salary structures to start.</span></div> : <div className="payroll-table-wrap"><table className="payroll-table"><thead><tr><th>Employee</th><th>Gross</th><th>Attendance</th><th>Paid / unpaid leave</th><th>Absence</th><th>Deductions</th><th>Net payable</th><th>Status / action</th></tr></thead><tbody>
        {items.filter(x => !query.trim() || `${x.name} ${x.employeeId}`.toLowerCase().includes(query.trim().toLowerCase())).map((item, index) => {
          const staff = employees.find(x => String(x.id) === String(item.employee))
          const isMissing = item.needsSalarySetup
          const paymentStatus = item.paymentStatus || (preview ? 'Preview' : 'unpaid')
          return <tr key={item._id || item.employee || index}><td><strong>{item.name}</strong><span className="payroll-table-subtext">{item.employeeId} · {item.designation || 'Staff'}</span>{item.calculationNotes?.length > 0 && <details className="payroll-row-notes"><summary>Calculation notes</summary>{item.calculationNotes.map((note, i) => <p key={i}>{note}</p>)}</details>}</td><td>{isMissing ? '—' : money(item.grossSalary)}</td><td><span className="payroll-count">{item.presentDays ?? '—'} present</span><span className="payroll-table-subtext">{item.absentDays ?? '—'} absent · {item.lateDays ?? '—'} late</span></td><td><span className="payroll-count">{item.paidLeaveDays ?? '—'} paid</span><span className="payroll-table-subtext">{item.unpaidLeaveDays ?? '—'} unpaid</span></td><td>{isMissing ? '—' : money(item.attendanceDeduction + item.unpaidLeaveDeduction)}</td><td>{isMissing ? '—' : money(item.totalDeductions)}</td><td><strong>{isMissing ? 'Salary setup needed' : money(item.netPayable)}</strong><span className="payroll-table-subtext">{!preview && `${money(item.paidAmount)} paid`}</span></td><td><span className={`payroll-status ${isMissing ? 'payroll-status-missing' : paymentStatus === 'paid' ? 'payroll-status-ready' : ''}`}>{isMissing ? 'Needs setup' : paymentStatus}</span>{isPrincipal && preview && staff && <button className="payroll-row-action" type="button" onClick={() => openSalary(staff)}>{staff.currentSalaryStructure ? 'Revise salary' : 'Set salary'}</button>}{isPrincipal && run?.status === 'approved' && item._id && item.paymentStatus !== 'paid' && <button className="payroll-row-action" type="button" onClick={() => { setPaymentTarget(item); setPaymentForm({ amount: String(Math.max(0, Number(item.netPayable || 0) - Number(item.paidAmount || 0))), method: 'bank_transfer', date: isoToday(), reference: '' }) }}>Record payment</button>}</td></tr>
        })}
      </tbody></table></div>}
      {totals.missing > 0 && <p className="payroll-inline-warning"><CircleAlert size={16}/> {totals.missing} staff member(s) need a salary structure effective for this month before payroll can be generated.</p>}
      <div className="payroll-table-footer">Attendance is linked through each employee’s teacher profile. Approved casual/sick/earned leave is treated as paid; approved emergency/other leave as unpaid. PF/ESIC/PT/TDS amounts are not automatically computed.</div>
    </section>

    {salaryTarget && <section className="payroll-panel payroll-editor"><div className="payroll-panel-heading"><div><span className="payroll-eyebrow">SALARY STRUCTURE</span><h2>{salaryTarget.name}</h2><p>Monthly salary components. Changes are effective-dated and do not rewrite past payroll snapshots.</p></div><button className="payroll-icon-button" type="button" onClick={() => setSalaryTarget(null)} aria-label="Close"><X size={18}/></button></div>
      <form onSubmit={saveSalary}><div className="payroll-form-grid payroll-salary-grid"><label>Basic monthly salary (₹) *<input type="number" min="0" step="0.01" value={salaryForm.basicSalary} onChange={e => setSalaryForm({ ...salaryForm, basicSalary: e.target.value })} required/></label><label>Effective from *<input type="date" value={salaryForm.effectiveFrom} onChange={e => setSalaryForm({ ...salaryForm, effectiveFrom: e.target.value })} required/></label></div>
      <div className="payroll-component-columns">{['allowances', 'recurringDeductions'].map(field => <div className="payroll-component-box" key={field}><div className="payroll-component-heading"><h3>{field === 'allowances' ? 'Monthly allowances' : 'Recurring deductions'}</h3><button type="button" className="payroll-text-button" onClick={() => setSalaryForm(old => ({ ...old, [field]: [...old[field], { name: '', amount: '' }] }))}><Plus size={14}/> Add</button></div>{salaryForm[field].map((item, i) => <div className="payroll-component-row" key={i}><input aria-label="Component name" placeholder="Component name" value={item.name} onChange={e => changeComponent(field, i, 'name', e.target.value)}/><input aria-label="Component amount" type="number" min="0" step="0.01" placeholder="Amount ₹" value={item.amount} onChange={e => changeComponent(field, i, 'amount', e.target.value)}/><button className="payroll-remove-row" type="button" onClick={() => setSalaryForm(old => ({ ...old, [field]: old[field].filter((_, j) => i !== j) }))} aria-label="Remove component"><X size={15}/></button></div>)}</div>)}</div>
      <div className="payroll-form-footer"><span>Estimated full-month gross: <strong>{money(Number(salaryForm.basicSalary || 0) + salaryForm.allowances.reduce((sum, x) => sum + Number(x.amount || 0), 0))}</strong></span><button className="payroll-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save salary structure'}</button></div></form>
    </section>}

    {paymentTarget && <section className="payroll-panel payroll-editor"><div className="payroll-panel-heading"><div><span className="payroll-eyebrow">PAYMENT ENTRY</span><h2>{paymentTarget.name}</h2><p>Record the actual payment made. The remaining balance cannot exceed the approved net salary.</p></div><button className="payroll-icon-button" type="button" onClick={() => setPaymentTarget(null)} aria-label="Close"><X size={18}/></button></div>
      <form className="payroll-form-grid" onSubmit={recordPayment}><label>Amount (₹) *<input type="number" min="0.01" step="0.01" max={Math.max(0, paymentTarget.netPayable - paymentTarget.paidAmount)} value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} required/></label><label>Payment method<select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label><label>Payment date<input type="date" value={paymentForm.date} onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} required/></label><label>Reference / transaction ID<input value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} maxLength={120}/></label><div className="payroll-form-footer"><span>Remaining: <strong>{money(paymentTarget.netPayable - paymentTarget.paidAmount)}</strong></span><button className="payroll-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save payment'}</button></div></form>
    </section>}
    <p className="payroll-privacy-note"><Clock3 size={15}/> Payroll is school-scoped. Preview values use current approved records; generated payroll is a saved snapshot, and payment status changes only when a payment is recorded.</p>
  </main>
}

export default PayrollPage
