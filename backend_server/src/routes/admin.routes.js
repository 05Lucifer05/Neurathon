/**
 * Admin Routes - User management (Admin only)
 */
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const logger = require('../utils/logger');
const { protect, authorize } = require('../middleware/auth.middleware');

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

/**
 * @desc    Get all users in organization
 * @route   GET /api/admin/users
 * @access  Admin
 */
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 20, role, search } = req.query;

        const query = { organization: req.user.organization };

        if (role) query.role = role;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error(`Get users error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

/**
 * @desc    Get single user
 * @route   GET /api/admin/users/:id
 * @access  Admin
 */
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findOne({
            _id: req.params.id,
            organization: req.user.organization
        }).select('-password');

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        logger.error(`Get user error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to fetch user' });
    }
});

/**
 * @desc    Update user role/status
 * @route   PUT /api/admin/users/:id
 * @access  Admin
 */
router.put('/users/:id', async (req, res) => {
    try {
        const { role, isActive, permissions } = req.body;

        const user = await User.findOne({
            _id: req.params.id,
            organization: req.user.organization
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Prevent admin from modifying themselves
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, error: 'Cannot modify your own account' });
        }

        if (role) user.role = role;
        if (typeof isActive === 'boolean') user.isActive = isActive;
        if (permissions) {
            user.permissions = { ...user.permissions, ...permissions };
        }

        await user.save();

        logger.info(`Admin ${req.user.email} updated user ${user.email}`);

        res.json({ success: true, data: user });
    } catch (error) {
        logger.error(`Update user error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to update user' });
    }
});

/**
 * @desc    Delete user
 * @route   DELETE /api/admin/users/:id
 * @access  Admin
 */
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findOne({
            _id: req.params.id,
            organization: req.user.organization
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
        }

        await user.deleteOne();

        logger.info(`Admin ${req.user.email} deleted user ${user.email}`);

        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        logger.error(`Delete user error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
});

/**
 * @desc    Get organization stats
 * @route   GET /api/admin/stats
 * @access  Admin
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await User.aggregate([
            { $match: { organization: req.user.organization } },
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    adminCount: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
                    userCount: { $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] } },
                    activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
                    inactiveUsers: { $sum: { $cond: ['$isActive', 0, 1] } }
                }
            }
        ]);

        res.json({
            success: true,
            data: stats[0] || {
                totalUsers: 0,
                adminCount: 0,
                userCount: 0,
                activeUsers: 0,
                inactiveUsers: 0
            }
        });
    } catch (error) {
        logger.error(`Get admin stats error: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

module.exports = router;
