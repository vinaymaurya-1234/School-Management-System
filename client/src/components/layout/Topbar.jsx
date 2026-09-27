import { Bell, Menu, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

function Topbar() {
  const { user } = useAuth()

  return (
    <header className="topbar">
      <button className="mobile-menu-button" type="button" aria-label="Open menu">
        <Menu size={21} />
      </button>

      <div className="topbar-search">
        <Search size={18} />
        <input type="search" placeholder="Search anything..." aria-label="Search" />
        <span>⌘ K</span>
      </div>

      <div className="topbar-actions">
        <button className="icon-button notification-button" type="button" aria-label="Notifications">
          <Bell size={19} />
          <span />
        </button>
        <div className="topbar-profile">
          <div className="profile-avatar">{user?.name?.charAt(0) || 'U'}</div>
          <div className="profile-copy">
            <strong>{user?.name}</strong>
            <span>{user?.roleLabel}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Topbar
