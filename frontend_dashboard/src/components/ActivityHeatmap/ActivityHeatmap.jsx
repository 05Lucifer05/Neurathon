import './ActivityHeatmap.css'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function getIntensityClass(value, max) {
    if (value === 0) return 'intensity-0'
    const ratio = value / max
    if (ratio < 0.25) return 'intensity-1'
    if (ratio < 0.5) return 'intensity-2'
    if (ratio < 0.75) return 'intensity-3'
    return 'intensity-4'
}

export default function ActivityHeatmap({ data, loading }) {
    if (loading) {
        return (
            <div className="chart-container">
                <div className="chart-header">
                    <h3 className="chart-title">Activity Heatmap</h3>
                </div>
                <div className="heatmap-loading">
                    <div className="skeleton" style={{ width: '100%', height: 200 }} />
                </div>
            </div>
        )
    }

    // Find max value for intensity calculation
    const maxValue = Math.max(...data.flat(), 1)

    return (
        <div className="chart-container">
            <div className="chart-header">
                <h3 className="chart-title">Activity Heatmap</h3>
                <span className="chart-subtitle">Accounts analyzed by time</span>
            </div>
            <div className="heatmap-wrapper">
                <div className="heatmap-grid">
                    {/* Hour labels */}
                    <div className="heatmap-row hour-labels">
                        <div className="day-label"></div>
                        {HOURS.filter((_, i) => i % 3 === 0).map(hour => (
                            <div key={hour} className="hour-label" style={{ gridColumn: `span 3` }}>
                                {hour.toString().padStart(2, '0')}:00
                            </div>
                        ))}
                    </div>

                    {/* Data rows */}
                    {DAYS.map((day, dayIndex) => (
                        <div key={day} className="heatmap-row">
                            <div className="day-label">{day}</div>
                            {HOURS.map(hour => (
                                <div
                                    key={`${day}-${hour}`}
                                    className={`heatmap-cell ${getIntensityClass(data[dayIndex]?.[hour] || 0, maxValue)}`}
                                    title={`${day} ${hour}:00 - ${data[dayIndex]?.[hour] || 0} accounts`}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="heatmap-legend">
                    <span className="legend-text">Less</span>
                    <div className="legend-cells">
                        <div className="heatmap-cell intensity-0" />
                        <div className="heatmap-cell intensity-1" />
                        <div className="heatmap-cell intensity-2" />
                        <div className="heatmap-cell intensity-3" />
                        <div className="heatmap-cell intensity-4" />
                    </div>
                    <span className="legend-text">More</span>
                </div>
            </div>
        </div>
    )
}
