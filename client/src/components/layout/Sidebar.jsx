import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ReceiptIndianRupee,
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
    ['Students', '/module/students', Users, 'students.manage'],
    ['Teachers', '/module/teachers', GraduationCap, 'teachers.manage'],
    ['Classes & Sections', '/module/classes', BookOpen, 'classes.manage'],
    ['Subjects', '/module/subjects', BookOpen, 'subjects.manage'],
    ['Timetable', '/module/timetable', CalendarDays, 'timetable.manage'],
    ['Attendance', '/module/attendance', ClipboardCheck, 'attendance.manage'],
    ['Fees & Payments', '/module/fees', CreditCard, 'fees.manage'],
    ['Exams & Results', '/module/exams', FileText, 'exams.manage'],
    ['Reports', '/module/reports', BarChart3, 'reports.view'],
    ['Notices', '/module/notices', Megaphone, 'notices.manage'],
    ['Events', '/module/events', CalendarDays, 'events.manage'],
    ['Payroll', '/module/payroll', ReceiptIndianRupee, 'payroll.manage'],
  ],
  teacher: [
    ['Dashboard', '/dashboard/teacher', LayoutDashboard, 'dashboard.view'],
    ['My Classes', '/module/my-classes', BookOpen, 'classes.view.assigned'],
    ['My Students', '/module/my-students', Users, 'students.view.assigned'],
    ['Timetable', '/module/timetable', CalendarDays, 'timetable.view.assigned'],
    ['Attendance', '/module/attendance', ClipboardCheck, 'attendance.manage.assigned'],
    ['Assignments', '/module/assignments', FileText, 'assignments.manage.assigned'],
    ['Exams & Marks', '/module/exams', BarChart3, 'exams.manage.assigned'],
    ['Notices', '/module/notices', Megaphone, 'notices.view'],
    ['Events', '/module/events', CalendarDays, 'events.view'],
    ['My Profile', '/module/profile', Settings, 'profile.manage.own'],
  ],
  student: [
    ['Dashboard', '/dashboard/student', LayoutDashboard, 'dashboard.view'],
    ['Timetable', '/module/timetable', CalendarDays, 'timetable.view.own'],
    ['Attendance', '/module/attendance', ClipboardCheck, 'attendance.view.own'],
    ['Assignments', '/module/assignments', FileText, 'assignments.view.own'],
    ['Exams', '/module/exams', BarChart3, 'exams.view.own'],
    ['Results', '/module/results', GraduationCap, 'results.view.own'],
    ['Fees', '/module/fees', CreditCard, 'fees.view.own'],
    ['Notices', '/module/notices', Megaphone, 'notices.view'],
    ['Events', '/module/events', CalendarDays, 'events.view'],
    ['My Profile', '/module/profile', Settings, 'profile.manage.own'],
  ],
  parent: [
    ['Dashboard', '/dashboard/parent', LayoutDashboard, 'dashboard.view'],
    ['My Children', '/module/children', Users, 'children.view.own'],
    ['Timetable', '/module/timetable', CalendarDays, 'timetable.view.children'],
    ['Attendance', '/module/attendance', ClipboardCheck, 'attendance.view.children'],
    ['Assignments', '/module/assignments', FileText, 'assignments.view.children'],
    ['Exams & Results', '/module/results', BarChart3, 'results.view.children'],
    ['Fees', '/module/fees', CreditCard, 'fees.view.children'],
    ['Notices', '/module/notices', Megaphone, 'notices.view'],
    ['Events', '/module/events', CalendarDays, 'events.view'],
    ['My Profile', '/module/profile', Settings, 'profile.manage.own'],
  ],
  accountant: [
    ['Dashboard', '/dashboard/accountant', LayoutDashboard, 'dashboard.view'],
    ['Students', '/module/students', Users, 'students.view.basic'],
    ['Fee Collection', '/module/fees', CreditCard, 'fees.manage'],
    ['Payments', '/module/fees', ClipboardCheck, 'payments.manage'],
    ['Receipts', '/module/fees', ReceiptIndianRupee, 'receipts.manage'],
    ['Payroll', '/module/payroll', ReceiptIndianRupee, 'payroll.manage'],
    ['Reports', '/module/reports', BarChart3, 'financialReports.view'],
    ['My Profile', '/module/profile', Settings, 'profile.manage.own'],
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
          <div className="brand-mark"><GraduationCap size={23} /></div>
          <div><strong>SchoolOS</strong><span>Management Portal</span></div>
        </div>
        <button className="mobile-close" type="button" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
      </div>

      <div className="school-switcher">
        <div className="school-avatar">AS</div>
        <div><strong>Academy School</strong><span>2026–27 Session</span></div>
      </div>

      <div className="sidebar-section-label">MAIN MENU</div>
      <nav className="sidebar-nav">
        {visibleMenu.map(([label, href, Icon]) => (
          <NavLink key={`${label}-${href}`} to={href} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <NavLink to="/module/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Settings size={18} /><span>Settings / Profile</span>
        </NavLink>
        <button className="nav-item logout-item" type="button" onClick={handleLogout}>
          <LogOut size={18} /><span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
