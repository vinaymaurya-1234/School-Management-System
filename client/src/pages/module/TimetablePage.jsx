import { CalendarDays, CheckCircle2, Clock3, GraduationCap, MapPin, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import './ModuleFeature.css'
import './AttendanceTimetable.css'

const sections = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
const classes = Array.from({ length: 12 }, (_, index) => String(index + 1))
const teachers = ['Priya Nair', 'Rahul Mehta', 'Sneha Kapoor', 'Amit Joshi', 'Meera Iyer', 'Karan Shah', 'Neha Patel']
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const periods = [['08:00', '08:45'], ['08:45', '09:30'], ['09:45', '10:30'], ['10:30', '11:15'], ['11:30', '12:15'], ['12:15', '13:00']]
const subjects = ['Mathematics', 'Science', 'English', 'Social Science', 'Computer Science', 'Hindi', 'Marathi']
const rooms = ['Room 101', 'Room 102', 'Room 204', 'Room 205', 'Science Lab', 'Computer Lab', 'Activity Hall']
const classTeachers = { '10-A': 'Priya Nair', '10-B': 'Rahul Mehta', '9-A': 'Sneha Kapoor', '8-A': 'Amit Joshi', '7-C': 'Meera Iyer' }
function buildClassSchedule(className, section) { const seed = Number(className) + section.charCodeAt(0); return periods.map(([start, end], periodIndex) => ({ start, end, cells: days.map((day, dayIndex) => ({ subject: subjects[(seed + periodIndex * 2 + dayIndex) % subjects.length], teacher: teachers[(seed + periodIndex + dayIndex) % teachers.length], room: rooms[(seed + periodIndex + dayIndex * 2) % rooms.length], day })) })) }
function buildTeacherSchedule(teacher) { const seed = Math.max(1, teachers.indexOf(teacher) + 1); return periods.map(([start, end], periodIndex) => ({ start, end, cells: days.map((day, dayIndex) => { const assigned = (periodIndex + dayIndex + seed) % 4 !== 0; return assigned ? { subject: subjects[(seed + periodIndex + dayIndex) % subjects.length], className: `${6 + ((seed + dayIndex) % 5)}-${String.fromCharCode(65 + ((seed + periodIndex) % 3))}`, room: rooms[(seed + periodIndex + dayIndex) % rooms.length], day } : null }) })) }

function TimetablePage() {
  const { user } = useAuth()
  const isPrincipal = user?.role === 'principal'
  const [viewMode, setViewMode] = useState('class')
  const [selectedClass, setSelectedClass] = useState('10')
  const [selectedSection, setSelectedSection] = useState('A')
  const [selectedTeacher, setSelectedTeacher] = useState('Rahul Mehta')
  const classSchedule = useMemo(() => buildClassSchedule(selectedClass, selectedSection), [selectedClass, selectedSection])
  const teacherSchedule = useMemo(() => buildTeacherSchedule(selectedTeacher), [selectedTeacher])
  const schedule = viewMode === 'class' ? classSchedule : teacherSchedule
  const classKey = `${selectedClass}-${selectedSection}`
  return <div className="feature-page timetable-feature-page">
    <header className="feature-page-heading"><div className="feature-heading-copy"><span className="feature-eyebrow">SCHOOL SCHEDULE</span><div className="feature-title-line"><div className="feature-title-icon"><CalendarDays size={23} /></div><div><h1>Timetable</h1><p>{isPrincipal ? 'Inspect a complete class timetable or any teacher’s weekly schedule.' : 'View your assigned teaching schedule from Monday to Saturday.'}</p></div></div></div><div className="feature-heading-meta"><CheckCircle2 size={14} /> Schedule view</div></header>
    {isPrincipal && <section className="feature-controls-card timetable-controls-card"><div className="feature-control-tabs"><button className={viewMode === 'class' ? 'active' : ''} onClick={() => setViewMode('class')} type="button">Class timetable</button><button className={viewMode === 'teacher' ? 'active' : ''} onClick={() => setViewMode('teacher')} type="button">Teacher timetable</button></div><div className="feature-select-grid">{viewMode === 'class' ? <><label><span>Class</span><select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>{classes.map((item) => <option key={item} value={item}>Class {item}</option>)}</select></label><label><span>Section / Division</span><select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}>{sections.map((item) => <option key={item} value={item}>Section {item}</option>)}</select></label><div className="feature-selection-summary"><span>Selected class</span><strong>{classKey}</strong><small>{classTeachers[classKey] || 'Class teacher not assigned'}</small></div></> : <><label><span>Teacher</span><select value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)}>{teachers.map((item) => <option key={item}>{item}</option>)}</select></label><div className="feature-selection-summary"><span>Selected teacher</span><strong>{selectedTeacher}</strong><small>Monday–Saturday teaching schedule</small></div></>}</div></section>}
    {!isPrincipal && <section className="timetable-teacher-banner"><div><span className="variant-kicker">MY WEEK</span><h2>{user?.name}'s teaching timetable</h2><p>All assigned periods are shown here. Use My Classes for class-level student and academic work.</p></div><span className="variant-chip">Monday–Saturday</span></section>}
    <section className="feature-stat-grid"><article><span>Days</span><strong>6</strong><small><CalendarDays size={13} /> Monday to Saturday</small></article><article><span>Periods / day</span><strong>6</strong><small><Clock3 size={13} /> Daily schedule</small></article><article><span>{viewMode === 'class' ? 'Class teacher' : 'Teacher'}</span><strong className="schedule-stat-name">{viewMode === 'class' ? (classTeachers[classKey] || 'Unassigned') : selectedTeacher}</strong><small><UserRound size={13} /> Schedule owner</small></article><article><span>Schedule status</span><strong className="feature-good">Ready</strong><small><CheckCircle2 size={13} /> No conflicts shown here</small></article></section>
    <section className="feature-panel timetable-panel"><div className="feature-panel-header"><div><span className="feature-eyebrow">WEEKLY VIEW</span><h2>{viewMode === 'class' ? `${classKey} · Full timetable` : `${selectedTeacher} · Weekly timetable`}</h2><p>{viewMode === 'class' ? 'Every period, subject, teacher and room for this division.' : 'Every teaching period assigned to the selected teacher.'}</p></div><span className="feature-live-badge">Mon–Sat</span></div><div className="timetable-scroll"><div className="timetable-grid timetable-six-day-grid" style={{ '--day-count': days.length }}><div className="timetable-corner">Period</div>{days.map((day) => <div className="timetable-day" key={day}><strong>{day.slice(0, 3)}</strong><span>{day}</span></div>)}{schedule.map((row) => <div className="timetable-grid-row" key={row.start}><div className="timetable-period"><strong>{row.start}</strong><span>{row.end}</span></div>{row.cells.map((cell, index) => <div className={`timetable-cell ${!cell ? 'free' : ''}`} key={`${row.start}-${days[index]}`}>{cell ? viewMode === 'class' ? <><strong>{cell.subject}</strong><span><GraduationCap size={12} /> {cell.teacher}</span><small><MapPin size={11} /> {cell.room}</small></> : <><strong>{cell.subject}</strong><span><GraduationCap size={12} /> Class {cell.className}</span><small><MapPin size={11} /> {cell.room}</small></> : <span className="free-label">Free period</span>}</div>)}</div>)}</div></div></section>
    <div className="timetable-footnote"><Clock3 size={14} /><span>Class view answers “what does this division study?” Teacher view answers “where is this teacher teaching?”</span></div>
  </div>
}
export default TimetablePage
