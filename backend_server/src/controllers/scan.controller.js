/**
 * Scan Controller
 * Handles creating scans, calling ML service, and storing results
 */
const { validationResult } = require('express-validator');
const Scan = require('../models/Scan');
const AccountResult = require('../models/AccountResult');
const AnalyticsLog = require('../models/AnalyticsLog');
const mlService = require('../services/ml.service');
const logger = require('../utils/logger');

/**
 * @desc    Create new scan and process accounts
 * @route   POST /api/scans
 * @access  Private
 */
exports.createScan = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { accounts, name } = req.body;

        // Create scan record
        const scan = await Scan.create({
            userId: req.user._id,
            name: name || `Scan ${new Date().toISOString().split('T')[0]}`,
            totalAccounts: accounts.length,
            status: 'processing',
            startedAt: new Date()
        });

        // Log scan start
        await AnalyticsLog.create({
            eventType: 'scan_started',
            userId: req.user._id,
            scanId: scan._id,
            metadata: { accountCount: accounts.length }
        });

        logger.info(`Scan ${scan._id} started with ${accounts.length} accounts`);

        try {
            // Call ML service
            const mlResults = await mlService.detectBatch(accounts);

            // Store results
            const accountResults = await Promise.all(
                mlResults.results.map(async (result, index) => {
                    return AccountResult.create({
                        scanId: scan._id,
                        accountId: result.account_id,
                        username: result.username,
                        fakeProbability: result.fake_probability,
                        anomalyScore: result.anomaly_score,
                        trustScore: result.trust_score,
                        authenticityScore: result.authenticity_score,
                        networkRiskScore: result.network_risk_score,
                        behavioralRiskScore: result.behavioral_risk_score,
                        classification: result.classification,
                        behavioralIndicators: result.behavioral_indicators,
                        featureSnapshot: result.feature_snapshot,
                        inputData: accounts[index]
                    });
                })
            );

            // Update scan with results
            scan.status = 'completed';
            scan.processedAccounts = accountResults.length;
            scan.summary = {
                fakeCount: mlResults.summary.fake_count,
                suspiciousCount: mlResults.summary.suspicious_count,
                realCount: mlResults.summary.real_count,
                fakePercentage: mlResults.summary.fake_percentage,
                suspiciousPercentage: mlResults.summary.suspicious_percentage,
                realPercentage: mlResults.summary.real_percentage,
                avgTrustScore: mlResults.summary.avg_trust_score,
                avgFakeProbability: mlResults.summary.avg_fake_probability
            };
            scan.highRiskAccounts = mlResults.summary.high_risk_accounts || [];
            await scan.save();

            // Log high risk accounts
            if (scan.highRiskAccounts.length > 0) {
                await AnalyticsLog.create({
                    eventType: 'high_risk_detected',
                    userId: req.user._id,
                    scanId: scan._id,
                    metadata: {
                        count: scan.highRiskAccounts.length,
                        accounts: scan.highRiskAccounts
                    }
                });
            }

            // Log scan completion
            await AnalyticsLog.create({
                eventType: 'scan_completed',
                userId: req.user._id,
                scanId: scan._id,
                metadata: scan.summary
            });

            logger.info(`Scan ${scan._id} completed successfully`);

            res.status(201).json({
                success: true,
                scan,
                results: accountResults
            });

        } catch (mlError) {
            // ML service failed
            scan.status = 'failed';
            scan.error = mlError.message;
            await scan.save();

            await AnalyticsLog.create({
                eventType: 'scan_failed',
                userId: req.user._id,
                scanId: scan._id,
                metadata: { error: mlError.message },
                status: 'failure'
            });

            logger.error(`Scan ${scan._id} failed: ${mlError.message}`);

            res.status(500).json({
                success: false,
                error: 'Scan processing failed',
                scanId: scan._id
            });
        }

    } catch (error) {
        logger.error(`Create scan error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to create scan'
        });
    }
};

/**
 * @desc    Get all scans for user
 * @route   GET /api/scans
 * @access  Private
 */
exports.getScans = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = { userId: req.user._id };

        if (req.query.status) {
            query.status = req.query.status;
        }

        const [scans, total] = await Promise.all([
            Scan.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Scan.countDocuments(query)
        ]);

        res.json({
            success: true,
            scans,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        logger.error(`Get scans error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve scans'
        });
    }
};

/**
 * @desc    Get single scan
 * @route   GET /api/scans/:id
 * @access  Private
 */
exports.getScan = async (req, res) => {
    try {
        const scan = await Scan.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Scan not found'
            });
        }

        res.json({
            success: true,
            scan
        });

    } catch (error) {
        logger.error(`Get scan error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve scan'
        });
    }
};

/**
 * @desc    Get scan results
 * @route   GET /api/scans/:id/results
 * @access  Private
 */
exports.getScanResults = async (req, res) => {
    try {
        const scan = await Scan.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Scan not found'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const query = { scanId: scan._id };

        // Filter by classification
        if (req.query.classification) {
            query.classification = req.query.classification;
        }

        // Filter by score range
        if (req.query.minScore) {
            query.fakeProbability = { $gte: parseFloat(req.query.minScore) };
        }
        if (req.query.maxScore) {
            query.fakeProbability = {
                ...query.fakeProbability,
                $lte: parseFloat(req.query.maxScore)
            };
        }

        const [results, total] = await Promise.all([
            AccountResult.find(query)
                .sort({ fakeProbability: -1 })
                .skip(skip)
                .limit(limit),
            AccountResult.countDocuments(query)
        ]);

        res.json({
            success: true,
            scan,
            results,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        logger.error(`Get scan results error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve scan results'
        });
    }
};

/**
 * @desc    Delete scan
 * @route   DELETE /api/scans/:id
 * @access  Private
 */
exports.deleteScan = async (req, res) => {
    try {
        const scan = await Scan.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Scan not found'
            });
        }

        // Delete associated results
        await AccountResult.deleteMany({ scanId: scan._id });

        // Delete scan
        await scan.deleteOne();

        logger.info(`Scan ${req.params.id} deleted`);

        res.json({
            success: true,
            message: 'Scan deleted successfully'
        });

    } catch (error) {
        logger.error(`Delete scan error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to delete scan'
        });
    }
};
