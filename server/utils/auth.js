const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { GameSession } = require('../models/GameSession');
const User = require('../models/User');
const Admin = require('../models/Admin');
const logger = require('./logger');

// JWT utilities
const generateToken = (payload, expiresIn = '24h') => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
};

// Password utilities
const hashPassword = async (password) => {
    return bcrypt.hash(password, 10);
};

const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

// 2FA utilities
const generateTOTPSecret = async (username) => {
    const secret = speakeasy.generateSecret({
        name: `Casino Admin - ${username}`,
    });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
    };
};

const verifyTOTP = (secret, token) => {
    return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1, // Allow 30 seconds before/after
    });
};

// Authentication middleware
const authenticateUser = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ message: 'Account is not active' });
        }

        req.user = user;
        next();
    } catch (error) {
        logger.error('Error in user authentication:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        const admin = await Admin.findById(decoded.id);
        if (!admin) {
            return res.status(401).json({ message: 'Admin not found' });
        }

        if (admin.status !== 'active') {
            return res.status(403).json({ message: 'Account is not active' });
        }

        req.admin = admin;
        next();
    } catch (error) {
        logger.error('Error in admin authentication:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Authorization middleware
const requirePermission = (category, action) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (!req.admin.hasPermission(category, action)) {
            return res.status(403).json({ message: 'Permission denied' });
        }

        next();
    };
};

// Rate limiting utilities
const rateLimiters = new Map();

const rateLimit = (key, limit, windowMs) => {
    return (req, res, next) => {
        const now = Date.now();
        const userKey = `${key}-${req.ip}`;

        let limiter = rateLimiters.get(userKey);
        if (!limiter) {
            limiter = {
                count: 0,
                resetTime: now + windowMs,
            };
            rateLimiters.set(userKey, limiter);
        }

        if (now > limiter.resetTime) {
            limiter.count = 0;
            limiter.resetTime = now + windowMs;
        }

        limiter.count++;

        if (limiter.count > limit) {
            return res.status(429).json({
                message: 'Too many requests',
                resetTime: limiter.resetTime,
            });
        }

        next();
    };
};

// Session management utilities
const validateSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        const session = await GameSession.findOne({
            _id: sessionId,
            userId: req.user._id,
            status: 'active',
        });

        if (!session) {
            return res.status(404).json({ message: 'Invalid session' });
        }

        req.gameSession = session;
        next();
    } catch (error) {
        logger.error('Error validating session:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    generateToken,
    verifyToken,
    hashPassword,
    comparePassword,
    generateTOTPSecret,
    verifyTOTP,
    authenticateUser,
    authenticateAdmin,
    requirePermission,
    rateLimit,
    validateSession,
};
