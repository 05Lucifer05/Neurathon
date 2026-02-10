/**
 * Moderation Queue Model
 * 
 * Queue for medium-risk accounts awaiting manual review.
 * Stores full risk analysis snapshot for moderator decision.
 */

const mongoose = require('mongoose');

const moderationQueueSchema = new mongoose.Schema({
    // Anonymized account identifier
    hashedAccountId: {
        type: String,
        required: true,
        index: true
    },

    // Original account reference (for internal use only)
    accountRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account'
    },
    scanRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Scan'
    },

    // Status tracking
    status: {
        type: String,
        enum: ['pending', 'in_review', 'reviewed', 'escalated', 'cleared', 'dismissed'],
        default: 'pending',
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        index: true
    },

    // Risk analysis snapshot
    riskAnalysis: {
        fakeProbability: { type: Number, required: true },
        trustScore: { type: Number, required: true },
        anomalyScore: { type: Number },
        classification: String,
        riskTier: String
    },

    // Behavioral summary (no PII)
    behavioralSummary: {
        actionsPerMinute: Number,
        messageSimilarityIndex: Number,
        followVelocity: Number,
        accountAgeDays: Number,
        followerFollowingRatio: Number,
        profileCompleteness: Number
    },

    // Anomaly indicators
    anomalyIndicators: [{
        indicator: String,
        severity: { type: String, enum: ['low', 'medium', 'high'] },
        description: String,
        value: Number
    }],

    // Rule-based signals
    ruleSignals: [{
        rule: String,
        triggered: Boolean,
        score: Number
    }],

    // Review tracking
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewStartedAt: Date,
    reviewCompletedAt: Date,

    // Decision
    decision: {
        type: String,
        enum: ['pending', 'cleared', 'restrict', 'escalate', 'dismiss'],
        default: 'pending'
    },
    decisionBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    decisionReason: String,
    decisionTimestamp: Date,

    // Action taken after decision
    actionTaken: String,
    actionLogRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ActionLog'
    },

    // Expiration (auto-clear after X days if no action)
    expiresAt: {
        type: Date,
        index: true
    },

    // Batch processing reference
    batchId: String

}, {
    timestamps: true
});

// Indexes for efficient querying
moderationQueueSchema.index({ status: 1, priority: -1, createdAt: 1 });
moderationQueueSchema.index({ 'riskAnalysis.fakeProbability': -1 });
moderationQueueSchema.index({ assignedTo: 1, status: 1 });

// Virtual for time in queue
moderationQueueSchema.virtual('timeInQueue').get(function () {
    if (this.reviewCompletedAt) {
        return this.reviewCompletedAt - this.createdAt;
    }
    return Date.now() - this.createdAt;
});

// Static method to get queue stats
moderationQueueSchema.statics.getQueueStats = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgRiskScore: { $avg: '$riskAnalysis.fakeProbability' }
            }
        }
    ]);

    const pending = await this.countDocuments({ status: 'pending' });
    const inReview = await this.countDocuments({ status: 'in_review' });

    return {
        byStatus: stats,
        pendingCount: pending,
        inReviewCount: inReview,
        totalActive: pending + inReview
    };
};

// Static method to get next item for review
moderationQueueSchema.statics.getNextForReview = async function (userId) {
    return this.findOneAndUpdate(
        { status: 'pending' },
        {
            status: 'in_review',
            assignedTo: userId,
            reviewStartedAt: new Date()
        },
        {
            sort: { priority: -1, createdAt: 1 },
            new: true
        }
    );
};

const ModerationQueue = mongoose.model('ModerationQueue', moderationQueueSchema);

module.exports = ModerationQueue;
