import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../layouts/DashboardLayout";
import Login from "../pages/auth/Login";
import PrincipalDashboard from "../pages/principal/PrincipalDashboard";
import TeacherDashboard from "../pages/teacher/TeacherDashboard";
import StudentDashboard from "../pages/student/StudentDashboard";
import ParentDashboard from "../pages/parent/ParentDashboard";
import AccountantDashboard from "../pages/accountant/AccountantDashboard";

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function RoleRoute({ role, children }) {
  const { user } = useAuth();

  if (user?.role !== role) {
    return <Navigate to={`/dashboard/${user?.role || "principal"}`} replace />;
  }

  return children;
}

function PublicRoute() {
  const { isAuthenticated, user } = useAuth();
  return isAuthenticated ? (
    <Navigate to={`/dashboard/${user.role}`} replace />
  ) : (
    <Outlet />
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route
            path="/dashboard/principal"
            element={
              <RoleRoute role="principal">
                <PrincipalDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/teacher"
            element={
              <RoleRoute role="teacher">
                <TeacherDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/student"
            element={
              <RoleRoute role="student">
                <StudentDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/parent"
            element={
              <RoleRoute role="parent">
                <ParentDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/accountant"
            element={
              <RoleRoute role="accountant">
                <AccountantDashboard />
              </RoleRoute>
            }
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
