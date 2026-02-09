/**
 * Scan Model - Analysis scan history
 */
const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        trim: true,
        default: function () {
            return `Scan ${new Date().toISOString().split('T')[0]}`;
        }
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    totalAccounts: {
        type: Number,
        required: true,
        min: 1
    },
    processedAccounts: {
        type: Number,
        default: 0
    },
    summary: {
        fakeCount: { type: Number, default: 0 },
        suspiciousCount: { type: Number, default: 0 },
        realCount: { type: Number, default: 0 },
        fakePercentage: { type: Number, default: 0 },
        suspiciousPercentage: { type: Number, default: 0 },
        realPercentage: { type: Number, default: 0 },
        avgTrustScore: { type: Number, default: 0 },
        avgFakeProbability: { type: Number, default: 0 },
        processingTimeSeconds: { type: Number, default: 0 }
    },
    highRiskAccounts: [{
        type: String
    }],
    startedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    error: {
        type: String
    }
}, {
    timestamps: true
});

// Index for efficient querying
scanSchema.index({ userId: 1, createdAt: -1 });
scanSchema.index({ status: 1 });

// Calculate processing time on completion
scanSchema.pre('save', function (next) {
    if (this.isModified('status') && this.status === 'completed' && this.startedAt) {
        this.completedAt = new Date();
        this.summary.processingTimeSeconds = (this.completedAt - this.startedAt) / 1000;
    }
    next();
});

module.exports = mongoose.model('Scan', scanSchema);
