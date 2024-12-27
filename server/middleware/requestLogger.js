const logger = require('../utils/logger');
const onHeaders = require('on-headers');
const onFinished = require('on-finished');

/**
 * Request logging middleware
 */
const requestLogger = () => {
    return (req, res, next) => {
        // Start time of request
        const start = process.hrtime();

        // Log request
        const requestLog = {
            method: req.method,
            path: req.path,
            query: req.query,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            userId: req.user && req.user._id,
            adminId: req.admin && req.admin._id,
        };

        // Log response headers
        onHeaders(res, () => {
            const diff = process.hrtime(start);
            const responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

            requestLog.statusCode = res.statusCode;
            requestLog.responseTime = responseTime;

            // Check for missing security headers
            const securityHeaders = {
                'x-content-type-options': 'nosniff',
                'x-frame-options': 'DENY',
                'x-xss-protection': '1; mode=block',
                'strict-transport-security': 'max-age=31536000; includeSubDomains',
            };

            const missingHeaders = Object.entries(securityHeaders)
                .filter(([header]) => !res.get(header))
                .map(([header, value]) => {
                    res.set(header, value);
                    return header;
                });

            if (missingHeaders.length > 0) {
                logger.warn('Missing security headers:', {
                    path: req.path,
                    headers: missingHeaders,
                });
            }
        });

        // Log response finish
        onFinished(res, (err) => {
            if (err) {
                logger.error('Request error:', {
                    ...requestLog,
                    error: err.message,
                });
            } else {
                logger.info('Request completed:', requestLog);
            }
        });

        next();
    };
};

/**
 * Performance monitoring middleware
 */
const performanceMonitor = () => {
    return (req, res, next) => {
        const start = process.hrtime();
        let dbOperations = 0;
        let responseSize = 0;

        // Track database operations
        const originalQuery = req.app.locals.db?.query;
        if (originalQuery) {
            req.app.locals.db.query = (...args) => {
                dbOperations++;
                return originalQuery.apply(req.app.locals.db, args);
            };
        }

        // Track response size
        const originalWrite = res.write;
        const originalEnd = res.end;

        res.write = function (chunk) {
            if (chunk) {
                responseSize += chunk.length;
            }
            return originalWrite.apply(res, arguments);
        };

        res.end = function (chunk) {
            if (chunk) {
                responseSize += chunk.length;
            }
            return originalEnd.apply(res, arguments);
        };

        // Log performance metrics on request completion
        onFinished(res, () => {
            const diff = process.hrtime(start);
            const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

            logger.info('Performance metrics:', {
                path: req.path,
                method: req.method,
                duration: `${duration}ms`,
                dbOperations,
                responseSize: `${(responseSize / 1024).toFixed(2)}KB`,
                statusCode: res.statusCode,
            });

            // Restore original database query method
            if (originalQuery) {
                req.app.locals.db.query = originalQuery;
            }
        });

        next();
    };
};

/**
 * Error logging middleware
 */
const errorLogger = () => {
    return (err, req, res, next) => {
        logger.error('Error:', {
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            userId: req.user && req.user._id,
            adminId: req.admin && req.admin._id,
            requestId: req.id,
            statusCode: err.status || err.statusCode || 500,
        });
        next(err);
    };
};

module.exports = {
    requestLogger,
    performanceMonitor,
    errorLogger,
};
