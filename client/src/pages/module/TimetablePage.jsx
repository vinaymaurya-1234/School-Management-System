import { CalendarDays, CheckCircle2, Clock3, GraduationCap, MapPin, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import './ModuleFeature.css'

const sections = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
const classes = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const teachers = ['Priya Nair', 'Rahul Verma', 'Sneha Kapoor', 'Amit Joshi', 'Meera Iyer', 'Karan Shah', 'Neha Patel']
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const periods = [
  ['08:00', '08:45'],
  ['08:45', '09:30'],
  ['09:45', '10:30'],
  ['10:30', '11:15'],
  ['11:30', '12:15'],
  ['12:15', '13:00'],
  ['14:00', '14:45'],
]

const subjects = ['Mathematics', 'Science', 'English', 'Social Science', 'Computer', 'Hindi', 'Physical Education']
const rooms = ['Room 101', 'Room 102', 'Room 204', 'Room 205', 'Science Lab', 'Computer Lab', 'Activity Hall']

function buildSchedule(className, section) {
  const seed = Number(className) + section.charCodeAt(0)
  return periods.map(([start, end], periodIndex) => {
    const cells = days.map((day, dayIndex) => {
      const subject = subjects[(seed + periodIndex * 2 + dayIndex) % subjects.length]
      const teacher = teachers[(seed + periodIndex + dayIndex) % teachers.length]
      const room = rooms[(seed + periodIndex + dayIndex * 2) % rooms.length]
      return { subject, teacher, room, day, start, end }
    })
    return { start, end, cells }
  })
}

function buildTeacherSchedule(teacher) {
  const seed = teachers.indexOf(teacher) + 1
  return periods.map(([start, end], periodIndex) => ({
    start,
    end,
    cells: days.map((day, dayIndex) => {
      const assigned = (periodIndex + dayIndex + seed) % 4 !== 0
      return assigned
        ? {
            subject: subjects[(seed + periodIndex + dayIndex) % subjects.length],
            className: `${6 + ((seed + dayIndex) % 5)}-${String.fromCharCode(65 + ((seed + periodIndex) % 3))}`,
            room: rooms[(seed + periodIndex + dayIndex) % rooms.length],
            day,
          }
        : null
    }),
  }))
}

function TimetablePage() {
  const { user } = useAuth()
  const [viewMode, setViewMode] = useState('class')
  const [selectedClass, setSelectedClass] = useState('10')
  const [selectedSection, setSelectedSection] = useState('A')
  const [selectedTeacher, setSelectedTeacher] = useState(teachers[0])

  const classSchedule = useMemo(() => buildSchedule(selectedClass, selectedSection), [selectedClass, selectedSection])
  const teacherSchedule = useMemo(() => buildTeacherSchedule(selectedTeacher), [selectedTeacher])
  const schedule = viewMode === 'class' ? classSchedule : teacherSchedule

  return (
    <div className="feature-page timetable-feature-page">
      <header className="feature-page-heading">
        <div className="feature-heading-copy">
          <span className="feature-eyebrow">SCHOOL SCHEDULE</span>
          <div className="feature-title-line">
            <div className="feature-title-icon"><CalendarDays size={23} /></div>
            <div>
              <h1>Timetable</h1>
              <p>{user?.role === 'principal' ? 'View the complete class or teacher timetable across the school.' : 'View your assigned teaching schedule.'}</p>
            </div>
          </div>
        </div>
        <div className="feature-heading-meta"><span><CheckCircle2 size={14} /> 0 conflicts</span></div>
      </header>

      <section className="feature-controls-card">
        <div className="feature-control-tabs">
          <button className={viewMode === 'class' ? 'active' : ''} onClick={() => setViewMode('class')} type="button">Class timetable</button>
          {user?.role === 'principal' && <button className={viewMode === 'teacher' ? 'active' : ''} onClick={() => setViewMode('teacher')} type="button">Teacher timetable</button>}
        </div>
        <div className="feature-select-grid">
          {viewMode === 'class' ? (
            <>
              <label><span>Class</span><select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>{classes.map((item) => <option key={item} value={item}>Class {item}</option>)}</select></label>
              <label><span>Section / Division</span><select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}>{sections.map((item) => <option key={item} value={item}>Section {item}</option>)}</select></label>
            </>
          ) : (
            <label><span>Teacher</span><select value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)}>{teachers.map((item) => <option key={item}>{item}</option>)}</select></label>
          )}
          <div className="feature-selection-summary">
            <span>Currently viewing</span>
            <strong>{viewMode === 'class' ? `Class ${selectedClass}-${selectedSection}` : selectedTeacher}</strong>
            <small>Academic year 2026–27 · Weekly schedule</small>
          </div>
        </div>
      </section>

      <section className="feature-stat-grid">
        <article><span>Periods this week</span><strong>35</strong><small><Clock3 size={13} /> 7 periods / day</small></article>
        <article><span>Teaching assignments</span><strong>{viewMode === 'class' ? '7' : '24'}</strong><small><UserRound size={13} /> Assigned schedule</small></article>
        <article><span>Rooms in use</span><strong>{viewMode === 'class' ? '7' : '11'}</strong><small><MapPin size={13} /> Across campus</small></article>
        <article><span>Scheduling conflicts</span><strong className="feature-good">0</strong><small><CheckCircle2 size={13} /> No conflicts</small></article>
      </section>

      <section className="feature-panel timetable-panel">
        <div className="feature-panel-header">
          <div><span className="feature-eyebrow">WEEKLY VIEW</span><h2>{viewMode === 'class' ? `Class ${selectedClass}-${selectedSection} timetable` : `${selectedTeacher}'s timetable`}</h2><p>{viewMode === 'class' ? 'Every period, subject, teacher and room assigned to this section.' : 'Every period assigned to this teacher, including class and room.'}</p></div>
          <span className="feature-live-badge">Live schedule</span>
        </div>
        <div className="timetable-scroll">
          <div className="timetable-grid" style={{ '--day-count': days.length }}>
            <div className="timetable-corner">Period</div>
            {days.map((day) => <div className="timetable-day" key={day}>{day}</div>)}
            {schedule.map((row) => (
              <div className="timetable-grid-row" key={row.start}>
                <div className="timetable-period"><strong>{row.start}</strong><span>{row.end}</span></div>
                {row.cells.map((cell, index) => (
                  <div className={`timetable-cell ${!cell ? 'free' : ''}`} key={`${row.start}-${days[index]}`}>
                    {cell ? viewMode === 'class' ? <><strong>{cell.subject}</strong><span><GraduationCap size={12} /> {cell.teacher}</span><small><MapPin size={11} /> {cell.room}</small></> : <><strong>{cell.subject}</strong><span><GraduationCap size={12} /> Class {cell.className}</span><small><MapPin size={11} /> {cell.room}</small></> : <span className="free-label">Free period</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default TimetablePage
