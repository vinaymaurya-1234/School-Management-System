import { CreditCard, IndianRupee, Receipt, TrendingUp, Users } from 'lucide-react'
import StatCard from '../../components/dashboard/StatCard'
import SectionCard from '../../components/dashboard/SectionCard'
import { useAuth } from '../../context/AuthContext'

function AccountantDashboard() {
  const { user } = useAuth()

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">FINANCE PORTAL</span>
          <h1>Good morning, {user?.name?.split(' ')[0]}.</h1>
          <p>Here is the school's current fee collection overview.</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Collected This Month" value="₹18.4L" change="8.2%" icon={IndianRupee} />
        <StatCard label="Pending Fees" value="₹4.8L" change="3.1%" trend="down" icon={CreditCard} />
        <StatCard label="Payments Today" value="47" change="12.5%" icon={TrendingUp} />
        <StatCard label="Receipts Issued" value="1,284" change="6.4%" icon={Receipt} />
      </div>

      <div className="dashboard-grid two-one">
        <SectionCard title="Recent payments" subtitle="Latest fee transactions" action="View all">
          <div className="payment-table">
            <div className="table-row table-head"><span>Student</span><span>Type</span><span>Amount</span></div>
            <div className="table-row"><span><strong>Aarav Sharma</strong><small>Class 10-A</small></span><span>Tuition</span><strong>₹18,000</strong></div>
            <div className="table-row"><span><strong>Riya Shah</strong><small>Class 8-B</small></span><span>Transport</span><strong>₹3,500</strong></div>
            <div className="table-row"><span><strong>Arjun Patel</strong><small>Class 6-A</small></span><span>Tuition</span><strong>₹14,000</strong></div>
          </div>
        </SectionCard>

        <SectionCard title="Collection snapshot" subtitle="This academic year">
          <div className="finance-highlight"><div className="finance-icon"><IndianRupee size={21} /></div><div><span>Total collected</span><strong>₹1.84 Cr</strong></div></div>
          <div className="finance-highlight"><div className="finance-icon"><Users size={21} /></div><div><span>Students with dues</span><strong>126</strong></div></div>
          <button type="button" className="primary-button full-width">Open finance reports</button>
        </SectionCard>
      </div>
    </div>
  )
}

export default AccountantDashboard
