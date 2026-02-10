import { useState, useRef } from 'react'
import { Upload, FileJson, X, Play, Loader, Files } from 'lucide-react'
import './BatchUpload.css'

export default function BatchUpload({ onUpload, loading }) {
    const [files, setFiles] = useState([])
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
        const droppedFiles = Array.from(e.dataTransfer.files)
        validateAndSetFiles(droppedFiles)
    }

    const handleFileInput = (e) => {
        const selectedFiles = Array.from(e.target.files)
        validateAndSetFiles(selectedFiles)
    }

    const validateAndSetFiles = (selectedFiles) => {
        setError('')
        if (!selectedFiles.length) return
        const validFiles = []
        for (const file of selectedFiles) {
            if (!file.name.endsWith('.json')) {
                setError('Please upload only JSON files')
                return
            }
            if (file.size > 50 * 1024 * 1024) {
                setError('Each file must be less than 50MB')
                return
            }
            validFiles.push(file)
        }
        setFiles(prev => [...prev, ...validFiles])
    }

    // Helper to extract accounts from various JSON structures
    const extractAccounts = (data) => {
        if (Array.isArray(data)) return data
        if (data.accounts && Array.isArray(data.accounts)) return data.accounts
        if (data.data && Array.isArray(data.data)) return data.data
        if (data.results && Array.isArray(data.results)) return data.results
        if (data.users && Array.isArray(data.users)) return data.users
        if (data.account_id || data.username || data.id) return [data]
        for (const key of Object.keys(data)) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                const first = data[key][0]
                if (typeof first === 'object' && first !== null) {
                    console.log(`Found accounts in "${key}": ${data[key].length} items`)
                    return data[key]
                }
            }
        }
        return []
    }

    const handleSubmit = async () => {
        if (!files.length) return
        try {
            const allAccounts = []
            for (const file of files) {
                console.log(`Processing file: ${file.name}, size: ${file.size}`)
                const content = await file.text()
                console.log(`File content length: ${content.length} chars`)
                const data = JSON.parse(content)
                console.log(`Parsed JSON keys:`, Object.keys(data))
                console.log(`Data type:`, Array.isArray(data) ? 'array' : typeof data)

                const accounts = extractAccounts(data)
                console.log(`Extracted ${accounts.length} accounts from ${file.name}`)

                if (accounts.length === 0) {
                    setError(`No accounts found in ${file.name}`)
                    return
                }
                allAccounts.push(...accounts)
            }
            if (allAccounts.length === 0) {
                setError('No accounts found in uploaded files')
                return
            }
            console.log(`Uploading ${allAccounts.length} accounts for analysis`)
            onUpload(allAccounts)
        } catch (err) {
            console.error('Parse error:', err)
            setError('Invalid JSON format')
        }
    }

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
        setError('')
    }

    const clearFiles = () => {
        setFiles([])
        setError('')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0)

    return (
        <div className="batch-upload">
            <div className="upload-header">
                <h3><Upload size={18} /> Run Analysis</h3>
                <p>Upload JSON files with account data to analyze</p>
            </div>

            <div
                className={`upload-zone ${dragActive ? 'dragging' : ''} ${files.length ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    multiple
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                />

                {files.length > 0 ? (
                    <div className="files-preview">
                        <div className="files-header">
                            <Files size={20} />
                            <span>{files.length} file(s) selected • {(totalSize / 1024).toFixed(1)} KB</span>
                            <button className="clear-all" onClick={(e) => { e.stopPropagation(); clearFiles(); }}>
                                Clear All
                            </button>
                        </div>
                        <div className="files-list">
                            {files.map((f, idx) => (
                                <div key={idx} className="file-item">
                                    <FileJson size={16} />
                                    <span className="file-name">{f.name}</span>
                                    <span className="file-size">{(f.size / 1024).toFixed(1)} KB</span>
                                    <button className="file-remove" onClick={(e) => { e.stopPropagation(); removeFile(idx); }}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="add-more">Click or drop to add more files</p>
                    </div>
                ) : (
                    <>
                        <Upload size={32} className="upload-icon" />
                        <p className="upload-text">Drag & drop your JSON files here</p>
                        <p className="upload-subtext">or click to browse (multiple files supported)</p>
                    </>
                )}
            </div>

            {error && <p className="upload-error">{error}</p>}

            <button
                className="btn btn-primary upload-submit"
                onClick={handleSubmit}
                disabled={!files.length || loading}
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
