import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ChevronDown, Search, LogOut, UserRound, Settings, GraduationCap } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hasPermission, ROLE_HOME_ROUTES } from '../../config/accessControl'
import '../../styles/PremiumProfile.css'

const academicItems = [
  { label: 'Students', href: '/module/students', hint: 'Assigned student records', permission: 'students.view.assigned' },
  { label: 'My Classes', href: '/module/my-classes', hint: 'Your class assignments', permission: 'classes.view.assigned' },
  { label: 'Timetable', href: '/module/timetable', hint: 'Your teaching schedule', permission: 'timetable.view.assigned' },
  { label: 'Teachers', href: '/module/teachers', hint: 'Faculty management', permission: 'teachers.manage' },
  { label: 'Classes', href: '/module/classes', hint: 'Class & section setup', permission: 'classes.manage' },
  { label: 'Subjects', href: '/module/subjects', hint: 'Curriculum mapping', permission: 'subjects.manage' },
]

const operationsItems = [
  { label: 'Attendance', href: '/module/attendance', hint: 'Mark or review attendance', permissions: ['attendance.manage', 'attendance.manage.assigned'] },
  { label: 'Assignments', href: '/module/assignments', hint: 'Learning tasks', permission: 'assignments.manage.assigned' },
  { label: 'Exams & Marks', href: '/module/exams', hint: 'Assessments & marks', permissions: ['exams.manage', 'exams.manage.assigned'] },
  { label: 'Fees & Payments', href: '/module/fees', hint: 'Collections & dues', permission: 'fees.manage' },
  { label: 'Reports', href: '/module/reports', hint: 'School analytics', permissions: ['reports.view', 'financialReports.view'] },
  { label: 'Notices', href: '/module/notices', hint: 'Announcements', permissions: ['notices.manage', 'notices.view'] },
  { label: 'Events', href: '/module/events', hint: 'School events', permissions: ['events.manage', 'events.view'] },
  { label: 'Payroll', href: '/module/payroll', hint: 'Staff payroll', permission: 'payroll.manage' },
]

const exploreItems = [
  { label: 'My Students', href: '/module/my-students', hint: 'Students in your assigned sections', permission: 'students.view.assigned' },
  { label: 'My Profile', href: '/module/profile', hint: 'Personal account settings', permission: 'profile.manage.own' },
  { label: 'Admissions', href: '/module/admissions', hint: 'Admission workflow', permission: 'admissions.manage' },
  { label: 'Staff & HR', href: '/module/staff', hint: 'Employee management', permission: 'staff.manage' },
  { label: 'Leave', href: '/module/leave', hint: 'Leave management', permission: 'leave.manage' },
  { label: 'Communication', href: '/module/communication', hint: 'Messages & notices', permission: 'communication.manage' },
]

function canSeeItem(role, item) {
  const permissions = item.permissions || [item.permission]
  return permissions.some((permission) => permission && hasPermission(role, permission))
}

function Menu({ label, items, role, open, onToggle, onClose, wide = false }) {
  const visibleItems = items.filter((item) => canSeeItem(role, item))
  if (!visibleItems.length) return null
  return (
    <div className={`nav-menu ${open ? 'is-open' : ''}`}>
      <button className="nav-pill nav-pill-menu" type="button" onClick={onToggle} aria-expanded={open}>
        <span>{label}</span><ChevronDown size={14} />
      </button>
      {open && (
        <div className={`nav-dropdown ${wide ? 'nav-dropdown-wide' : ''}`}>
          {visibleItems.map((item) => (
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
  const role = user?.role || 'principal'
  const homeRoute = ROLE_HOME_ROUTES[role] || '/login'

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

  const visibleAcademic = useMemo(() => academicItems.filter((item) => canSeeItem(role, item)), [role])
  const visibleOperations = useMemo(() => operationsItems.filter((item) => canSeeItem(role, item)), [role])
  const visibleExplore = useMemo(() => exploreItems.filter((item) => canSeeItem(role, item)), [role])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="premium-topbar" ref={rootRef}>
      <div className="premium-nav-scroll">
        <nav className="premium-nav" aria-label="Primary navigation">
          <NavLink to={homeRoute} className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}>Home</NavLink>
          <Menu label="Academic" items={visibleAcademic} role={role} open={openMenu === 'academic'} onToggle={() => setOpenMenu(openMenu === 'academic' ? null : 'academic')} onClose={() => setOpenMenu(null)} />
          <Menu label="Operations" items={visibleOperations} role={role} wide open={openMenu === 'operations'} onToggle={() => setOpenMenu(openMenu === 'operations' ? null : 'operations')} onClose={() => setOpenMenu(null)} />
          <Menu label="Explore" items={visibleExplore} role={role} wide open={openMenu === 'explore'} onToggle={() => setOpenMenu(openMenu === 'explore' ? null : 'explore')} onClose={() => setOpenMenu(null)} />
        </nav>
      </div>

      <div className="premium-search">
        <Search size={17} />
        <input type="search" placeholder="Search by student, teacher, class..." aria-label="Search" />
      </div>

      <div className="premium-actions">
        <button className="premium-icon-button notification-button" type="button" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
        <div className="profile-menu">
          <button className="profile-trigger" type="button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}>
            <span className="profile-avatar premium-avatar">{user?.name?.charAt(0) || 'P'}</span>
            <span className="profile-trigger-copy"><strong>{user?.name || 'User'}</strong><small>{user?.roleLabel || role}</small></span>
            <ChevronDown size={15} />
          </button>
          {profileOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-head"><span className="profile-avatar premium-avatar large">{user?.name?.charAt(0) || 'P'}</span><div><strong>{user?.name || 'User'}</strong><small>{user?.email || `${role} account`}</small></div></div>
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
