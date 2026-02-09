import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Users, Shield, Bell, Trash2, UserPlus, Edit2, Check, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { RoleGuard } from '../components/ProtectedRoute/ProtectedRoute'
import './Settings.css'

// Sample users for demo
const SAMPLE_USERS = [
    { _id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin', isActive: true, createdAt: new Date().toISOString() },
    { _id: '2', name: 'John Analyst', email: 'john@example.com', role: 'user', isActive: true, createdAt: new Date().toISOString() },
    { _id: '3', name: 'Sarah Manager', email: 'sarah@example.com', role: 'user', isActive: false, createdAt: new Date().toISOString() },
]

export default function Settings() {
    const { user, isAdmin } = useAuth()
    const [users, setUsers] = useState(SAMPLE_USERS)
    const [editingId, setEditingId] = useState(null)
    const [editRole, setEditRole] = useState('')

    const handleRoleChange = (id) => {
        setUsers(users.map(u => u._id === id ? { ...u, role: editRole } : u))
        setEditingId(null)
    }

    const toggleActive = (id) => {
        setUsers(users.map(u => u._id === id ? { ...u, isActive: !u.isActive } : u))
    }

    const deleteUser = (id) => {
        if (confirm('Are you sure you want to delete this user?')) {
            setUsers(users.filter(u => u._id !== id))
        }
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Manage your account and organization</p>
                </div>
            </div>

            <div className="settings-grid">
                {/* Profile Section */}
                <div className="settings-section glass-card">
                    <h3><SettingsIcon size={18} /> Profile Settings</h3>
                    <div className="settings-form">
                        <div className="form-group">
                            <label>Name</label>
                            <input type="text" className="input" defaultValue={user?.name || 'Demo User'} />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" className="input" defaultValue={user?.email || 'demo@example.com'} />
                        </div>
                        <div className="form-group">
                            <label>Organization</label>
                            <input type="text" className="input" defaultValue={user?.organization || 'Demo Organization'} />
                        </div>
                        <button className="btn btn-primary">Save Changes</button>
                    </div>
                </div>

                {/* Notifications */}
                <div className="settings-section glass-card">
                    <h3><Bell size={18} /> Notifications</h3>
                    <div className="settings-toggles">
                        <label className="toggle-item">
                            <span>Email alerts for high-risk accounts</span>
                            <input type="checkbox" defaultChecked />
                        </label>
                        <label className="toggle-item">
                            <span>Daily summary reports</span>
                            <input type="checkbox" defaultChecked />
                        </label>
                        <label className="toggle-item">
                            <span>System notifications</span>
                            <input type="checkbox" />
                        </label>
                    </div>
                </div>

                {/* Admin: User Management */}
                <RoleGuard allowedRoles={['admin']}>
                    <div className="settings-section glass-card wide">
                        <div className="section-header">
                            <h3><Users size={18} /> User Management</h3>
                            <span className="admin-badge"><Shield size={12} /> Admin Only</span>
                        </div>

                        <div className="users-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Joined</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u._id}>
                                            <td>
                                                <div className="user-info">
                                                    <div className="user-avatar">{u.name.charAt(0)}</div>
                                                    <div>
                                                        <div className="user-name">{u.name}</div>
                                                        <div className="user-email">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {editingId === u._id ? (
                                                    <div className="edit-role">
                                                        <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                                                            <option value="user">User</option>
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                        <button className="icon-btn" onClick={() => handleRoleChange(u._id)}><Check size={14} /></button>
                                                        <button className="icon-btn" onClick={() => setEditingId(null)}><X size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <span className={`role-badge ${u.role}`}>{u.role}</span>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    className={`status-toggle ${u.isActive ? 'active' : ''}`}
                                                    onClick={() => toggleActive(u._id)}
                                                >
                                                    {u.isActive ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>
                                            <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="icon-btn"
                                                        onClick={() => { setEditingId(u._id); setEditRole(u.role); }}
                                                        title="Edit role"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        className="icon-btn danger"
                                                        onClick={() => deleteUser(u._id)}
                                                        title="Delete user"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </RoleGuard>

                {/* Non-admin message */}
                {!isAdmin?.() && (
                    <div className="settings-section glass-card">
                        <div className="restricted-notice">
                            <Shield size={32} />
                            <p>User management is only available to administrators.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
