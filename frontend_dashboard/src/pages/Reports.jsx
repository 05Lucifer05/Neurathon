import { BarChart3, Download, Calendar, TrendingUp, PieChart, Activity } from 'lucide-react'
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import './Reports.css'

const RISK_DATA = [
    { name: 'Real', value: 68, color: '#10b981' },
    { name: 'Suspicious', value: 22, color: '#f59e0b' },
    { name: 'Fake', value: 10, color: '#ef4444' }
]

const TREND_DATA = [
    { date: 'Mon', scans: 45, fakeDetected: 5 },
    { date: 'Tue', scans: 52, fakeDetected: 8 },
    { date: 'Wed', scans: 48, fakeDetected: 6 },
    { date: 'Thu', scans: 70, fakeDetected: 12 },
    { date: 'Fri', scans: 61, fakeDetected: 9 },
    { date: 'Sat', scans: 32, fakeDetected: 3 },
    { date: 'Sun', scans: 28, fakeDetected: 2 }
]

export default function Reports() {
    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Reports & Analytics</h1>
                    <p className="page-subtitle">Comprehensive fraud detection insights</p>
                </div>
                <button className="btn btn-primary">
                    <Download size={16} /> Export Report
                </button>
            </div>

            <div className="reports-grid">
                {/* Summary Stats */}
                <div className="report-card glass-card">
                    <div className="report-card-header">
                        <h3><BarChart3 size={18} /> Weekly Summary</h3>
                        <span className="date-range"><Calendar size={14} /> Last 7 days</span>
                    </div>
                    <div className="summary-stats">
                        <div className="summary-stat">
                            <span className="stat-value">336</span>
                            <span className="stat-label">Total Scans</span>
                            <span className="stat-trend positive"><TrendingUp size={12} /> +12%</span>
                        </div>
                        <div className="summary-stat">
                            <span className="stat-value">45</span>
                            <span className="stat-label">Threats Detected</span>
                            <span className="stat-trend negative"><TrendingUp size={12} /> +23%</span>
                        </div>
                        <div className="summary-stat">
                            <span className="stat-value">86%</span>
                            <span className="stat-label">Accuracy Rate</span>
                            <span className="stat-trend positive"><TrendingUp size={12} /> +2%</span>
                        </div>
                    </div>
                </div>

                {/* Risk Distribution */}
                <div className="report-card glass-card">
                    <div className="report-card-header">
                        <h3><PieChart size={18} /> Risk Distribution</h3>
                    </div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={200}>
                            <RechartsPie>
                                <Pie
                                    data={RISK_DATA}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {RISK_DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </RechartsPie>
                        </ResponsiveContainer>
                        <div className="chart-legend">
                            {RISK_DATA.map((item) => (
                                <div key={item.name} className="legend-item">
                                    <span className="legend-dot" style={{ background: item.color }}></span>
                                    <span>{item.name}</span>
                                    <span className="legend-value">{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Trend Chart */}
                <div className="report-card glass-card wide">
                    <div className="report-card-header">
                        <h3><Activity size={18} /> Detection Trends</h3>
                    </div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={TREND_DATA}>
                                <defs>
                                    <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorFake" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                                <YAxis stroke="rgba(255,255,255,0.5)" />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15, 15, 20, 0.9)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Area type="monotone" dataKey="scans" stroke="#6366f1" fillOpacity={1} fill="url(#colorScans)" />
                                <Area type="monotone" dataKey="fakeDetected" stroke="#ef4444" fillOpacity={1} fill="url(#colorFake)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    )
}
