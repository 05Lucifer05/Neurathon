/**
 * Privacy Service
 * 
 * Handles anonymization and PII protection for logging.
 * Uses SHA256 hashing for account identifiers.
 */

const crypto = require('crypto');

// Salt for hashing (in production, use environment variable)
const HASH_SALT = process.env.PRIVACY_SALT || 'fraud-detection-v1-salt';

/**
 * Hash an account ID for anonymized logging
 * @param {string} accountId - Original account ID
 * @returns {string} - SHA256 hashed ID (first 16 chars)
 */
function hashAccountId(accountId) {
    if (!accountId) return 'unknown';

    const hash = crypto
        .createHash('sha256')
        .update(HASH_SALT + String(accountId))
        .digest('hex');

    // Return first 16 characters for readability while maintaining privacy
    return hash.substring(0, 16);
}

/**
 * Sanitize a log entry to remove PII
 * Only keeps behavioral metrics, removes personal content
 * @param {Object} entry - Raw log entry
 * @returns {Object} - Sanitized entry
 */
function sanitizeLogEntry(entry) {
    const sanitized = { ...entry };

    // Fields to remove (PII)
    const piiFields = [
        'username', 'email', 'name', 'bio', 'description',
        'profile_url', 'avatar_url', 'location', 'ip_address',
        'user_agent', 'phone', 'content', 'message', 'text'
    ];

    for (const field of piiFields) {
        if (sanitized[field]) {
            delete sanitized[field];
        }
    }

    // Hash account ID if present
    if (sanitized.account_id) {
        sanitized.hashedAccountId = hashAccountId(sanitized.account_id);
        delete sanitized.account_id;
    }

    if (sanitized.accountId) {
        sanitized.hashedAccountId = hashAccountId(sanitized.accountId);
        delete sanitized.accountId;
    }

    return sanitized;
}

/**
 * Create anonymized audit entry from detection result
 * @param {Object} result - Detection result
 * @param {string} action - Action taken
 * @returns {Object} - Anonymized audit entry
 */
function createAuditEntry(result, action) {
    return {
        hashedAccountId: hashAccountId(result.account_id || result.accountId),
        riskScore: result.fake_probability || result.fakeProbability,
        trustScore: result.trust_score || result.trustScore,
        anomalyScore: result.anomaly_score || result.anomalyScore,
        classification: result.classification,
        signalsTriggered: result.risk_factors || result.riskFactors || [],
        actionTaken: action,
        timestamp: new Date(),
        modelVersion: result.model_version || 'unknown'
    };
}

/**
 * Batch anonymize account IDs
 * @param {string[]} accountIds - Array of account IDs
 * @returns {Object} - Map of original to hashed IDs
 */
function batchHashAccountIds(accountIds) {
    const hashMap = {};
    for (const id of accountIds) {
        hashMap[id] = hashAccountId(id);
    }
    return hashMap;
}

module.exports = {
    hashAccountId,
    sanitizeLogEntry,
    createAuditEntry,
    batchHashAccountIds
};
