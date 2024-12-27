const { APIError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Validate request body against a schema
 */
const validateBody = (schema) => {
    return (req, res, next) => {
        try {
            const { error, value } = schema.validate(req.body, {
                abortEarly: false,
                stripUnknown: true,
            });

            if (error) {
                const details = error.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                }));

                logger.warn('Validation error:', {
                    path: req.path,
                    errors: details,
                });

                throw new APIError('Validation error', 'VALIDATION_ERROR', 400, details);
            }

            // Replace request body with validated value
            req.body = value;
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Validate request query parameters against a schema
 */
const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            const { error, value } = schema.validate(req.query, {
                abortEarly: false,
                stripUnknown: true,
            });

            if (error) {
                const details = error.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                }));

                logger.warn('Query validation error:', {
                    path: req.path,
                    errors: details,
                });

                throw new APIError(
                    'Query validation error',
                    'QUERY_VALIDATION_ERROR',
                    400,
                    details
                );
            }

            // Replace request query with validated value
            req.query = value;
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Validate request parameters against a schema
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        try {
            const { error, value } = schema.validate(req.params, {
                abortEarly: false,
                stripUnknown: true,
            });

            if (error) {
                const details = error.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                }));

                logger.warn('Parameter validation error:', {
                    path: req.path,
                    errors: details,
                });

                throw new APIError(
                    'Parameter validation error',
                    'PARAMETER_VALIDATION_ERROR',
                    400,
                    details
                );
            }

            // Replace request params with validated value
            req.params = value;
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Sanitize request body to prevent XSS attacks
 */
const sanitizeBody = () => {
    return (req, res, next) => {
        try {
            if (req.body) {
                req.body = sanitizeObject(req.body);
            }
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Recursively sanitize an object
 */
const sanitizeObject = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObject(item));
    }

    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            acc[key] = sanitizeObject(obj[key]);
            return acc;
        }, {});
    }

    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    return obj;
};

/**
 * Sanitize a string to prevent XSS attacks
 */
const sanitizeString = (str) => {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

module.exports = {
    validateBody,
    validateQuery,
    validateParams,
    sanitizeBody,
};
