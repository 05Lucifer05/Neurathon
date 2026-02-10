import React, { useState, useEffect, useCallback } from 'react';
import './AlertSystem.css';

/**
 * AlertSystem - High-risk account alerts with toast notifications
 * Provides real-time alerts for fake/suspicious accounts
 */
const AlertSystem = ({
    alerts = [],
    onDismiss = null,
    onAction = null,
    maxVisible = 5,
    autoDismissMs = 10000
}) => {
    const [visibleAlerts, setVisibleAlerts] = useState([]);

    useEffect(() => {
        setVisibleAlerts(alerts.slice(0, maxVisible));
    }, [alerts, maxVisible]);

    const handleDismiss = useCallback((alertId) => {
        setVisibleAlerts(prev => prev.filter(a => a.id !== alertId));
        if (onDismiss) onDismiss(alertId);
    }, [onDismiss]);

    useEffect(() => {
        if (autoDismissMs > 0) {
            const timers = visibleAlerts.map(alert =>
                setTimeout(() => handleDismiss(alert.id), autoDismissMs)
            );
            return () => timers.forEach(clearTimeout);
        }
    }, [visibleAlerts, autoDismissMs, handleDismiss]);

    if (visibleAlerts.length === 0) return null;

    return (
        <div className="alert-system">
            {visibleAlerts.map(alert => (
                <AlertToast
                    key={alert.id}
                    alert={alert}
                    onDismiss={() => handleDismiss(alert.id)}
                    onAction={onAction}
                />
            ))}
        </div>
    );
};

/**
 * AlertToast - Individual alert notification
 */
const AlertToast = ({ alert, onDismiss, onAction }) => {
    const severityClass = alert.severity || 'medium';

    const icons = {
        high: '🚨',
        medium: '⚠️',
        low: 'ℹ️'
    };

    return (
        <div className={`alert-toast ${severityClass}`}>
            <div className="alert-icon">{icons[severityClass] || '⚠️'}</div>

            <div className="alert-content">
                <div className="alert-header">
                    <span className="alert-title">{alert.title || 'Alert'}</span>
                    <span className={`severity-badge ${severityClass}`}>
                        {severityClass.toUpperCase()}
                    </span>
                </div>
                <p className="alert-message">{alert.message}</p>

                {alert.accountId && (
                    <span className="alert-account">Account: {alert.accountId}</span>
                )}
            </div>

            <div className="alert-actions">
                {alert.actions?.map((action, idx) => (
                    <button
                        key={idx}
                        className={`action-btn ${action.type || 'default'}`}
                        onClick={() => onAction && onAction(alert.id, action.id)}
                    >
                        {action.label}
                    </button>
                ))}
                <button className="dismiss-btn" onClick={onDismiss}>
                    ✕
                </button>
            </div>
        </div>
    );
};

/**
 * AlertPanel - Panel for viewing all alerts
 */
export const AlertPanel = ({
    alerts = [],
    onAction = null,
    onClearAll = null
}) => {
    const groupedAlerts = {
        high: alerts.filter(a => a.severity === 'high'),
        medium: alerts.filter(a => a.severity === 'medium'),
        low: alerts.filter(a => a.severity === 'low')
    };

    return (
        <div className="alert-panel">
            <div className="panel-header">
                <h3>Alerts</h3>
                <span className="alert-count">{alerts.length}</span>
                {alerts.length > 0 && onClearAll && (
                    <button className="clear-all-btn" onClick={onClearAll}>
                        Clear All
                    </button>
                )}
            </div>

            {alerts.length === 0 ? (
                <div className="no-alerts">
                    <span className="no-alerts-icon">✓</span>
                    <p>No active alerts</p>
                </div>
            ) : (
                <div className="alerts-list">
                    {Object.entries(groupedAlerts).map(([severity, items]) =>
                        items.length > 0 && (
                            <div key={severity} className="alert-group">
                                <div className={`group-header ${severity}`}>
                                    {severity.toUpperCase()} ({items.length})
                                </div>
                                {items.map(alert => (
                                    <AlertListItem
                                        key={alert.id}
                                        alert={alert}
                                        onAction={onAction}
                                    />
                                ))}
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * AlertListItem - Alert in list format
 */
const AlertListItem = ({ alert, onAction }) => (
    <div className={`alert-list-item ${alert.severity}`}>
        <div className="item-main">
            <span className="item-title">{alert.title}</span>
            <span className="item-time">{formatTime(alert.timestamp)}</span>
        </div>
        <p className="item-message">{alert.message}</p>
        {alert.accountId && (
            <div className="item-meta">
                Account: <strong>{alert.accountId}</strong>
                {alert.score && ` | Score: ${(alert.score * 100).toFixed(1)}%`}
            </div>
        )}
        <div className="item-actions">
            <button
                className="action-btn review"
                onClick={() => onAction && onAction(alert.id, 'review')}
            >
                Review
            </button>
            <button
                className="action-btn flag"
                onClick={() => onAction && onAction(alert.id, 'flag')}
            >
                Flag
            </button>
            <button
                className="action-btn dismiss"
                onClick={() => onAction && onAction(alert.id, 'dismiss')}
            >
                Dismiss
            </button>
        </div>
    </div>
);

/**
 * Generate alerts from scan results
 */
export const generateAlerts = (results) => {
    return results
        .filter(r => r.classification === 'Fake' || r.fake_probability >= 0.8)
        .map((r, idx) => ({
            id: `alert-${r.account_id || idx}-${Date.now()}`,
            title: 'High-Risk Account Detected',
            message: `Account "${r.username || r.account_id}" classified as ${r.classification} with ${((r.fake_probability || 0) * 100).toFixed(1)}% fake probability`,
            accountId: r.account_id,
            severity: r.fake_probability >= 0.9 ? 'high' : r.fake_probability >= 0.7 ? 'medium' : 'low',
            score: r.fake_probability,
            timestamp: new Date(),
            actions: [
                { id: 'review', label: 'Review', type: 'primary' },
                { id: 'flag', label: 'Flag', type: 'warning' }
            ]
        }));
};

const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export default AlertSystem;
