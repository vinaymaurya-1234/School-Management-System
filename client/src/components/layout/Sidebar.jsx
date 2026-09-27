import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const menuByRole = {
  principal: [
    ['Dashboard', '/dashboard/principal', LayoutDashboard],
    ['Students', '#', Users],
    ['Teachers', '#', GraduationCap],
    ['Classes', '#', BookOpen],
    ['Timetable', '#', CalendarDays],
    ['Attendance', '#', ClipboardCheck],
    ['Fees', '#', CreditCard],
    ['Reports', '#', BarChart3],
  ],
  teacher: [
    ['Dashboard', '/dashboard/teacher', LayoutDashboard],
    ['My Classes', '#', BookOpen],
    ['My Students', '#', Users],
    ['Timetable', '#', CalendarDays],
    ['Attendance', '#', ClipboardCheck],
    ['Assignments', '#', BookOpen],
    ['Exams & Marks', '#', BarChart3],
  ],
  student: [
    ['Dashboard', '/dashboard/student', LayoutDashboard],
    ['Timetable', '#', CalendarDays],
    ['Attendance', '#', ClipboardCheck],
    ['Assignments', '#', BookOpen],
    ['Exams', '#', BarChart3],
    ['Results', '#', GraduationCap],
  ],
  parent: [
    ['Dashboard', '/dashboard/parent', LayoutDashboard],
    ['My Children', '#', Users],
    ['Attendance', '#', ClipboardCheck],
    ['Assignments', '#', BookOpen],
    ['Exams & Results', '#', BarChart3],
    ['Fees', '#', CreditCard],
  ],
  accountant: [
    ['Dashboard', '/dashboard/accountant', LayoutDashboard],
    ['Students', '#', Users],
    ['Fee Collection', '#', CreditCard],
    ['Payments', '#', ClipboardCheck],
    ['Receipts', '#', BookOpen],
    ['Reports', '#', BarChart3],
  ],
}

function Sidebar({ onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const menu = menuByRole[user?.role] || []

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <GraduationCap size={23} />
          </div>
          <div>
            <strong>SchoolOS</strong>
            <span>Management Portal</span>
          </div>
        </div>
        <button className="mobile-close" type="button" onClick={onClose} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>

      <div className="school-switcher">
        <div className="school-avatar">AS</div>
        <div>
          <strong>Academy School</strong>
          <span>2026–27 Session</span>
        </div>
      </div>

      <div className="sidebar-section-label">MAIN MENU</div>
      <nav className="sidebar-nav">
        {menu.map(([label, href, Icon]) => (
          href === '#' ? (
            <button key={label} className="nav-item disabled-nav" type="button" title="Coming soon">
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ) : (
            <NavLink
              key={label}
              to={href}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          )
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item" type="button">
          <Settings size={18} />
          <span>Settings</span>
        </button>
        <button className="nav-item logout-item" type="button" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
