import { BookOpen, CheckCircle2, CreditCard, GraduationCap, Users } from 'lucide-react'
import StatCard from '../../components/dashboard/StatCard'
import SectionCard from '../../components/dashboard/SectionCard'
import { useAuth } from '../../context/AuthContext'

function ParentDashboard() {
  const { user } = useAuth()

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">PARENT PORTAL</span>
          <h1>Welcome back, {user?.name?.split(' ')[0]}.</h1>
          <p>Keep track of your children's school activity from one place.</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Children" value="2" change="Both active" icon={Users} />
        <StatCard label="Attendance" value="95.5%" change="1.2%" icon={CheckCircle2} />
        <StatCard label="Fees Due" value="₹12,500" change="Due 30 Sep" trend="down" icon={CreditCard} />
        <StatCard label="Assignments" value="5" change="Across children" icon={BookOpen} />
      </div>

      <div className="dashboard-grid two-one">
        <SectionCard title="My children" subtitle="Quick academic overview">
          <div className="children-list">
            <div className="child-row"><div className="profile-avatar">A</div><div><strong>Aarav Sharma</strong><span>Class 10-A · Attendance 94%</span></div><GraduationCap size={19} /></div>
            <div className="child-row"><div className="profile-avatar">A</div><div><strong>Ananya Sharma</strong><span>Class 6-B · Attendance 97%</span></div><GraduationCap size={19} /></div>
          </div>
        </SectionCard>

        <SectionCard title="Payment summary" subtitle="Current academic year">
          <div className="payment-summary"><span>Total fees</span><strong>₹84,000</strong></div>
          <div className="payment-summary"><span>Paid</span><strong>₹71,500</strong></div>
          <div className="payment-summary pending"><span>Remaining</span><strong>₹12,500</strong></div>
          <button type="button" className="primary-button full-width">View fee details</button>
        </SectionCard>
      </div>
    </div>
  )
}

export default ParentDashboard
