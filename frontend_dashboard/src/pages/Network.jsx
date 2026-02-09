import { Network as NetworkIcon, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import './Network.css'

export default function Network() {
    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Network Graph</h1>
                    <p className="page-subtitle">Visualize account connections and suspicious clusters</p>
                </div>
                <div className="network-controls">
                    <button className="btn btn-secondary"><ZoomIn size={16} /></button>
                    <button className="btn btn-secondary"><ZoomOut size={16} /></button>
                    <button className="btn btn-secondary"><Maximize2 size={16} /></button>
                </div>
            </div>

            <div className="network-container glass-card">
                <div className="network-placeholder">
                    <NetworkIcon size={64} />
                    <h3>Network Visualization</h3>
                    <p>Connect to the backend to visualize account relationships and detect suspicious clusters.</p>
                    <p className="hint">Nodes represent accounts, edges represent connections. Red nodes indicate high-risk accounts.</p>
                </div>

                {/* Placeholder network visualization */}
                <svg className="network-svg" viewBox="0 0 800 400">
                    <defs>
                        <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity="0.3" />
                        </linearGradient>
                    </defs>

                    {/* Sample network edges */}
                    <line x1="400" y1="200" x2="200" y2="100" stroke="url(#linkGradient)" strokeWidth="2" />
                    <line x1="400" y1="200" x2="600" y2="100" stroke="url(#linkGradient)" strokeWidth="2" />
                    <line x1="400" y1="200" x2="200" y2="300" stroke="url(#linkGradient)" strokeWidth="2" />
                    <line x1="400" y1="200" x2="600" y2="300" stroke="url(#linkGradient)" strokeWidth="2" />
                    <line x1="200" y1="100" x2="100" y2="150" stroke="url(#linkGradient)" strokeWidth="1" />
                    <line x1="600" y1="100" x2="700" y2="150" stroke="url(#linkGradient)" strokeWidth="1" />

                    {/* Sample network nodes */}
                    <circle cx="400" cy="200" r="20" fill="var(--accent-primary)" className="node-pulse" />
                    <circle cx="200" cy="100" r="14" fill="var(--color-success)" />
                    <circle cx="600" cy="100" r="14" fill="var(--color-danger)" />
                    <circle cx="200" cy="300" r="14" fill="var(--color-success)" />
                    <circle cx="600" cy="300" r="14" fill="var(--color-warning)" />
                    <circle cx="100" cy="150" r="10" fill="var(--color-success)" />
                    <circle cx="700" cy="150" r="10" fill="var(--color-danger)" />
                </svg>
            </div>

            <div className="network-legend glass-card">
                <h4>Legend</h4>
                <div className="legend-items">
                    <div className="legend-item">
                        <span className="legend-dot green"></span>
                        <span>Real Account</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot yellow"></span>
                        <span>Suspicious</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot red"></span>
                        <span>Fake Account</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot purple"></span>
                        <span>Central Node</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
