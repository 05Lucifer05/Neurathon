import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import './TrustScoreChart.css';

/**
 * TrustScoreChart - Gauge/Pie visualization for AI trust scores
 * Displays trust score (0-100) with color-coded thresholds
 */
const TrustScoreChart = ({
    trustScore = 50,
    label = "Trust Score",
    size = "medium",
    showLegend = true
}) => {
    // Normalize trust score to 0-100
    const score = Math.max(0, Math.min(100, Math.round(trustScore * (trustScore <= 1 ? 100 : 1))));

    // Determine classification based on score
    const getClassification = (s) => {
        if (s >= 70) return { label: 'Real', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)' };
        if (s >= 40) return { label: 'Suspicious', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' };
        return { label: 'Fake', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)' };
    };

    const classification = getClassification(score);

    // Gauge data
    const gaugeData = [
        { name: 'Score', value: score, color: classification.color },
        { name: 'Remaining', value: 100 - score, color: '#2D3748' }
    ];

    // Size configurations
    const sizeConfig = {
        small: { width: 120, height: 120, innerRadius: 35, outerRadius: 50, fontSize: 20 },
        medium: { width: 180, height: 180, innerRadius: 55, outerRadius: 75, fontSize: 28 },
        large: { width: 240, height: 240, innerRadius: 75, outerRadius: 100, fontSize: 36 }
    };

    const config = sizeConfig[size] || sizeConfig.medium;

    return (
        <div className="trust-score-chart" style={{ width: config.width, height: config.height + 40 }}>
            <div className="chart-container" style={{ width: config.width, height: config.height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={gaugeData}
                            cx="50%"
                            cy="50%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius={config.innerRadius}
                            outerRadius={config.outerRadius}
                            paddingAngle={0}
                            dataKey="value"
                        >
                            {gaugeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>

                {/* Center display */}
                <div
                    className="score-display"
                    style={{
                        fontSize: config.fontSize,
                        color: classification.color,
                        top: '40%'
                    }}
                >
                    {score}
                </div>
            </div>

            <div className="chart-label">{label}</div>

            {showLegend && (
                <div
                    className="classification-badge"
                    style={{
                        backgroundColor: classification.bgColor,
                        color: classification.color,
                        borderColor: classification.color
                    }}
                >
                    {classification.label}
                </div>
            )}
        </div>
    );
};

/**
 * TrustScoreGauge - Full circle gauge variant
 */
export const TrustScoreGauge = ({
    trustScore = 50,
    label = "AI Trust Score",
    description = ""
}) => {
    const score = Math.max(0, Math.min(100, Math.round(trustScore * (trustScore <= 1 ? 100 : 1))));

    const getGradient = (s) => {
        if (s >= 70) return 'linear-gradient(135deg, #10B981, #34D399)';
        if (s >= 40) return 'linear-gradient(135deg, #F59E0B, #FBBF24)';
        return 'linear-gradient(135deg, #EF4444, #F87171)';
    };

    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="trust-gauge-container">
            <div className="gauge-wrapper">
                <svg className="gauge-svg" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#2D3748"
                        strokeWidth="8"
                    />
                    {/* Score circle */}
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="url(#gaugeGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        transform="rotate(-90 50 50)"
                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                    <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444'} />
                            <stop offset="100%" stopColor={score >= 70 ? '#34D399' : score >= 40 ? '#FBBF24' : '#F87171'} />
                        </linearGradient>
                    </defs>
                </svg>
                <div className="gauge-center">
                    <span className="gauge-score">{score}</span>
                    <span className="gauge-percent">%</span>
                </div>
            </div>
            <div className="gauge-label">{label}</div>
            {description && <div className="gauge-description">{description}</div>}
        </div>
    );
};

/**
 * TrustScoreTrend - Mini trend indicator
 */
export const TrustScoreTrend = ({ current = 50, previous = 50 }) => {
    const diff = current - previous;
    const isUp = diff > 0;
    const isDown = diff < 0;
    const isStable = diff === 0;

    return (
        <div className={`trust-trend ${isUp ? 'up' : isDown ? 'down' : 'stable'}`}>
            <span className="trend-icon">
                {isUp ? '↑' : isDown ? '↓' : '→'}
            </span>
            <span className="trend-value">
                {Math.abs(diff).toFixed(1)}%
            </span>
        </div>
    );
};

export default TrustScoreChart;
