const express = require('express');
const router = express.Router();
const multer = require('multer');
const mlService = require('../services/ml.service');
const { protect, authorize } = require('../middleware/auth.middleware');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

/**
 * @route   POST /api/training/upload
 * @desc    Upload file for training
 * @access  Private (Admin only)
 */
router.post('/upload', protect, authorize('admin'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const options = {
            labelColumn: req.body.label_column,
            testSize: req.body.test_size,
            useSmote: req.body.use_smote === 'true',
            modelType: req.body.model_type,
            saveModel: req.body.save_model === 'true'
        };

        const result = await mlService.trainWithFile(req.file, options);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Training upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/training/status/:jobId
 * @desc    Get training status
 * @access  Private
 */
router.get('/status/:jobId', protect, async (req, res) => {
    try {
        // Implement status check if ML service supports it
        res.status(501).json({ success: false, error: 'Not implemented yet' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
