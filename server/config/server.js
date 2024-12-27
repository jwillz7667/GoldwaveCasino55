const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const path = require('path');
const compression = require('compression');
const MonitoringServer = require('../websocket/MonitoringServer');
const { requestLogger, errorLogger, performanceMonitor } = require('../middleware/requestLogger');
const logger = require('../utils/logger');
const cache = require('../services/CacheService');

// Rate limiting configuration
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW * 60 * 1000 || 15 * 60 * 1000, // Default: 15 minutes
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // Limit each IP
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    // Use Redis if available, otherwise use memory store
    store: cache.client
        ? {
              incr: (key) => cache.increment(key),
              decrement: (key) => cache.increment(key, -1),
              resetKey: (key) => cache.del(key),
          }
        : undefined,
});

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Request-ID', 'X-Response-Time'],
    credentials: true,
    maxAge: 600, // 10 minutes
};

// File upload configuration
const fileUploadOptions = {
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // Default: 5MB
    },
    abortOnLimit: true,
    createParentPath: true,
    useTempFiles: true,
    tempFileDir: path.join(process.cwd(), 'tmp'),
    debug: process.env.NODE_ENV === 'development',
    safeFileNames: true,
    preserveExtension: true,
};

// Configure server middleware and settings
const configureServer = (app) => {
    // Basic security headers
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'", 'wss:', 'https:'],
                    fontSrc: ["'self'", 'https:', 'data:'],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            crossOriginEmbedderPolicy: true,
            crossOriginOpenerPolicy: true,
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            dnsPrefetchControl: true,
            frameguard: { action: 'deny' },
            hidePoweredBy: true,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true,
            },
            ieNoOpen: true,
            noSniff: true,
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
            xssFilter: true,
        })
    );

    // Enable compression
    app.use(
        compression({
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            },
            level: 6, // Balanced setting between compression ratio and CPU usage
        })
    );

    // CORS
    app.use(cors(corsOptions));

    // Request parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // File upload
    app.use(fileUpload(fileUploadOptions));

    // Logging and monitoring
    if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
        app.use(morgan('combined', { stream: logger.stream }));
    }
    app.use(requestLogger());
    app.use(performanceMonitor());

    // Rate limiting
    app.use('/api/', limiter);

    // Static files with caching
    app.use(
        express.static('public', {
            maxAge: '1d',
            etag: true,
            lastModified: true,
        })
    );

    // Error handling
    app.use(errorLogger());

    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            error: {
                message: 'Not Found',
                code: 'NOT_FOUND',
                requestId: req.id,
            },
        });
    });

    // Error handler
    app.use((err, req, res) => {
        const statusCode = err.status || err.statusCode || 500;

        res.status(statusCode).json({
            error: {
                message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
                code: err.code || 'INTERNAL_ERROR',
                requestId: req.id,
            },
        });

        if (statusCode === 500) {
            logger.error('Unhandled error:', {
                error: err.message,
                stack: err.stack,
                requestId: req.id,
            });
        }
    });
};

// Start server with WebSocket support
const startServer = async (app, port) => {
    try {
        const server = require('http').createServer(app);
        const monitoringServer = new MonitoringServer(server);

        await new Promise((resolve, reject) => {
            server.listen(port, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                logger.info(`Server running on port ${port}`);
                resolve();
            });
        });

        // Graceful shutdown
        const shutdown = async (signal) => {
            logger.info(`${signal} received. Starting graceful shutdown...`);

            // Stop accepting new connections
            server.close(async () => {
                logger.info('HTTP server closed');

                // Close WebSocket connections
                monitoringServer.wss.clients.forEach((client) => {
                    client.close(1000, 'Server shutting down');
                });

                // Close database connections
                try {
                    const mongoose = require('mongoose');
                    await mongoose.connection.close();
                    logger.info('Database connections closed');
                } catch (error) {
                    logger.error('Error closing database connections:', error);
                }

                // Close Redis connections
                try {
                    await cache.client.quit();
                    logger.info('Redis connections closed');
                } catch (error) {
                    logger.error('Error closing Redis connections:', error);
                }

                logger.info('Graceful shutdown completed');
                throw new Error('Server shutdown completed');
            });

            // Force shutdown after timeout
            setTimeout(() => {
                logger.error('Forced shutdown due to timeout');
                throw new Error('Server shutdown timeout');
            }, 30000);
        };

        // Handle shutdown signals
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        return { server, monitoringServer };
    } catch (error) {
        logger.error('Error starting server:', error);
        throw error;
    }
};

module.exports = {
    configureServer,
    startServer,
};
