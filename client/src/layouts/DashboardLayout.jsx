import { Outlet } from 'react-router-dom'
import Topbar from '../components/layout/Topbar'
import '../styles/PremiumShell.css'
import '../styles/PremiumPolish.css'

function DashboardLayout() {
  return (
    <div className="premium-app-shell">
      <Topbar />
      <main className="premium-page-content">
        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout
