import { BookOpen, CalendarDays, CheckCircle2, ClipboardList, Users } from 'lucide-react'
import StatCard from '../../components/dashboard/StatCard'
import SectionCard from '../../components/dashboard/SectionCard'
import { useAuth } from '../../context/AuthContext'

function TeacherDashboard() {
  const { user } = useAuth()

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">TEACHER PORTAL</span>
          <h1>Good morning, {user?.name?.split(' ')[0]}.</h1>
          <p>Here is your teaching overview for today.</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="My Classes" value="6" change="2 active today" icon={BookOpen} />
        <StatCard label="My Students" value="184" change="3 new" icon={Users} />
        <StatCard label="Attendance" value="96.1%" change="2.4%" icon={CheckCircle2} />
        <StatCard label="Assignments" value="12" change="4 pending" trend="down" icon={ClipboardList} />
      </div>

      <div className="dashboard-grid two-one">
        <SectionCard title="Today's classes" subtitle="Your teaching schedule">
          <div className="schedule-list">
            <div><strong>08:00</strong><span>Mathematics · Class 10-A · Room 204</span></div>
            <div><strong>09:00</strong><span>Mathematics · Class 9-B · Room 106</span></div>
            <div><strong>11:30</strong><span>Mathematics · Class 8-A · Room 301</span></div>
            <div><strong>13:30</strong><span>Remedial session · Library</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Quick actions">
          <div className="quick-grid">
            <button type="button"><CheckCircle2 size={19} /><span>Mark attendance</span></button>
            <button type="button"><ClipboardList size={19} /><span>Add assignment</span></button>
            <button type="button"><CalendarDays size={19} /><span>View timetable</span></button>
            <button type="button"><BookOpen size={19} /><span>Enter marks</span></button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

export default TeacherDashboard
