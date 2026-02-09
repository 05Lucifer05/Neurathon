import { useState, useEffect } from 'react'
import { Users, AlertTriangle, ShieldCheck, TrendingUp, Activity, Bell } from 'lucide-react'

import KPICard from '../components/KPICard/KPICard'
import RiskPieChart from '../components/RiskPieChart/RiskPieChart'
import ActivityHeatmap from '../components/ActivityHeatmap/ActivityHeatmap'
import AccountsTable from '../components/AccountsTable/AccountsTable'
import AccountModal from '../components/AccountModal/AccountModal'
import AlertPanel from '../components/AlertPanel/AlertPanel'
import BatchUpload from '../components/BatchUpload/BatchUpload'
import ScanStatus from '../components/ScanStatus/ScanStatus'

import './Dashboard.css'
import { scansAPI } from '../services/api'

// Sample data for demo mode
const SAMPLE_ACCOUNTS = [
    {
        accountId: 'acc_001',
        username: 'john_doe_2024',
        classification: 'Real',
        fakeProbability: 0.12,
        trustScore: 0.88,
        anomalyScore: 0.15,
        authenticityScore: 0.92,
        networkRiskScore: 0.08,
        behavioralRiskScore: 0.18,
        behavioralIndicators: [],
        inputData: {
            behavioral: { actions_per_minute: 2.5, message_similarity_index: 0.15, follow_velocity: 5.2, url_post_ratio: 0.12 },
            profile: { profile_completeness_index: 0.92 },
            network: { mutual_connection_ratio: 0.68, clustering_coefficient: 0.42, pagerank_score: 0.0012, edge_creation_velocity: 2.1 }
        },
        createdAt: new Date().toISOString()
    },
    {
        accountId: 'acc_002',
        username: 'xk7_bot_farm_92',
        classification: 'Fake',
        fakeProbability: 0.94,
        trustScore: 0.06,
        anomalyScore: 0.89,
        authenticityScore: 0.08,
        networkRiskScore: 0.92,
        behavioralRiskScore: 0.95,
        behavioralIndicators: [
            { indicator: 'high_action_rate', severity: 'high', value: 0.95, threshold: 0.8, description: 'Unusually high activity rate suggesting automation' },
            { indicator: 'low_message_diversity', severity: 'medium', value: 0.94, threshold: 0.85, description: 'High message similarity suggesting templated content' },
            { indicator: 'suspicious_network', severity: 'high', value: 0.92, threshold: 0.7, description: 'Connected to known suspicious account clusters' }
        ],
        inputData: {
            behavioral: { actions_per_minute: 85.3, message_similarity_index: 0.94, follow_velocity: 287.5, url_post_ratio: 0.89 },
            profile: { profile_completeness_index: 0.15 },
            network: { mutual_connection_ratio: 0.01, clustering_coefficient: 0.02, pagerank_score: 0.00001, edge_creation_velocity: 85.4 }
        },
        createdAt: new Date().toISOString()
    },
    {
        accountId: 'acc_003',
        username: 'sarah_marketing',
        classification: 'Suspicious',
        fakeProbability: 0.52,
        trustScore: 0.48,
        anomalyScore: 0.45,
        authenticityScore: 0.65,
        networkRiskScore: 0.42,
        behavioralRiskScore: 0.55,
        behavioralIndicators: [
            { indicator: 'rapid_network_growth', severity: 'medium', value: 0.88, threshold: 0.85, description: 'Unusually rapid network expansion' }
        ],
        inputData: {
            behavioral: { actions_per_minute: 12.5, message_similarity_index: 0.45, follow_velocity: 35.2, url_post_ratio: 0.42 },
            profile: { profile_completeness_index: 0.78 },
            network: { mutual_connection_ratio: 0.35, clustering_coefficient: 0.28, pagerank_score: 0.0008, edge_creation_velocity: 12.3 }
        },
        createdAt: new Date().toISOString()
    },
    {
        accountId: 'acc_004',
        username: 'news_updates_daily',
        classification: 'Suspicious',
        fakeProbability: 0.68,
        trustScore: 0.32,
        anomalyScore: 0.62,
        authenticityScore: 0.45,
        networkRiskScore: 0.68,
        behavioralRiskScore: 0.72,
        behavioralIndicators: [
            { indicator: 'low_message_diversity', severity: 'medium', value: 0.72, threshold: 0.85, description: 'High message similarity' },
            { indicator: 'low_mutual_connections', severity: 'medium', value: 0.12, threshold: 0.15, description: 'Very few mutual connections' }
        ],
        inputData: {
            behavioral: { actions_per_minute: 45.8, message_similarity_index: 0.72, follow_velocity: 125.5, url_post_ratio: 0.75 },
            profile: { profile_completeness_index: 0.45 },
            network: { mutual_connection_ratio: 0.12, clustering_coefficient: 0.08, pagerank_score: 0.0002, edge_creation_velocity: 42.5 }
        },
        createdAt: new Date().toISOString()
    },
    {
        accountId: 'acc_005',
        username: 'emma_travels_world',
        classification: 'Real',
        fakeProbability: 0.08,
        trustScore: 0.92,
        anomalyScore: 0.05,
        authenticityScore: 0.95,
        networkRiskScore: 0.05,
        behavioralRiskScore: 0.12,
        behavioralIndicators: [],
        inputData: {
            behavioral: { actions_per_minute: 3.8, message_similarity_index: 0.18, follow_velocity: 8.5, url_post_ratio: 0.08 },
            profile: { profile_completeness_index: 0.98 },
            network: { mutual_connection_ratio: 0.78, clustering_coefficient: 0.55, pagerank_score: 0.0025, edge_creation_velocity: 1.8 }
        },
        createdAt: new Date().toISOString()
    }
]

