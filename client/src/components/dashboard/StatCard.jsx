import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

function StatCard({ label, value, change, trend = 'up', icon: Icon }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <div className="stat-icon">
          <Icon size={19} />
        </div>
        <span className={`trend ${trend}`}>
          {trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {change}
        </span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </article>
  )
}

export default StatCard
