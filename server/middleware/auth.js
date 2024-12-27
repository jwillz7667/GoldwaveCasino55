const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const logger = require('../utils/logger');

/**
 * Authenticate user middleware
 */
const authenticateUser = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            throw new Error('No authentication token provided');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('+status');

        if (!user) {
            throw new Error('User not found');
        }

        if (user.status !== 'active') {
            throw new Error('User account is not active');
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        logger.error('Authentication error:', {
            error: error.message,
            path: req.path,
            ip: req.ip,
        });

        res.status(401).json({
            error: {
                message: 'Please authenticate',
                code: 'AUTHENTICATION_REQUIRED',
            },
        });
    }
};

/**
 * Authenticate admin middleware
 */
const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            throw new Error('No authentication token provided');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id).select('+status +permissions').lean();

        if (!admin) {
            throw new Error('Admin not found');
        }

        if (admin.status !== 'active') {
            throw new Error('Admin account is not active');
        }

        req.admin = admin;
        req.token = token;
        next();
    } catch (error) {
        logger.error('Admin authentication error:', {
            error: error.message,
            path: req.path,
            ip: req.ip,
        });

        res.status(401).json({
            error: {
                message: 'Please authenticate as admin',
                code: 'ADMIN_AUTHENTICATION_REQUIRED',
            },
        });
    }
};

/**
 * Check admin permission middleware
 */
const requirePermission = (category, action) => {
    return (req, res, next) => {
        try {
            if (!req.admin) {
                throw new Error('Admin authentication required');
            }

            // Super admin has all permissions
            if (req.admin.role === 'super_admin') {
                return next();
            }

            // Check specific permission
            if (!req.admin.permissions?.[category]?.[action]) {
                throw new Error(`Permission denied: ${category}.${action}`);
            }

            next();
        } catch (error) {
            logger.error('Permission error:', {
                error: error.message,
                adminId: req.admin?._id,
                category,
                action,
                path: req.path,
            });

            res.status(403).json({
                error: {
                    message: 'Permission denied',
                    code: 'PERMISSION_DENIED',
                    details: `${category}.${action}`,
                },
            });
        }
    };
};

/**
 * Rate limiting middleware
 */
const rateLimit = (limit, windowMs) => {
    const requests = new Map();

    return (req, res, next) => {
        const ip = req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old requests
        requests.forEach((timestamp, key) => {
            if (timestamp < windowStart) {
                requests.delete(key);
            }
        });

        // Count requests in window
        const requestCount = Array.from(requests.values()).filter(
            (timestamp) => timestamp > windowStart
        ).length;

        if (requestCount >= limit) {
            logger.warn('Rate limit exceeded:', {
                ip,
                path: req.path,
                limit,
                windowMs,
            });

            return res.status(429).json({
                error: {
                    message: 'Too many requests',
                    code: 'RATE_LIMIT_EXCEEDED',
                },
            });
        }

        requests.set(ip, now);
        next();
    };
};

module.exports = {
    authenticateUser,
    authenticateAdmin,
    requirePermission,
    rateLimit,
};
