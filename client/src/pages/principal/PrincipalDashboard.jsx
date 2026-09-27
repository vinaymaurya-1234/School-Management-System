import { CalendarDays, CheckCircle2, GraduationCap, IndianRupee, Users } from 'lucide-react'
import StatCard from '../../components/dashboard/StatCard'
import SectionCard from '../../components/dashboard/SectionCard'
import { useAuth } from '../../context/AuthContext'

const activities = [
  ['New teacher added', 'Priya Nair joined the faculty', '10 min ago'],
  ['Attendance updated', 'Class 10-A attendance completed', '32 min ago'],
  ['Fee payment received', '₹24,500 collected today', '1 hr ago'],
  ['Exam schedule published', 'Mid-term timetable is ready', '2 hrs ago'],
]

function PrincipalDashboard() {
  const { user } = useAuth()

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h1>Good morning, {user?.name?.split(' ')[1] || 'Principal'}.</h1>
          <p>Here is what is happening across Academy School today.</p>
        </div>
        <button className="primary-button" type="button">+ Add new</button>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Students" value="1,245" change="4.8%" icon={Users} />
        <StatCard label="Teachers" value="68" change="2.1%" icon={GraduationCap} />
        <StatCard label="Today's Attendance" value="92.4%" change="1.7%" icon={CheckCircle2} />
        <StatCard label="Fees Collected" value="₹18.4L" change="8.2%" icon={IndianRupee} />
      </div>

      <div className="dashboard-grid two-one">
        <SectionCard title="Attendance overview" subtitle="Student attendance over the current week" action="View report">
          <div className="chart-placeholder">
            {[58, 72, 66, 82, 76, 92, 86].map((height, index) => (
              <div className="chart-column" key={index}>
                <div className="chart-bar" style={{ height: `${height}%` }} />
                <span>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'][index]}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Today's schedule" subtitle="Friday, 27 September" action="View timetable">
          <div className="schedule-list">
            <div><strong>08:00</strong><span>Assembly · Main Ground</span></div>
            <div><strong>10:30</strong><span>Staff meeting · Conference Room</span></div>
            <div><strong>12:00</strong><span>Parent meeting · Room 204</span></div>
            <div><strong>15:30</strong><span>Academic review · Principal Office</span></div>
          </div>
        </SectionCard>
      </div>

      <div className="dashboard-grid two-one">
        <SectionCard title="Recent activity" subtitle="Latest changes across the school" action="View all">
          <div className="activity-list">
            {activities.map(([title, description, time]) => (
              <div className="activity-row" key={title}>
                <div className="activity-dot" />
                <div>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </div>
                <small>{time}</small>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Upcoming events" subtitle="Next 7 days">
          <div className="event-list">
            <div><div className="event-icon"><CalendarDays size={17} /></div><span>Parent-Teacher Meeting</span><strong>30 Sep</strong></div>
            <div><div className="event-icon"><CalendarDays size={17} /></div><span>Mid-term Examinations</span><strong>03 Oct</strong></div>
            <div><div className="event-icon"><CalendarDays size={17} /></div><span>Sports Day</span><strong>06 Oct</strong></div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

export default PrincipalDashboard
