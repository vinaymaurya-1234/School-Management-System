import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hasPermission, ROLE_HOME_ROUTES, ROLES } from '../config/accessControl'
import { MODULES } from '../config/moduleConfig'
import DashboardLayout from '../layouts/DashboardLayout'
import Login from '../pages/auth/Login'
import PrincipalDashboard from '../pages/principal/PrincipalDashboard'
import PrincipalModulePage from '../pages/module/PrincipalModulePage'
import PrincipalStudentsPage from '../pages/module/PrincipalStudentsPage'
import PrincipalTeachersPage from '../pages/module/PrincipalTeachersPage'
import PrincipalClassesPage from '../pages/module/PrincipalClassesPage'
import PrincipalSubjectsPage from '../pages/module/PrincipalSubjectsPage'
import TeacherAssignmentsPage from '../pages/module/TeacherAssignmentsPage'
import EventCalendarPage from '../pages/module/EventCalendarPage'
import TeacherDashboard from '../pages/teacher/TeacherDashboard'
import StudentDashboard from '../pages/student/StudentDashboard'
import ParentDashboard from '../pages/parent/ParentDashboard'
import AccountantDashboard from '../pages/accountant/AccountantDashboard'
import ModulePage from '../pages/module/ModulePage'
import TimetablePage from '../pages/module/TimetablePage'
import ExamSchedulePage from '../pages/module/ExamSchedulePage'
import AttendancePage from '../pages/module/AttendancePage'
import '../pages/module/ModuleFeature.css'

const PRINCIPAL_OPERATIONS = new Set(['fees', 'notices', 'payroll'])
function ProtectedRoute() { const { isAuthenticated } = useAuth(); return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace /> }
function RoleRoute({ role, children }) { const { user } = useAuth(); const homeRoute = ROLE_HOME_ROUTES[user?.role] || ROLE_HOME_ROUTES[ROLES.PRINCIPAL]; if (!user || user.role !== role) return <Navigate to={homeRoute} replace />; return children }
function PermissionRoute({ permission, children }) { const { user } = useAuth(); if (!hasPermission(user?.role, permission)) { const homeRoute = ROLE_HOME_ROUTES[user?.role] || '/login'; return <Navigate to={homeRoute} replace /> } return children }
function ModuleRoute() {
  const { user } = useAuth(); const { moduleKey } = useParams(); const module = MODULES[moduleKey]; const permission = module?.permissionByRole?.[user?.role]; const homeRoute = ROLE_HOME_ROUTES[user?.role] || '/login'
  if (!module || !permission || !hasPermission(user?.role, permission)) return <Navigate to={homeRoute} replace />
  if (moduleKey === 'timetable') return <TimetablePage />
  if (moduleKey === 'exams') return <ExamSchedulePage />
  if (moduleKey === 'attendance') return <AttendancePage />
  if (user?.role === 'principal' && moduleKey === 'events') return <EventCalendarPage />
  if (user?.role === 'principal' && moduleKey === 'students') return <PrincipalStudentsPage />
  if (user?.role === 'principal' && moduleKey === 'teachers') return <PrincipalTeachersPage />
  if (user?.role === 'principal' && moduleKey === 'classes') return <PrincipalClassesPage />
  if (user?.role === 'principal' && moduleKey === 'subjects') return <PrincipalSubjectsPage />
  if (user?.role === 'principal' && moduleKey === 'teacher-assignments') return <TeacherAssignmentsPage />
  if (user?.role === 'principal' && PRINCIPAL_OPERATIONS.has(moduleKey)) return <ModulePage moduleKey={moduleKey} />
  if (user?.role === 'principal') return <PrincipalModulePage moduleKey={moduleKey} />
  return <ModulePage moduleKey={moduleKey} />
}
function PublicRoute() { const { isAuthenticated, user } = useAuth(); const homeRoute = ROLE_HOME_ROUTES[user?.role] || ROLE_HOME_ROUTES[ROLES.PRINCIPAL]; return isAuthenticated ? <Navigate to={homeRoute} replace /> : <Outlet /> }
function AppRoutes() { return <Routes><Route element={<PublicRoute />}><Route path="/login" element={<Login />} /></Route><Route element={<ProtectedRoute />}><Route element={<DashboardLayout />}><Route path="/dashboard/principal" element={<RoleRoute role={ROLES.PRINCIPAL}><PermissionRoute permission="dashboard.view"><PrincipalDashboard /></PermissionRoute></RoleRoute>} /><Route path="/dashboard/teacher" element={<RoleRoute role={ROLES.TEACHER}><PermissionRoute permission="dashboard.view"><TeacherDashboard /></PermissionRoute></RoleRoute>} /><Route path="/dashboard/student" element={<RoleRoute role={ROLES.STUDENT}><PermissionRoute permission="dashboard.view"><StudentDashboard /></PermissionRoute></RoleRoute>} /><Route path="/dashboard/parent" element={<RoleRoute role={ROLES.PARENT}><PermissionRoute permission="dashboard.view"><ParentDashboard /></PermissionRoute></RoleRoute>} /><Route path="/dashboard/accountant" element={<RoleRoute role={ROLES.ACCOUNTANT}><PermissionRoute permission="dashboard.view"><AccountantDashboard /></PermissionRoute></RoleRoute>} /><Route path="/module/:moduleKey" element={<ModuleRoute />} /></Route></Route><Route path="/" element={<Navigate to="/login" replace />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes> }
export default AppRoutes
