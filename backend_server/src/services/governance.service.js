/**
 * Governance Service
 * 
 * Decision engine for risk-tiered moderation.
 * Operates on ML output without modifying prediction logic.
 */

const ActionLog = require('../models/actionLog.model');
const ModerationQueue = require('../models/moderationQueue.model');
const privacyService = require('./privacy.service');
const logger = require('../utils/logger');

// Risk tier thresholds
const RISK_THRESHOLDS = {
    HIGH: 0.85,      // >= 85% fake probability
    MEDIUM: 0.50,    // >= 50% fake probability
    LOW: 0           // < 50%
};

// Multi-signal confirmation thresholds
const CONFIRMATION_THRESHOLDS = {
    ML_PROBABILITY: 0.85,
    ANOMALY_SCORE: 0.6,
    MIN_RULE_INDICATORS: 1
};

// Rule-based indicators that count toward confirmation
const RULE_INDICATORS = [
    'high_action_rate',
    'excessive_action_rate',
    'high_message_similarity',
    'spam_pattern',
    'suspicious_network_growth',
    'low_profile_quality',
    'rapid_follow_unfollow',
    'unnatural_timing',
    'suspicious_network'
];

// Batch processing configuration
const BATCH_CONFIG = {
    CHUNK_SIZE: 500,
    PARALLEL_LIMIT: 5
};

/**
 * Determine risk tier based on fake probability
 */
function determineRiskTier(fakeProbability) {
    if (fakeProbability >= RISK_THRESHOLDS.HIGH) {
        return 'HIGH';
    } else if (fakeProbability >= RISK_THRESHOLDS.MEDIUM) {
        return 'MEDIUM';
    }
    return 'LOW';
}

/**
 * Check if multi-signal confirmation is met for auto-restriction
 */
function checkMultiSignalConfirmation(result) {
    const fakeProbability = result.fake_probability || result.fakeProbability || 0;
    const anomalyScore = result.anomaly_score || result.anomalyScore || 0;
    const riskFactors = result.risk_factors || result.riskFactors ||
        result.behavioral_indicators || result.behavioralIndicators || [];

    // Extract indicator names
    const indicatorNames = riskFactors.map(r =>
        typeof r === 'string' ? r.toLowerCase() : (r.indicator || r.name || '').toLowerCase()
    );

    // Count matching rule indicators
    const matchedIndicators = indicatorNames.filter(ind =>
        RULE_INDICATORS.some(rule => ind.includes(rule.replace(/_/g, '')))
    );

    const confirmation = {
        mlThresholdMet: fakeProbability >= CONFIRMATION_THRESHOLDS.ML_PROBABILITY,
        anomalyThresholdMet: anomalyScore >= CONFIRMATION_THRESHOLDS.ANOMALY_SCORE,
        ruleIndicatorsMet: matchedIndicators.length >= CONFIRMATION_THRESHOLDS.MIN_RULE_INDICATORS,
        indicatorsMatched: matchedIndicators
    };

    confirmation.allConfirmed = (
        confirmation.mlThresholdMet &&
        confirmation.anomalyThresholdMet &&
        confirmation.ruleIndicatorsMet
    );

    return confirmation;
}

/**
 * Determine action based on risk tier and confirmation
 */
function determineAction(riskTier, confirmation) {
    switch (riskTier) {
        case 'HIGH':
            if (confirmation.allConfirmed) {
                return 'SOFT_RESTRICT';
            }
            // If not all signals confirmed, queue for review instead
            return 'QUEUE_FOR_REVIEW';

        case 'MEDIUM':
            return 'QUEUE_FOR_REVIEW';

        case 'LOW':
        default:
            return 'NONE';
    }
}

/**
 * Process a single detection result through governance
 */
