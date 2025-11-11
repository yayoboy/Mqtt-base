import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Database, FileText, Settings, Users, LogOut } from 'lucide-react'
import { useAppStore } from '@/store'
import { api } from '@/services/api'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const user = useAppStore((state) => state.user)
  const setUser = useAppStore((state) => state.setUser)
  const isConnected = useAppStore((state) => state.isConnected)

  const handleLogout = () => {
    api.logout()
    setUser(null)
    navigate('/login')
  }

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/data-explorer', icon: Database, label: 'Data Explorer' },
    { to: '/schemas', icon: FileText, label: 'Schemas' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  if (user?.role === 'admin') {
    navItems.push({ to: '/admin', icon: Users, label: 'Admin Panel' })
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold text-primary">MQTT Telemetry</h1>
          <p className="text-xs text-muted-foreground mt-1">Server Dashboard</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium">{user?.username}</p>
              <Badge variant="secondary" className="text-xs mt-1">
                {user?.role}
              </Badge>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
