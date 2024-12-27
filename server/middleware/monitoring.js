const logger = require('../utils/logger');
const { MonitoringService } = require('../services/MonitoringService');

/**
 * Configure monitoring middleware
 */
const configureMonitoringMiddleware = (app) => {
    // Track active connections
    let activeConnections = 0;

    app.use((req, res, next) => {
        // Increment active connections
        activeConnections++;
        MonitoringService.updateMetric('active_connections', activeConnections);

        // Track request start time
        const startTime = process.hrtime();

        // Track response size
        let responseSize = 0;
        const originalWrite = res.write;
        const originalEnd = res.end;

        res.write = function (chunk) {
            responseSize += chunk?.length || 0;
            return originalWrite.apply(res, arguments);
        };

        res.end = function (chunk) {
            responseSize += chunk?.length || 0;
            return originalEnd.apply(res, arguments);
        };

        // Handle request completion
        res.on('finish', () => {
            // Calculate response time
            const diff = process.hrtime(startTime);
            const responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

            // Log request metrics
            const metrics = {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                responseTime: parseFloat(responseTime),
                responseSize,
                userAgent: req.get('user-agent'),
                referer: req.get('referer'),
                ip: req.ip,
            };

            logger.info('Request metrics:', metrics);

            // Update monitoring metrics
            MonitoringService.updateRequestMetrics(metrics);

            // Decrement active connections
            activeConnections--;
            MonitoringService.updateMetric('active_connections', activeConnections);
        });

        next();
    });

    // Monitor memory usage
    setInterval(() => {
        const memoryUsage = process.memoryUsage();

        MonitoringService.updateMetric('memory_usage', {
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external,
            rss: memoryUsage.rss,
        });

        // Log if memory usage is high
        const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
        if (heapUsedMB > 500) {
            // Alert if heap usage exceeds 500MB
            logger.warn('High memory usage:', {
                heapUsedMB: heapUsedMB.toFixed(2),
            });
        }
    }, 60000); // Check every minute

    // Monitor event loop lag
    let lastLoop = Date.now();

    setInterval(() => {
        const now = Date.now();
        const lag = now - lastLoop;
        lastLoop = now;

        MonitoringService.updateMetric('event_loop_lag', lag);

        // Log if event loop lag is high
        if (lag > 100) {
            // Alert if lag exceeds 100ms
            logger.warn('High event loop lag:', {
                lag,
            });
        }
    }, 1000); // Check every second
};

/**
 * Error monitoring middleware
 */
const errorMonitoring = () => {
    return (err, req, res, next) => {
        // Track error metrics
        MonitoringService.trackError({
            type: err.name,
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            statusCode: err.status || 500,
        });

        next(err);
    };
};

/**
 * Performance monitoring middleware
 */
const performanceMonitoring = () => {
    return (req, res, next) => {
        // Track database operations
        let dbOperations = 0;
        const originalQuery = req.app.locals.db?.query;

        if (originalQuery) {
            req.app.locals.db.query = (...args) => {
                dbOperations++;
                const startTime = process.hrtime();

                return originalQuery
                    .apply(req.app.locals.db, args)
                    .then((result) => {
                        const diff = process.hrtime(startTime);
                        const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

                        MonitoringService.trackDatabaseOperation({
                            duration: parseFloat(duration),
                            query: args[0],
                            path: req.path,
                        });

                        return result;
                    })
                    .catch((error) => {
                        MonitoringService.trackDatabaseError({
                            error: error.message,
                            query: args[0],
                            path: req.path,
                        });

                        throw error;
                    });
            };
        }

        // Track response time
        const startTime = process.hrtime();

        res.on('finish', () => {
            const diff = process.hrtime(startTime);
            const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

            MonitoringService.trackPerformance({
                duration: parseFloat(duration),
                dbOperations,
                path: req.path,
                method: req.method,
                statusCode: res.statusCode,
            });
        });

        next();
    };
};

module.exports = {
    configureMonitoringMiddleware,
    errorMonitoring,
    performanceMonitoring,
};
