/**
 * Dashboard Routes
 */
const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const dashboardController = require('../controllers/dashboard.controller');
const { protect, optionalAuth } = require('../middleware/auth.middleware');

// Public stats endpoint (demo mode)
router.get('/public/stats', dashboardController.getPublicStats);

// Protected routes
router.use(protect);

router.get('/stats', dashboardController.getStats);
router.get('/trends',
    query('days').optional().isInt({ min: 1, max: 90 }),
    dashboardController.getTrends
);
router.get('/risk-distribution', dashboardController.getRiskDistribution);
router.get('/activity-heatmap', dashboardController.getActivityHeatmap);
router.get('/flagged-accounts',
    query('limit').optional().isInt({ min: 1, max: 50 }),
    dashboardController.getFlaggedAccounts
);
router.get('/recent-scans',
    query('limit').optional().isInt({ min: 1, max: 20 }),
    dashboardController.getRecentScans
);
router.get('/ml-status', dashboardController.getMLStatus);

module.exports = router;
