const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const logger = require('../utils/logger');

/**
 * Middleware to verify admin JWT token
 */
async function verifyAdminToken(req, res, next) {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if admin exists and is active
        const admin = await Admin.findById(decoded.id);
        if (!admin || admin.status !== 'active') {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Attach admin to request
        req.admin = admin;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        logger.error('Admin auth middleware error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

/**
 * Middleware to check admin permissions
 * @param {string[]} requiredPermissions - Array of required permissions
 */
function checkPermissions(requiredPermissions) {
    return (req, res, next) => {
        try {
            const admin = req.admin;

            // Super admin has all permissions
            if (admin.role === 'super_admin') {
                return next();
            }

            // Check if admin has all required permissions
            const hasAllPermissions = requiredPermissions.every((permission) =>
                admin.permissions.includes(permission)
            );

            if (!hasAllPermissions) {
                return res.status(403).json({ message: 'Insufficient permissions' });
            }

            next();
        } catch (error) {
            logger.error('Permission check error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };
}

/**
 * Middleware to log admin actions
 */
async function logAdminAction(req, res, next) {
    try {
        const originalSend = res.send;

        res.send = function (data) {
            res.send = originalSend;

            // Log the action after response is sent
            process.nextTick(async () => {
                try {
                    await Admin.findByIdAndUpdate(req.admin._id, {
                        $push: {
                            actionLog: {
                                action: req.method + ' ' + req.originalUrl,
                                ip: req.ip,
                                timestamp: new Date(),
                                status: res.statusCode,
                                details: typeof data === 'string' ? data : JSON.stringify(data),
                            },
                        },
                    });
                } catch (error) {
                    logger.error('Error logging admin action:', error);
                }
            });

            return res.send(data);
        };

        next();
    } catch (error) {
        logger.error('Action logging middleware error:', error);
        next(error);
    }
}

/**
 * Middleware to rate limit admin actions
 * @param {number} maxRequests - Maximum number of requests per window
 * @param {number} windowMs - Time window in milliseconds
 */
function rateLimit(maxRequests, windowMs) {
    const requests = new Map();

    return (req, res, next) => {
        const adminId = req.admin._id.toString();
        const now = Date.now();

        // Get admin's request history
        const adminRequests = requests.get(adminId) || [];

        // Remove expired requests
        const validRequests = adminRequests.filter((timestamp) => now - timestamp < windowMs);

        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                message: 'Too many requests',
                retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000),
            });
        }

        // Add current request
        validRequests.push(now);
        requests.set(adminId, validRequests);

        next();
    };
}

module.exports = {
    verifyAdminToken,
    checkPermissions,
    logAdminAction,
    rateLimit,
};
