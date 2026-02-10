/**
 * Background Worker for Periodic Account Rescoring
 * Runs on schedule to update trust scores with latest model
 */
const cron = require('node-cron');
const AccountResult = require('../models/AccountResult');
const mlService = require('../services/ml.service');
const logger = require('../utils/logger');

const RESCORE_INTERVAL_HOURS = parseInt(process.env.RESCORE_INTERVAL_HOURS) || 6;
const RESCORE_BATCH_SIZE = parseInt(process.env.RESCORE_BATCH_SIZE) || 100;
const SCORE_CHANGE_THRESHOLD = 0.1; // Alert if score changes by 10%+

class RescoreWorker {
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.stats = {
            totalRescored: 0,
            significantChanges: 0,
            lastRunDuration: 0
        };
    }

    /**
     * Start the cron job for periodic rescoring
     */
    start() {
        // Run every N hours
        const cronExpression = `0 */${RESCORE_INTERVAL_HOURS} * * *`;

        cron.schedule(cronExpression, async () => {
            await this.runRescore();
        });

        logger.info(`Rescore worker scheduled: every ${RESCORE_INTERVAL_HOURS} hours`);
    }

    /**
     * Run the rescore process
     */
    async runRescore() {
        if (this.isRunning) {
            logger.warn('Rescore already in progress, skipping');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        logger.info('Starting periodic rescore...');

        try {
            // Check if ML service is available
            const available = await mlService.checkAvailability();
            if (!available) {
                logger.warn('ML service unavailable, skipping rescore');
                this.isRunning = false;
                return;
            }

            // Get accounts that need rescoring (older than 24 hours)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            let rescored = 0;
            let significantChanges = 0;
            let hasMore = true;
            let skip = 0;

            while (hasMore) {
                const accounts = await AccountResult.find({
                    updatedAt: { $lt: oneDayAgo }
                })
                    .skip(skip)
                    .limit(RESCORE_BATCH_SIZE)
                    .lean();

                if (accounts.length === 0) {
                    hasMore = false;
                    break;
                }

                // Prepare accounts for prediction
                const accountsToScore = accounts.map(acc => ({
                    account_id: acc.accountId,
                    username: acc.username,
                    ...acc.inputData
                }));

                // Get new scores
                const results = await mlService.predictBatch(accountsToScore);

                // Update each account
                for (let i = 0; i < results.results.length; i++) {
                    const result = results.results[i];
                    const original = accounts[i];

                    const oldScore = original.trustScore;
                    const newScore = result.trust_score;
                    const scoreDiff = Math.abs(newScore - oldScore);

                    // Update in database
                    await AccountResult.findByIdAndUpdate(original._id, {
                        trustScore: newScore,
                        fakeProbability: result.fake_probability,
                        classification: result.classification,
                        behavioralRiskScore: result.behavioral_risk_score,
                        networkRiskScore: result.network_risk_score,
                        authenticityScore: result.authenticity_score,
                        behavioralIndicators: result.behavioral_indicators,
                        rescoreInfo: {
                            lastRescored: new Date(),
                            previousScore: oldScore,
                            scoreDelta: newScore - oldScore
                        }
                    });

                    rescored++;

                    // Check for significant changes
                    if (scoreDiff >= SCORE_CHANGE_THRESHOLD) {
                        significantChanges++;
                        logger.info(`Significant score change: ${original.accountId} ${oldScore.toFixed(3)} -> ${newScore.toFixed(3)}`);
                    }
                }

                skip += RESCORE_BATCH_SIZE;
                logger.info(`Rescored ${rescored} accounts...`);
            }

            const duration = (Date.now() - startTime) / 1000;

            this.stats = {
                totalRescored: rescored,
                significantChanges,
                lastRunDuration: duration
            };
            this.lastRun = new Date();

            logger.info(`Rescore completed: ${rescored} accounts in ${duration.toFixed(2)}s, ${significantChanges} significant changes`);

        } catch (error) {
            logger.error(`Rescore failed: ${error.message}`);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Get worker status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            nextRun: this.lastRun
                ? new Date(this.lastRun.getTime() + RESCORE_INTERVAL_HOURS * 60 * 60 * 1000)
                : null,
            stats: this.stats,
            config: {
                intervalHours: RESCORE_INTERVAL_HOURS,
                batchSize: RESCORE_BATCH_SIZE,
                changeThreshold: SCORE_CHANGE_THRESHOLD
            }
        };
    }
}

// Export singleton
module.exports = new RescoreWorker();
