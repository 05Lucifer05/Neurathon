import { useState } from 'react'
import { Users } from 'lucide-react'
import AccountsTable from '../components/AccountsTable/AccountsTable'
import AccountModal from '../components/AccountModal/AccountModal'
import { useAuth } from '../context/AuthContext'

// Sample data
const SAMPLE_ACCOUNTS = [
    { accountId: 'acc_001', username: 'john_doe_2024', classification: 'Real', fakeProbability: 0.12, trustScore: 0.88, anomalyScore: 0.15, authenticityScore: 0.92, networkRiskScore: 0.08, behavioralRiskScore: 0.18, behavioralIndicators: [], inputData: { behavioral: { actions_per_minute: 2.5, message_similarity_index: 0.15, follow_velocity: 5.2, url_post_ratio: 0.12 }, profile: { profile_completeness_index: 0.92 }, network: { mutual_connection_ratio: 0.68, clustering_coefficient: 0.42, pagerank_score: 0.0012, edge_creation_velocity: 2.1 } }, createdAt: new Date().toISOString() },
    { accountId: 'acc_002', username: 'xk7_bot_farm_92', classification: 'Fake', fakeProbability: 0.94, trustScore: 0.06, anomalyScore: 0.89, authenticityScore: 0.08, networkRiskScore: 0.92, behavioralRiskScore: 0.95, behavioralIndicators: [{ indicator: 'high_action_rate', severity: 'high', value: 0.95, threshold: 0.8, description: 'Unusually high activity rate' }], inputData: { behavioral: { actions_per_minute: 85.3, message_similarity_index: 0.94, follow_velocity: 287.5, url_post_ratio: 0.89 }, profile: { profile_completeness_index: 0.15 }, network: { mutual_connection_ratio: 0.01, clustering_coefficient: 0.02, pagerank_score: 0.00001, edge_creation_velocity: 85.4 } }, createdAt: new Date().toISOString() },
    { accountId: 'acc_003', username: 'sarah_marketing', classification: 'Suspicious', fakeProbability: 0.52, trustScore: 0.48, anomalyScore: 0.45, authenticityScore: 0.65, networkRiskScore: 0.42, behavioralRiskScore: 0.55, behavioralIndicators: [{ indicator: 'rapid_network_growth', severity: 'medium', value: 0.88, threshold: 0.85, description: 'Rapid network expansion' }], inputData: { behavioral: { actions_per_minute: 12.5, message_similarity_index: 0.45, follow_velocity: 35.2, url_post_ratio: 0.42 }, profile: { profile_completeness_index: 0.78 }, network: { mutual_connection_ratio: 0.35, clustering_coefficient: 0.28, pagerank_score: 0.0008, edge_creation_velocity: 12.3 } }, createdAt: new Date().toISOString() },
]

export default function Accounts() {
    const [accounts] = useState(SAMPLE_ACCOUNTS)
    const [selectedAccount, setSelectedAccount] = useState(null)
    const { isAdmin } = useAuth()

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Analyzed Accounts</h1>
                    <p className="page-subtitle">
                        {isAdmin?.() ? 'All organization accounts' : 'Your analyzed accounts'}
                    </p>
                </div>
            </div>

            <AccountsTable
                accounts={accounts}
                onViewAccount={setSelectedAccount}
                loading={false}
            />

            {selectedAccount && (
                <AccountModal
                    account={selectedAccount}
                    onClose={() => setSelectedAccount(null)}
                />
            )}
        </div>
    )
}
