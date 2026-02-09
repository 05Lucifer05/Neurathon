import { X, AlertTriangle, Shield, Network, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts'
import './AccountModal.css'

export default function AccountModal({ account, onClose }) {
    if (!account) return null

    const behavioralData = [
        { name: 'Actions/min', value: account.inputData?.behavioral?.actions_per_minute || 0 },
        { name: 'Msg Similarity', value: (account.inputData?.behavioral?.message_similarity_index || 0) * 100 },
        { name: 'Follow Velocity', value: account.inputData?.behavioral?.follow_velocity || 0 },
        { name: 'URL Ratio', value: (account.inputData?.behavioral?.url_post_ratio || 0) * 100 },
    ]

    const radarData = [
        { metric: 'Behavioral', score: (1 - account.behavioralRiskScore) * 100, fullMark: 100 },
        { metric: 'Authenticity', score: account.authenticityScore * 100, fullMark: 100 },
        { metric: 'Network', score: (1 - account.networkRiskScore) * 100, fullMark: 100 },
        { metric: 'Trust', score: account.trustScore * 100, fullMark: 100 },
        { metric: 'Profile', score: (account.inputData?.profile?.profile_completeness_index || 0) * 100, fullMark: 100 },
    ]

    const getClassColor = () => {
        switch (account.classification) {
            case 'Fake': return 'var(--color-danger)'
            case 'Suspicious': return 'var(--color-warning)'
            default: return 'var(--color-success)'
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title-group">
                        <h2>{account.username}</h2>
                        <span className={`badge badge-${account.classification.toLowerCase()}`}>
                            {account.classification}
                        </span>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Score Overview */}
                    <div className="score-overview">
                        <div className="main-score" style={{ '--score-color': getClassColor() }}>
                            <div className="score-circle">
                                <svg viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-tertiary)" strokeWidth="8" />
                                    <circle
                                        cx="50" cy="50" r="45"
                                        fill="none"
                                        stroke={getClassColor()}
                                        strokeWidth="8"
                                        strokeDasharray={`${account.trustScore * 283} 283`}
                                        strokeLinecap="round"
                                        transform="rotate(-90 50 50)"
                                    />
                                </svg>
                                <div className="score-value">{(account.trustScore * 100).toFixed(0)}%</div>
                            </div>
                            <div className="score-label">Trust Score</div>
                        </div>

                        <div className="score-details">
                            <div className="score-item">
                                <span className="score-item-label">Fake Probability</span>
                                <span className="score-item-value danger">{(account.fakeProbability * 100).toFixed(1)}%</span>
                            </div>
                            <div className="score-item">
                                <span className="score-item-label">Anomaly Score</span>
                                <span className="score-item-value">{(account.anomalyScore * 100).toFixed(1)}%</span>
                            </div>
                            <div className="score-item">
                                <span className="score-item-label">Authenticity</span>
                                <span className="score-item-value success">{(account.authenticityScore * 100).toFixed(1)}%</span>
                            </div>
                            <div className="score-item">
                                <span className="score-item-label">Network Risk</span>
                                <span className="score-item-value warning">{(account.networkRiskScore * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="charts-grid">
                        {/* Radar Chart */}
                        <div className="chart-section">
                            <h4><Shield size={16} /> Score Breakdown</h4>
                            <ResponsiveContainer width="100%" height={200}>
                                <RadarChart data={radarData}>
                                    <PolarGrid stroke="var(--border-color)" />
                                    <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                    <Radar
                                        name="Score"
                                        dataKey="score"
                                        stroke="var(--accent-primary)"
                                        fill="var(--accent-primary)"
                                        fillOpacity={0.3}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Behavioral Metrics */}
                        <div className="chart-section">
                            <h4><Activity size={16} /> Behavioral Metrics</h4>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={behavioralData} layout="vertical">
                                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={80} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)'
                                        }}
                                    />
                                    <Bar dataKey="value" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Behavioral Indicators */}
                    {account.behavioralIndicators && account.behavioralIndicators.length > 0 && (
                        <div className="indicators-section">
                            <h4><AlertTriangle size={16} /> Triggered Indicators</h4>
                            <div className="indicators-list">
                                {account.behavioralIndicators.map((indicator, index) => (
                                    <div key={index} className={`indicator-item severity-${indicator.severity}`}>
                                        <div className="indicator-header">
                                            <span className="indicator-name">{indicator.indicator.replace(/_/g, ' ')}</span>
                                            <span className={`indicator-severity ${indicator.severity}`}>{indicator.severity}</span>
                                        </div>
                                        <p className="indicator-desc">{indicator.description}</p>
                                        <div className="indicator-values">
                                            <span>Value: {indicator.value.toFixed(2)}</span>
                                            <span>Threshold: {indicator.threshold}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Network Stats */}
                    <div className="network-section">
                        <h4><Network size={16} /> Network Statistics</h4>
                        <div className="network-grid">
                            <div className="network-stat">
                                <span className="stat-value">{((account.inputData?.network?.mutual_connection_ratio || 0) * 100).toFixed(0)}%</span>
                                <span className="stat-label">Mutual Connections</span>
                            </div>
                            <div className="network-stat">
                                <span className="stat-value">{(account.inputData?.network?.clustering_coefficient || 0).toFixed(3)}</span>
                                <span className="stat-label">Clustering Coef.</span>
                            </div>
                            <div className="network-stat">
                                <span className="stat-value">{(account.inputData?.network?.pagerank_score || 0).toFixed(4)}</span>
                                <span className="stat-label">PageRank</span>
                            </div>
                            <div className="network-stat">
                                <span className="stat-value">{(account.inputData?.network?.edge_creation_velocity || 0).toFixed(1)}</span>
                                <span className="stat-label">Edge Velocity</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
