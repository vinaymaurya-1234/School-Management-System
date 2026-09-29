import { useEffect, useState } from 'react'
import { BarChart3, BookOpen, CalendarDays, ClipboardCheck, CreditCard, FileText, GraduationCap, LayoutDashboard, LogOut, Megaphone, ReceiptIndianRupee, Settings, Users, X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hasPermission } from '../../config/accessControl'
import apiClient from '../../api/client'

const menuByRole = {
  principal: [
    { section: 'Overview', items: [['Dashboard', '/dashboard/principal', LayoutDashboard, 'dashboard.view']] },
    { section: 'Academics', items: [['Students', '/module/students', Users, 'students.manage'], ['Teachers', '/module/teachers', GraduationCap, 'teachers.manage'], ['Classes & Sections', '/module/classes', BookOpen, 'classes.manage'], ['Subjects', '/module/subjects', BookOpen, 'subjects.manage'], ['Timetable', '/module/timetable', CalendarDays, 'timetable.manage']] },
    { section: 'Operations', items: [['Attendance', '/module/attendance', ClipboardCheck, 'attendance.manage'], ['Fees & Payments', '/module/fees', CreditCard, 'fees.manage'], ['Exams & Results', '/module/exams', FileText, 'exams.manage'], ['Reports', '/module/reports', BarChart3, 'reports.view'], ['Notices', '/module/notices', Megaphone, 'notices.manage'], ['Events', '/module/events', CalendarDays, 'events.manage'], ['Payroll', '/module/payroll', ReceiptIndianRupee, 'payroll.manage']] },
  ],
  teacher: [{ section: 'Overview', items: [['Dashboard', '/dashboard/teacher', LayoutDashboard, 'dashboard.view']] }],
  student: [{ section: 'Overview', items: [['Dashboard', '/dashboard/student', LayoutDashboard, 'dashboard.view']] }],
  parent: [{ section: 'Overview', items: [['Dashboard', '/dashboard/parent', LayoutDashboard, 'dashboard.view']] }],
  accountant: [{ section: 'Overview', items: [['Dashboard', '/dashboard/accountant', LayoutDashboard, 'dashboard.view']] }],
}
const roleMeta = { principal: { label: 'Principal', short: 'PR', tone: 'indigo' }, teacher: { label: 'Teacher', short: 'TC', tone: 'violet' }, student: { label: 'Student', short: 'ST', tone: 'cyan' }, parent: { label: 'Parent', short: 'PT', tone: 'emerald' }, accountant: { label: 'Accountant', short: 'AC', tone: 'amber' } }

function Sidebar({ onClose, isOpen = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = user?.role || 'principal'
  const sections = menuByRole[role] || []
  const meta = roleMeta[role] || roleMeta.principal
  const [school, setSchool] = useState(null)
  const [academicYear, setAcademicYear] = useState(null)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([apiClient.get('/auth/me'), apiClient.get('/academic/years')]).then(([meResult, yearResult]) => {
      if (!mounted) return
      if (meResult.status === 'fulfilled') setSchool(meResult.value.data.school || null)
      if (yearResult.status === 'fulfilled') {
        const years = yearResult.value.data.years || []
        setAcademicYear(years.find((year) => year.isActive) || years[0] || null)
      }
    })
    return () => { mounted = false }
  }, [user?.id])

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  return <aside className={`sidebar sidebar-${role} ${isOpen ? 'open' : ''}`}>
    <div className="sidebar-top"><div className="sidebar-brand"><div className="brand-mark"><GraduationCap size={21} /></div><div className="sidebar-brand-copy"><strong>SchoolOS</strong><span>Management Portal</span></div></div><button className="mobile-close" type="button" onClick={onClose} aria-label="Close menu"><X size={19} /></button></div>
    <div className="school-switcher"><div className="school-avatar">{(school?.name || 'School').slice(0,2).toUpperCase()}</div><div className="school-copy"><strong>{school?.name || 'School'}</strong><span>{academicYear?.name || 'Academic year not set'}</span></div><span className="school-status" aria-label="School active" /></div>
    <div className="sidebar-role-card"><div className={`role-avatar ${meta.tone}`}>{meta.short}</div><div><span>Signed in as</span><strong>{user?.name || meta.label}</strong></div><span className="role-badge">{meta.label}</span></div>
    <nav className="sidebar-nav" aria-label={`${meta.label} navigation`}>{sections.map(({ section, items }) => { const visibleItems = items.filter(([, , , permission]) => hasPermission(role, permission)); if (!visibleItems.length) return null; return <div className="sidebar-group" key={section}><div className="sidebar-section-label">{section}</div><div className="sidebar-group-items">{visibleItems.map(([label, href, Icon]) => <NavLink key={`${label}-${href}`} to={href} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}><span className="nav-icon"><Icon size={17} /></span><span className="nav-label">{label}</span></NavLink>)}</div></div> })}</nav>
    <div className="sidebar-bottom"><NavLink to="/module/profile" className={({ isActive }) => `nav-item utility-item ${isActive ? 'active' : ''}`} onClick={onClose}><span className="nav-icon"><Settings size={17} /></span><span className="nav-label">Settings & Profile</span></NavLink><button className="nav-item logout-item" type="button" onClick={handleLogout}><span className="nav-icon"><LogOut size={17} /></span><span className="nav-label">Sign out</span></button></div>
  </aside>
}
export default Sidebar
