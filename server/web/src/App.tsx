import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataExplorerPage } from './pages/DataExplorerPage'
import { SchemaManagerPage } from './pages/SchemaManagerPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminPanelPage } from './pages/AdminPanelPage'
import './index.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated)
  return isAuthenticated ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/data-explorer" element={<ProtectedRoute><DataExplorerPage /></ProtectedRoute>} />
        <Route path="/schemas" element={<ProtectedRoute><SchemaManagerPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPanelPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
