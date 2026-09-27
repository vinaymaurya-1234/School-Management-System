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
import { hasPermission } from '../../config/accessControl'

const menuByRole = {
  principal: [
    ['Dashboard', '/dashboard/principal', LayoutDashboard, 'dashboard.view'],
    ['Students', '#', Users, 'students.manage'],
    ['Teachers', '#', GraduationCap, 'teachers.manage'],
    ['Classes', '#', BookOpen, 'classes.manage'],
    ['Timetable', '#', CalendarDays, 'timetable.manage'],
    ['Attendance', '#', ClipboardCheck, 'attendance.manage'],
    ['Fees', '#', CreditCard, 'fees.manage'],
    ['Reports', '#', BarChart3, 'reports.view'],
  ],
  teacher: [
    ['Dashboard', '/dashboard/teacher', LayoutDashboard, 'dashboard.view'],
    ['My Classes', '#', BookOpen, 'classes.view.assigned'],
    ['My Students', '#', Users, 'students.view.assigned'],
    ['Timetable', '#', CalendarDays, 'timetable.view.assigned'],
    ['Attendance', '#', ClipboardCheck, 'attendance.manage.assigned'],
    ['Assignments', '#', BookOpen, 'assignments.manage.assigned'],
    ['Exams & Marks', '#', BarChart3, 'exams.manage.assigned'],
  ],
  student: [
    ['Dashboard', '/dashboard/student', LayoutDashboard, 'dashboard.view'],
    ['Timetable', '#', CalendarDays, 'timetable.view.own'],
    ['Attendance', '#', ClipboardCheck, 'attendance.view.own'],
    ['Assignments', '#', BookOpen, 'assignments.view.own'],
    ['Exams', '#', BarChart3, 'exams.view.own'],
    ['Results', '#', GraduationCap, 'results.view.own'],
  ],
  parent: [
    ['Dashboard', '/dashboard/parent', LayoutDashboard, 'dashboard.view'],
    ['My Children', '#', Users, 'children.view.own'],
    ['Attendance', '#', ClipboardCheck, 'attendance.view.children'],
    ['Assignments', '#', BookOpen, 'assignments.view.children'],
    ['Exams & Results', '#', BarChart3, 'results.view.children'],
    ['Fees', '#', CreditCard, 'fees.view.children'],
  ],
  accountant: [
    ['Dashboard', '/dashboard/accountant', LayoutDashboard, 'dashboard.view'],
    ['Students', '#', Users, 'students.view.basic'],
    ['Fee Collection', '#', CreditCard, 'fees.manage'],
    ['Payments', '#', ClipboardCheck, 'payments.manage'],
    ['Receipts', '#', BookOpen, 'receipts.manage'],
    ['Reports', '#', BarChart3, 'financialReports.view'],
  ],
}

function Sidebar({ onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const menu = menuByRole[user?.role] || []
  const visibleMenu = menu.filter(([, , , permission]) => hasPermission(user?.role, permission))

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
        {visibleMenu.map(([label, href, Icon]) => (
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
