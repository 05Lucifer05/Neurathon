/**
 * Dashboard Controller
 * Provides aggregated statistics and analytics for the dashboard
 */
const Scan = require('../models/Scan');
const AccountResult = require('../models/AccountResult');
const AnalyticsLog = require('../models/AnalyticsLog');
const mlService = require('../services/ml.service');
const logger = require('../utils/logger');

/**
 * @desc    Get public stats (demo mode)
 * @route   GET /api/dashboard/public/stats
 * @access  Public
 */
exports.getPublicStats = async (req, res) => {
    try {
        // Return sample stats for demo
        res.json({
            success: true,
            stats: {
                totalScans: 127,
                totalAccountsAnalyzed: 15420,
                fakePercentage: 12.4,
                suspiciousPercentage: 18.2,
                avgTrustScore: 0.72,
                recentTrend: 'stable'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve stats'
        });
    }
};

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/dashboard/stats
 * @access  Private
 */
exports.getStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get aggregated stats
        const [scanStats, resultStats] = await Promise.all([
            Scan.aggregate([
                { $match: { userId, status: 'completed' } },
                {
                    $group: {
                        _id: null,
                        totalScans: { $sum: 1 },
                        totalAccounts: { $sum: '$totalAccounts' },
                        avgTrustScore: { $avg: '$summary.avgTrustScore' },
                        totalFake: { $sum: '$summary.fakeCount' },
                        totalSuspicious: { $sum: '$summary.suspiciousCount' },
                        totalReal: { $sum: '$summary.realCount' }
                    }
                }
            ]),
            AccountResult.aggregate([
                {
                    $lookup: {
                        from: 'scans',
                        localField: 'scanId',
                        foreignField: '_id',
                        as: 'scan'
                    }
                },
                { $unwind: '$scan' },
                { $match: { 'scan.userId': userId } },
                {
                    $group: {
                        _id: '$classification',
                        count: { $sum: 1 },
                        avgFakeProbability: { $avg: '$fakeProbability' }
                    }
                }
            ])
        ]);

        const stats = scanStats[0] || {
            totalScans: 0,
            totalAccounts: 0,
            avgTrustScore: 0,
            totalFake: 0,
            totalSuspicious: 0,
            totalReal: 0
        };

        // Calculate percentages
        const total = stats.totalFake + stats.totalSuspicious + stats.totalReal;

        res.json({
            success: true,
            stats: {
                totalScans: stats.totalScans,
                totalAccountsAnalyzed: stats.totalAccounts,
                avgTrustScore: stats.avgTrustScore || 0,
                fakeCount: stats.totalFake,
                suspiciousCount: stats.totalSuspicious,
                realCount: stats.totalReal,
                fakePercentage: total > 0 ? (stats.totalFake / total) * 100 : 0,
                suspiciousPercentage: total > 0 ? (stats.totalSuspicious / total) * 100 : 0,
                realPercentage: total > 0 ? (stats.totalReal / total) * 100 : 0,
                classificationBreakdown: resultStats
            }
        });

    } catch (error) {
        logger.error(`Get stats error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve statistics'
        });
    }
};

/**
 * @desc    Get trend data over time
 * @route   GET /api/dashboard/trends
 * @access  Private
 */
exports.getTrends = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const userId = req.user._id;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const trends = await Scan.aggregate([
            {
                $match: {
                    userId,
                    status: 'completed',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    scans: { $sum: 1 },
                    accounts: { $sum: '$totalAccounts' },
                    fakeCount: { $sum: '$summary.fakeCount' },
                    suspiciousCount: { $sum: '$summary.suspiciousCount' },
                    avgTrustScore: { $avg: '$summary.avgTrustScore' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            trends,
            period: { days, startDate }
        });

    } catch (error) {
        logger.error(`Get trends error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve trends'
        });
    }
};

/**
 * @desc    Get risk distribution
 * @route   GET /api/dashboard/risk-distribution
 * @access  Private
 */
