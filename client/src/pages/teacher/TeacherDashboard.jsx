import { CalendarDays, CheckCircle2, ClipboardList, LockKeyhole, BookOpen, Users } from 'lucide-react'
import StatCard from '../../components/dashboard/StatCard'
import SectionCard from '../../components/dashboard/SectionCard'
import { useAuth } from '../../context/AuthContext'
import './TeacherDashboard.css'

const myClasses = [
  { className: '10-A', subject: 'Mathematics', students: 36, role: 'Subject teacher', attendanceOwner: 'Priya Nair' },
  { className: '10-B', subject: 'Mathematics', students: 34, role: 'Class teacher + Mathematics', attendanceOwner: 'Rahul Mehta' },
  { className: '9-A', subject: 'Mathematics', students: 35, role: 'Subject teacher', attendanceOwner: 'Sneha Kapoor' },
  { className: '8-A', subject: 'Mathematics', students: 32, role: 'Subject teacher', attendanceOwner: 'Amit Joshi' },
]

function TeacherDashboard() {
  const { user } = useAuth()
  const classTeacherClass = myClasses.find((item) => item.attendanceOwner === user?.name)

  return (
    <div className="dashboard-page teacher-dashboard-page">
      <div className="page-heading-row"><div><span className="eyebrow">TEACHER PORTAL</span><h1>Good morning, {user?.name?.split(' ')[0]}.</h1><p>Here is your teaching overview for today.</p></div></div>

      <div className="stats-grid">
        <StatCard label="My Classes" value={myClasses.length} change="2 active today" icon={BookOpen} />
        <StatCard label="Class Teacher" value={classTeacherClass?.className || '—'} change="Daily attendance owner" icon={Users} />
        <StatCard label="Attendance" value="94.1%" change="Today across your class" icon={CheckCircle2} />
        <StatCard label="Assignments" value="12" change="4 pending" trend="down" icon={ClipboardList} />
      </div>

      <div className="dashboard-grid two-one">
        <SectionCard title="My Classes" subtitle="Your teaching assignments remain visible even when another teacher owns the daily attendance register.">
          <div className="teacher-class-list">{myClasses.map((item) => <div className="teacher-class-row" key={item.className}>
            <div className="teacher-class-main"><div className="teacher-class-badge">{item.className}</div><div><strong>{item.subject}</strong><span>{item.students} students · {item.role}</span></div></div>
            <div className={`teacher-class-owner ${item.attendanceOwner === user?.name ? 'owner' : ''}`}><LockKeyhole size={13} /><span>Attendance</span><strong>{item.attendanceOwner}</strong></div>
          </div>)}</div>
        </SectionCard>

        <SectionCard title="Today's classes" subtitle="Your teaching schedule">
          <div className="schedule-list"><div><strong>08:00</strong><span>Mathematics · Class 10-A · Room 204</span></div><div><strong>09:00</strong><span>Mathematics · Class 10-B · Room 106</span></div><div><strong>11:30</strong><span>Mathematics · Class 9-A · Room 301</span></div><div><strong>13:30</strong><span>Remedial session · Library</span></div></div>
        </SectionCard>
      </div>

      <div className="dashboard-grid two-one teacher-dashboard-actions">
        <SectionCard title="Attendance rule" subtitle="Keep the register ownership clear"><div className="teacher-rule-card"><div className="teacher-rule-icon"><CheckCircle2 size={19} /></div><div><strong>{classTeacherClass ? `${classTeacherClass.className} is your class-teacher class.` : 'You are a subject teacher.'}</strong><p>Take daily attendance only for the class where you are the class teacher. In other classes, teach your subject and share student exceptions with the class teacher.</p></div></div></SectionCard>
        <SectionCard title="Quick actions"><div className="quick-grid"><button type="button"><CheckCircle2 size={19} /><span>Mark class attendance</span></button><button type="button"><CalendarDays size={19} /><span>View timetable</span></button><button type="button"><ClipboardList size={19} /><span>Add assignment</span></button><button type="button"><BookOpen size={19} /><span>Enter marks</span></button></div></SectionCard>
      </div>
    </div>
  )
}

export default TeacherDashboard
