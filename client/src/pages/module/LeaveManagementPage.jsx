import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, FileCheck2, RefreshCw, Send, ShieldCheck, XCircle } from 'lucide-react'
import apiClient from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './LeaveManagementPage.css'

const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const blankForm = () => ({ leaveType: 'casual', startDate: today(), endDate: today(), halfDay: false, reason: '' })
const labels = { casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave', emergency: 'Emergency Leave', other: 'Other' }
const statusLabel = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' }
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'
const daysFor = (form) => form.halfDay ? 0.5 : Math.max(0, Math.round((new Date(`${form.endDate}T00:00:00Z`) - new Date(`${form.startDate}T00:00:00Z`)) / 86400000) + 1)

export default function LeaveManagementPage() {
  const { user } = useAuth()
  const isPrincipal = user?.role === 'principal'
  const [requests, setRequests] = useState([])
  const [balance, setBalance] = useState(null)
  const [policy, setPolicy] = useState({ casual: 0, sick: 0, earned: 0 })
  const [filter, setFilter] = useState('pending')
  const [form, setForm] = useState(blankForm)
  const [showApplicationForm, setShowApplicationForm] = useState(false)
  const [reviewNotes, setReviewNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (isPrincipal) {
        const response = await apiClient.get('/leave', { params: { status: filter } })
        setRequests(response.data?.requests || [])
        setPolicy(response.data?.policy || { casual: 0, sick: 0, earned: 0 })
      } else {
        const response = await apiClient.get('/leave/mine')
        setRequests(response.data?.requests || [])
        setBalance(response.data?.balance || null)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load leave records. Check the server and database connection.')
    } finally { setLoading(false) }
  }, [isPrincipal, filter])

  useEffect(() => { load() }, [load])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await apiClient.post('/leave', { ...form, totalDays: daysFor(form) })
      setNotice(response.data?.message || 'Leave application submitted.')
      setForm(blankForm())
      setShowApplicationForm(false)
      await load()
    } catch (err) { setError(err.response?.data?.message || 'Could not submit leave application.') }
    finally { setSaving(false) }
  }

  const cancelRequest = async (id) => {
    setSaving(true); setError(''); setNotice('')
    try { const response = await apiClient.post(`/leave/${id}/cancel`); setNotice(response.data?.message || 'Request withdrawn.'); await load() }
    catch (err) { setError(err.response?.data?.message || 'Could not withdraw this request.') }
    finally { setSaving(false) }
  }

  const decide = async (request, decision) => {
    const reviewNote = (reviewNotes[request.id] || '').trim()
    if (decision === 'rejected' && !reviewNote) { setError('Enter a rejection reason before rejecting the request.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await apiClient.post(`/leave/${request.id}/decision`, { decision, reviewNote })
      setNotice(response.data?.message || 'Decision saved.')
      await load()
    } catch (err) { setError(err.response?.data?.message || 'Could not update leave request.') }
    finally { setSaving(false) }
  }

  const savePolicy = async (event) => {
    event.preventDefault()
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await apiClient.put('/leave/policy', { quotas: { casual: Number(policy.casual), sick: Number(policy.sick), earned: Number(policy.earned) } })
      setPolicy(response.data?.policy || policy)
      setNotice('Annual leave quotas saved.')
    } catch (err) { setError(err.response?.data?.message || 'Could not save leave quotas.') }
    finally { setSaving(false) }
  }

  const pendingCount = useMemo(() => requests.filter((item) => item.status === 'pending').length, [requests])
  if (loading && !requests.length) return <div className="leave-page"><div className="leave-empty"><RefreshCw className="leave-spin" size={20}/>Loading leave management…</div></div>

  return <main className="leave-page">
    <header className="leave-hero">
      <div><span className="leave-eyebrow">{isPrincipal ? 'STAFF OPERATIONS' : 'YOUR STAFF BENEFITS'}</span><h1>{isPrincipal ? 'Leave Management' : 'My Leave'}</h1><p>{isPrincipal ? 'Review staff leave requests, manage annual quotas and keep decisions transparent.' : 'Apply for leave, track the principal’s decision and review your remaining leave balance.'}</p></div>
      {!isPrincipal && <button type="button" className="leave-primary" onClick={() => setShowApplicationForm((open) => !open)} aria-expanded={showApplicationForm}><Send size={16}/>{showApplicationForm ? 'Close form' : 'Leave'}</button>}
    </header>
    {error && <div className="leave-alert error"><AlertCircle size={17}/><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    {notice && <div className="leave-alert success"><CheckCircle2 size={17}/><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}

    {isPrincipal ? <>
      <section className="leave-panel">
        <div className="leave-panel-head"><div><span className="leave-eyebrow">ANNUAL POLICY</span><h2>Leave quota per teacher</h2><p>Set the school’s annual paid leave allowance. Quotas start at zero until configured; existing approvals count against each teacher’s balance.</p></div><ShieldCheck size={23}/></div>
        <form className="leave-policy-form" onSubmit={savePolicy}>
          {['casual', 'sick', 'earned'].map((type) => <label key={type}>{labels[type]} (days)<input type="number" min="0" max="366" step="0.5" required value={policy[type] ?? 0} onChange={(event) => setPolicy((current) => ({ ...current, [type]: event.target.value }))}/></label>)}
          <button className="leave-primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save quotas'}</button>
        </form>
      </section>
      <section className="leave-panel">
        <div className="leave-panel-head"><div><span className="leave-eyebrow">APPLICATION INBOX</span><h2>Staff leave requests</h2><p>{filter === 'pending' ? 'Review applications awaiting your decision.' : 'Review past decisions and application history.'}</p></div><span className="leave-count">{pendingCount} pending in view</span></div>
        <div className="leave-toolbar"><div className="leave-filters">{['pending','approved','rejected','cancelled','all'].map((value) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div></div>
        <div className="leave-request-list">
          {requests.length ? requests.map((item) => <article className="leave-request-card" key={item.id}>
            <div className="leave-request-top"><div className="leave-person"><span className="leave-avatar">{item.teacher?.name?.charAt(0) || 'T'}</span><div><strong>{item.teacher?.name || 'Teacher'}</strong><small>{item.teacher?.email || 'Staff account'} · Applied {dateLabel(item.createdAt)}</small></div></div><span className={`leave-status ${item.status}`}>{statusLabel[item.status] || item.status}</span></div>
            <div className="leave-request-details"><div><small>Leave type</small><strong>{labels[item.leaveType] || item.leaveType}</strong></div><div><small>Dates</small><strong>{dateLabel(item.startDate)} – {dateLabel(item.endDate)}</strong></div><div><small>Duration</small><strong>{item.totalDays} day{item.totalDays === 1 ? '' : 's'}{item.halfDay ? ' · Half day' : ''}</strong></div></div>
            <div className="leave-reason"><small>Reason</small><p>{item.reason}</p></div>
            {item.reviewNote && <div className="leave-review-note"><strong>{item.status === 'rejected' ? 'Rejection reason' : 'Principal note'}:</strong> {item.reviewNote}</div>}
            {item.status === 'pending' && <div className="leave-decision"><label>Review note{filter === 'pending' ? ' (required for rejection)' : ''}<textarea value={reviewNotes[item.id] || ''} maxLength={1000} onChange={(event) => setReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Add feedback for the teacher…"/></label><div><button className="leave-secondary" type="button" disabled={saving} onClick={() => decide(item, 'rejected')}><XCircle size={16}/> Reject</button><button className="leave-primary" type="button" disabled={saving} onClick={() => decide(item, 'approved')}><CheckCircle2 size={16}/> Approve</button></div></div>}
          </article>) : <div className="leave-empty"><FileCheck2 size={28}/><strong>No leave requests here</strong><span>Applications matching this filter will appear here.</span></div>}
        </div>
      </section>
    </> : <>
      <section className="leave-balance-grid">
        {['casual','sick','earned'].map((type) => <article className="leave-balance-card" key={type}><span className="leave-balance-icon"><CalendarDays size={19}/></span><div><small>{labels[type]}</small><strong>{balance?.leaveTypes?.[type]?.remaining ?? '—'} <span>days left</span></strong><p>{balance?.leaveTypes?.[type]?.used ?? 0} used of {balance?.leaveTypes?.[type]?.quota ?? 0} days</p></div></article>)}
      </section>
      {balance && !balance.policyConfigured && <div className="leave-alert info"><ShieldCheck size={17}/><span>Leave quotas have not been configured yet. You can submit requests, but the principal must configure quotas before approving Casual, Sick or Earned Leave.</span></div>}
      {showApplicationForm && <section className="leave-panel leave-application-panel">
        <div className="leave-panel-head"><div><span className="leave-eyebrow">NEW APPLICATION</span><h2>Apply for leave</h2><p>Past-date requests require an emergency or medical reason. Duplicate and overlapping pending/approved requests are blocked.</p></div><Send size={22}/></div>
        <form className="leave-application-form" onSubmit={submit}>
          <label>Leave type<select value={form.leaveType} onChange={(event) => setForm((current) => ({ ...current, leaveType: event.target.value }))}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Start date<input type="date" required value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value, endDate: current.endDate < event.target.value ? event.target.value : current.endDate }))}/></label>
          <label>End date<input type="date" min={form.startDate} required value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}/></label>
          <label className="leave-halfday"><input type="checkbox" checked={form.halfDay} onChange={(event) => setForm((current) => ({ ...current, halfDay: event.target.checked, endDate: event.target.checked ? current.startDate : current.endDate }))}/> Half-day leave (single date only)</label>
          <div className="leave-duration"><Clock3 size={18}/><span>Requested duration</span><strong>{daysFor(form)} day{daysFor(form) === 1 ? '' : 's'}</strong></div>
          <label className="leave-reason-field">Reason<textarea required minLength={5} maxLength={1000} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Explain why you need leave. For past-date requests, mention the medical/emergency reason." /></label>
          <div className="leave-form-footer"><span>Submitting sends this application to your principal. Leave balance changes only after approval.</span><button className="leave-primary" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit application'} <Send size={16}/></button></div>
        </form>
      </section>}
      <section className="leave-panel">
        <div className="leave-panel-head"><div><span className="leave-eyebrow">YOUR HISTORY</span><h2>My applications</h2><p>Track every application and the principal’s decision.</p></div><span className="leave-count">{requests.length} records</span></div>
        <div className="leave-request-list">
          {requests.length ? requests.map((item) => <article className="leave-request-card" key={item.id}>
            <div className="leave-request-top"><div><strong>{labels[item.leaveType] || item.leaveType}</strong><small>Applied {dateLabel(item.createdAt)}</small></div><span className={`leave-status ${item.status}`}>{statusLabel[item.status] || item.status}</span></div>
            <div className="leave-request-details"><div><small>Dates</small><strong>{dateLabel(item.startDate)} – {dateLabel(item.endDate)}</strong></div><div><small>Duration</small><strong>{item.totalDays} day{item.totalDays === 1 ? '' : 's'}</strong></div></div>
            <div className="leave-reason"><small>Reason</small><p>{item.reason}</p></div>
            {item.reviewNote && <div className="leave-review-note"><strong>{item.status === 'rejected' ? 'Rejection reason' : 'Principal note'}:</strong> {item.reviewNote}</div>}
            {item.status === 'pending' && <div className="leave-request-actions"><span>Waiting for principal review</span><button type="button" className="leave-secondary" disabled={saving} onClick={() => cancelRequest(item.id)}>Withdraw request</button></div>}
            {item.status === 'approved' && <div className="leave-inline-success"><CheckCircle2 size={16}/> Approved by principal{item.reviewedAt ? ` on ${dateLabel(item.reviewedAt)}` : ''}.</div>}
            {item.status === 'rejected' && <div className="leave-inline-rejected"><XCircle size={16}/> Request rejected{item.reviewNote ? `: ${item.reviewNote}` : '.'}</div>}
          </article>) : <div className="leave-empty"><FileCheck2 size={28}/><strong>No applications yet</strong><span>Submit your first leave request using the form above.</span></div>}
        </div>
      </section>
    </>}
  </main>
}
