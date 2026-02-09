/**
 * Scan Routes
 */
const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const scanController = require('../controllers/scan.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

// Routes
router.post('/',
    body('accounts').isArray({ min: 1 }).withMessage('At least one account is required'),
    body('name').optional().trim().isLength({ max: 100 }),
    scanController.createScan
);

router.get('/',
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
    scanController.getScans
);

router.get('/:id', scanController.getScan);
router.get('/:id/results', scanController.getScanResults);
router.delete('/:id', scanController.deleteScan);

module.exports = router;
