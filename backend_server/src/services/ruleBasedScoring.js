/**
 * Rule-Based Scoring Service
 * Fallback scoring logic when ML service is unavailable
 */
const logger = require('../utils/logger');
const featureEngineering = require('./featureEngineering');

/**
 * Scoring rules with weights
 */
const SCORING_RULES = {
    // High action rate indicates automation
    highActionRate: {
        weight: 0.15,
        check: (features) => features.actions_per_minute > 0.3,
        score: (features) => Math.min(features.actions_per_minute / 0.5, 1)
    },

    // High message similarity indicates bot/spam
    highMessageSimilarity: {
        weight: 0.20,
        check: (features) => features.message_similarity_index > 0.6,
        score: (features) => features.message_similarity_index
    },

    // Low profile completeness is suspicious
    lowProfileComplete: {
        weight: 0.12,
        check: (features) => features.profile_completeness_index < 0.4,
        score: (features) => 1 - features.profile_completeness_index
    },

    // Low mutual connections indicates fake network
    lowMutualConnections: {
        weight: 0.15,
        check: (features) => features.mutual_connection_ratio < 0.2,
        score: (features) => 1 - features.mutual_connection_ratio
    },

    // High follow velocity indicates aggressive following
    highFollowVelocity: {
        weight: 0.12,
        check: (features) => features.follow_velocity > 0.2,
        score: (features) => Math.min(features.follow_velocity / 0.4, 1)
    },

    // High URL posting ratio indicates spam
    highUrlRatio: {
        weight: 0.10,
        check: (features) => features.url_post_ratio > 0.5,
        score: (features) => features.url_post_ratio
    },

    // New account with suspicious behavior
    newAccount: {
        weight: 0.08,
        check: (features) => features.account_age_days < 0.01, // < 36 days
        score: (features) => 1 - (features.account_age_days * 100)
    },

    // No profile image
    noProfileImage: {
        weight: 0.05,
        check: (features) => features.profile_image_presence === 0,
        score: () => 1
    },

    // Low clustering (not part of organic community)
    lowClustering: {
        weight: 0.03,
        check: (features) => features.clustering_coefficient < 0.1,
        score: (features) => 1 - (features.clustering_coefficient * 10)
    }
};

/**
 * Calculate fake probability using rule-based scoring
 * @param {Object} account - Raw account data
 * @returns {number} Fake probability 0-1
 */
function calculateFakeProbability(account) {
    const features = featureEngineering.accountToFeatures(account);

    let totalScore = 0;
    let totalWeight = 0;

    for (const [name, rule] of Object.entries(SCORING_RULES)) {
        if (rule.check(features)) {
            totalScore += rule.score(features) * rule.weight;
        }
        totalWeight += rule.weight;
    }

    // Normalize to 0-1
    const probability = totalScore / totalWeight;

    return Math.min(Math.max(probability, 0), 1);
}

/**
 * Classify account based on probability threshold
 * @param {number} probability - Fake probability 0-1
 * @returns {string} Classification: Real, Suspicious, or Fake
 */
function classify(probability) {
    if (probability >= 0.7) return 'Fake';
    if (probability >= 0.4) return 'Suspicious';
    return 'Real';
}

/**
 * Identify triggered risk indicators
 * @param {Object} account - Raw account data
 * @returns {Array} List of behavioral indicators
 */
function identifyRiskIndicators(account) {
    const features = featureEngineering.accountToFeatures(account);
    const indicators = [];

    const INDICATOR_DETAILS = {
        highActionRate: {
            indicator: 'high_action_rate',
            severity: 'high',
            description: 'Unusually high activity rate suggesting automation'
        },
        highMessageSimilarity: {
            indicator: 'low_message_diversity',
            severity: 'medium',
            description: 'High message similarity suggesting templated content'
        },
        lowProfileComplete: {
            indicator: 'incomplete_profile',
            severity: 'medium',
            description: 'Profile is significantly incomplete'
        },
        lowMutualConnections: {
            indicator: 'suspicious_network',
            severity: 'high',
            description: 'Very few mutual connections with followers'
        },
        highFollowVelocity: {
            indicator: 'aggressive_following',
            severity: 'medium',
            description: 'Following accounts at an unusually high rate'
        },
        highUrlRatio: {
            indicator: 'high_url_spam',
            severity: 'medium',
            description: 'High ratio of URL posts suggesting spam'
        },
        newAccount: {
            indicator: 'new_account_risk',
            severity: 'low',
            description: 'Account is newly created'
        },
        noProfileImage: {
            indicator: 'no_profile_image',
            severity: 'low',
            description: 'No profile image set'
        },
        lowClustering: {
            indicator: 'low_network_clustering',
            severity: 'low',
            description: 'Not part of any organic community clusters'
        }
    };

    for (const [name, rule] of Object.entries(SCORING_RULES)) {
        if (rule.check(features)) {
            const detail = INDICATOR_DETAILS[name];
            if (detail) {
                indicators.push({
                    indicator: detail.indicator,
                    severity: detail.severity,
                    value: Math.round(rule.score(features) * 100) / 100,
                    threshold: 0.5,
                    description: detail.description
                });
            }
        }
    }

    return indicators;
}

