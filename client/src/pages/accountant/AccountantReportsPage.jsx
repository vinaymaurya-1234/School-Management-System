import { useEffect, useMemo, useState } from 'react'
import { Download, IndianRupee, RefreshCw, Wallet, CreditCard, AlertCircle } from 'lucide-react'
import apiClient from '../../api/client'

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0)

export default function AccountantReportsPage() {
  const [summary, setSummary] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await apiClient.get('/fees/summary')
      setSummary(data.summary || null)
      setPayments(Array.isArray(data.payments) ? data.payments : [])
    } catch (requestError) {
      setSummary(null)
      setPayments([])
      setError(requestError.response?.data?.message || 'Financial report data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    apiClient.get('/fees/summary')
      .then(({ data }) => {
        if (!active) return
        setSummary(data.summary || null)
        setPayments(Array.isArray(data.payments) ? data.payments : [])
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.response?.data?.message || 'Financial report data could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const verifiedPayments = useMemo(() => payments.filter((payment) => payment.status === 'verified'), [payments])
  const exportPayments = () => {
    if (!payments.length) return
    const rows = [
      ['Student', 'Amount', 'Method', 'Status', 'Date', 'Receipt'],
      ...payments.map((payment) => [
        payment.student?.name || 'Student',
        payment.amount ?? '',
        payment.offlineMethod || payment.method || '',
        payment.status || '',
        payment.createdAt || '',
        payment.receiptNumber || '',
      ]),
    ]
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'school-financial-payments.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="accountant-reports-page">
      <header className="page-heading-row">
        <div><span className="eyebrow">FINANCE / REPORTS</span><h1>Financial reports</h1><p>Current fee-account balances and recorded payment activity from the school database.</p></div>
        <div className="accountant-report-actions">
          <button type="button" className="secondary-button" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
          <button type="button" className="primary-button" onClick={exportPayments} disabled={!payments.length}><Download size={15} /> Export payments</button>
        </div>
      </header>
      {error && <div className="dashboard-notice" role="alert">{error}</div>}
      <section className="stats-grid">
        <article className="stat-card"><div className="stat-card-top"><div className="stat-icon"><Wallet size={19} /></div></div><div className="stat-label">Fees assigned</div><div className="stat-value">{loading ? '—' : money(summary?.feesAssigned)}</div></article>
        <article className="stat-card"><div className="stat-card-top"><div className="stat-icon"><IndianRupee size={19} /></div></div><div className="stat-label">Collected</div><div className="stat-value">{loading ? '—' : money(summary?.collected)}</div></article>
        <article className="stat-card"><div className="stat-card-top"><div className="stat-icon"><CreditCard size={19} /></div></div><div className="stat-label">Outstanding</div><div className="stat-value">{loading ? '—' : money(summary?.outstanding)}</div></article>
        <article className="stat-card"><div className="stat-card-top"><div className="stat-icon"><AlertCircle size={19} /></div></div><div className="stat-label">Overdue accounts</div><div className="stat-value">{loading ? '—' : String(summary?.overdueAccounts ?? 0)}</div></article>
      </section>
      <section className="accountant-report-panel">
        <header><div><span className="eyebrow">PAYMENT REGISTER</span><h2>Latest recorded payments</h2><p>{verifiedPayments.length} verified payments in the latest returned records</p></div><span className="accountant-report-total"><IndianRupee size={16} />{loading ? '—' : money(verifiedPayments.reduce((total, item) => total + Number(item.amount || 0), 0))}</span></header>
        {loading ? <div className="accountant-directory-empty">Loading payment records…</div> : payments.length ? <div className="accountant-directory-table-wrap"><table className="accountant-directory-table"><thead><tr><th>Student</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead><tbody>
          {payments.map((payment) => <tr key={payment._id}><td><strong>{payment.student?.name || 'Student'}</strong><small>{payment.receiptNumber || 'No receipt number'}</small></td><td>{money(payment.amount)}</td><td>{payment.offlineMethod || payment.method || '—'}</td><td><span className={payment.status === 'verified' ? 'accountant-status-active' : 'accountant-status-inactive'}>{String(payment.status || 'unknown').replaceAll('_', ' ')}</span></td><td>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-IN') : '—'}</td></tr>)}
        </tbody></table></div> : <div className="accountant-directory-empty"><Wallet size={24} /><strong>No payment records yet</strong><span>Recorded transactions will appear here when finance payments are entered.</span></div>}
      </section>
    </main>
  )
}
