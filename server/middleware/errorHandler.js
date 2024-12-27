const logger = require('../utils/logger');

/**
 * Custom error class for API errors
 */
class APIError extends Error {
    constructor(message, code, status = 400, details = null) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

/**
 * Not found error handler
 */
const notFoundHandler = (req, res, next) => {
    const error = new APIError('Resource not found', 'RESOURCE_NOT_FOUND', 404);
    next(error);
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res) => {
    // Log the error
    const userId = req.user ? req.user._id : null;
    const adminId = req.admin ? req.admin._id : null;

    logger.error('Error occurred:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId,
        adminId,
    });

    // Handle API errors
    if (err instanceof APIError) {
        return res.status(err.status).json({
            error: {
                message: err.message,
                code: err.code,
                details: err.details,
            },
        });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: {
                message: 'Invalid token',
                code: 'INVALID_TOKEN',
            },
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: {
                message: 'Token expired',
                code: 'TOKEN_EXPIRED',
            },
        });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: {
                message: 'Validation error',
                code: 'VALIDATION_ERROR',
                details: Object.values(err.errors).map((e) => ({
                    field: e.path,
                    message: e.message,
                })),
            },
        });
    }

    // Handle duplicate key errors
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({
            error: {
                message: `${field} already exists`,
                code: 'DUPLICATE_KEY_ERROR',
                details: { field },
            },
        });
    }

    // Handle cast errors
    if (err.name === 'CastError') {
        return res.status(400).json({
            error: {
                message: 'Invalid ID format',
                code: 'INVALID_ID',
                details: {
                    field: err.path,
                    value: err.value,
                },
            },
        });
    }

    // Handle other errors
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({
        error: {
            message: isProd ? 'Internal server error' : err.message,
            code: 'INTERNAL_SERVER_ERROR',
            ...(isProd ? {} : { stack: err.stack }),
        },
    });
};

module.exports = {
    APIError,
    notFoundHandler,
    errorHandler,
};
