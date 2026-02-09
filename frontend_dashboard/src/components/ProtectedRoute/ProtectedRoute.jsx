import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function ProtectedRoute({ children, requireAdmin = false }) {
    const { user, loading, isAuthenticated, isAdmin } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner" />
                <p>Loading...</p>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (requireAdmin && !isAdmin()) {
        return <Navigate to="/" replace />
    }

    return children
}

export function RoleGuard({ children, allowedRoles = [], requiredPermission }) {
    const { user, hasPermission } = useAuth()

    if (!user) return null

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return null
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
        return null
    }

    return children
}

export default ProtectedRoute
