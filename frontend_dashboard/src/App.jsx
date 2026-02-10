import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute'
import Sidebar from './components/Sidebar/Sidebar'

// Pages
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import Analysis from './pages/Analysis'
import Accounts from './pages/Accounts'
import Alerts from './pages/Alerts'
import Network from './pages/Network'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Training from './pages/Training'
import ModerationQueue from './pages/ModerationQueue'

function AppLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const { isAuthenticated, loading } = useAuth()

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner" />
                <p>Loading...</p>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return (
        <div className="app-container">
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <Routes>
                    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<Navigate to="/" replace />} />
                    <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
                    <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
                    <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                    <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
                    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
                    <Route path="/moderation" element={<ProtectedRoute><ModerationQueue /></ProtectedRoute>} />
                </Routes>
            </main>
        </div>
    )
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/*" element={<AppLayout />} />
                </Routes>
            </Router>
        </AuthProvider>
    )
}

export default App
