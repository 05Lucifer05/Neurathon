import { useState, useEffect } from 'react'
import {
    AlertTriangle,
    CheckCircle,
    XCircle,
    Eye,
    Clock,
    ChevronLeft,
    ChevronRight,
    Filter,
    RefreshCw,
    Shield,
    ArrowUpRight
} from 'lucide-react'
import './ModerationQueue.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export default function ModerationQueue() {
    const [queue, setQueue] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedItem, setSelectedItem] = useState(null)
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 })
    const [filters, setFilters] = useState({ status: 'pending', priority: '' })
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        fetchQueue()
        fetchStats()
    }, [pagination.page, filters])

    const fetchQueue = async () => {
        try {
            setLoading(true)
            const token = localStorage.getItem('token')
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                status: filters.status || 'all',
                ...(filters.priority && { priority: filters.priority })
            })

            const res = await fetch(`${API_URL}/governance/queue?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            const data = await res.json()
            if (data.success) {
                setQueue(data.data.items)
                setPagination(prev => ({ ...prev, ...data.data.pagination }))
            }
        } catch (error) {
            console.error('Error fetching queue:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_URL}/governance/queue/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                setStats(data.data)
            }
        } catch (error) {
            console.error('Error fetching stats:', error)
        }
    }

    const handleDecision = async (itemId, decision, reason = '') => {
        try {
            setActionLoading(true)
            const token = localStorage.getItem('token')

            const res = await fetch(`${API_URL}/governance/queue/${itemId}/decide`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ decision, reason })
            })

            const data = await res.json()
            if (data.success) {
                setSelectedItem(null)
                fetchQueue()
                fetchStats()
            }
        } catch (error) {
            console.error('Error making decision:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleClaim = async (itemId) => {
        try {
            const token = localStorage.getItem('token')
            await fetch(`${API_URL}/governance/queue/${itemId}/claim`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            fetchQueue()
        } catch (error) {
            console.error('Error claiming item:', error)
        }
    }

    const getPriorityBadge = (priority) => {
        const classes = {
            critical: 'priority-critical',
            high: 'priority-high',
            medium: 'priority-medium',
            low: 'priority-low'
        }
        return <span className={`priority-badge ${classes[priority]}`}>{priority}</span>
    }

    const getStatusBadge = (status) => {
        const icons = {
            pending: <Clock size={14} />,
            in_review: <Eye size={14} />,
            reviewed: <CheckCircle size={14} />,
            cleared: <CheckCircle size={14} />,
            escalated: <ArrowUpRight size={14} />
        }
        return (
            <span className={`status-badge status-${status}`}>
                {icons[status]} {status.replace('_', ' ')}
            </span>
        )
    }

    const formatRiskScore = (score) => {
        if (!score) return '0%'
        return `${(score * 100).toFixed(1)}%`
    }

    return (
        <div className="moderation-queue">
            <header className="queue-header">
                <div className="header-left">
                    <Shield className="header-icon" />
                    <div>
                        <h1>Moderation Queue</h1>
                        <p>Review and manage flagged accounts</p>
                    </div>
                </div>
                <button className="refresh-btn" onClick={() => { fetchQueue(); fetchStats(); }}>
                    <RefreshCw size={18} />
                    Refresh
                </button>
            </header>

            {stats && (
                <div className="stats-cards">
                    <div className="stat-card stat-pending">
                        <Clock size={24} />
                        <div>
                            <span className="stat-value">{stats.pendingCount}</span>
                            <span className="stat-label">Pending</span>
                        </div>
                    </div>
                    <div className="stat-card stat-review">
                        <Eye size={24} />
                        <div>
                            <span className="stat-value">{stats.inReviewCount}</span>
                            <span className="stat-label">In Review</span>
                        </div>
                    </div>
                    <div className="stat-card stat-total">
                        <AlertTriangle size={24} />
                        <div>
                            <span className="stat-value">{stats.totalActive}</span>
                            <span className="stat-label">Total Active</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="filters-bar">
                <div className="filter-group">
                    <Filter size={18} />
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="in_review">In Review</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="cleared">Cleared</option>
                        <option value="escalated">Escalated</option>
                    </select>
                    <select
                        value={filters.priority}
                        onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                    >
                        <option value="">All Priority</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>
            </div>

            <div className="queue-container">
                <div className="queue-list">
                    {loading ? (
                        <div className="loading-state">Loading queue...</div>
                    ) : queue.length === 0 ? (
                        <div className="empty-state">
                            <CheckCircle size={48} />
                            <h3>Queue is empty</h3>
                            <p>No accounts pending review</p>
                        </div>
                    ) : (
                        queue.map(item => (
                            <div
                                key={item._id}
                                className={`queue-item ${selectedItem?._id === item._id ? 'selected' : ''}`}
                                onClick={() => setSelectedItem(item)}
                            >
                                <div className="item-header">
                                    <span className="hashed-id">{item.hashedAccountId?.substring(0, 12)}...</span>
                                    {getPriorityBadge(item.priority)}
                                </div>
                                <div className="item-scores">
                                    <div className="score">
                                        <span className="score-label">Risk</span>
                                        <span className="score-value risk">
                                            {formatRiskScore(item.riskAnalysis?.fakeProbability)}
                                        </span>
                                    </div>
                                    <div className="score">
                                        <span className="score-label">Trust</span>
                                        <span className="score-value trust">
                                            {formatRiskScore(item.riskAnalysis?.trustScore)}
                                        </span>
                                    </div>
                                </div>
                                <div className="item-footer">
                                    {getStatusBadge(item.status)}
                                    <span className="item-time">
                                        {new Date(item.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {selectedItem && (
                    <div className="detail-panel">
                        <div className="panel-header">
                            <h2>Account Details</h2>
                            <button className="close-btn" onClick={() => setSelectedItem(null)}>
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="panel-section">
                            <h3>Risk Analysis</h3>
                            <div className="risk-grid">
                                <div className="risk-item">
                                    <span>Fake Probability</span>
                                    <span className="risk-value high">
                                        {formatRiskScore(selectedItem.riskAnalysis?.fakeProbability)}
                                    </span>
                                </div>
                                <div className="risk-item">
                                    <span>Trust Score</span>
                                    <span className="risk-value">
                                        {formatRiskScore(selectedItem.riskAnalysis?.trustScore)}
                                    </span>
                                </div>
                                <div className="risk-item">
                                    <span>Anomaly Score</span>
                                    <span className="risk-value">
                                        {formatRiskScore(selectedItem.riskAnalysis?.anomalyScore)}
                                    </span>
                                </div>
                                <div className="risk-item">
                                    <span>Risk Tier</span>
                                    <span className={`tier tier-${selectedItem.riskAnalysis?.riskTier?.toLowerCase()}`}>
                                        {selectedItem.riskAnalysis?.riskTier}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="panel-section">
                            <h3>Behavioral Summary</h3>
                            <div className="behavioral-grid">
                                {Object.entries(selectedItem.behavioralSummary || {}).map(([key, value]) => (
                                    <div key={key} className="behavioral-item">
                                        <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <span>{typeof value === 'number' ? value.toFixed(2) : value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {selectedItem.anomalyIndicators?.length > 0 && (
                            <div className="panel-section">
                                <h3>Anomaly Indicators</h3>
                                <div className="indicators-list">
                                    {selectedItem.anomalyIndicators.map((ind, idx) => (
                                        <div key={idx} className={`indicator severity-${ind.severity}`}>
                                            <AlertTriangle size={14} />
                                            <span>{ind.indicator}</span>
                                            <span className="severity">{ind.severity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedItem.status === 'pending' && (
                            <div className="panel-actions">
                                <button
                                    className="action-btn claim-btn"
                                    onClick={() => handleClaim(selectedItem._id)}
                                >
                                    <Eye size={16} /> Claim for Review
                                </button>
                            </div>
                        )}

                        {selectedItem.status === 'in_review' && (
                            <div className="panel-actions">
                                <button
                                    className="action-btn clear-btn"
                                    onClick={() => handleDecision(selectedItem._id, 'cleared', 'Manual review - cleared')}
                                    disabled={actionLoading}
                                >
                                    <CheckCircle size={16} /> Clear
                                </button>
                                <button
                                    className="action-btn restrict-btn"
                                    onClick={() => handleDecision(selectedItem._id, 'restrict', 'Manual review - restrict')}
                                    disabled={actionLoading}
                                >
                                    <XCircle size={16} /> Restrict
                                </button>
                                <button
                                    className="action-btn escalate-btn"
                                    onClick={() => handleDecision(selectedItem._id, 'escalate', 'Escalated for further review')}
                                    disabled={actionLoading}
                                >
                                    <ArrowUpRight size={16} /> Escalate
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {pagination.pages > 1 && (
                <div className="pagination">
                    <button
                        disabled={pagination.page <= 1}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span>Page {pagination.page} of {pagination.pages}</span>
                    <button
                        disabled={pagination.page >= pagination.pages}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}
        </div>
    )
}