const SAMPLE_HEATMAP = [
    [5, 2, 0, 0, 3, 8, 15, 25, 30, 28, 22, 18, 15, 20, 25, 22, 18, 15, 12, 8, 5, 3, 2, 4],
    [12, 8, 3, 2, 5, 15, 35, 55, 65, 58, 45, 38, 42, 48, 52, 48, 42, 35, 28, 22, 15, 10, 8, 10],
    [15, 10, 5, 3, 8, 18, 40, 62, 72, 65, 52, 45, 48, 55, 58, 52, 45, 38, 32, 25, 18, 12, 10, 12],
    [18, 12, 6, 4, 10, 22, 45, 68, 78, 70, 58, 50, 52, 58, 62, 56, 48, 42, 35, 28, 20, 15, 12, 15],
    [15, 10, 5, 3, 8, 18, 42, 65, 75, 68, 55, 48, 50, 56, 60, 54, 46, 40, 33, 26, 18, 12, 10, 12],
    [10, 6, 2, 1, 4, 12, 28, 45, 52, 48, 40, 35, 38, 42, 45, 42, 36, 30, 24, 18, 12, 8, 6, 8],
    [8, 4, 1, 0, 2, 8, 18, 32, 38, 35, 28, 24, 26, 30, 32, 30, 25, 22, 18, 14, 10, 6, 5, 6]
]

