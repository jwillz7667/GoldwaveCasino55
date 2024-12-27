const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: logLevels,
    format: logFormat,
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
        }),

        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
        }),

        // Write all logs with level 'http' to access.log
        new winston.transports.File({
            filename: path.join(logDir, 'access.log'),
            level: 'http',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
        }),
    ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        })
    );
}

// Create a stream object for Morgan
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

// Add error event handler that writes to a fallback file
logger.on('error', (error) => {
    const fallbackLog = path.join(logDir, 'logger-errors.log');
    const timestamp = new Date().toISOString();
    const errorMessage = `${timestamp} - Logger Error: ${error.message}\n${error.stack}\n`;
    
    try {
        fs.appendFileSync(fallbackLog, errorMessage);
    } catch {
        // If we can't even write to the fallback log, there's nothing more we can do
    }
});

// Add custom methods for structured logging
logger.logRequest = (req, res, responseTime) => {
    const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        status: res.statusCode,
        responseTime: `${responseTime}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user ? req.user._id : null,
    };

    logger.http('HTTP Request', logData);
};

logger.logError = (error, req = null) => {
    const logData = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        code: error.code,
        ...(req && {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userId: req.user ? req.user._id : null,
        }),
    };

    logger.error('Application Error', logData);
};

logger.logTransaction = (transaction, userId, status) => {
    const logData = {
        timestamp: new Date().toISOString(),
        transactionId: transaction._id,
        userId,
        type: transaction.type,
        amount: transaction.amount,
        status,
        metadata: transaction.metadata,
    };

    logger.info('Transaction', logData);
};

logger.logGameActivity = (gameSession, userId, action) => {
    const logData = {
        timestamp: new Date().toISOString(),
        sessionId: gameSession._id,
        gameId: gameSession.gameId,
        userId,
        action,
        bet: gameSession.rounds[gameSession.rounds.length - 1]?.bet,
        result: gameSession.rounds[gameSession.rounds.length - 1]?.result,
    };

    logger.info('Game Activity', logData);
};

logger.logAdminActivity = (adminId, action, details) => {
    const logData = {
        timestamp: new Date().toISOString(),
        adminId,
        action,
        details,
    };

    logger.info('Admin Activity', logData);
};

logger.logPerformance = (metric, value, tags = {}) => {
    const logData = {
        timestamp: new Date().toISOString(),
        metric,
        value,
        tags,
    };

    logger.debug('Performance Metric', logData);
};

logger.logSecurity = (event, details, severity = 'warn') => {
    const logData = {
        timestamp: new Date().toISOString(),
        event,
        details,
        severity,
    };

    logger[severity]('Security Event', logData);
};

// Export logger instance
module.exports = logger;
