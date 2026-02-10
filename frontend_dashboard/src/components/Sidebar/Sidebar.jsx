import { useNavigate, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Search,
    Shield,
    Users,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Network,
    LogOut,
    Brain
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import './Sidebar.css'

const menuItems = [
    { id: 'dashboard', path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'analysis', path: '/analysis', icon: Search, label: 'Run Analysis' },
    { id: 'accounts', path: '/accounts', icon: Users, label: 'Analyzed Accounts' },
    { id: 'alerts', path: '/alerts', icon: AlertTriangle, label: 'Alerts', badge: 3 },
    { id: 'network', path: '/network', icon: Network, label: 'Network Graph' },
    { id: 'reports', path: '/reports', icon: BarChart3, label: 'Reports' },
    { id: 'training', path: '/training', icon: Brain, label: 'Model Training' },
    { id: 'moderation', path: '/moderation', icon: Shield, label: 'Moderation Queue', adminOnly: true },
]

const bottomItems = [
    { id: 'settings', path: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ collapsed, onToggle }) {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout, isAdmin } = useAuth()

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/'
        return location.pathname.startsWith(path)
    }

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="logo-icon">
                    <Shield size={24} />
                </div>
                {!collapsed && (
                    <div className="logo-text">
                        <span className="logo-title">FraudShield</span>
                        <span className="logo-subtitle">AI Detection</span>
                    </div>
                )}
            </div>

            {/* Toggle Button */}
            <button className="sidebar-toggle" onClick={onToggle}>
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            {/* Navigation */}
            <nav className="sidebar-nav">
                <div className="nav-section">
                    {!collapsed && <span className="nav-section-title">Main Menu</span>}
                    <ul className="nav-list">
                        {menuItems
                            .filter(item => !item.adminOnly || isAdmin)
                            .map((item) => (
                                <li key={item.id}>
                                    <button
                                        className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                                        onClick={() => navigate(item.path)}
                                    >
                                        <item.icon size={20} className="nav-icon" />
                                        {!collapsed && (
                                            <>
                                                <span className="nav-label">{item.label}</span>
                                                {item.badge && (
                                                    <span className="nav-badge">{item.badge}</span>
                                                )}
                                            </>
                                        )}
                                    </button>
                                </li>
                            ))}
                    </ul>
                </div>

                <div className="nav-section bottom">
                    <ul className="nav-list">
                        {bottomItems.map((item) => (
                            <li key={item.id}>
                                <button
                                    className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                                    onClick={() => navigate(item.path)}
                                >
                                    <item.icon size={20} className="nav-icon" />
                                    {!collapsed && <span className="nav-label">{item.label}</span>}
                                </button>
                            </li>
                        ))}
                        <li>
                            <button className="nav-item logout" onClick={handleLogout}>
                                <LogOut size={20} className="nav-icon" />
                                {!collapsed && <span className="nav-label">Logout</span>}
                            </button>
                        </li>
                    </ul>
                </div>
            </nav>

            {/* User Section */}
            {!collapsed && (
                <div className="sidebar-user">
                    <div className="user-avatar">
                        <span>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                    </div>
                    <div className="user-info">
                        <span className="user-name">{user?.name || 'User'}</span>
                        <span className="user-role">
                            {isAdmin?.() ? (
                                <><Shield size={10} /> Admin</>
                            ) : (
                                user?.role || 'User'
                            )}
                        </span>
                    </div>
                </div>
            )}
        </aside>
    )
}
