import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import './RiskPieChart.css'

const COLORS = {
    Real: '#10b981',
    Suspicious: '#f59e0b',
    Fake: '#ef4444'
}

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0]
        return (
            <div className="chart-tooltip">
                <p className="tooltip-label">{data.name}</p>
                <p className="tooltip-value">{data.value} accounts</p>
                <p className="tooltip-percent">{((data.value / data.payload.total) * 100).toFixed(1)}%</p>
            </div>
        )
    }
    return null
}

const CustomLegend = ({ payload }) => {
    return (
        <div className="chart-legend">
            {payload.map((entry, index) => (
                <div key={index} className="legend-item">
                    <span
                        className="legend-dot"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="legend-label">{entry.value}</span>
                </div>
            ))}
        </div>
    )
}

export default function RiskPieChart({ data, loading }) {
    if (loading) {
        return (
            <div className="chart-container">
                <div className="chart-header">
                    <h3 className="chart-title">Risk Distribution</h3>
                </div>
                <div className="chart-loading">
                    <div className="skeleton" style={{ width: 200, height: 200, borderRadius: '50%', margin: '0 auto' }} />
                </div>
            </div>
        )
    }

    const total = data.reduce((sum, item) => sum + item.value, 0)
    const chartData = data.map(item => ({ ...item, total }))

    return (
        <div className="chart-container">
            <div className="chart-header">
                <h3 className="chart-title">Risk Distribution</h3>
                <span className="chart-subtitle">{total} total accounts</span>
            </div>
            <div className="pie-chart-wrapper">
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[entry.name]}
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend content={<CustomLegend />} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
