/**
 * Event Trigger Service
 * 
 * Detects activity spikes and triggers real-time analysis.
 * Monitors action rates per account for anomaly detection.
 */

const logger = require('../utils/logger');

// Activity tracking (in-memory, could be Redis in production)
const activityTrackers = new Map();

// Configuration
const EVENT_CONFIG = {
    // Time window for rate calculation (ms)
    WINDOW_SIZE: 60000,  // 1 minute

    // Spike detection thresholds
    SPIKE_THRESHOLDS: {
        actions_per_minute: 30,        // More than 30 actions/min
        message_velocity: 10,          // More than 10 messages/min
        follow_velocity: 20,           // More than 20 follows/min
        login_velocity: 5              // More than 5 logins/min
    },

    // Cooldown after triggering (ms)
    TRIGGER_COOLDOWN: 300000,  // 5 minutes

    // Max accounts to track (memory limit)
    MAX_TRACKED_ACCOUNTS: 10000,

    // Cleanup interval (ms)
    CLEANUP_INTERVAL: 600000  // 10 minutes
};

// Event listeners
const eventListeners = [];

/**
 * Account activity tracker
 */
class ActivityTracker {
    constructor(accountId) {
        this.accountId = accountId;
        this.events = [];
        this.lastTrigger = null;
        this.createdAt = Date.now();
    }

    /**
     * Record an activity event
     */
    recordEvent(eventType, metadata = {}) {
        const now = Date.now();

        // Remove events outside the window
        this.events = this.events.filter(e =>
            now - e.timestamp < EVENT_CONFIG.WINDOW_SIZE
        );

        // Add new event
        this.events.push({
            type: eventType,
            timestamp: now,
            metadata
        });
    }

    /**
     * Get event rate for a specific type
     */
    getRate(eventType) {
        const now = Date.now();
        const recentEvents = this.events.filter(e =>
            e.type === eventType && (now - e.timestamp) < EVENT_CONFIG.WINDOW_SIZE
        );
        return recentEvents.length;
    }

    /**
     * Get overall action rate
     */
    getTotalRate() {
        const now = Date.now();
        const recentEvents = this.events.filter(e =>
            (now - e.timestamp) < EVENT_CONFIG.WINDOW_SIZE
        );
        return recentEvents.length;
    }

    /**
     * Check if any spike threshold is exceeded
     */
    checkSpike() {
        const now = Date.now();

        // Check cooldown
        if (this.lastTrigger && (now - this.lastTrigger) < EVENT_CONFIG.TRIGGER_COOLDOWN) {
            return null;
        }

        const rates = {
            actions_per_minute: this.getTotalRate(),
            message_velocity: this.getRate('message'),
            follow_velocity: this.getRate('follow'),
            login_velocity: this.getRate('login')
        };

        const exceededThresholds = [];

        for (const [metric, threshold] of Object.entries(EVENT_CONFIG.SPIKE_THRESHOLDS)) {
            if (rates[metric] >= threshold) {
                exceededThresholds.push({
                    metric,
                    value: rates[metric],
                    threshold
                });
            }
        }

        if (exceededThresholds.length > 0) {
            this.lastTrigger = now;
            return {
                accountId: this.accountId,
                timestamp: now,
                rates,
                exceededThresholds
            };
        }

        return null;
    }
}

/**
 * Record an activity event for an account
 */
function recordActivity(accountId, eventType, metadata = {}) {
    let tracker = activityTrackers.get(accountId);

    if (!tracker) {
        // Enforce max tracked accounts
        if (activityTrackers.size >= EVENT_CONFIG.MAX_TRACKED_ACCOUNTS) {
            // Remove oldest tracker
            const oldestKey = activityTrackers.keys().next().value;
            activityTrackers.delete(oldestKey);
        }

        tracker = new ActivityTracker(accountId);
        activityTrackers.set(accountId, tracker);
    }

    tracker.recordEvent(eventType, metadata);

    // Check for spike
    const spike = tracker.checkSpike();
    if (spike) {
        emitSpike(spike);
    }

    return tracker.getTotalRate();
}

/**
 * Emit spike event to all listeners
 */
function emitSpike(spike) {
    logger.warn(`Activity spike detected for account: ${spike.accountId}`, {
        rates: spike.rates,
        exceeded: spike.exceededThresholds
    });

    for (const listener of eventListeners) {
        try {
            listener(spike);
        } catch (err) {
            logger.error('Error in spike event listener:', err);
        }
    }
}

/**
 * Register a spike event listener
 */
function onSpike(callback) {
    eventListeners.push(callback);
    return () => {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
            eventListeners.splice(index, 1);
        }
    };
}

/**
 * Get current activity stats for an account
 */
function getAccountStats(accountId) {
    const tracker = activityTrackers.get(accountId);
    if (!tracker) {
        return null;
    }

    return {
        accountId,
        totalRate: tracker.getTotalRate(),
        messageRate: tracker.getRate('message'),
        followRate: tracker.getRate('follow'),
        loginRate: tracker.getRate('login'),
        eventCount: tracker.events.length,
        lastTrigger: tracker.lastTrigger
    };
}

/**
 * Get accounts with elevated activity
 */
function getElevatedAccounts(threshold = 10) {
    const elevated = [];

    for (const [accountId, tracker] of activityTrackers) {
        const rate = tracker.getTotalRate();
        if (rate >= threshold) {
            elevated.push({
                accountId,
                rate,
                events: tracker.events.length
            });
        }
    }

    return elevated.sort((a, b) => b.rate - a.rate);
}

/**
 * Cleanup old trackers
 */
function cleanup() {
    const now = Date.now();
    const maxAge = EVENT_CONFIG.WINDOW_SIZE * 10; // 10x window size

    for (const [accountId, tracker] of activityTrackers) {
        if ((now - tracker.createdAt) > maxAge && tracker.events.length === 0) {
            activityTrackers.delete(accountId);
        }
    }

    logger.debug(`Activity tracker cleanup: ${activityTrackers.size} accounts tracked`);
}

/**
 * Start periodic cleanup
 */
function startCleanup() {
    setInterval(cleanup, EVENT_CONFIG.CLEANUP_INTERVAL);
    logger.info('Event trigger cleanup started');
}

/**
 * Get service stats
 */
function getServiceStats() {
    return {
        trackedAccounts: activityTrackers.size,
        listenerCount: eventListeners.length,
        config: EVENT_CONFIG
    };
}

/**
 * Clear all trackers (for testing)
 */
function clearAll() {
    activityTrackers.clear();
}

module.exports = {
    EVENT_CONFIG,
    recordActivity,
    onSpike,
    getAccountStats,
    getElevatedAccounts,
    startCleanup,
    getServiceStats,
    clearAll
};
