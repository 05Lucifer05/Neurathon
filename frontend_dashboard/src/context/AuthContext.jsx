import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        checkAuth()
    }, [])

    const checkAuth = async () => {
        const token = localStorage.getItem('token')
        if (!token) {
            setLoading(false)
            return
        }

        try {
            const response = await api.get('/auth/me')
            setUser(response.data.user)
        } catch (err) {
            localStorage.removeItem('token')
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

    const login = async (email, password) => {
        setError(null)
        try {
            const response = await api.post('/auth/login', { email, password })
            const { token, user } = response.data

            localStorage.setItem('token', token)
            setUser(user)
            return { success: true }
        } catch (err) {
            const message = err.response?.data?.error || 'Login failed'
            setError(message)
            return { success: false, error: message }
        }
    }

    const register = async (name, email, password, role = 'user', organization = '') => {
        setError(null)
        try {
            const response = await api.post('/auth/register', {
                name,
                email,
                password,
                role,
                organization
            })
            const { token, user } = response.data

            localStorage.setItem('token', token)
            setUser(user)
            return { success: true }
        } catch (err) {
            const message = err.response?.data?.error || 'Registration failed'
            setError(message)
            return { success: false, error: message }
        }
    }

    const logout = async () => {
        try {
            await api.post('/auth/logout')
        } catch (err) {
            // Ignore logout errors
        } finally {
            localStorage.removeItem('token')
            setUser(null)
        }
    }

    const isAdmin = () => user?.role === 'admin'
    const hasPermission = (permission) => user?.permissions?.[permission] ?? false

    const value = {
        user,
        loading,
        error,
        login,
        register,
        logout,
        isAdmin,
        hasPermission,
        isAuthenticated: !!user
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

export default AuthContext
