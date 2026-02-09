import { useState } from 'react'
import { ChevronUp, ChevronDown, Eye, Filter } from 'lucide-react'
import './AccountsTable.css'

const SORT_OPTIONS = ['fakeProbability', 'trustScore', 'username', 'classification']

export default function AccountsTable({ accounts, onViewAccount, loading }) {
    const [sortBy, setSortBy] = useState('fakeProbability')
    const [sortDir, setSortDir] = useState('desc')
    const [filter, setFilter] = useState('all')

    if (loading) {
        return (
            <div className="table-container">
                <div className="table-header">
                    <h3 className="table-title">Analyzed Accounts</h3>
                </div>
                <div className="table-loading">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8 }} />
                    ))}
                </div>
            </div>
        )
    }

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortDir('desc')
        }
    }

    const filteredAccounts = accounts.filter(account => {
        if (filter === 'all') return true
        return account.classification === filter
    })

    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
        let aVal = a[sortBy]
        let bVal = b[sortBy]

        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase()
            bVal = bVal.toLowerCase()
        }

        if (sortDir === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        }
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    })

    const getClassificationBadge = (classification) => {
        const classes = {
            Real: 'badge badge-success',
            Suspicious: 'badge badge-warning',
            Fake: 'badge badge-danger'
        }
        return <span className={classes[classification]}>{classification}</span>
    }

    const getTrustScoreBar = (score) => {
        const level = score >= 0.6 ? 'high' : score >= 0.4 ? 'medium' : 'low'
        return (
            <div className="trust-score-bar">
                <div
                    className={`trust-score-fill ${level}`}
                    style={{ width: `${score * 100}%` }}
                />
            </div>
        )
    }

    const SortIcon = ({ field }) => {
        if (sortBy !== field) return null
        return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
    }

    return (
        <div className="table-container">
            <div className="table-header">
                <h3 className="table-title">Analyzed Accounts</h3>
                <div className="table-filters">
                    <div className="filter-group">
                        <Filter size={14} />
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Classifications</option>
                            <option value="Real">Real</option>
                            <option value="Suspicious">Suspicious</option>
                            <option value="Fake">Fake</option>
                        </select>
                    </div>
                    <span className="results-count">{filteredAccounts.length} accounts</span>
                </div>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('username')} className="sortable">
                                Username <SortIcon field="username" />
                            </th>
                            <th>Account ID</th>
                            <th onClick={() => handleSort('classification')} className="sortable">
                                Classification <SortIcon field="classification" />
                            </th>
                            <th onClick={() => handleSort('fakeProbability')} className="sortable">
                                Fake Probability <SortIcon field="fakeProbability" />
                            </th>
                            <th onClick={() => handleSort('trustScore')} className="sortable">
                                Trust Score <SortIcon field="trustScore" />
                            </th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAccounts.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="empty-row">
                                    No accounts found
                                </td>
                            </tr>
                        ) : (
                            sortedAccounts.map((account) => (
                                <tr key={account.accountId}>
                                    <td>
                                        <span className="username">{account.username}</span>
                                    </td>
                                    <td>
                                        <span className="account-id">{account.accountId}</span>
                                    </td>
                                    <td>{getClassificationBadge(account.classification)}</td>
                                    <td>
                                        <span className={`probability ${account.fakeProbability >= 0.7 ? 'high' : account.fakeProbability >= 0.4 ? 'medium' : 'low'}`}>
                                            {(account.fakeProbability * 100).toFixed(1)}%
                                        </span>
                                    </td>
                                    <td>
                                        <div className="trust-cell">
                                            {getTrustScoreBar(account.trustScore)}
                                            <span className="trust-value">{(account.trustScore * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <button
                                            className="btn-icon"
                                            onClick={() => onViewAccount(account)}
                                            title="View Details"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
