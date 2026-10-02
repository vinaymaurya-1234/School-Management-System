import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Search, LogOut, UserRound, Settings, GraduationCap } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../styles/PremiumProfile.css'

const academicItems = [
  { label: 'Students', href: '/module/students', hint: 'Student records' },
  { label: 'Teachers', href: '/module/teachers', hint: 'Faculty & assignments' },
  { label: 'Classes', href: '/module/classes', hint: 'Manage classes' },
  { label: 'Timetable', href: '/module/timetable', hint: 'School schedule' },
]

const operationsItems = [
  { label: 'Attendance', href: '/module/attendance', hint: 'Daily attendance' },
  { label: 'Fees & Payments', href: '/module/fees', hint: 'Collections & dues' },
  { label: 'Exams & Results', href: '/module/exams', hint: 'Assessments & marks' },
  { label: 'Reports', href: '/module/reports', hint: 'School analytics' },
  { label: 'Notices', href: '/module/notices', hint: 'Announcements' },
  { label: 'Events', href: '/module/events', hint: 'School events' },
  { label: 'Payroll', href: '/module/payroll', hint: 'Staff payroll' },
]

const exploreItems = [
  { label: 'Subjects', href: '/module/subjects', hint: 'Curriculum mapping' },
  { label: 'Admissions', href: '/module/admissions', hint: 'Admission workflow' },
  { label: 'Assignments', href: '/module/assignments', hint: 'Learning tasks' },
  { label: 'Communication', href: '/module/communication', hint: 'Messages & notices' },
  { label: 'Staff & HR', href: '/module/staff', hint: 'Employee management' },
  { label: 'Leave', href: '/module/leave', hint: 'Leave management' },
  { label: 'Settings', href: '/module/profile', hint: 'School & account settings' },
]

function Menu({ label, items, open, onToggle, onClose, wide = false }) {
  return (
    <div className={`nav-menu ${open ? 'is-open' : ''}`}>
      <button className="nav-pill nav-pill-menu" type="button" onClick={onToggle} aria-expanded={open}>
        <span>{label}</span><ChevronDown size={14} />
      </button>
      {open && (
        <div className={`nav-dropdown ${wide ? 'nav-dropdown-wide' : ''}`}>
          {items.map((item) => (
            <NavLink key={item.href} to={item.href} className="nav-dropdown-item" onClick={onClose}>
              <span className="nav-dropdown-icon"><GraduationCap size={15} /></span>
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
            </NavLink>
          ))}
        </div>
      )}
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

  useEffect(() => {
    setOpenMenu(null)
    setProfileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handlePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpenMenu(null)
        setProfileOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointer)
    return () => document.removeEventListener('pointerdown', handlePointer)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="premium-topbar" ref={rootRef}>
      <div className="premium-nav-scroll">
        <nav className="premium-nav" aria-label="Primary navigation">
          <NavLink to="/dashboard/principal" className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>Home</NavLink>
          <Menu label="Academic" items={academicItems} open={openMenu === 'academic'} onToggle={() => setOpenMenu(openMenu === 'academic' ? null : 'academic')} onClose={() => setOpenMenu(null)} />
          <Menu label="Operations" items={operationsItems} wide open={openMenu === 'operations'} onToggle={() => setOpenMenu(openMenu === 'operations' ? null : 'operations')} onClose={() => setOpenMenu(null)} />
          <Menu label="Explore" items={exploreItems} wide open={openMenu === 'explore'} onToggle={() => setOpenMenu(openMenu === 'explore' ? null : 'explore')} onClose={() => setOpenMenu(null)} />
        </nav>
      </div>

      <div className="premium-search">
        <Search size={17} />
        <input type="search" placeholder="Search by student, teacher, class..." aria-label="Search" />
      </div>

      <div className="premium-actions">
        <button className="premium-icon-button notification-button" type="button" aria-label="Notifications">
          <Bell size={18} />
          <span className="notification-dot" />
        </button>

        <div className="profile-menu">
          <button className="profile-trigger" type="button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}>
            <span className="profile-avatar premium-avatar">{user?.name?.charAt(0) || 'P'}</span>
            <span className="profile-trigger-copy"><strong>{user?.name || 'Principal'}</strong><small>{user?.roleLabel || 'Principal'}</small></span>
            <ChevronDown size={15} />
          </button>
          {profileOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-head"><span className="profile-avatar premium-avatar large">{user?.name?.charAt(0) || 'P'}</span><div><strong>{user?.name || 'Principal'}</strong><small>{user?.email || 'Principal account'}</small></div></div>
              <button type="button" onClick={() => { setProfileOpen(false); navigate('/module/profile') }}><UserRound size={16} /> Profile</button>
              <button type="button" onClick={() => { setProfileOpen(false); navigate('/module/profile') }}><Settings size={16} /> Account settings</button>
              <div className="profile-divider" />
              <button className="signout-action" type="button" onClick={handleLogout}><LogOut size={16} /> Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Topbar
