import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Mail, Lock, User, Building, AlertCircle, Loader, UserCog } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Register() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user',
        organization: ''
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { register } = useAuth()
    const navigate = useNavigate()

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        const { name, email, password, confirmPassword, role, organization } = formData

        if (!name || !email || !password) {
            setError('Please fill in all required fields')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }

        setLoading(true)
        const result = await register(name, email, password, role, organization)
        setLoading(false)

        if (result.success) {
            navigate('/', { replace: true })
        } else {
            setError(result.error)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-container register">
                <div className="auth-header">
                    <div className="auth-logo">
                        <Shield size={32} />
                    </div>
                    <h1>Create Account</h1>
                    <p>Join FraudShield to start detecting fraud</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="auth-error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="name">Full Name *</label>
                        <div className="input-wrapper">
                            <User size={18} className="input-icon" />
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Enter your full name"
                                className="input"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email *</label>
                        <div className="input-wrapper">
                            <Mail size={18} className="input-icon" />
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Enter your email"
                                className="input"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="password">Password *</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Min. 6 characters"
                                    className="input"
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password *</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Confirm password"
                                    className="input"
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="role">Account Type</label>
                            <div className="input-wrapper">
                                <UserCog size={18} className="input-icon" />
                                <select
                                    id="role"
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="input"
                                >
                                    <option value="user">Regular User</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="organization">Organization</label>
                            <div className="input-wrapper">
                                <Building size={18} className="input-icon" />
                                <input
                                    type="text"
                                    id="organization"
                                    name="organization"
                                    value={formData.organization}
                                    onChange={handleChange}
                                    placeholder="Your organization"
                                    className="input"
                                />
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader size={18} className="spin" />
                                Creating account...
                            </>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login">Sign in</Link></p>
                </div>
            </div>

            <div className="auth-background">
                <div className="auth-bg-pattern" />
            </div>
        </div>
    )
}
