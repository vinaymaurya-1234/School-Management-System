import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hasPermission, ROLE_HOME_ROUTES, ROLES } from '../config/accessControl'
import { MODULES } from '../config/moduleConfig'
import DashboardLayout from '../layouts/DashboardLayout'
import Login from '../pages/auth/Login'
import FirstLoginPasswordPage from '../pages/auth/FirstLoginPasswordPage'
import PrincipalDashboard from '../pages/principal/PrincipalDashboard'
import PrincipalModulePage from '../pages/module/PrincipalModulePage'
import PrincipalStudentsPage from '../pages/module/PrincipalStudentsPage'
import PrincipalCredentialsPage from '../pages/module/PrincipalCredentialsPage'
import PrincipalTeachersPage from '../pages/module/PrincipalTeachersPage'
import PrincipalClassesPage from '../pages/module/PrincipalClassesPage'
import PrincipalSubjectsPage from '../pages/module/PrincipalSubjectsPage'
import TeacherAssignmentsPage from '../pages/module/TeacherAssignmentsPage'
import EventCalendarPage from '../pages/module/EventCalendarPage'
import TeacherDashboard from '../pages/teacher/TeacherDashboard'
import TeacherWorkspacePage from '../pages/teacher/TeacherWorkspacePage'
import StudentDashboard from '../pages/student/StudentDashboard'
import StudentAssignmentsPage from '../pages/student/StudentAssignmentsPage'
import StudentProfilePage from '../pages/student/StudentProfilePage'
import ParentDashboard from '../pages/parent/ParentDashboard'
import AccountantDashboard from '../pages/accountant/AccountantDashboard'
import ModulePage from '../pages/module/ModulePage'
import TimetablePage from '../pages/module/TimetablePage'
import ExamSchedulePage from '../pages/module/ExamSchedulePage'
import ResultsPage from '../pages/module/ResultsPage'
import ResultsPublicationPage from '../pages/module/ResultsPublicationPage'
import MessagesPage from '../pages/module/MessagesPage'
import PayrollPage from '../pages/module/PayrollPage'
import AttendancePage from '../pages/module/AttendancePage'
import TeacherAttendancePage from '../pages/module/TeacherAttendancePage'
import LeaveManagementPage from '../pages/module/LeaveManagementPage'
import '../pages/module/ModuleFeature.css'

const PRINCIPAL_OPERATIONS = new Set(['fees', 'notices', 'payroll'])
function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.mustChangePassword && location.pathname !== '/first-login-password') return <Navigate to="/first-login-password" replace />
  return <Outlet />
}
function RoleRoute({ role, children }) {
  const { user } = useAuth()
  const homeRoute = ROLE_HOME_ROUTES[user?.role] || ROLE_HOME_ROUTES[ROLES.PRINCIPAL]
  if (!user || user.role !== role) return <Navigate to={homeRoute} replace />
  return children
}
function PermissionRoute({ permission, children }) {
  const { user } = useAuth()
  if (!hasPermission(user?.role, permission)) {
    const homeRoute = ROLE_HOME_ROUTES[user?.role] || '/login'
    return <Navigate to={homeRoute} replace />
  }
  return children
}
function ModuleRoute() {
  const { user } = useAuth()
  const { moduleKey } = useParams()
  const homeRoute = ROLE_HOME_ROUTES[user?.role] || '/login'
  if (user?.role === 'principal' && moduleKey === 'notices') return <TeacherWorkspacePage mode="notice-admin" />
  if (user?.role === 'principal' && moduleKey === 'admissions') return <PrincipalStudentsPage />
  if (user?.role === 'principal' && moduleKey === 'login-credentials') return <PrincipalCredentialsPage />
  if (user?.role === 'student' && moduleKey === 'assignments') return <StudentAssignmentsPage />
  if (user?.role === 'student' && moduleKey === 'profile') return <StudentProfilePage />
  if (['student', 'parent'].includes(user?.role) && moduleKey === 'notices') return <TeacherWorkspacePage mode="notices" />
  if (user?.role === 'teacher') {
    if (moduleKey === 'exam-schedule') return <ExamSchedulePage mode="schedule" />
    if (moduleKey === 'enter-marks') return <ExamSchedulePage mode="marks" />
    if (moduleKey === 'marks-review') return <TeacherWorkspacePage mode="review" />
    if (moduleKey === 'student-performance') return <TeacherWorkspacePage mode="performance" />
    if (moduleKey === 'parent-communication') return <TeacherWorkspacePage mode="communication" />
    if (moduleKey === 'assignments') return <TeacherWorkspacePage mode="homework" />
    if (moduleKey === 'notices') return <TeacherWorkspacePage mode="notices" />
    if (moduleKey === 'events') return <TeacherWorkspacePage mode="events" />
  }
  const module = MODULES[moduleKey]
  const permission = module?.permissionByRole?.[user?.role]
  if (!module || !permission || !hasPermission(user?.role, permission)) return <Navigate to={homeRoute} replace />
  if (moduleKey === 'payroll' && ['principal', 'accountant'].includes(user?.role)) return <PayrollPage />
  if (moduleKey === 'leave' && ['principal', 'teacher'].includes(user?.role)) return <LeaveManagementPage />
  if (moduleKey === 'messages') return <MessagesPage />
  if (moduleKey === 'timetable') return <TimetablePage />
  if (moduleKey === 'exams') return <ExamSchedulePage />
  if (moduleKey === 'results' && ['student', 'parent'].includes(user?.role)) return <ResultsPage />
  if (moduleKey === 'results' && user?.role === 'principal') return <ResultsPublicationPage />
  if (moduleKey === 'attendance') return user?.role === ROLES.TEACHER ? <TeacherAttendancePage /> : <AttendancePage />
  if (moduleKey === 'class-attendance') return <AttendancePage />
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
function PublicRoute() {
  const { isAuthenticated, user } = useAuth()
  const homeRoute = ROLE_HOME_ROUTES[user?.role] || ROLE_HOME_ROUTES[ROLES.PRINCIPAL]
  if (isAuthenticated && user?.mustChangePassword) return <Navigate to="/first-login-password" replace />
  return isAuthenticated ? <Navigate to={homeRoute} replace /> : <Outlet />
}
function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicRoute />}><Route path="/login" element={<Login />} /></Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/first-login-password" element={<FirstLoginPasswordPage />} />
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard/principal" element={<RoleRoute role={ROLES.PRINCIPAL}><PermissionRoute permission="dashboard.view"><PrincipalDashboard /></PermissionRoute></RoleRoute>} />
          <Route path="/dashboard/teacher" element={<RoleRoute role={ROLES.TEACHER}><PermissionRoute permission="dashboard.view"><TeacherDashboard /></PermissionRoute></RoleRoute>} />
          <Route path="/dashboard/student" element={<RoleRoute role={ROLES.STUDENT}><PermissionRoute permission="dashboard.view"><StudentDashboard /></PermissionRoute></RoleRoute>} />
          <Route path="/dashboard/parent" element={<RoleRoute role={ROLES.PARENT}><PermissionRoute permission="dashboard.view"><ParentDashboard /></PermissionRoute></RoleRoute>} />
          <Route path="/dashboard/accountant" element={<RoleRoute role={ROLES.ACCOUNTANT}><PermissionRoute permission="dashboard.view"><AccountantDashboard /></PermissionRoute></RoleRoute>} />
          <Route path="/module/:moduleKey" element={<ModuleRoute />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
export default AppRoutes
