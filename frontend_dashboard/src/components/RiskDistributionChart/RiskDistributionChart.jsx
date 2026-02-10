import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import './RiskDistributionChart.css';

/**
 * RiskDistributionChart - Histogram and stacked bar visualization
 * Shows distribution of probability scores across accounts
 */
const RiskDistributionChart = ({ data = [], title = "Risk Distribution" }) => {
    // Process data into histogram buckets
    const buckets = [
        { range: '0-20%', label: 'Very Low', min: 0, max: 0.2, count: 0, color: '#10B981' },
        { range: '20-40%', label: 'Low', min: 0.2, max: 0.4, count: 0, color: '#34D399' },
        { range: '40-60%', label: 'Medium', min: 0.4, max: 0.6, count: 0, color: '#F59E0B' },
        { range: '60-80%', label: 'High', min: 0.6, max: 0.8, count: 0, color: '#F97316' },
        { range: '80-100%', label: 'Very High', min: 0.8, max: 1.01, count: 0, color: '#EF4444' }
    ];

    // Count accounts in each bucket
    data.forEach(item => {
        const prob = item.fakeProbability || item.fake_probability || 0;
        const bucket = buckets.find(b => prob >= b.min && prob < b.max);
        if (bucket) bucket.count++;
    });

    return (
        <div className="risk-distribution-chart">
            <h3 className="chart-title">{title}</h3>
            <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={buckets} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                        <XAxis
                            dataKey="range"
                            tick={{ fill: '#A0AEC0', fontSize: 11 }}
                            axisLine={{ stroke: '#4A5568' }}
                        />
                        <YAxis
                            tick={{ fill: '#A0AEC0', fontSize: 11 }}
                            axisLine={{ stroke: '#4A5568' }}
                            label={{
                                value: 'Accounts',
                                angle: -90,
                                position: 'insideLeft',
                                fill: '#A0AEC0',
                                fontSize: 12
                            }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1A202C',
                                border: '1px solid #2D3748',
                                borderRadius: 8,
                                color: '#E2E8F0'
                            }}
                            formatter={(value) => [`${value} accounts`, 'Count']}
                        />
                        <Bar
                            dataKey="count"
                            radius={[4, 4, 0, 0]}
                        >
                            {buckets.map((bucket, index) => (
                                <Cell key={`cell-${index}`} fill={bucket.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Summary stats */}
            <div className="distribution-stats">
                <div className="stat-item low">
                    <span className="stat-value">{buckets[0].count + buckets[1].count}</span>
                    <span className="stat-label">Low Risk</span>
                </div>
                <div className="stat-item medium">
                    <span className="stat-value">{buckets[2].count}</span>
                    <span className="stat-label">Medium Risk</span>
                </div>
                <div className="stat-item high">
                    <span className="stat-value">{buckets[3].count + buckets[4].count}</span>
                    <span className="stat-label">High Risk</span>
                </div>
            </div>
        </div>
    );
};

/**
 * RiskStackedBar - Stacked bar showing distribution
 */
export const RiskStackedBar = ({
    realCount = 0,
    suspiciousCount = 0,
    fakeCount = 0,
    showLabels = true
}) => {
    const total = realCount + suspiciousCount + fakeCount;
    if (total === 0) return null;

    const realPct = (realCount / total) * 100;
    const suspiciousPct = (suspiciousCount / total) * 100;
    const fakePct = (fakeCount / total) * 100;

    return (
        <div className="risk-stacked-bar">
            <div className="stacked-bar">
                <div
                    className="bar-segment real"
                    style={{ width: `${realPct}%` }}
                    title={`Real: ${realCount} (${realPct.toFixed(1)}%)`}
                />
                <div
                    className="bar-segment suspicious"
                    style={{ width: `${suspiciousPct}%` }}
                    title={`Suspicious: ${suspiciousCount} (${suspiciousPct.toFixed(1)}%)`}
                />
                <div
                    className="bar-segment fake"
                    style={{ width: `${fakePct}%` }}
                    title={`Fake: ${fakeCount} (${fakePct.toFixed(1)}%)`}
                />
            </div>

            {showLabels && (
                <div className="stacked-labels">
                    {realCount > 0 && (
                        <span className="label-item real">
                            <span className="dot" />Real: {realPct.toFixed(0)}%
                        </span>
                    )}
                    {suspiciousCount > 0 && (
                        <span className="label-item suspicious">
                            <span className="dot" />Suspicious: {suspiciousPct.toFixed(0)}%
                        </span>
                    )}
                    {fakeCount > 0 && (
                        <span className="label-item fake">
                            <span className="dot" />Fake: {fakePct.toFixed(0)}%
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default RiskDistributionChart;