export default function Dashboard() {
    const [loading, setLoading] = useState(false)
    const [accounts, setAccounts] = useState([]) // Initialize empty or keep sample if needed
    const [selectedAccount, setSelectedAccount] = useState(null)
    const [scanStatus, setScanStatus] = useState('active')
    const [error, setError] = useState(null) // Add error state

    // Load recent results on mount (optional, for now just keep sample or empty)
    // For this specific task, we mainly want to make the upload work.

    // Calculate stats from accounts
    const stats = {
        totalAccounts: accounts.length,
        fakeCount: accounts.filter(a => a.classification === 'Fake').length,
        suspiciousCount: accounts.filter(a => a.classification === 'Suspicious').length,
        realCount: accounts.filter(a => a.classification === 'Real').length,
        avgTrustScore: accounts.length > 0 ? accounts.reduce((sum, a) => sum + a.trustScore, 0) / accounts.length : 0
    }

    const fakePercentage = stats.totalAccounts > 0 ? ((stats.fakeCount / stats.totalAccounts) * 100).toFixed(1) : 0

    const riskDistribution = [
        { name: 'Real', value: stats.realCount },
        { name: 'Suspicious', value: stats.suspiciousCount },
        { name: 'Fake', value: stats.fakeCount }
    ]

    const flaggedAccounts = accounts
        .filter(a => a.fakeProbability >= 0.7)
        .sort((a, b) => b.fakeProbability - a.fakeProbability)

    const handleUpload = async (uploadedAccounts) => {
        setLoading(true)
        setScanStatus('processing')
        setError(null)

        try {
            // Call backend API
            const response = await scansAPI.create(uploadedAccounts, `Batch Scan ${new Date().toLocaleString()}`)

            if (response.data.success) {
                const newResults = response.data.results
                // Prepend new results to existing accounts
                setAccounts(prev => [...newResults, ...prev])
                setScanStatus('completed')
            } else {
                throw new Error('Scan failed to complete')
            }
        } catch (err) {
            console.error("Upload failed:", err)
            setError(err.response?.data?.error || err.message || "Failed to process accounts")
            setScanStatus('error')
        } finally {
            setLoading(false)
            // Reset status after a delay
            setTimeout(() => {
                setScanStatus('active')
                setError(null)
            }, 5000)
        }
    }

    return (
        <div className="dashboard">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Fraud Detection Dashboard</h1>
                    <p className="page-subtitle">AI-powered social media account analysis</p>
                </div>
                <div className="header-actions">
                    <ScanStatus status={scanStatus} message={error} />
                    <button className="btn btn-secondary">
                        <Bell size={16} />
                        <span className="notification-badge">3</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="dashboard-grid grid-cols-4 mb-lg">
                <KPICard
                    icon={Users}
                    iconColor="blue"
                    value={stats.totalAccounts.toLocaleString()}
                    label="Total Accounts Analyzed"
                    trend="up"
                    trendValue="+12%"
                    loading={loading}
                />
                <KPICard
                    icon={AlertTriangle}
                    iconColor="red"
                    value={`${fakePercentage}%`}
                    label="Fake Accounts Detected"
                    trend="down"
                    trendValue="-3%"
                    loading={loading}
                />
                <KPICard
                    icon={Activity}
                    iconColor="yellow"
                    value={stats.suspiciousCount}
                    label="Suspicious Accounts"
                    trend="neutral"
                    trendValue="0%"
                    loading={loading}
                />
                <KPICard
                    icon={ShieldCheck}
                    iconColor="green"
                    value={`${(stats.avgTrustScore * 100).toFixed(0)}%`}
                    label="Average Trust Score"
                    trend="up"
                    trendValue="+5%"
                    loading={loading}
                />
            </div>

            {/* Charts Row */}
            <div className="dashboard-grid grid-cols-3 mb-lg">
                <RiskPieChart data={riskDistribution} loading={loading} />
                <div className="span-2">
                    <ActivityHeatmap data={SAMPLE_HEATMAP} loading={loading} />
                </div>
            </div>

            {/* Main Content */}
            <div className="dashboard-grid grid-cols-3 mb-lg">
                <div className="span-2">
                    <AccountsTable
                        accounts={accounts}
                        onViewAccount={setSelectedAccount}
                        loading={loading}
                    />
                </div>
                <div className="sidebar-panels">
                    <AlertPanel alerts={flaggedAccounts} loading={loading} />
                    <BatchUpload onUpload={handleUpload} loading={loading} />
                </div>
            </div>

            {/* Account Modal */}
            {selectedAccount && (
                <AccountModal
                    account={selectedAccount}
                    onClose={() => setSelectedAccount(null)}
                />
            )}
        </div>
    )
}
