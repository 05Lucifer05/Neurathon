import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import './ClassificationBreakdown.css';

const COLORS = {
    Real: '#10B981',
    Suspicious: '#F59E0B',
    Fake: '#EF4444'
};

/**
 * ClassificationBreakdown - Pie chart with drill-down capability
 * Shows Real/Suspicious/Fake distribution
 */
const ClassificationBreakdown = ({
    data = [],
    summary = null,
    onClassificationClick = null,
    title = "Classification Breakdown"
}) => {
    // Calculate from data array or use summary
    let chartData;

    if (summary) {
        chartData = [
            { name: 'Real', value: summary.real_count || summary.realCount || 0 },
            { name: 'Suspicious', value: summary.suspicious_count || summary.suspiciousCount || 0 },
            { name: 'Fake', value: summary.fake_count || summary.fakeCount || 0 }
        ].filter(d => d.value > 0);
    } else {
        const counts = { Real: 0, Suspicious: 0, Fake: 0 };
        data.forEach(item => {
            const classification = item.classification || 'Real';
            if (counts[classification] !== undefined) {
                counts[classification]++;
            }
        });
        chartData = Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .filter(d => d.value > 0);
    }

    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
        return (
            <div className="classification-breakdown empty">
                <h3>{title}</h3>
                <p className="no-data">No classification data available</p>
            </div>
        );
    }

    const handleClick = (entry) => {
        if (onClassificationClick) {
            onClassificationClick(entry.name);
        }
    };

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
        if (percent < 0.05) return null;

        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill="#fff"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight={600}
            >
                {(percent * 100).toFixed(0)}%
            </text>
        );
    };

    return (
        <div className="classification-breakdown">
            <h3 className="breakdown-title">{title}</h3>

            <div className="chart-container">
                <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            labelLine={false}
                            label={renderCustomLabel}
                            onClick={handleClick}
                            style={{ cursor: onClassificationClick ? 'pointer' : 'default' }}
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[entry.name]}
                                    stroke="transparent"
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1A202C',
                                border: '1px solid #2D3748',
                                borderRadius: 8,
                                color: '#E2E8F0'
                            }}
                            formatter={(value, name) => [
                                `${value} accounts (${((value / total) * 100).toFixed(1)}%)`,
                                name
                            ]}
                        />
                    </PieChart>
                </ResponsiveContainer>

                {/* Center total */}
                <div className="center-label">
                    <span className="total-value">{total}</span>
                    <span className="total-text">Total</span>
                </div>
            </div>

            {/* Legend */}
            <div className="classification-legend">
                {chartData.map(item => (
                    <div
                        key={item.name}
                        className={`legend-item ${item.name.toLowerCase()}`}
                        onClick={() => handleClick(item)}
                        style={{ cursor: onClassificationClick ? 'pointer' : 'default' }}
                    >
                        <span className="legend-dot" style={{ backgroundColor: COLORS[item.name] }} />
                        <span className="legend-name">{item.name}</span>
                        <span className="legend-value">{item.value}</span>
                        <span className="legend-pct">
                            ({((item.value / total) * 100).toFixed(1)}%)
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * ClassificationBadge - Small inline badge
 */
export const ClassificationBadge = ({ classification = 'Real', size = 'normal' }) => {
    const classLower = classification.toLowerCase();
    return (
        <span className={`classification-badge ${classLower} ${size}`}>
            {classification}
        </span>
    );
};

export default ClassificationBreakdown;
