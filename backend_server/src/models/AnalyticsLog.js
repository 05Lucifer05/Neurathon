/**
 * AnalyticsLog Model - System analytics and audit logging
 */
const mongoose = require('mongoose');

const analyticsLogSchema = new mongoose.Schema({
    eventType: {
        type: String,
        required: true,
        enum: [
            'scan_started',
            'scan_completed',
            'scan_failed',
            'high_risk_detected',
            'api_call',
            'login',
            'logout',
            'user_action'
        ]
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    scanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Scan'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: String,
    userAgent: String,
    duration: Number,
    status: {
        type: String,
        enum: ['success', 'failure', 'warning'],
        default: 'success'
    }
}, {
    timestamps: true
});

// Indexes for analytics queries
analyticsLogSchema.index({ eventType: 1, createdAt: -1 });
analyticsLogSchema.index({ userId: 1, createdAt: -1 });
analyticsLogSchema.index({ createdAt: -1 });

// TTL index - auto-delete logs after 90 days
analyticsLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AnalyticsLog', analyticsLogSchema);
