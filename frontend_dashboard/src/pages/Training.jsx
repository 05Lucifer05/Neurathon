import { useState, useRef } from 'react'
import { Upload, FileUp, Play, Loader, Check, AlertTriangle, Activity, Database, Settings } from 'lucide-react'
import { trainingAPI } from '../services/api'
import './Training.css'

export default function Training() {
    const [file, setFile] = useState(null)
    const [dragActive, setDragActive] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [results, setResults] = useState(null)

    // Configuration
    const [config, setConfig] = useState({
        testSize: 0.2,
        useSmote: true,
        modelType: 'ensemble',
        labelColumn: 'label'
    })

    const fileInputRef = useRef(null)

    const handleDrag = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0])
        }
    }

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0])
        }
    }

    const validateAndSetFile = (selectedFile) => {
        setError('')
        const validExtensions = ['.json', '.csv', '.zip']
        const ext = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'))

        if (!validExtensions.includes(ext)) {
            setError('Please upload a JSON, CSV, or ZIP file')
            return
        }

        if (selectedFile.size > 50 * 1024 * 1024) { // 50MB
            setError('File must be less than 50MB')
            return
        }

        setFile(selectedFile)
        setResults(null)
    }

    const handleTrain = async () => {
        if (!file) return

        setLoading(true)
        setError('')
        setResults(null)

        const formData = new FormData()
        formData.append('file', file)
        formData.append('test_size', config.testSize)
        formData.append('use_smote', config.useSmote)
        formData.append('model_type', config.modelType)
        formData.append('label_column', config.labelColumn)

        try {
            const response = await trainingAPI.trainWithFile(formData)
            if (response.success) {
                setResults(response)
            } else {
                setError('Training failed: Unknown error')
            }
        } catch (err) {
            console.error(err)
            setError(err.message || 'Failed to train model')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Model Training</h1>
                    <p className="page-subtitle">Train custom models with your own datasets</p>
                </div>
            </div>

            <div className={`training-grid ${results ? 'has-results' : ''}`}>
                {/* Configuration Panel */}
                <div className="card glass-card">
                    <div className="training-config">
                        <h3><Settings size={18} /> Configuration</h3>

                        <div className="config-form">
                            {/* File Upload */}
                            <div
                                className={`upload-zone ${dragActive ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                style={{ borderStyle: 'dashed', borderWidth: 2, padding: '2rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem' }}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json,.csv,.zip"
                                    onChange={handleFileInput}
                                    style={{ display: 'none' }}
                                />

                                {file ? (
                                    <div className="file-preview">
                                        <FileUp size={32} className="text-primary" />
                                        <p className="font-medium">{file.name}</p>
                                        <p className="text-sm text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                ) : (
                                    <div className="upload-placeholder">
                                        <Database size={32} className="text-muted" />
                                        <p className="font-medium">Drop dataset here</p>
                                        <p className="text-sm text-muted">JSON, CSV, or ZIP supported</p>
                                    </div>
                                )}
                            </div>

                            {/* Options */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Model Type</label>
                                    <select
                                        className="input"
                                        value={config.modelType}
                                        onChange={e => setConfig({ ...config, modelType: e.target.value })}
                                    >
                                        <option value="ensemble">Ensemble (Recommended)</option>
                                        <option value="random_forest">Random Forest</option>
                                        <option value="gradient_boosting">Gradient Boosting</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Test Split</label>
                                    <select
                                        className="input"
                                        value={config.testSize}
                                        onChange={e => setConfig({ ...config, testSize: parseFloat(e.target.value) })}
                                    >
                                        <option value={0.1}>10%</option>
                                        <option value={0.2}>20%</option>
                                        <option value={0.3}>30%</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={config.useSmote}
                                        onChange={e => setConfig({ ...config, useSmote: e.target.checked })}
                                    />
                                    <span>Use SMOTE for class balancing</span>
                                </label>
                            </div>

                            {error && <div className="alert alert-danger"><AlertTriangle size={16} /> {error}</div>}

                            <button
                                className="btn btn-primary"
                                onClick={handleTrain}
                                disabled={!file || loading}
                            >
                                {loading ? (
                                    <><Loader size={16} className="spin" /> Training...</>
                                ) : (
                                    <><Play size={16} /> Start Training</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Panel */}
                {(results || loading) && (
                    <div className="card glass-card">
                        <div className="training-results">
                            <h3><Activity size={18} /> Training Results</h3>

                            {loading ? (
                                <div className="training-progress">
                                    <Loader size={48} className="spin text-primary" />
                                    <p className="progress-text">Training model... this may take a few minutes</p>
                                </div>
                            ) : results ? (
                                <div className="results-content">
                                    <div className="metrics-grid">
                                        <div className="metric-card">
                                            <div className="metric-value">{(results.metrics.accuracy * 100).toFixed(1)}%</div>
                                            <div className="metric-label">Accuracy</div>
                                        </div>
                                        <div className="metric-card">
                                            <div className="metric-value">{(results.metrics.f1_score * 100).toFixed(1)}%</div>
                                            <div className="metric-label">F1 Score</div>
                                        </div>
                                    </div>

                                    <div className="result-details">
                                        <p><strong>Model Version:</strong> {results.model_version}</p>
                                        <p><strong>Samples Trained:</strong> {results.samples_trained}</p>
                                        <p><strong>Time Taken:</strong> {results.training_time_seconds}s</p>

                                        <h4 className="mt-4 mb-2">Feature Importance</h4>
                                        <div className="feature-importance-list">
                                            {Object.entries(results.feature_importance)
                                                .slice(0, 5)
                                                .map(([feature, score]) => (
                                                    <div key={feature} className="feature-item">
                                                        <span>{feature}</span>
                                                        <span className="feature-score">{(score * 100).toFixed(1)}%</span>
                                                    </div>
                                                ))}
                                        </div>

                                        <div className="alert alert-success mt-4">
                                            <Check size={16} /> Model successfully updated
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
