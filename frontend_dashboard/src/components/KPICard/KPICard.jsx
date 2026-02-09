import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import './KPICard.css'

export default function KPICard({
    icon: Icon,
    iconColor = 'blue',
    value,
    label,
    trend,
    trendValue,
    loading = false
}) {
    const getTrendIcon = () => {
        if (trend === 'up') return <TrendingUp size={14} />
        if (trend === 'down') return <TrendingDown size={14} />
        return <Minus size={14} />
    }

    if (loading) {
        return (
            <div className="kpi-card">
                <div className="skeleton" style={{ width: 48, height: 48 }} />
                <div className="skeleton" style={{ width: '60%', height: 32, marginTop: 16 }} />
                <div className="skeleton" style={{ width: '40%', height: 16, marginTop: 8 }} />
            </div>
        )
    }

    return (
        <div className="kpi-card">
            <div className="kpi-header">
                <div className={`kpi-icon ${iconColor}`}>
                    <Icon size={24} />
                </div>
                {trend && (
                    <div className={`kpi-trend ${trend}`}>
                        {getTrendIcon()}
                        <span>{trendValue}</span>
                    </div>
                )}
            </div>
            <div className="kpi-body">
                <div className="kpi-value">{value}</div>
                <div className="kpi-label">{label}</div>
            </div>
        </div>
    )
}
