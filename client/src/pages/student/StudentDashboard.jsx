import { Award, BookOpen, CalendarDays, CheckCircle2, ClipboardList } from 'lucide-react'
import StatCard from '../../components/dashboard/StatCard'
import SectionCard from '../../components/dashboard/SectionCard'
import { useAuth } from '../../context/AuthContext'

function StudentDashboard() {
  const { user } = useAuth()

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">STUDENT PORTAL</span>
          <h1>Welcome, {user?.name?.split(' ')[0]}.</h1>
          <p>Class 10-A · Roll No. 24 · Academic Year 2026–27</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Attendance" value="94%" change="1.8%" icon={CheckCircle2} />
        <StatCard label="Assignments" value="8" change="2 due" trend="down" icon={ClipboardList} />
        <StatCard label="Average Score" value="86.4%" change="4.2%" icon={Award} />
        <StatCard label="Next Exam" value="03 Oct" change="Mathematics" icon={BookOpen} />
      </div>

      <div className="dashboard-grid two-one">
        <SectionCard title="Today's timetable" subtitle="Your next classes">
          <div className="schedule-list">
            <div><strong>08:00</strong><span>Mathematics · Room 204</span></div>
            <div><strong>09:00</strong><span>Science · Lab 2</span></div>
            <div><strong>10:30</strong><span>English · Room 101</span></div>
            <div><strong>12:00</strong><span>History · Room 105</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Upcoming" subtitle="Important dates">
          <div className="event-list">
            <div><div className="event-icon"><CalendarDays size={17} /></div><span>Math assignment</span><strong>29 Sep</strong></div>
            <div><div className="event-icon"><CalendarDays size={17} /></div><span>Parent meeting</span><strong>30 Sep</strong></div>
            <div><div className="event-icon"><CalendarDays size={17} /></div><span>Mid-term exams</span><strong>03 Oct</strong></div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

export default StudentDashboard
