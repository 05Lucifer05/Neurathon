/**
 * Error Handling Middleware
 */
const logger = require('../utils/logger');

/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
    // Log error
    logger.error(`${err.message}\n${err.stack}`);

    // Determine status code
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
    } else if (err.name === 'CastError') {
        statusCode = 400;
        err.message = 'Invalid ID format';
    } else if (err.code === 11000) {
        statusCode = 400;
        err.message = 'Duplicate field value entered';
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        err.message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        err.message = 'Token expired';
    }

    res.status(statusCode).json({
        success: false,
        error: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = { notFound, errorHandler };
