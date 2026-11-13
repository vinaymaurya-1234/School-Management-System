import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CreditCard, IndianRupee, Receipt, RefreshCw, TrendingUp, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import apiClient from '../../api/client'
import StatCard from '../../components/dashboard/StatCard'
import SectionCard from '../../components/dashboard/SectionCard'
import { useAuth } from '../../context/AuthContext'

const currency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0)

const dateTime = (value) => value
  ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—'

function AccountantDashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await apiClient.get('/fees/summary')
      setSummary(data.summary || null)
      setPayments(Array.isArray(data.payments) ? data.payments : [])
    } catch (requestError) {
      setSummary(null)
      setPayments([])
      setError(requestError.response?.data?.message || 'Finance summary could not be loaded. Please retry.')
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
        setSummary(null)
        setPayments([])
        setError(requestError.response?.data?.message || 'Finance summary could not be loaded. Please retry.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const recentPayments = useMemo(() => payments.slice(0, 8), [payments])

  return (
    <div className="dashboard-page accountant-dashboard">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">FINANCE PORTAL</span>
          <h1>Welcome, {user?.name?.split(' ')[0] || 'Accountant'}.</h1>
          <p>Live fee collection and outstanding balances from your school's finance records.</p>
        </div>
        <button type="button" className="secondary-button" onClick={loadDashboard} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <div className="dashboard-notice" role="alert">{error}</div>}

      <div className="stats-grid">
        <StatCard label="Fees assigned" value={loading ? '—' : currency(summary?.feesAssigned)} icon={Wallet} />
        <StatCard label="Collected" value={loading ? '—' : currency(summary?.collected)} icon={IndianRupee} />
        <StatCard label="Outstanding" value={loading ? '—' : currency(summary?.outstanding)} trend="down" icon={CreditCard} />
        <StatCard label="Overdue accounts" value={loading ? '—' : String(summary?.overdueAccounts ?? 0)} icon={TrendingUp} />
      </div>

      <div className="dashboard-grid two-one">
        <SectionCard title="Recent payments" subtitle="Latest recorded fee transactions" action="View all">
          {loading ? (
            <div className="accountant-dashboard-empty">Loading saved payments…</div>
          ) : recentPayments.length ? (
            <div className="payment-table">
              <div className="table-row table-head"><span>Student</span><span>Recorded</span><span>Amount</span></div>
              {recentPayments.map((payment) => (
                <div className="table-row" key={payment._id}>
                  <span><strong>{payment.student?.name || 'Student account'}</strong><small>{payment.receiptNumber || payment.status?.replaceAll('_', ' ') || 'Payment'}</small></span>
                  <span>{dateTime(payment.createdAt)}</span>
                  <strong>{currency(payment.amount)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="accountant-dashboard-empty">
              <Receipt size={22} />
              <strong>No payment records yet</strong>
              <span>Verified and pending transactions will appear here after they are recorded.</span>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Finance workspace" subtitle="Continue with a finance task">
          <div className="finance-highlight">
            <div className="finance-icon"><IndianRupee size={21} /></div>
            <div><span>Current outstanding balance</span><strong>{loading ? '—' : currency(summary?.outstanding)}</strong></div>
          </div>
          <Link to="/module/fees" className="primary-button full-width">Open fees & payments <ArrowRight size={15} /></Link>
          <Link to="/module/reports" className="secondary-button full-width">Open financial reports <ArrowRight size={15} /></Link>
          <Link to="/module/payroll" className="secondary-button full-width">Open payroll <ArrowRight size={15} /></Link>
        </SectionCard>
      </div>
    </div>
  )
}

export default AccountantDashboard
