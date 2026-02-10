/**
 * Governance Routes
 * 
 * Admin endpoints for moderation queue, action logs, and overrides.
 */

const express = require('express');
const router = express.Router();
const governanceService = require('../services/governance.service');
const ActionLog = require('../models/actionLog.model');
const ModerationQueue = require('../models/moderationQueue.model');
const { protect, authorize } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

/**
 * @route   GET /api/governance/queue
 * @desc    Get moderation queue items
 * @access  Private (Admin)
 */
router.get('/queue', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            status = 'pending',
            priority,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (priority) {
            query.priority = priority;
        }

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        const [items, total] = await Promise.all([
            ModerationQueue.find(query)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('assignedTo', 'name email')
                .populate('decisionBy', 'name email')
                .lean(),
            ModerationQueue.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: {
                items,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error fetching moderation queue:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/governance/queue/stats
 * @desc    Get queue statistics
 * @access  Private (Admin)
 */
router.get('/queue/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const stats = await ModerationQueue.getQueueStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        logger.error('Error fetching queue stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/governance/queue/:id
 * @desc    Get single queue item details
 * @access  Private (Admin)
 */
router.get('/queue/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const item = await ModerationQueue.findById(req.params.id)
            .populate('assignedTo', 'name email')
            .populate('decisionBy', 'name email')
            .populate('actionLogRef');

        if (!item) {
            return res.status(404).json({ success: false, error: 'Queue item not found' });
        }

        res.json({ success: true, data: item });

    } catch (error) {
        logger.error('Error fetching queue item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/governance/queue/:id/claim
 * @desc    Claim a queue item for review
 * @access  Private (Admin)
 */
router.post('/queue/:id/claim', protect, authorize('admin'), async (req, res) => {
    try {
        const item = await ModerationQueue.findByIdAndUpdate(
            req.params.id,
            {
                status: 'in_review',
                assignedTo: req.user._id,
                reviewStartedAt: new Date()
            },
            { new: true }
        );

        if (!item) {
            return res.status(404).json({ success: false, error: 'Queue item not found' });
        }

        res.json({ success: true, data: item });

    } catch (error) {
        logger.error('Error claiming queue item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/governance/queue/:id/decide
 * @desc    Make decision on queue item
 * @access  Private (Admin)
 */
router.post('/queue/:id/decide', protect, authorize('admin'), async (req, res) => {
    try {
        const { decision, reason, action } = req.body;

        if (!decision || !['cleared', 'restrict', 'escalate', 'dismiss'].includes(decision)) {
            return res.status(400).json({
                success: false,
                error: 'Valid decision required (cleared, restrict, escalate, dismiss)'
            });
        }

        const item = await ModerationQueue.findByIdAndUpdate(
            req.params.id,
            {
                status: 'reviewed',
                decision,
                decisionBy: req.user._id,
                decisionReason: reason,
                decisionTimestamp: new Date(),
                reviewCompletedAt: new Date(),
                actionTaken: action || decision.toUpperCase()
            },
            { new: true }
        );

        if (!item) {
            return res.status(404).json({ success: false, error: 'Queue item not found' });
        }

        // Create action log for the decision
        await ActionLog.create({
            hashedAccountId: item.hashedAccountId,
            riskScore: item.riskAnalysis.fakeProbability,
            trustScore: item.riskAnalysis.trustScore,
            anomalyScore: item.riskAnalysis.anomalyScore,
            classification: item.riskAnalysis.classification,
            riskTier: item.riskAnalysis.riskTier,
            signalsTriggered: item.anomalyIndicators.map(i => i.indicator),
            actionTaken: `MANUAL_${decision.toUpperCase()}`,
            overriddenBy: req.user._id,
            overrideReason: reason,
            overrideTimestamp: new Date()
        });

        res.json({ success: true, data: item });

    } catch (error) {
        logger.error('Error deciding on queue item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/governance/override/:logId
 * @desc    Override a previous action
 * @access  Private (Admin)
 */
router.post('/override/:logId', protect, authorize('admin'), async (req, res) => {
    try {
        const { action, reason } = req.body;

        if (!action || !reason) {
            return res.status(400).json({
                success: false,
                error: 'Action and reason required'
            });
        }

        const result = await governanceService.overrideAction(
            req.params.logId,
            req.user._id,
            action,
            reason
        );

        res.json({ success: true, data: result });

    } catch (error) {
        logger.error('Error overriding action:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/governance/revert/:logId
 * @desc    Revert a previous action
 * @access  Private (Admin)
 */
router.post('/revert/:logId', protect, authorize('admin'), async (req, res) => {
    try {
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Reason required for reversion'
            });
        }

        const result = await governanceService.revertAction(
            req.params.logId,
            req.user._id,
            reason
        );

        res.json({ success: true, data: result });

    } catch (error) {
        logger.error('Error reverting action:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/governance/logs
 * @desc    Get action logs
 * @access  Private (Admin)
 */
router.get('/logs', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            action,
            riskTier,
            startDate,
            endDate,
            page = 1,
            limit = 50
        } = req.query;

        const query = {};
        if (action) query.actionTaken = action;
        if (riskTier) query.riskTier = riskTier;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            ActionLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('overriddenBy', 'name email')
                .populate('revertedBy', 'name email')
                .lean(),
            ActionLog.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error fetching action logs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/governance/stats
 * @desc    Get governance statistics
 * @access  Private (Admin)
 */
router.get('/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endDate = new Date()
        } = req.query;

        const stats = await governanceService.getStats(
            new Date(startDate),
            new Date(endDate)
        );

        res.json({ success: true, data: stats });

    } catch (error) {
        logger.error('Error fetching governance stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   POST /api/governance/process
 * @desc    Manually trigger governance processing on detection results
 * @access  Private (Admin)
 */
router.post('/process', protect, authorize('admin'), async (req, res) => {
    try {
        const { results } = req.body;

        if (!results || !Array.isArray(results)) {
            return res.status(400).json({
                success: false,
                error: 'Results array required'
            });
        }

        const batchResult = await governanceService.processBatch(results, {
            batchId: `manual_${Date.now()}`
        });

        res.json({ success: true, data: batchResult });

    } catch (error) {
        logger.error('Error processing governance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
