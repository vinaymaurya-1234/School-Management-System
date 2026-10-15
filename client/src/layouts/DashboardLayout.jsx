import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Topbar from '../components/layout/Topbar'
import StudentTopbar from '../components/layout/StudentTopbar'
import '../styles/PremiumShell.css'
import '../styles/PremiumPolish.css'

function DashboardLayout() {
  const { user } = useAuth()
  const isStudent = user?.role === 'student'

  return (
    <div className={`premium-app-shell ${isStudent ? 'student-app-shell' : ''}`}>
      {isStudent ? <StudentTopbar /> : <Topbar />}
      <main className="premium-page-content">
        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout
