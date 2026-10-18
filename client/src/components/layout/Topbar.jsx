import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Search, LogOut, UserRound, Settings, GraduationCap, Home, BookOpen, ClipboardCheck, CalendarDays, Menu as MenuIcon, MessageCircle } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../styles/PremiumProfile.css'

const academicItems = [
  { label: 'Students', href: '/module/students', hint: 'Student records and admissions' },
  { label: 'Teachers', href: '/module/teachers', hint: 'Faculty directory' },
  { label: 'Assign Teachers', href: '/module/teacher-assignments', hint: 'Class, section & subject allocation' },
  { label: 'Classes', href: '/module/classes', hint: 'Manage classes' },
  { label: 'Timetable', href: '/module/timetable', hint: 'School schedule' },
]
const operationsItems = [
  { label: 'Attendance', href: '/module/attendance', hint: 'Daily attendance' },
  { label: 'Fees & Payments', href: '/module/fees', hint: 'Collections & dues' },
  { label: 'Exams & Schedule', href: '/module/exams', hint: 'Create and manage exam dates' },
  { label: 'Results & Publication', href: '/module/results', hint: 'Review marks and publish results' },
  { label: 'Reports', href: '/module/reports', hint: 'School analytics' },
  { label: 'Notices', href: '/module/notices', hint: 'Announcements' },
  { label: 'Events', href: '/module/events', hint: 'School events' },
  { label: 'Payroll', href: '/module/payroll', hint: 'Staff payroll' },
]
const teacherTeachingItems = [
  { label: 'My Classes', href: '/module/my-classes', hint: 'Your assigned classes and students' },
  { label: 'Class Attendance', href: '/module/class-attendance', hint: 'Mark daily student attendance' },
  { label: 'Timetable', href: '/module/timetable', hint: 'Your teaching schedule' },
  { label: 'Homework & Assignments', href: '/module/assignments', hint: 'Create and review classwork' },
  { label: 'My Students', href: '/module/my-students', hint: 'Students in your assigned classes' },
]
const teacherWorkItems = [
  { label: 'Exam Schedule', href: '/module/exam-schedule', hint: 'Exams for your assigned classes' },
  { label: 'Enter Marks', href: '/module/enter-marks', hint: 'Save and submit student marks' },
  { label: 'Marks Review Status', href: '/module/marks-review', hint: 'Track principal review and publishing' },
  { label: 'Student Performance', href: '/module/student-performance', hint: 'Progress for your assigned students' },
]
const teacherCommunicationItems = [
  { label: 'Notices', href: '/module/notices', hint: 'School announcements' },
  { label: 'Events', href: '/module/events', hint: 'School calendar and events' },
  { label: 'Parent Communication', href: '/module/parent-communication', hint: 'Permitted parent conversations' },
]
const studentLearningItems = [
  { label: 'My Attendance', href: '/module/attendance', hint: 'Daily presence and attendance summary' },
  { label: 'Class Timetable', href: '/module/timetable', hint: 'Your published weekly schedule' },
  { label: 'Exams', href: '/module/exams', hint: 'Upcoming exam schedule' },
  { label: 'Results', href: '/module/results', hint: 'Published marks and grades' },
  { label: 'Assignments', href: '/module/assignments', hint: 'Homework and classwork from teachers' },
]
const studentLifeItems = [
  { label: 'Notices', href: '/module/notices', hint: 'School announcements' },
  { label: 'Events & Holidays', href: '/module/events', hint: 'School calendar and holidays' },
  { label: 'Fees & Receipts', href: '/module/fees', hint: 'Your fee account and receipts' },
  { label: 'My Profile', href: '/module/profile', hint: 'Your account details' },
]
const exploreItems = [
  { label: 'Subjects', href: '/module/subjects', hint: 'Curriculum mapping' },
  { label: 'Admissions', href: '/module/students', hint: 'Add one student or import a class list' },
  { label: 'Student & Parent Login Credentials', href: '/module/login-credentials', hint: 'Login IDs, account status and password reset' },
  { label: 'Assignments', href: '/module/assignments', hint: 'Learning tasks' },
  { label: 'Communication', href: '/module/communication', hint: 'Messages & notices' },
  { label: 'Staff & HR', href: '/module/staff', hint: 'Employee management' },
  { label: 'Leave', href: '/module/leave', hint: 'Leave management' },
  { label: 'Settings', href: '/module/profile', hint: 'School & account settings' },
]

