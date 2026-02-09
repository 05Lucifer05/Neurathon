import { useState } from 'react'
import { Search, Play, Loader } from 'lucide-react'
import BatchUpload from '../components/BatchUpload/BatchUpload'
import './Analysis.css'

export default function Analysis() {
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState(null)

    const handleUpload = async (accounts) => {
        setLoading(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000))

        const mockResults = accounts.map((acc, i) => ({
            accountId: acc.account_id,
            username: acc.username,
            classification: ['Real', 'Suspicious', 'Fake'][Math.floor(Math.random() * 3)],
            fakeProbability: Math.random(),
            trustScore: Math.random()
        }))

        mockResults.forEach(r => {
            r.trustScore = 1 - r.fakeProbability
            r.classification = r.fakeProbability >= 0.7 ? 'Fake' : r.fakeProbability >= 0.4 ? 'Suspicious' : 'Real'
        })

        setResults(mockResults)
        setLoading(false)
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Run Analysis</h1>
                    <p className="page-subtitle">Upload account data for fraud detection analysis</p>
                </div>
            </div>

            <div className="analysis-grid">
                <div className="analysis-upload">
                    <BatchUpload onUpload={handleUpload} loading={loading} />
                </div>

                {results && (
                    <div className="analysis-results glass-card">
                        <h3><Search size={18} /> Analysis Results</h3>
                        <p className="results-summary">
                            Analyzed {results.length} accounts •
                            {results.filter(r => r.classification === 'Fake').length} Fake •
                            {results.filter(r => r.classification === 'Suspicious').length} Suspicious •
                            {results.filter(r => r.classification === 'Real').length} Real
                        </p>
                        <div className="results-list">
                            {results.slice(0, 10).map((result, i) => (
                                <div key={i} className={`result-item ${result.classification.toLowerCase()}`}>
                                    <span className="result-username">{result.username}</span>
                                    <span className={`badge badge-${result.classification.toLowerCase()}`}>
                                        {result.classification}
                                    </span>
                                    <span className="result-score">{(result.trustScore * 100).toFixed(0)}% trust</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
