/**
 * Authentication Middleware
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Protect routes - require valid JWT
 */
const protect = async (req, res, next) => {
    try {
        let token;

        // Get token from header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized - no token provided'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized - user not found'
            });
        }

        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        req.user = user;
        next();

    } catch (error) {
        logger.error(`Auth error: ${error.message}`);
        return res.status(401).json({
            success: false,
            error: 'Not authorized - invalid token'
        });
    }
};

/**
 * Authorize specific roles
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Role '${req.user.role}' is not authorized to access this resource`
            });
        }
        next();
    };
};

/**
 * Optional auth - attach user if token exists but don't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
        }

        next();
    } catch (error) {
        // Token invalid, but continue without user
        next();
    }
};

module.exports = { protect, authorize, optionalAuth };
