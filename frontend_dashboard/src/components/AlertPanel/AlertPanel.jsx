import { AlertTriangle, Clock } from 'lucide-react'
import './AlertPanel.css'

export default function AlertPanel({ alerts, loading }) {
    if (loading) {
        return (
            <div className="alert-panel">
                <div className="alert-panel-header">
                    <h3><AlertTriangle size={18} /> High Risk Alerts</h3>
                </div>
                <div className="alert-panel-body">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />
                    ))}
                </div>
            </div>
        )
    }

    if (!alerts || alerts.length === 0) {
        return (
            <div className="alert-panel">
                <div className="alert-panel-header">
                    <h3><AlertTriangle size={18} /> High Risk Alerts</h3>
                </div>
                <div className="alert-panel-body empty">
                    <p>No high-risk accounts detected</p>
                </div>
            </div>
        )
    }

    return (
        <div className="alert-panel">
            <div className="alert-panel-header">
                <h3><AlertTriangle size={18} /> High Risk Alerts</h3>
                <span className="alert-count">{alerts.length}</span>
            </div>
            <div className="alert-panel-body">
                {alerts.slice(0, 5).map((alert, index) => (
                    <div key={index} className="alert-item">
                        <div className="alert-icon-wrapper">
                            <AlertTriangle size={16} />
                        </div>
                        <div className="alert-content">
                            <h4>{alert.username}</h4>
                            <p>
                                Fake probability: {(alert.fakeProbability * 100).toFixed(1)}%
                                {alert.behavioralIndicators?.length > 0 && (
                                    <> • {alert.behavioralIndicators.length} indicators triggered</>
                                )}
                            </p>
                            <div className="alert-time">
                                <Clock size={12} />
                                <span>{new Date(alert.createdAt).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
