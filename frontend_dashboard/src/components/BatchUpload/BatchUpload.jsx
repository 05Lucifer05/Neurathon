import { useState, useRef } from 'react'
import { Upload, FileJson, X, Play, Loader } from 'lucide-react'
import './BatchUpload.css'

export default function BatchUpload({ onUpload, loading }) {
    const [file, setFile] = useState(null)
    const [dragActive, setDragActive] = useState(false)
    const [error, setError] = useState('')
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

        const droppedFile = e.dataTransfer.files[0]
        validateAndSetFile(droppedFile)
    }

    const handleFileInput = (e) => {
        const selectedFile = e.target.files[0]
        validateAndSetFile(selectedFile)
    }

    const validateAndSetFile = (selectedFile) => {
        setError('')

        if (!selectedFile) return

        if (!selectedFile.name.endsWith('.json')) {
            setError('Please upload a JSON file')
            return
        }

        if (selectedFile.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB')
            return
        }

        setFile(selectedFile)
    }

    const handleSubmit = async () => {
        if (!file) return

        try {
            const content = await file.text()
            const data = JSON.parse(content)

            if (!data.accounts || !Array.isArray(data.accounts)) {
                setError('Invalid format: Expected { "accounts": [...] }')
                return
            }

            onUpload(data.accounts)
        } catch (err) {
            setError('Invalid JSON format')
        }
    }

    const clearFile = () => {
        setFile(null)
        setError('')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="batch-upload">
            <div className="upload-header">
                <h3><Upload size={18} /> Run Analysis</h3>
                <p>Upload a JSON file with account data to analyze</p>
            </div>

            <div
                className={`upload-zone ${dragActive ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !file && fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                />

                {file ? (
                    <div className="file-preview">
                        <FileJson size={32} className="file-icon" />
                        <div className="file-info">
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                        <button className="file-remove" onClick={(e) => { e.stopPropagation(); clearFile(); }}>
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <>
                        <Upload size={32} className="upload-icon" />
                        <p className="upload-text">Drag & drop your JSON file here</p>
                        <p className="upload-subtext">or click to browse</p>
                    </>
                )}
            </div>

            {error && <p className="upload-error">{error}</p>}

            <button
                className="btn btn-primary upload-submit"
                onClick={handleSubmit}
                disabled={!file || loading}
            >
                {loading ? (
                    <>
                        <Loader size={16} className="spin" />
                        Processing...
                    </>
                ) : (
                    <>
                        <Play size={16} />
                        Analyze Accounts
                    </>
                )}
            </button>

            <div className="upload-format">
                <h4>Expected Format:</h4>
                <pre>{`{
  "accounts": [
    {
      "account_id": "...",
      "username": "...",
      "behavioral": { ... },
      "profile": { ... },
      "network": { ... }
    }
  ]
}`}</pre>
            </div>
        </div>
    )
}
