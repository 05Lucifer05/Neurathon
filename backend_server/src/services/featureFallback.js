/**
 * Feature Fallback Service
 * 
 * Provides safe defaults for missing behavioral/network fields.
 * Ensures pipeline never crashes due to missing data.
 */

// Default values for each feature type
const FEATURE_DEFAULTS = {
    // Behavioral features - use neutral/low-risk defaults
    behavioral: {
        actions_per_minute: 0,
        inter_action_time_mean: 300,      // 5 minutes average
        inter_action_time_std: 100,
        message_similarity_index: 0,
        follow_velocity: 0,
        unfollow_velocity: 0,
        url_post_ratio: 0.1,              // Normal ratio
        device_change_frequency: 0,
        session_duration_mean: 600,       // 10 minutes
        click_sequence_entropy: 0.5       // Neutral entropy
    },

    // Profile features
    profile: {
        account_age_days: 365,            // 1 year default
        follower_following_ratio: 1.0,    // Balanced
        profile_completeness_index: 0.5,  // Partial
        profile_image_presence: 1,        // Has image
        bio_length_score: 0.5,
        username_entropy_score: 0.5
    },

    // Network features
    network: {
        mutual_connection_ratio: 0.3,     // Some mutuals
        clustering_coefficient: 0.2,
        pagerank_score: 0.001,
        edge_creation_velocity: 0,
        community_suspicion_index: 0,
        network_authenticity_score: 0.7
    }
};

/**
 * Get default value for a feature
 * @param {string} featureName - Name of the feature
 * @returns {number} - Default value
 */
function getFeatureDefault(featureName) {
    // Check all categories
    for (const category of Object.values(FEATURE_DEFAULTS)) {
        if (featureName in category) {
            return category[featureName];
        }
    }
    // Ultimate fallback
    return 0;
}

/**
 * Fill missing features with safe defaults
 * @param {Object} features - Feature object (may have missing fields)
 * @param {string[]} requiredFeatures - List of required feature names
 * @returns {Object} - Complete feature object
 */
function fillMissingFeatures(features, requiredFeatures) {
    const complete = { ...features };

    for (const featureName of requiredFeatures) {
        if (complete[featureName] === undefined ||
            complete[featureName] === null ||
            Number.isNaN(complete[featureName])) {
            complete[featureName] = getFeatureDefault(featureName);
        }
    }

    return complete;
}

/**
 * Validate and sanitize a single feature value
 * @param {string} featureName - Feature name
 * @param {any} value - Raw value
 * @returns {number} - Safe numeric value
 */
function sanitizeFeatureValue(featureName, value) {
    // Handle null/undefined
    if (value === null || value === undefined) {
        return getFeatureDefault(featureName);
    }

    // Convert to number
    const numValue = Number(value);

    // Handle NaN
    if (Number.isNaN(numValue)) {
        return getFeatureDefault(featureName);
    }

    // Handle infinity
    if (!Number.isFinite(numValue)) {
        return getFeatureDefault(featureName);
    }

    // Clamp extreme values
    return Math.max(-1e6, Math.min(1e6, numValue));
}

/**
 * Process account data with fallbacks for missing fields
 * @param {Object} account - Raw account data
 * @returns {Object} - Account with all required fields
 */
function processAccountWithFallbacks(account) {
    const processed = { ...account };

    // Ensure behavioral section exists
    if (!processed.behavioral) {
        processed.behavioral = {};
    }
    for (const [key, defaultVal] of Object.entries(FEATURE_DEFAULTS.behavioral)) {
        if (processed.behavioral[key] === undefined) {
            processed.behavioral[key] = defaultVal;
        } else {
            processed.behavioral[key] = sanitizeFeatureValue(key, processed.behavioral[key]);
        }
    }

    // Ensure profile section exists
    if (!processed.profile) {
        processed.profile = {};
    }
    for (const [key, defaultVal] of Object.entries(FEATURE_DEFAULTS.profile)) {
        if (processed.profile[key] === undefined) {
            processed.profile[key] = defaultVal;
        } else {
            processed.profile[key] = sanitizeFeatureValue(key, processed.profile[key]);
        }
    }

    // Ensure network section exists
    if (!processed.network) {
        processed.network = {};
    }
    for (const [key, defaultVal] of Object.entries(FEATURE_DEFAULTS.network)) {
        if (processed.network[key] === undefined) {
            processed.network[key] = defaultVal;
        } else {
            processed.network[key] = sanitizeFeatureValue(key, processed.network[key]);
        }
    }

    return processed;
}

/**
 * Batch process accounts with fallbacks
 * @param {Object[]} accounts - Array of account data
 * @returns {Object[]} - Processed accounts
 */
function batchProcessWithFallbacks(accounts) {
    return accounts.map(acc => processAccountWithFallbacks(acc));
}

/**
 * Get list of available features from account data
 * @param {Object} account - Account data
 * @returns {Object} - Availability report
 */
function checkFeatureAvailability(account) {
    const availability = {
        behavioral: {},
        profile: {},
        network: {},
        summary: { available: 0, missing: 0, total: 0 }
    };

    // Check behavioral
    for (const key of Object.keys(FEATURE_DEFAULTS.behavioral)) {
        const hasValue = account.behavioral?.[key] !== undefined;
        availability.behavioral[key] = hasValue;
        hasValue ? availability.summary.available++ : availability.summary.missing++;
        availability.summary.total++;
    }

    // Check profile
    for (const key of Object.keys(FEATURE_DEFAULTS.profile)) {
        const hasValue = account.profile?.[key] !== undefined;
        availability.profile[key] = hasValue;
        hasValue ? availability.summary.available++ : availability.summary.missing++;
        availability.summary.total++;
    }

    // Check network
    for (const key of Object.keys(FEATURE_DEFAULTS.network)) {
        const hasValue = account.network?.[key] !== undefined;
        availability.network[key] = hasValue;
        hasValue ? availability.summary.available++ : availability.summary.missing++;
        availability.summary.total++;
    }

    availability.summary.completeness =
        availability.summary.available / availability.summary.total;

    return availability;
}

module.exports = {
    FEATURE_DEFAULTS,
    getFeatureDefault,
    fillMissingFeatures,
    sanitizeFeatureValue,
    processAccountWithFallbacks,
    batchProcessWithFallbacks,
    checkFeatureAvailability
};