exports.getRiskDistribution = async (req, res) => {
    try {
        const userId = req.user._id;

        const distribution = await AccountResult.aggregate([
            {
                $lookup: {
                    from: 'scans',
                    localField: 'scanId',
                    foreignField: '_id',
                    as: 'scan'
                }
            },
            { $unwind: '$scan' },
            { $match: { 'scan.userId': userId } },
            {
                $bucket: {
                    groupBy: '$fakeProbability',
                    boundaries: [0, 0.2, 0.4, 0.6, 0.8, 1.01],
                    default: 'other',
                    output: {
                        count: { $sum: 1 },
                        accounts: { $push: '$username' }
                    }
                }
            }
        ]);

        // Format distribution for chart
        const labels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
        const formattedDistribution = labels.map((label, index) => {
            const bucket = distribution.find(d => {
                const boundaries = [0, 0.2, 0.4, 0.6, 0.8];
                return d._id === boundaries[index];
            });
            return {
                range: label,
                count: bucket ? bucket.count : 0
            };
        });

        res.json({
            success: true,
            distribution: formattedDistribution
        });

    } catch (error) {
        logger.error(`Get risk distribution error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve risk distribution'
        });
    }
};

/**
 * @desc    Get activity heatmap data
 * @route   GET /api/dashboard/activity-heatmap
 * @access  Private
 */
exports.getActivityHeatmap = async (req, res) => {
    try {
        const userId = req.user._id;
        const days = 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const activity = await Scan.aggregate([
            {
                $match: {
                    userId,
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        dayOfWeek: { $dayOfWeek: '$createdAt' },
                        hour: { $hour: '$createdAt' }
                    },
                    count: { $sum: '$totalAccounts' }
                }
            }
        ]);

        // Format for heatmap (7 days x 24 hours)
        const heatmap = Array(7).fill(null).map(() => Array(24).fill(0));

        activity.forEach(item => {
            const day = item._id.dayOfWeek - 1; // MongoDB dayOfWeek is 1-7
            const hour = item._id.hour;
            heatmap[day][hour] = item.count;
        });

        res.json({
            success: true,
            heatmap,
            days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            hours: Array.from({ length: 24 }, (_, i) => i)
        });

    } catch (error) {
        logger.error(`Get activity heatmap error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve activity heatmap'
        });
    }
};

/**
 * @desc    Get flagged (high-risk) accounts
 * @route   GET /api/dashboard/flagged-accounts
 * @access  Private
 */
exports.getFlaggedAccounts = async (req, res) => {
    try {
        const userId = req.user._id;
        const limit = parseInt(req.query.limit) || 20;

        const flaggedAccounts = await AccountResult.aggregate([
            {
                $lookup: {
                    from: 'scans',
                    localField: 'scanId',
                    foreignField: '_id',
                    as: 'scan'
                }
            },
            { $unwind: '$scan' },
            { $match: { 'scan.userId': userId, fakeProbability: { $gte: 0.7 } } },
            { $sort: { fakeProbability: -1, createdAt: -1 } },
            { $limit: limit },
            {
                $project: {
                    accountId: 1,
                    username: 1,
                    fakeProbability: 1,
                    classification: 1,
                    trustScore: 1,
                    behavioralIndicators: 1,
                    createdAt: 1,
                    scanName: '$scan.name'
                }
            }
        ]);

        res.json({
            success: true,
            accounts: flaggedAccounts
        });

    } catch (error) {
        logger.error(`Get flagged accounts error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve flagged accounts'
        });
    }
};

/**
 * @desc    Get recent scans
 * @route   GET /api/dashboard/recent-scans
 * @access  Private
 */
exports.getRecentScans = async (req, res) => {
    try {
        const userId = req.user._id;
        const limit = parseInt(req.query.limit) || 10;

        const recentScans = await Scan.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('name status totalAccounts summary createdAt completedAt');

        res.json({
            success: true,
            scans: recentScans
        });

    } catch (error) {
        logger.error(`Get recent scans error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve recent scans'
        });
    }
};

/**
 * @desc    Get ML service status
 * @route   GET /api/dashboard/ml-status
 * @access  Private
 */
exports.getMLStatus = async (req, res) => {
    try {
        const [health, modelInfo] = await Promise.all([
            mlService.healthCheck().catch(() => ({ status: 'unavailable' })),
            mlService.getModelInfo().catch(() => null)
        ]);

        res.json({
            success: true,
            mlService: {
                ...health,
                modelInfo
            }
        });

    } catch (error) {
        res.json({
            success: true,
            mlService: {
                status: 'unavailable',
                error: error.message
            }
        });
    }
};
