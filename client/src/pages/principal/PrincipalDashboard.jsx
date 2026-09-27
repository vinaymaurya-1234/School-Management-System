import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  IndianRupee,
  MoreHorizontal,
  Plus,
  UserPlus,
  Users,
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import './PrincipalDashboard.css'

const stats = [
  { label: 'Total students', value: '1,245', change: '+4.8%', note: 'vs last month', icon: Users, tone: 'indigo' },
  { label: 'Teaching staff', value: '68', change: '+2.1%', note: '3 new this month', icon: GraduationCap, tone: 'violet' },
  { label: "Today's attendance", value: '92.4%', change: '+1.7%', note: 'vs yesterday', icon: CheckCircle2, tone: 'green' },
  { label: 'Fees collected', value: '₹18.4L', change: '+8.2%', note: 'this academic year', icon: IndianRupee, tone: 'amber' },
]

const attendance = [78, 86, 82, 91, 88, 94, 92]
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today']

const activities = [
  { title: 'New teacher added', text: 'Priya Nair joined the faculty', time: '10 min ago', tone: 'violet' },
  { title: 'Attendance completed', text: 'Class 10-A attendance was marked', time: '32 min ago', tone: 'green' },
  { title: 'Fee payment received', text: '₹24,500 payment received from 10-B', time: '1 hr ago', tone: 'amber' },
  { title: 'Exam schedule published', text: 'Mid-term timetable is ready', time: '2 hrs ago', tone: 'indigo' },
]

const schedule = [
  ['08:00', 'Morning assembly', 'Main ground'],
  ['10:30', 'Staff meeting', 'Conference room'],
  ['12:00', 'Parent meeting', 'Room 204'],
  ['15:30', 'Academic review', 'Principal office'],
]

const events = [
  ['30', 'SEP', 'Parent-Teacher Meeting', 'Monday · 9:00 AM'],
  ['03', 'OCT', 'Mid-term examinations', 'Thursday · All day'],
  ['06', 'OCT', 'Annual sports day', 'Sunday · Main ground'],
]

const quickActions = [
  { label: 'Add student', icon: UserPlus },
  { label: 'Add teacher', icon: GraduationCap },
  { label: 'Create notice', icon: FileText },
  { label: 'View timetable', icon: CalendarDays },
]

function PrincipalDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0] || 'Principal'

  return (
    <div className="principal-dashboard">
      <section className="principal-hero">
        <div className="hero-copy">
          <div className="principal-kicker-row">
            <span className="principal-kicker">SCHOOL OVERVIEW</span>
            <span className="live-dot"><i /> Live</span>
          </div>
          <h1>Good morning, {firstName}.</h1>
          <p>Here’s a quick view of what is happening across your school today.</p>
        </div>
        <div className="hero-actions">
          <button className="dashboard-icon-button" type="button" aria-label="Notifications">
            <Bell size={18} />
            <span className="notification-dot" />
          </button>
          <button className="dashboard-primary-button" type="button"><Plus size={17} /> Add new</button>
        </div>
      </section>

      <section className="principal-stat-grid">
        {stats.map(({ label, value, change, note, icon: Icon, tone }) => (
          <article className="principal-stat-card" key={label}>
            <div className="principal-stat-top">
              <div className={`principal-stat-icon ${tone}`}><Icon size={19} /></div>
              <span className="stat-period">This month</span>
            </div>
            <p>{label}</p>
            <div className="principal-stat-value-row">
              <strong>{value}</strong>
              <span className="stat-change"><ArrowUpRight size={13} /> {change}</span>
            </div>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="principal-content-grid">
        <article className="principal-panel attendance-panel">
          <div className="principal-panel-header">
            <div>
              <span>ATTENDANCE</span>
              <h2>Weekly attendance</h2>
              <p>Average student attendance across all classes</p>
            </div>
            <button className="panel-link" type="button">View report <ChevronRight size={14} /></button>
          </div>
          <div className="attendance-summary">
            <div>
              <strong>89.8%</strong>
              <span><ArrowUpRight size={14} /> 2.4% from last week</span>
            </div>
            <div className="attendance-legend"><span /><small>Present</small></div>
          </div>
          <div className="attendance-chart" aria-label="Weekly attendance chart">
            {attendance.map((value, index) => (
              <div className="attendance-column" key={days[index]}>
                <div className="attendance-track">
                  <div className="attendance-bar" style={{ height: `${value}%` }}><span>{value}%</span></div>
                </div>
                <small>{days[index]}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="principal-panel schedule-panel">
          <div className="principal-panel-header">
            <div><span>TODAY</span><h2>Principal schedule</h2><p>Friday, 27 September</p></div>
            <button className="more-button" type="button" aria-label="More options"><MoreHorizontal size={18} /></button>
          </div>
          <div className="principal-schedule-list">
            {schedule.map(([time, title, place]) => (
              <div className="principal-schedule-row" key={time}>
                <div className="schedule-time"><Clock3 size={13} /> {time}</div>
                <div><strong>{title}</strong><span>{place}</span></div>
              </div>
            ))}
          </div>
          <button className="full-width-link" type="button">View full timetable <ChevronRight size={14} /></button>
        </article>
      </section>

      <section className="principal-content-grid lower-grid">
        <article className="principal-panel activity-panel">
          <div className="principal-panel-header">
            <div><span>ACTIVITY</span><h2>Recent activity</h2><p>Latest updates from across the school</p></div>
            <button className="panel-link" type="button">View all <ChevronRight size={14} /></button>
          </div>
          <div className="principal-activity-list">
            {activities.map((activity) => (
              <div className="principal-activity-row" key={activity.title}>
                <div className={`activity-marker ${activity.tone}`} />
                <div className="activity-copy"><strong>{activity.title}</strong><span>{activity.text}</span></div>
                <time>{activity.time}</time>
              </div>
            ))}
          </div>
        </article>

        <article className="principal-panel events-panel">
          <div className="principal-panel-header">
            <div><span>UPCOMING</span><h2>Next events</h2><p>Important dates this week</p></div>
          </div>
          <div className="principal-event-list">
            {events.map(([date, month, title, meta]) => (
              <div key={title}>
                <div className="event-date"><strong>{date}</strong><span>{month}</span></div>
                <span><strong>{title}</strong><small>{meta}</small></span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="principal-panel quick-panel">
        <div className="principal-panel-header">
          <div><span>SHORTCUTS</span><h2>Quick actions</h2><p>Frequently used administrative actions</p></div>
        </div>
        <div className="quick-action-grid">
          {quickActions.map(({ label, icon: Icon }) => (
            <button type="button" key={label}>
              <span><Icon size={18} /></span>
              <b>{label}</b>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </section>

      <section className="principal-bottom-grid">
        <div className="principal-insight">
          <div className="insight-icon"><ClipboardCheck size={18} /></div>
          <div>
            <span className="insight-label">SCHOOL INSIGHT</span>
            <strong>Attendance is trending upward this week.</strong>
            <p>92.4% of students are present today, with Classes 8–10 showing the strongest improvement.</p>
          </div>
          <button type="button">Open report <ChevronRight size={15} /></button>
        </div>
        <div className="principal-alert">
          <div className="alert-icon"><AlertTriangle size={18} /></div>
          <div><span>ATTENTION</span><strong>12 students have low attendance</strong><p>Below 75% this month</p></div>
          <button type="button">Review <ChevronRight size={15} /></button>
        </div>
      </section>
    </div>
  )
}

export default PrincipalDashboard