async function processResult(result, options = {}) {
    const startTime = Date.now();

    const fakeProbability = result.fake_probability || result.fakeProbability || 0;
    const trustScore = result.trust_score || result.trustScore || (1 - fakeProbability);
    const anomalyScore = result.anomaly_score || result.anomalyScore || 0;
    const classification = result.classification || 'UNKNOWN';
    const accountId = result.account_id || result.accountId;

    // DETERMINISM: Round scores to 4 decimals before threshold comparison
    const roundedFakeProbability = Math.round(fakeProbability * 10000) / 10000;
    const roundedTrustScore = Math.round(trustScore * 10000) / 10000;

    // Determine risk tier using rounded value
    const riskTier = determineRiskTier(roundedFakeProbability);

    // Check multi-signal confirmation
    const confirmation = checkMultiSignalConfirmation(result);

    // Determine action
    const action = determineAction(riskTier, confirmation);

    // Extract signals
    const riskFactors = result.risk_factors || result.riskFactors ||
        result.behavioral_indicators || result.behavioralIndicators || [];
    const signalsTriggered = riskFactors.map(r =>
        typeof r === 'string' ? r : (r.indicator || r.name || 'unknown')
    );

    // Create action log entry
    const logEntry = {
        hashedAccountId: privacyService.hashAccountId(accountId),
        riskScore: roundedFakeProbability,
        trustScore: roundedTrustScore,
        anomalyScore,
        classification,
        riskTier,
        signalsTriggered,
        actionTaken: action,
        confirmationDetails: confirmation,
        scanId: options.scanId,
        modelVersion: result.model_version || 'unknown',
        processingTimeMs: Date.now() - startTime,
        batchId: options.batchId
    };

    // Save action log
    const actionLog = await ActionLog.create(logEntry);

    // If queued for review, create moderation queue entry
    if (action === 'QUEUE_FOR_REVIEW') {
        await createQueueEntry(result, riskTier, confirmation, actionLog._id, options);
    }

    // Return decision
    return {
        accountId,
        hashedAccountId: logEntry.hashedAccountId,
        riskTier,
        action,
        confirmation,
        actionLogId: actionLog._id,
        processingTimeMs: Date.now() - startTime
    };
}

/**
 * Create moderation queue entry for medium/high risk accounts
 */