function Menu({ label, items, open, onToggle, onClose, wide = false }) {
  return (
    <div className={`nav-menu ${open ? 'is-open' : ''}`}>
      <button className="nav-pill nav-pill-menu" type="button" onClick={onToggle} aria-expanded={open}><span>{label}</span><ChevronDown size={14} /></button>
      {open && <div className={`nav-dropdown ${wide ? 'nav-dropdown-wide' : ''}`}>{items.map((item) => <NavLink key={item.href} to={item.href} className="nav-dropdown-item" onClick={onClose}><span className="nav-dropdown-icon"><GraduationCap size={15} /></span><span><strong>{item.label}</strong><small>{item.hint}</small></span></NavLink>)}</div>}
    </div>
  )
}

function Topbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => { setOpenMenu(null); setProfileOpen(false) }, [location.pathname])
  useEffect(() => {
    const handlePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) { setOpenMenu(null); setProfileOpen(false) }
    }
    document.addEventListener('pointerdown', handlePointer)
    return () => document.removeEventListener('pointerdown', handlePointer)
  }, [])

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }
  const homeHref = user?.role === 'teacher' ? '/dashboard/teacher' : user?.role === 'student' ? '/dashboard/student' : user?.role === 'parent' ? '/dashboard/parent' : user?.role === 'accountant' ? '/dashboard/accountant' : '/dashboard/principal'

  return (
    <>
      <header className="premium-topbar" ref={rootRef}>
        <div className="premium-nav-scroll">
          <nav className="premium-nav" aria-label="Primary navigation">
            <NavLink to={homeHref} className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>Home</NavLink>
            <NavLink to="/module/messages" className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}><MessageCircle size={15} /> Messages</NavLink>
            {user?.role === 'student' ? <>
              <Menu label="Learning" items={studentLearningItems} wide open={openMenu === 'student-learning'} onToggle={() => setOpenMenu(openMenu === 'student-learning' ? null : 'student-learning')} onClose={() => setOpenMenu(null)} />
              <Menu label="School life" items={studentLifeItems} wide open={openMenu === 'student-life'} onToggle={() => setOpenMenu(openMenu === 'student-life' ? null : 'student-life')} onClose={() => setOpenMenu(null)} />
            </> : user?.role === 'teacher' ? <>
              <Menu label="Teaching" items={teacherTeachingItems} wide open={openMenu === 'teaching'} onToggle={() => setOpenMenu(openMenu === 'teaching' ? null : 'teaching')} onClose={() => setOpenMenu(null)} />
              <Menu label="My Work" items={teacherWorkItems} wide open={openMenu === 'my-work'} onToggle={() => setOpenMenu(openMenu === 'my-work' ? null : 'my-work')} onClose={() => setOpenMenu(null)} />
              <Menu label="Communication" items={teacherCommunicationItems} wide open={openMenu === 'communication'} onToggle={() => setOpenMenu(openMenu === 'communication' ? null : 'communication')} onClose={() => setOpenMenu(null)} />
            </> : <>
              <Menu label="Academic" items={academicItems} open={openMenu === 'academic'} onToggle={() => setOpenMenu(openMenu === 'academic' ? null : 'academic')} onClose={() => setOpenMenu(null)} />
              <Menu label="Operations" items={operationsItems} wide open={openMenu === 'operations'} onToggle={() => setOpenMenu(openMenu === 'operations' ? null : 'operations')} onClose={() => setOpenMenu(null)} />
              {user?.role === 'principal' && <Menu label="Explore" items={exploreItems} wide open={openMenu === 'explore'} onToggle={() => setOpenMenu(openMenu === 'explore' ? null : 'explore')} onClose={() => setOpenMenu(null)} />}
            </>}
          </nav>
        </div>
        <div className="premium-search"><Search size={17} /><input type="search" placeholder={user?.role === 'student' ? 'Search lessons, assignments, notices...' : user?.role === 'teacher' ? 'Search my classes, subjects...' : 'Search by student, teacher, class...'} aria-label="Search" /></div>
        <div className="premium-actions">
          <button className="premium-icon-button notification-button" type="button" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
          <div className="profile-menu">
            <button className="profile-trigger" type="button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}>
              <span className="profile-avatar premium-avatar">{user?.name?.charAt(0) || 'P'}</span>
              <span className="profile-trigger-copy"><strong>{user?.name || 'Principal'}</strong><small>{user?.roleLabel || 'Principal'}</small></span><ChevronDown size={15} />
            </button>
            {profileOpen && <div className="profile-dropdown">
              <div className="profile-dropdown-head"><span className="profile-avatar premium-avatar large">{user?.name?.charAt(0) || 'P'}</span><div><strong>{user?.name || 'Principal'}</strong><small>{user?.email || 'Principal account'}</small></div></div>
              <button type="button" onClick={() => { setProfileOpen(false); navigate('/module/profile') }}><UserRound size={16} /> Profile</button>
              <button type="button" onClick={() => { setProfileOpen(false); navigate('/module/profile') }}><Settings size={16} /> Account settings</button>
              <div className="profile-divider" />
              <button className="signout-action" type="button" onClick={handleLogout}><LogOut size={16} /> Sign out</button>
            </div>}
          </div>
        </div>
      </header>
      <nav className="mobile-app-nav" aria-label="Mobile navigation">
        {(() => {
          const role = user?.role || 'teacher'
          const items = role === 'teacher'
            ? [{ label: 'Home', href: '/dashboard/teacher', Icon: Home }, { label: 'Classes', href: '/module/my-classes', Icon: BookOpen }, { label: 'Attendance', href: '/module/class-attendance', Icon: ClipboardCheck }, { label: 'Messages', href: '/module/messages', Icon: MessageCircle }, { label: 'More', href: '/module/assignments', Icon: MenuIcon }]
            : role === 'student'
              ? [{ label: 'Home', href: '/dashboard/student', Icon: Home }, { label: 'Classes', href: '/module/timetable', Icon: BookOpen }, { label: 'Attendance', href: '/module/attendance', Icon: ClipboardCheck }, { label: 'Messages', href: '/module/messages', Icon: MessageCircle }, { label: 'More', href: '/module/assignments', Icon: MenuIcon }]
              : role === 'parent'
                ? [{ label: 'Home', href: '/dashboard/parent', Icon: Home }, { label: 'Children', href: '/module/children', Icon: BookOpen }, { label: 'Attendance', href: '/module/attendance', Icon: ClipboardCheck }, { label: 'Messages', href: '/module/messages', Icon: MessageCircle }, { label: 'More', href: '/module/results', Icon: MenuIcon }]
                : [{ label: 'Home', href: role === 'accountant' ? '/dashboard/accountant' : '/dashboard/principal', Icon: Home }, { label: 'Students', href: '/module/students', Icon: BookOpen }, { label: 'Attendance', href: '/module/attendance', Icon: ClipboardCheck }, { label: 'Messages', href: '/module/messages', Icon: MessageCircle }, { label: 'More', href: '/module/reports', Icon: MenuIcon }]
          return items.map(({ label, href, Icon }) => <NavLink key={label} to={href} className={({ isActive }) => `mobile-app-nav-item ${isActive ? 'active' : ''}`}><Icon size={20} strokeWidth={1.9} /><span>{label}</span></NavLink>)
        })()}
      </nav>
    </>
  )
}
export default Topbar
