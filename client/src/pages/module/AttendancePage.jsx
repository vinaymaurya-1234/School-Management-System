import { CalendarDays, Check, Clock3, UserCheck, UserRound, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import './ModuleFeature.css'

const classes = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const sections = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))

const classStudents = {
  '10-A': [
    ['Aarav Sharma', '01', 'present', '08:03'],
    ['Anaya Patel', '02', 'present', '08:05'],
    ['Vivaan Mehta', '03', 'late', '08:22'],
    ['Diya Shah', '04', 'absent', '—'],
    ['Arjun Rao', '05', 'present', '08:01'],
    ['Ishita Singh', '06', 'present', '08:07'],
    ['Kabir Khan', '07', 'present', '08:04'],
    ['Myra Joshi', '08', 'present', '08:06'],
  ],
  '10-B': [
    ['Riya Gupta', '01', 'present', '08:02'],
    ['Aditya Shah', '02', 'late', '08:19'],
    ['Sara Khan', '03', 'present', '08:04'],
    ['Neil Mehta', '04', 'absent', '—'],
    ['Avni Patel', '05', 'present', '08:05'],
    ['Reyansh Rao', '06', 'present', '08:03'],
    ['Aisha Verma', '07', 'present', '08:06'],
    ['Yash Jain', '08', 'present', '08:08'],
  ],
  '9-A': [
    ['Aarav Kapoor', '01', 'present', '08:04'],
    ['Meera Shah', '02', 'present', '08:02'],
    ['Vihaan Patel', '03', 'present', '08:06'],
    ['Anaya Rao', '04', 'late', '08:21'],
    ['Ira Mehta', '05', 'present', '08:03'],
    ['Dhruv Singh', '06', 'absent', '—'],
    ['Kiara Joshi', '07', 'present', '08:05'],
    ['Rudra Khan', '08', 'present', '08:01'],
  ],
  '8-A': [
    ['Ayaan Sharma', '01', 'present', '08:02'],
    ['Siya Patel', '02', 'present', '08:04'],
    ['Advait Shah', '03', 'present', '08:03'],
    ['Myra Mehta', '04', 'absent', '—'],
    ['Reyansh Gupta', '05', 'late', '08:17'],
    ['Anika Rao', '06', 'present', '08:05'],
    ['Arnav Singh', '07', 'present', '08:07'],
    ['Tara Joshi', '08', 'present', '08:04'],
  ],
}

const teacherAttendance = [
  ['Priya Nair', 'Mathematics', 'present', '07:48', '8'],
  ['Rahul Verma', 'Science', 'present', '07:54', '7'],
  ['Sneha Kapoor', 'English', 'late', '08:17', '6'],
  ['Amit Joshi', 'Computer', 'absent', '—', '5'],
  ['Meera Iyer', 'Social Science', 'present', '07:59', '7'],
  ['Karan Shah', 'Hindi', 'late', '08:12', '6'],
  ['Neha Patel', 'Biology', 'present', '07:52', '5'],
  ['Rohit Desai', 'Physical Education', 'absent', '—', '4'],
]

const statusMeta = {
  present: { label: 'Present', className: 'present' },
  absent: { label: 'Absent', className: 'absent' },
  late: { label: 'Late', className: 'late' },
}

function getDateLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function AttendancePage() {
  const [viewMode, setViewMode] = useState('students')
  const [selectedClass, setSelectedClass] = useState('10')
  const [selectedSection, setSelectedSection] = useState('A')
  const [date, setDate] = useState('2026-09-28')

  const students = useMemo(() => classStudents[`${selectedClass}-${selectedSection}`] || classStudents['10-A'], [selectedClass, selectedSection])
  const studentCounts = useMemo(() => students.reduce((acc, [, , status]) => ({ ...acc, [status]: acc[status] + 1 }), { present: 0, absent: 0, late: 0 }), [students])
  const teacherCounts = useMemo(() => teacherAttendance.reduce((acc, [, , status]) => ({ ...acc, [status]: acc[status] + 1 }), { present: 0, absent: 0, late: 0 }), [])
  const studentPercentage = Math.round(((studentCounts.present + studentCounts.late) / students.length) * 1000) / 10

  return (
    <div className="feature-page attendance-feature-page">
      <header className="feature-page-heading">
        <div className="feature-heading-copy">
          <span className="feature-eyebrow">DAILY OPERATIONS</span>
          <div className="feature-title-line">
            <div className="feature-title-icon"><UserCheck size={23} /></div>
            <div><h1>Attendance</h1><p>Check today's student and teacher attendance with class-wise and staff-wise records.</p></div>
          </div>
        </div>
        <div className="feature-date-badge"><CalendarDays size={15} /> {getDateLabel(date)}</div>
      </header>

      <section className="feature-controls-card attendance-controls">
        <div className="feature-control-tabs">
          <button className={viewMode === 'students' ? 'active' : ''} onClick={() => setViewMode('students')} type="button">Student attendance</button>
          <button className={viewMode === 'teachers' ? 'active' : ''} onClick={() => setViewMode('teachers')} type="button">Teacher attendance</button>
        </div>
        <div className="feature-select-grid">
          {viewMode === 'students' ? <>
            <label><span>Class</span><select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>{classes.map((item) => <option key={item}>Class {item}</option>)}</select></label>
            <label><span>Section / Division</span><select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}>{sections.map((item) => <option key={item} value={item}>Section {item}</option>)}</select></label>
          </> : <div className="attendance-scope"><Users size={17} /><div><strong>All teaching staff</strong><span>School-wide teacher attendance for the selected date</span></div></div>}
          <label className="date-control"><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>
      </section>

      <section className="feature-stat-grid">
        {viewMode === 'students' ? <>
          <article><span>Attendance</span><strong>{studentPercentage}%</strong><small><UserCheck size={13} /> Class {selectedClass}-{selectedSection}</small></article>
          <article><span>Present</span><strong className="feature-good">{studentCounts.present}</strong><small><Check size={13} /> Students present</small></article>
          <article><span>Absent</span><strong className="feature-bad">{studentCounts.absent}</strong><small><X size={13} /> Students absent</small></article>
          <article><span>Late</span><strong className="feature-warn">{studentCounts.late}</strong><small><Clock3 size={13} /> Students late</small></article>
        </> : <>
          <article><span>Staff attendance</span><strong>{Math.round(((teacherCounts.present + teacherCounts.late) / teacherAttendance.length) * 1000) / 10}%</strong><small><UserCheck size={13} /> School-wide</small></article>
          <article><span>Present</span><strong className="feature-good">{teacherCounts.present}</strong><small><Check size={13} /> Teachers present</small></article>
          <article><span>Absent</span><strong className="feature-bad">{teacherCounts.absent}</strong><small><X size={13} /> Teachers absent</small></article>
          <article><span>Late</span><strong className="feature-warn">{teacherCounts.late}</strong><small><Clock3 size={13} /> Teachers late</small></article>
        </>}
      </section>

      <section className="feature-panel attendance-panel">
        <div className="feature-panel-header">
          <div><span className="feature-eyebrow">TODAY'S REGISTER</span><h2>{viewMode === 'students' ? `Class ${selectedClass}-${selectedSection} attendance` : 'Teacher attendance'}</h2><p>{viewMode === 'students' ? `${students.length} visible students · ${getDateLabel(date)}` : `${teacherAttendance.length} teaching staff records · ${getDateLabel(date)}`}</p></div>
          <span className="feature-live-badge">Attendance record</span>
        </div>

        {viewMode === 'students' ? <div className="attendance-table-wrap"><table className="feature-table"><thead><tr><th>Student</th><th>Roll no.</th><th>Status</th><th>Check-in</th><th>Action state</th></tr></thead><tbody>{students.map(([name, roll, status, checkIn]) => { const meta = statusMeta[status]; return <tr key={roll}><td><div className="person-cell"><div className="person-avatar">{name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><strong>{name}</strong></div></td><td>{roll}</td><td><span className={`attendance-status ${meta.className}`}>{meta.label}</span></td><td>{checkIn}</td><td><span className="record-note">Today's record</span></td></tr> })}</tbody></table></div> : <div className="attendance-table-wrap"><table className="feature-table"><thead><tr><th>Teacher</th><th>Department</th><th>Status</th><th>Check-in</th><th>Assigned classes</th></tr></thead><tbody>{teacherAttendance.map(([name, department, status, checkIn, assigned]) => { const meta = statusMeta[status]; return <tr key={name}><td><div className="person-cell"><div className="person-avatar teacher-avatar">{name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><strong>{name}</strong></div></td><td>{department}</td><td><span className={`attendance-status ${meta.className}`}>{meta.label}</span></td><td>{checkIn}</td><td>{assigned} classes</td></tr> })}</tbody></table></div>}
      </section>

      <section className="attendance-status-strip">
        <div><span className="attendance-dot present-dot" /><strong>{viewMode === 'students' ? studentCounts.present : teacherCounts.present}</strong><span>Present</span></div>
        <div><span className="attendance-dot absent-dot" /><strong>{viewMode === 'students' ? studentCounts.absent : teacherCounts.absent}</strong><span>Absent</span></div>
        <div><span className="attendance-dot late-dot" /><strong>{viewMode === 'students' ? studentCounts.late : teacherCounts.late}</strong><span>Late</span></div>
      </section>
    </div>
  )
}

export default AttendancePage
