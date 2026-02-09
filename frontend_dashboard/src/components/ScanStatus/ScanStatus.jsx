import './ScanStatus.css'

export default function ScanStatus({ status = 'idle', message }) {
    const statusConfig = {
        idle: { label: 'Idle', dotClass: 'idle' },
        processing: { label: 'Processing', dotClass: 'processing' },
        active: { label: 'System Active', dotClass: 'active' },
        error: { label: 'Error', dotClass: 'error' }
    }

    const config = statusConfig[status] || statusConfig.idle

    return (
        <div className="scan-status">
            <span className={`status-dot ${config.dotClass}`} />
            <span className="status-label">{message || config.label}</span>
        </div>
    )
}
