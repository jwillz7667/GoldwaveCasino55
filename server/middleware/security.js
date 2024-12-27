const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { APIError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Configure security middleware
 */
const configureSecurityMiddleware = (app) => {
    // Enable helmet middleware for security headers
    app.use(helmet());

    // Configure CORS
    const corsOptions = {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-Total-Count'],
        credentials: true,
        maxAge: 86400, // 24 hours
    };
    app.use(cors(corsOptions));

    // Configure rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: {
            error: {
                message: 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED',
            },
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req) => {
            logger.warn('Rate limit exceeded:', {
                ip: req.ip,
                path: req.path,
            });

            throw new APIError('Too many requests', 'RATE_LIMIT_EXCEEDED', 429);
        },
    });
    app.use(limiter);

    // Configure content security policy
    app.use(
        helmet.contentSecurityPolicy({
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        })
    );

    // Configure referrer policy
    app.use(
        helmet.referrerPolicy({
            policy: 'strict-origin-when-cross-origin',
        })
    );

    // Enable XSS filter
    app.use(helmet.xssFilter());

    // Prevent clickjacking
    app.use(helmet.frameguard({ action: 'deny' }));

    // Disable MIME type sniffing
    app.use(helmet.noSniff());

    // Set HSTS header
    app.use(
        helmet.hsts({
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
        })
    );

    // Remove X-Powered-By header
    app.disable('x-powered-by');

    // Prevent parameter pollution
    app.use(preventParameterPollution());

    // Add security headers check middleware
    app.use(checkSecurityHeaders());
};

/**
 * Prevent parameter pollution middleware
 */
const preventParameterPollution = () => {
    return (req, res, next) => {
        try {
            // Convert arrays to single values in query parameters
            if (req.query) {
                Object.keys(req.query).forEach((key) => {
                    if (Array.isArray(req.query[key])) {
                        req.query[key] = req.query[key][0];
                    }
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Check security headers middleware
 */
const checkSecurityHeaders = () => {
    return (req, res, next) => {
        try {
            // Add security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

            // Add CORS headers for preflight requests
            if (req.method === 'OPTIONS') {
                res.setHeader('Access-Control-Max-Age', '86400');
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = {
    configureSecurityMiddleware,
    preventParameterPollution,
    checkSecurityHeaders,
};
