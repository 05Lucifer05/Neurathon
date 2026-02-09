import { useState } from 'react'
import { AlertTriangle, Clock, Filter, CheckCircle } from 'lucide-react'
import './Alerts.css'

const SAMPLE_ALERTS = [
    { id: 1, username: 'xk7_bot_farm_92', fakeProbability: 0.94, indicatorCount: 3, createdAt: new Date().toISOString(), resolved: false },
    { id: 2, username: 'spam_account_123', fakeProbability: 0.89, indicatorCount: 5, createdAt: new Date(Date.now() - 3600000).toISOString(), resolved: false },
    { id: 3, username: 'fake_news_bot', fakeProbability: 0.87, indicatorCount: 4, createdAt: new Date(Date.now() - 7200000).toISOString(), resolved: true },
    { id: 4, username: 'suspicious_trader', fakeProbability: 0.78, indicatorCount: 2, createdAt: new Date(Date.now() - 14400000).toISOString(), resolved: false },
]

export default function Alerts() {
    const [alerts, setAlerts] = useState(SAMPLE_ALERTS)
    const [filter, setFilter] = useState('active')

    const filteredAlerts = alerts.filter(a => {
        if (filter === 'active') return !a.resolved
        if (filter === 'resolved') return a.resolved
        return true
    })

    const markResolved = (id) => {
        setAlerts(alerts.map(a => a.id === id ? { ...a, resolved: true } : a))
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Security Alerts</h1>
                    <p className="page-subtitle">High-risk accounts requiring attention</p>
                </div>
                <div className="alert-filters">
                    <button
                        className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                        onClick={() => setFilter('active')}
                    >
                        Active ({alerts.filter(a => !a.resolved).length})
                    </button>
                    <button
                        className={`filter-btn ${filter === 'resolved' ? 'active' : ''}`}
                        onClick={() => setFilter('resolved')}
                    >
                        Resolved ({alerts.filter(a => a.resolved).length})
                    </button>
                    <button
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                </div>
            </div>

            <div className="alerts-list">
                {filteredAlerts.length === 0 ? (
                    <div className="empty-state glass-card">
                        <CheckCircle size={48} />
                        <p>No {filter} alerts</p>
                    </div>
                ) : (
                    filteredAlerts.map(alert => (
                        <div key={alert.id} className={`alert-card glass-card ${alert.resolved ? 'resolved' : ''}`}>
                            <div className="alert-card-icon">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="alert-card-content">
                                <h4>{alert.username}</h4>
                                <p>
                                    Fake probability: {(alert.fakeProbability * 100).toFixed(1)}% •
                                    {alert.indicatorCount} indicators triggered
                                </p>
                                <div className="alert-card-time">
                                    <Clock size={12} />
                                    <span>{new Date(alert.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="alert-card-actions">
                                {!alert.resolved ? (
                                    <button className="btn btn-secondary" onClick={() => markResolved(alert.id)}>
                                        Mark Resolved
                                    </button>
                                ) : (
                                    <span className="resolved-badge">
                                        <CheckCircle size={14} /> Resolved
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