async function createQueueEntry(result, riskTier, confirmation, actionLogId, options = {}) {
    const fakeProbability = result.fake_probability || result.fakeProbability || 0;
    const accountId = result.account_id || result.accountId;

    // Determine priority
    let priority = 'medium';
    if (fakeProbability >= 0.9) priority = 'critical';
    else if (fakeProbability >= 0.8) priority = 'high';
    else if (fakeProbability < 0.6) priority = 'low';

    // Extract behavioral summary (anonymized)
    const behavioralSummary = {
        actionsPerMinute: result.behavioral?.actions_per_minute || 0,
        messageSimilarityIndex: result.behavioral?.message_similarity_index || 0,
        followVelocity: result.behavioral?.follow_velocity || 0,
        accountAgeDays: result.profile?.account_age_days || 0,
        followerFollowingRatio: result.profile?.follower_following_ratio || 0,
        profileCompleteness: result.profile?.profile_completeness_index || 0
    };

    // Extract anomaly indicators
    const riskFactors = result.risk_factors || result.riskFactors ||
        result.behavioral_indicators || result.behavioralIndicators || [];
    const anomalyIndicators = riskFactors.map(r => ({
        indicator: typeof r === 'string' ? r : (r.indicator || r.name),
        severity: typeof r === 'object' ? (r.severity || 'medium') : 'medium',
        description: typeof r === 'object' ? (r.description || '') : '',
        value: typeof r === 'object' ? (r.value || 0) : 0
    }));

    const queueEntry = {
        hashedAccountId: privacyService.hashAccountId(accountId),
        accountRef: options.accountRef,
        scanRef: options.scanId,
        status: 'pending',
        priority,
        riskAnalysis: {
            fakeProbability,
            trustScore: result.trust_score || result.trustScore || (1 - fakeProbability),
            anomalyScore: result.anomaly_score || result.anomalyScore || 0,
            classification: result.classification,
            riskTier
        },
        behavioralSummary,
        anomalyIndicators,
        ruleSignals: confirmation.indicatorsMatched.map(ind => ({
            rule: ind,
            triggered: true,
            score: 1
        })),
        actionLogRef: actionLogId,
        batchId: options.batchId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    return ModerationQueue.create(queueEntry);
}

/**
 * Process batch of detection results
 */
async function processBatch(results, options = {}) {
    const batchId = options.batchId || `batch_${Date.now()}`;
    const startTime = Date.now();

    logger.info(`Processing governance batch: ${results.length} accounts, batchId=${batchId}`);

    // DETERMINISM: Sort results by account_id before processing
    const sortedResults = [...results].sort((a, b) => {
        const idA = a.account_id || a.accountId || '';
        const idB = b.account_id || b.accountId || '';
        return idA.localeCompare(idB);
    });

    const decisions = [];
    const stats = {
        total: results.length,
        high: 0,
        medium: 0,
        low: 0,
        restricted: 0,
        queued: 0,
        noAction: 0
    };

    // Process in chunks
    for (let i = 0; i < sortedResults.length; i += BATCH_CONFIG.CHUNK_SIZE) {
        const chunk = sortedResults.slice(i, i + BATCH_CONFIG.CHUNK_SIZE);
        const chunkIndex = Math.floor(i / BATCH_CONFIG.CHUNK_SIZE);

        logger.info(`Processing chunk ${chunkIndex + 1}/${Math.ceil(sortedResults.length / BATCH_CONFIG.CHUNK_SIZE)}`);

        // Process chunk in parallel with limit
        const chunkDecisions = await Promise.all(
            chunk.map(result => processResult(result, { ...options, batchId }))
        );

        for (const decision of chunkDecisions) {
            decisions.push(decision);

            // Update stats
            stats[decision.riskTier.toLowerCase()]++;
            if (decision.action === 'SOFT_RESTRICT') stats.restricted++;
            else if (decision.action === 'QUEUE_FOR_REVIEW') stats.queued++;
            else stats.noAction++;
        }

        // Progress callback
        if (options.onProgress) {
            options.onProgress({
                processed: Math.min(i + BATCH_CONFIG.CHUNK_SIZE, sortedResults.length),
                total: sortedResults.length,
                stats
            });
        }
    }

    const processingTime = Date.now() - startTime;

    logger.info(`Governance batch complete: ${stats.restricted} restricted, ${stats.queued} queued, ${processingTime}ms`);

    return {
        batchId,
        decisions,
        stats,
        processingTimeMs: processingTime
    };
}

/**
 * Override a previous action
 */
async function overrideAction(actionLogId, userId, newAction, reason) {
    const actionLog = await ActionLog.findById(actionLogId);
    if (!actionLog) {
        throw new Error('Action log not found');
    }

    // Create new log entry for override
    const overrideLog = await ActionLog.create({
        hashedAccountId: actionLog.hashedAccountId,
        riskScore: actionLog.riskScore,
        trustScore: actionLog.trustScore,
        anomalyScore: actionLog.anomalyScore,
        classification: actionLog.classification,
        riskTier: actionLog.riskTier,
        signalsTriggered: actionLog.signalsTriggered,
        actionTaken: newAction,
        confirmationDetails: actionLog.confirmationDetails,
        overriddenBy: userId,
        overrideReason: reason,
        overrideTimestamp: new Date(),
        modelVersion: actionLog.modelVersion
    });

    // Update original log
    actionLog.overriddenBy = userId;
    actionLog.overrideReason = reason;
    actionLog.overrideTimestamp = new Date();
    await actionLog.save();

    // Update moderation queue if exists
    await ModerationQueue.updateMany(
        { hashedAccountId: actionLog.hashedAccountId, status: { $in: ['pending', 'in_review'] } },
        {
            status: newAction === 'OVERRIDE_CLEARED' ? 'cleared' : 'reviewed',
            decision: newAction === 'OVERRIDE_CLEARED' ? 'cleared' : 'escalate',
            decisionBy: userId,
            decisionReason: reason,
            decisionTimestamp: new Date(),
            actionTaken: newAction
        }
    );

    return overrideLog;
}

/**
 * Revert a previous action
 */
async function revertAction(actionLogId, userId, reason) {
    const actionLog = await ActionLog.findById(actionLogId);
    if (!actionLog) {
        throw new Error('Action log not found');
    }

    // Create reversion log
    const revertLog = await ActionLog.create({
        hashedAccountId: actionLog.hashedAccountId,
        riskScore: actionLog.riskScore,
        trustScore: actionLog.trustScore,
        anomalyScore: actionLog.anomalyScore,
        classification: actionLog.classification,
        riskTier: actionLog.riskTier,
        signalsTriggered: [],
        actionTaken: 'REVERTED',
        revertedBy: userId,
        revertReason: reason,
        revertedAt: new Date(),
        modelVersion: actionLog.modelVersion
    });

    // Update original log
    actionLog.revertedBy = userId;
    actionLog.revertReason = reason;
    actionLog.revertedAt = new Date();
    await actionLog.save();

    return revertLog;
}

/**
 * Get governance statistics
 */
async function getStats(startDate, endDate) {
    const [actionStats, tierStats, queueStats] = await Promise.all([
        ActionLog.getActionStats(startDate, endDate),
        ActionLog.getTierDistribution(startDate, endDate),
        ModerationQueue.getQueueStats()
    ]);

    return {
        actions: actionStats,
        tiers: tierStats,
        queue: queueStats,
        period: { startDate, endDate }
    };
}

module.exports = {
    // Configuration
    RISK_THRESHOLDS,
    CONFIRMATION_THRESHOLDS,
    BATCH_CONFIG,

    // Core functions
    determineRiskTier,
    checkMultiSignalConfirmation,
    determineAction,

    // Processing
    processResult,
    processBatch,

    // Override/revert
    overrideAction,
    revertAction,

    // Stats
    getStats
};
