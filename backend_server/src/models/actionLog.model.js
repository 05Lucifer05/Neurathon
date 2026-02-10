/**
 * Action Log Model
 * 
 * Stores anonymized audit logs for governance actions.
 * Records decisions, overrides, and reversions.
 */

const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
    // Anonymized account identifier (SHA256 hash)
    hashedAccountId: {
        type: String,
        required: true,
        index: true
    },

    // Risk scores at time of action
    riskScore: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    trustScore: {
        type: Number,
        min: 0,
        max: 1
    },
    anomalyScore: {
        type: Number,
        min: 0,
        max: 1
    },

    // Classification and tier
    classification: {
        type: String,
        enum: ['REAL', 'SUSPICIOUS', 'FAKE'],
        required: true
    },
    riskTier: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        required: true,
        index: true
    },

    // Signals that triggered the action
    signalsTriggered: [{
        type: String
    }],

    // Action details
    actionTaken: {
        type: String,
        enum: [
            'NONE',
            'QUEUE_FOR_REVIEW',
            'SOFT_RESTRICT',
            'RATE_LIMIT',
            'REQUIRE_VERIFICATION',
            'POSTING_RESTRICTION',
            'OVERRIDE_CLEARED',
            'OVERRIDE_ESCALATED',
            'REVERTED'
        ],
        required: true,
        index: true
    },

    // Multi-signal confirmation details
    confirmationDetails: {
        mlThresholdMet: Boolean,
        anomalyThresholdMet: Boolean,
        ruleIndicatorsMet: Boolean,
        indicatorsMatched: [String]
    },

    // Original reference (hashed for correlation)
    scanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Scan'
    },

    // Override information
    overriddenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    overrideReason: String,
    overrideTimestamp: Date,

    // Reversion information
    revertedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    revertReason: String,
    revertedAt: Date,

    // Model version for reproducibility
    modelVersion: String,

    // Processing metadata
    processingTimeMs: Number,
    batchId: String

}, {
    timestamps: true
});

// Indexes for common queries
actionLogSchema.index({ createdAt: -1 });
actionLogSchema.index({ riskTier: 1, createdAt: -1 });
actionLogSchema.index({ actionTaken: 1, createdAt: -1 });
actionLogSchema.index({ hashedAccountId: 1, createdAt: -1 });

// Static method to get action stats
actionLogSchema.statics.getActionStats = async function (startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$actionTaken',
                count: { $sum: 1 },
                avgRiskScore: { $avg: '$riskScore' }
            }
        }
    ]);
};

// Static method to get tier distribution
actionLogSchema.statics.getTierDistribution = async function (startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$riskTier',
                count: { $sum: 1 }
            }
        }
    ]);
};

const ActionLog = mongoose.model('ActionLog', actionLogSchema);

module.exports = ActionLog;