/**
 * Score a single account using rule-based logic
 * @param {Object} account - Raw account data
 * @returns {Object} Scoring result matching ML service format
 */
function scoreAccount(account) {
    const features = featureEngineering.accountToFeatures(account);
    const fakeProbability = calculateFakeProbability(account);
    const classification = classify(fakeProbability);
    const indicators = identifyRiskIndicators(account);

    // Calculate component scores
    const behavioralScore = (
        features.actions_per_minute * 0.3 +
        features.message_similarity_index * 0.4 +
        features.follow_velocity * 0.3
    );

    const networkScore = (
        (1 - features.mutual_connection_ratio) * 0.5 +
        (1 - features.clustering_coefficient) * 0.3 +
        features.edge_creation_velocity * 0.2
    );

    const profileScore = (
        (1 - features.profile_completeness_index) * 0.5 +
        (1 - features.profile_image_presence) * 0.2 +
        (1 - features.bio_length_score) * 0.3
    );

    return {
        account_id: account.account_id || 'unknown',
        username: account.username || '',
        fake_probability: Math.round(fakeProbability * 10000) / 10000,
        anomaly_score: Math.round(behavioralScore * 10000) / 10000,
        trust_score: Math.round((1 - fakeProbability) * 10000) / 10000,
        authenticity_score: Math.round((1 - profileScore) * 10000) / 10000,
        network_risk_score: Math.round(networkScore * 10000) / 10000,
        behavioral_risk_score: Math.round(behavioralScore * 10000) / 10000,
        classification,
        behavioral_indicators: indicators,
        feature_snapshot: features,
        scoring_method: 'rule_based'
    };
}

/**
 * Score batch of accounts using rule-based logic
 * @param {Array} accounts - Array of account data
 * @returns {Object} Batch results matching ML service format
 */
function scoreBatch(accounts) {
    logger.info(`Rule-based scoring for ${accounts.length} accounts`);

    // DETERMINISM: Sort accounts by account_id before scoring
    const sortedAccounts = [...accounts].sort((a, b) =>
        (a.account_id || '').localeCompare(b.account_id || '')
    );

    const results = sortedAccounts.map(account => scoreAccount(account));

    // DETERMINISM: Sort results by account_id
    results.sort((a, b) =>
        (a.account_id || '').localeCompare(b.account_id || '')
    );

    // Calculate summary
    const fakeCount = results.filter(r => r.classification === 'Fake').length;
    const suspiciousCount = results.filter(r => r.classification === 'Suspicious').length;
    const realCount = results.filter(r => r.classification === 'Real').length;

    const avgTrustScore = results.reduce((sum, r) => sum + r.trust_score, 0) / results.length;
    const avgFakeProbability = results.reduce((sum, r) => sum + r.fake_probability, 0) / results.length;

    // High risk accounts (fake probability >= 0.8)
    const highRiskAccounts = results
        .filter(r => r.fake_probability >= 0.8)
        .map(r => r.account_id);

    const summary = {
        fake_count: fakeCount,
        suspicious_count: suspiciousCount,
        real_count: realCount,
        fake_percentage: Math.round((fakeCount / results.length) * 10000) / 100,
        suspicious_percentage: Math.round((suspiciousCount / results.length) * 10000) / 100,
        real_percentage: Math.round((realCount / results.length) * 10000) / 100,
        avg_trust_score: Math.round(avgTrustScore * 10000) / 10000,
        avg_fake_probability: Math.round(avgFakeProbability * 10000) / 10000,
        high_risk_accounts: highRiskAccounts,
        scoring_method: 'rule_based'
    };

    return {
        success: true,
        total_accounts: accounts.length,
        processed: results.length,
        results,
        summary
    };
}

module.exports = {
    calculateFakeProbability,
    classify,
    identifyRiskIndicators,
    scoreAccount,
    scoreBatch,
    SCORING_RULES
};
