/**
 * Feature Engineering Service
 * Converts scan data into ML-ready feature vectors
 */
const logger = require('../utils/logger');

/**
 * Feature configuration with normalization parameters
 */
const FEATURE_CONFIG = {
    behavioral: {
        actions_per_minute: { default: 0, normalize: v => Math.min(v / 100, 1) },
        inter_action_time_mean: { default: 30, normalize: v => Math.min(v / 60, 1) },
        inter_action_time_std: { default: 15, normalize: v => Math.min(v / 30, 1) },
        message_similarity_index: { default: 0.2, normalize: v => Math.min(Math.max(v, 0), 1) },
        follow_velocity: { default: 5, normalize: v => Math.min(v / 500, 1) },
        unfollow_velocity: { default: 2, normalize: v => Math.min(v / 500, 1) },
        url_post_ratio: { default: 0.1, normalize: v => Math.min(Math.max(v, 0), 1) },
        device_change_frequency: { default: 0.5, normalize: v => Math.min(v / 10, 1) }
    },
    profile: {
        account_age_days: { default: 365, normalize: v => Math.min(v / 3650, 1) },
        follower_following_ratio: { default: 1, normalize: v => Math.min(v / 10, 1) },
        profile_completeness_index: { default: 0.7, normalize: v => Math.min(Math.max(v, 0), 1) },
        profile_image_presence: { default: 1, normalize: v => v ? 1 : 0 },
        bio_length_score: { default: 0.5, normalize: v => Math.min(Math.max(v, 0), 1) }
    },
    network: {
        mutual_connection_ratio: { default: 0.3, normalize: v => Math.min(Math.max(v, 0), 1) },
        clustering_coefficient: { default: 0.3, normalize: v => Math.min(Math.max(v, 0), 1) },
        pagerank_score: { default: 0.001, normalize: v => Math.min(v * 1000, 1) },
        edge_creation_velocity: { default: 5, normalize: v => Math.min(v / 100, 1) }
    }
};

/**
 * Extract and normalize a single feature value
 */
function extractFeature(data, category, feature) {
    const config = FEATURE_CONFIG[category][feature];
    let value = config.default;

    // Try to extract from nested structure
    if (data[category] && data[category][feature] !== undefined) {
        value = data[category][feature];
    } else if (data[feature] !== undefined) {
        // Direct access
        value = data[feature];
    }

    // Handle null/undefined
    if (value === null || value === undefined || isNaN(value)) {
        value = config.default;
    }

    // Normalize
    return config.normalize(Number(value));
}

/**
 * Convert raw account data to ML-ready feature vector
 * @param {Object} accountData - Raw account data from scan
 * @returns {Object} Normalized feature vector
 */
function accountToFeatures(accountData) {
    const features = {};

    // Extract all features with normalization
    for (const [category, featureSet] of Object.entries(FEATURE_CONFIG)) {
        for (const feature of Object.keys(featureSet)) {
            features[feature] = extractFeature(accountData, category, feature);
        }
    }

    // Compute derived features
    if (accountData.follower_count !== undefined && accountData.following_count !== undefined) {
        const following = Math.max(accountData.following_count, 1);
        features.follower_following_ratio = Math.min(accountData.follower_count / following, 10) / 10;
    }

    if (accountData.bio_length !== undefined) {
        features.bio_length_score = Math.min(accountData.bio_length / 160, 1);
    }

    return features;
}

/**
 * Convert batch of accounts to feature matrix for ML prediction
 * @param {Array} accounts - Array of raw account data
 * @returns {Array} Array of feature vectors
 */
function batchToFeatures(accounts) {
    return accounts.map(account => accountToFeatures(account));
}

/**
 * Prepare accounts for ML service /predict endpoint
 * @param {Array} accounts - Raw account data array
 * @returns {Array} Formatted prediction requests
 */
function prepareForPrediction(accounts) {
    return accounts.map((account, index) => {
        const features = accountToFeatures(account);

        return {
            account_id: account.account_id || `acc_${index}`,
            username: account.username || '',

            // Behavioral features (denormalized for ML service)
            actions_per_minute: features.actions_per_minute * 100,
            inter_action_time_mean: features.inter_action_time_mean * 60,
            inter_action_time_std: features.inter_action_time_std * 30,
            message_similarity_index: features.message_similarity_index,
            follow_velocity: features.follow_velocity * 500,
            unfollow_velocity: features.unfollow_velocity * 500,
            url_post_ratio: features.url_post_ratio,
            device_change_frequency: features.device_change_frequency * 10,

            // Profile features
            account_age_days: Math.round(features.account_age_days * 3650),
            follower_count: account.follower_count || 0,
            following_count: account.following_count || 0,
            profile_completeness_index: features.profile_completeness_index,
            profile_image_presence: features.profile_image_presence === 1,
            bio_length: account.bio_length || Math.round(features.bio_length_score * 160),

            // Network features
            mutual_connection_ratio: features.mutual_connection_ratio,
            clustering_coefficient: features.clustering_coefficient,
            pagerank_score: features.pagerank_score / 1000,
            edge_creation_velocity: features.edge_creation_velocity * 100
        };
    });
}

/**
 * Calculate feature statistics for a batch
 * @param {Array} accounts - Array of account data
 * @returns {Object} Statistics summary
 */
function calculateBatchStats(accounts) {
    const featureArrays = {};

    // Collect all feature values
    for (const account of accounts) {
        const features = accountToFeatures(account);
        for (const [key, value] of Object.entries(features)) {
            if (!featureArrays[key]) {
                featureArrays[key] = [];
            }
            featureArrays[key].push(value);
        }
    }

    // Calculate statistics
    const stats = {};
    for (const [key, values] of Object.entries(featureArrays)) {
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;

        stats[key] = {
            mean: Math.round(mean * 1000) / 1000,
            std: Math.round(Math.sqrt(variance) * 1000) / 1000,
            min: Math.min(...values),
            max: Math.max(...values)
        };
    }

    return stats;
}

/**
 * Validate account data has required fields
 * @param {Object} account - Account data to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateAccountData(account) {
    const errors = [];

    if (!account.account_id && !account.username) {
        errors.push('Account must have account_id or username');
    }

    // Validate behavioral data structure
    if (account.behavioral) {
        const behavioral = account.behavioral;
        if (behavioral.actions_per_minute !== undefined && behavioral.actions_per_minute < 0) {
            errors.push('actions_per_minute must be non-negative');
        }
        if (behavioral.message_similarity_index !== undefined &&
            (behavioral.message_similarity_index < 0 || behavioral.message_similarity_index > 1)) {
            errors.push('message_similarity_index must be between 0 and 1');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    accountToFeatures,
    batchToFeatures,
    prepareForPrediction,
    calculateBatchStats,
    validateAccountData,
    FEATURE_CONFIG
};
