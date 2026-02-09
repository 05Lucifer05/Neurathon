/**
 * Authentication Controller
 */
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const AnalyticsLog = require('../models/AnalyticsLog');
const logger = require('../utils/logger');

/**
 * Generate JWT token
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password, name, role, organization } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered'
            });
        }

        // Create user (role defaults to 'user' if not provided)
        const user = await User.create({
            email,
            password,
            name,
            role: role || 'user',
            organization: organization || 'Default Organization'
        });

        // Generate token
        const token = generateToken(user._id);

        // Log registration
        await AnalyticsLog.create({
            eventType: 'user_action',
            userId: user._id,
            metadata: { action: 'register' },
            ipAddress: req.ip
        });

        logger.info(`New user registered: ${email}`);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        logger.error(`Registration error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // Get user with password
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check if active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        // Log login
        await AnalyticsLog.create({
            eventType: 'login',
            userId: user._id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        logger.info(`User logged in: ${email}`);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        logger.error(`Login error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
};

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;

        const user = await User.findById(req.user._id);

        if (name) user.name = name;
        if (email && email !== user.email) {
            const existing = await User.findOne({ email });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: 'Email already in use'
                });
            }
            user.email = email;
        }

        await user.save();

        res.json({
            success: true,
            user
        });

    } catch (error) {
        logger.error(`Profile update error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Profile update failed'
        });
    }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res) => {
    await AnalyticsLog.create({
        eventType: 'logout',
        userId: req.user._id,
        ipAddress: req.ip
    });

    res.json({
        success: true,
        message: 'Logged out successfully'
    });
};
