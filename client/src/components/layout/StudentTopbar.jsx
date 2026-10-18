import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BookOpen, CalendarDays, ChevronDown, ClipboardCheck, FileText, GraduationCap, Home, LogOut, MessageCircle, Search, Settings, Trophy, UserRound, WalletCards, X } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './StudentTopbar.css'

const studentGroups = [
  { label: 'Learning', items: [
    { label: 'Attendance', hint: 'Your attendance record', href: '/module/attendance', Icon: ClipboardCheck },
    { label: 'Class timetable', hint: 'Periods, subjects and teachers', href: '/module/timetable', Icon: CalendarDays },
    { label: 'Exams', hint: 'Published exam schedules', href: '/module/exams', Icon: GraduationCap },
    { label: 'Results', hint: 'Published marks and grades', href: '/module/results', Icon: Trophy },
    { label: 'Assignments', hint: 'Homework from your teachers', href: '/module/assignments', Icon: FileText },
  ]},
  { label: 'School life', items: [
    { label: 'Notices', hint: 'School announcements', href: '/module/notices', Icon: Bell },
    { label: 'Events & holidays', hint: 'School calendar and holidays', href: '/module/events', Icon: CalendarDays },
    { label: 'Fees & receipts', hint: 'Your fee account and receipts', href: '/module/fees', Icon: WalletCards },
    { label: 'My profile', hint: 'Your account details', href: '/module/profile', Icon: UserRound },
  ]},
]
const allItems = [{ label: 'Messages', hint: 'Chat with authorized school contacts', href: '/module/messages', Icon: MessageCircle }, ...studentGroups.flatMap((group) => group.items)]

function StudentTopbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const rootRef = useRef(null)
  const [openGroup, setOpenGroup] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? allItems.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(query)) : []
  }, [search])

  useEffect(() => {
    setOpenGroup('')
    setProfileOpen(false)
    setNotificationsOpen(false)
    setSearchOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const closeMenus = (event) => { if (!rootRef.current?.contains(event.target)) { setOpenGroup(''); setProfileOpen(false); setNotificationsOpen(false); setSearchOpen(false) } }
    document.addEventListener('pointerdown', closeMenus)
    return () => document.removeEventListener('pointerdown', closeMenus)
  }, [])

  const goTo = (href) => { navigate(href); setOpenGroup(''); setSearchOpen(false); setNotificationsOpen(false); setProfileOpen(false) }
  const signOut = () => { logout(); navigate('/login', { replace: true }) }

  return (
    <header className="student-topbar" ref={rootRef}>
      <div className="student-brand">
        <span className="student-brand-mark"><GraduationCap size={22} /></span>
        <span><strong>Campus</strong><small>STUDENT PORTAL</small></span>
      </div>
      <nav className="student-primary-nav" aria-label="Student navigation">
        <NavLink to="/dashboard/student" end className={({ isActive }) => `student-nav-home ${isActive ? 'active' : ''}`}><Home size={16} /> Home</NavLink>
        <NavLink to="/module/messages" className={({ isActive }) => `student-nav-home ${isActive ? 'active' : ''}`}><MessageCircle size={16} /> Messages</NavLink>
        {studentGroups.map((group) => (
          <div className="student-nav-group" key={group.label}>
            <button type="button" className={`student-nav-trigger ${openGroup === group.label ? 'active' : ''}`} aria-expanded={openGroup === group.label} onClick={() => setOpenGroup(openGroup === group.label ? '' : group.label)}>{group.label}<ChevronDown size={15} /></button>
            {openGroup === group.label && <div className="student-nav-dropdown">{group.items.map(({ label, hint, href, Icon }) => <button type="button" className="student-nav-option" key={href} onClick={() => goTo(href)}><span className="student-nav-option-icon"><Icon size={17} /></span><span><strong>{label}</strong><small>{hint}</small></span></button>)}</div>}
          </div>
        ))}
      </nav>
      <div className="student-topbar-search">
        <Search size={17} />
        <input aria-label="Search student pages" placeholder="Search your school..." value={search} onChange={(event) => { setSearch(event.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter' && matches[0]) goTo(matches[0].href); if (event.key === 'Escape') setSearchOpen(false) }} />
        {search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(''); setSearchOpen(false) }}><X size={15} /></button>}
        {searchOpen && search.trim() && <div className="student-search-results">{matches.length ? matches.map(({ label, hint, href, Icon }) => <button type="button" key={href} onClick={() => goTo(href)}><Icon size={17} /><span><strong>{label}</strong><small>{hint}</small></span></button>) : <p>No student pages match “{search}”.</p>}</div>}
      </div>
      <div className="student-topbar-actions">
        <div className="student-notification-wrap">
          <button className="student-round-action" type="button" aria-label="Open school updates" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={18} /></button>
          {notificationsOpen && <div className="student-updates-popover"><strong>School updates</strong><p>Check notices and assignment updates from your school.</p><button type="button" onClick={() => goTo('/module/notices')}>View notices <span>→</span></button><button type="button" onClick={() => goTo('/module/assignments')}>View assignments <span>→</span></button></div>}
        </div>
        <div className="student-profile-wrap">
          <button className="student-profile-trigger" type="button" aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}><span className="student-profile-avatar">{String(user?.name || 'S').trim().charAt(0).toUpperCase()}</span><span className="student-profile-copy"><strong>{user?.name || 'Student'}</strong><small>Student</small></span><ChevronDown size={15} /></button>
          {profileOpen && <div className="student-profile-menu"><div className="student-profile-menu-head"><strong>{user?.name || 'Student'}</strong><small>{user?.email || 'Student account'}</small></div><button type="button" onClick={() => goTo('/module/profile')}><UserRound size={16} /> My profile</button><button type="button" onClick={() => goTo('/module/profile')}><Settings size={16} /> Account settings</button><button type="button" className="student-signout" onClick={signOut}><LogOut size={16} /> Sign out</button></div>}
        </div>
      </div>
      <nav className="student-mobile-nav" aria-label="Quick student navigation">
        {[{label:'Home',href:'/dashboard/student',Icon:Home},{label:'Messages',href:'/module/messages',Icon:MessageCircle},{label:'Timetable',href:'/module/timetable',Icon:BookOpen},{label:'Attendance',href:'/module/attendance',Icon:ClipboardCheck},{label:'More',href:'/module/events',Icon:CalendarDays}].map(({label,href,Icon}) => <NavLink key={label} to={href} className={({isActive}) => `student-mobile-nav-item ${isActive ? 'active' : ''}`}><Icon size={19}/><span>{label}</span></NavLink>)}
      </nav>
    </header>
  )
}

export default StudentTopbar
