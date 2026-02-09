/**
 * AccountResult Model - Individual account analysis results
 */
const mongoose = require('mongoose');

const behavioralIndicatorSchema = new mongoose.Schema({
    indicator: String,
    severity: {
        type: String,
        enum: ['low', 'medium', 'high']
    },
    value: Number,
    threshold: Number,
    description: String
}, { _id: false });

const accountResultSchema = new mongoose.Schema({
    scanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Scan',
        required: true
    },
    accountId: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },

    // Core scores
    fakeProbability: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    anomalyScore: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    trustScore: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },

    // Component scores
    authenticityScore: {
        type: Number,
        min: 0,
        max: 1
    },
    networkRiskScore: {
        type: Number,
        min: 0,
        max: 1
    },
    behavioralRiskScore: {
        type: Number,
        min: 0,
        max: 1
    },

    // Classification
    classification: {
        type: String,
        enum: ['Real', 'Suspicious', 'Fake'],
        required: true
    },

    // Behavioral indicators
    behavioralIndicators: [behavioralIndicatorSchema],

    // Feature snapshot for auditing
    featureSnapshot: {
        type: mongoose.Schema.Types.Mixed
    },

    // Original input data
    inputData: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
accountResultSchema.index({ scanId: 1 });
accountResultSchema.index({ classification: 1 });
accountResultSchema.index({ fakeProbability: -1 });
accountResultSchema.index({ accountId: 1, scanId: 1 }, { unique: true });

module.exports = mongoose.model('AccountResult', accountResultSchema);
