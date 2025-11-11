import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store'
import './index.css'

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(263,70%,50%)] to-[hsl(280,60%,40%)]">
      <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">MQTT Telemetry Server</h1>
          <p className="text-muted-foreground">Web Dashboard</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-secondary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 bg-secondary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>
          <button className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-semibold transition">
            Sign In
          </button>
        </div>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Default: admin / admin123</p>
        </div>
      </div>
    </div>
  )
}

function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="flex h-16 items-center px-6">
          <h1 className="text-2xl font-bold text-primary">MQTT Telemetry Dashboard</h1>
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">Connected</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-sm text-muted-foreground mb-2">Messages Received</div>
            <div className="text-3xl font-bold">0</div>
            <div className="text-xs text-green-500 mt-2">+0% from last hour</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-sm text-muted-foreground mb-2">Buffer Usage</div>
            <div className="text-3xl font-bold">0%</div>
            <div className="text-xs text-muted-foreground mt-2">0 / 10000</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-sm text-muted-foreground mb-2">WebSocket Clients</div>
            <div className="text-3xl font-bold">0</div>
            <div className="text-xs text-muted-foreground mt-2">Active connections</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Messages</h2>
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-2">📊</p>
            <p>No messages yet</p>
            <p className="text-sm mt-2">Connect to MQTT broker to start receiving telemetry data</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={
          isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
