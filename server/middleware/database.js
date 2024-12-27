const mongoose = require('mongoose');
const { MonitoringService } = require('../services/MonitoringService');
const logger = require('../utils/logger');

/**
 * Configure database middleware
 */
const configureDatabaseMiddleware = (app) => {
    // Track database operations
    const originalQuery = mongoose.Query.prototype.exec;

    mongoose.Query.prototype.exec = async function () {
        const startTime = process.hrtime();
        const collection = this.model.collection.name;
        const operation = this.op;

        try {
            const result = await originalQuery.apply(this, arguments);

            // Calculate operation duration
            const diff = process.hrtime(startTime);
            const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

            // Log slow queries (over 100ms)
            if (duration > 100) {
                logger.warn('Slow database query:', {
                    collection,
                    operation,
                    duration: `${duration}ms`,
                    query: this.getQuery(),
                });
            }

            // Update monitoring metrics
            MonitoringService.trackDatabaseOperation({
                collection,
                operation,
                duration: parseFloat(duration),
                success: true,
            });

            return result;
        } catch (error) {
            // Calculate operation duration even for failed queries
            const diff = process.hrtime(startTime);
            const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

            // Log database errors
            logger.error('Database error:', {
                collection,
                operation,
                duration: `${duration}ms`,
                error: error.message,
                query: this.getQuery(),
            });

            // Update monitoring metrics
            MonitoringService.trackDatabaseOperation({
                collection,
                operation,
                duration: parseFloat(duration),
                success: false,
                error: error.message,
            });

            throw error;
        }
    };

    // Add database health check endpoint
    app.get('/health/db', async (req, res) => {
        try {
            // Check database connection
            if (mongoose.connection.readyState !== 1) {
                throw new Error('Database not connected');
            }

            // Check database responsiveness
            const startTime = process.hrtime();
            await mongoose.connection.db.admin().ping();

            const diff = process.hrtime(startTime);
            const responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

            // Get database statistics
            const stats = await mongoose.connection.db.stats();

            res.json({
                status: 'healthy',
                responseTime: `${responseTime}ms`,
                connections: mongoose.connection.client.topology.connections.length,
                collections: stats.collections,
                indexes: stats.indexes,
                avgObjSize: stats.avgObjSize,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
            });
        } catch (error) {
            logger.error('Database health check failed:', {
                error: error.message,
            });

            res.status(503).json({
                status: 'unhealthy',
                error: error.message,
            });
        }
    });
};

/**
 * Database transaction middleware
 */
const withTransaction = () => {
    return async (req, res, next) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        // Add session to request
        req.dbSession = session;

        // Override end to commit or rollback transaction
        const originalEnd = res.end;

        res.end = async function (chunk, encoding) {
            try {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // Commit transaction for successful responses
                    await session.commitTransaction();
                    logger.debug('Transaction committed');
                } else {
                    // Rollback transaction for error responses
                    await session.abortTransaction();
                    logger.debug('Transaction rolled back');
                }
            } catch (error) {
                logger.error('Transaction error:', {
                    error: error.message,
                    statusCode: res.statusCode,
                });

                // Ensure transaction is rolled back
                try {
                    await session.abortTransaction();
                } catch (rollbackError) {
                    logger.error('Transaction rollback error:', {
                        error: rollbackError.message,
                    });
                }
            } finally {
                // End session
                session.endSession();
            }

            // Call original end
            originalEnd.call(this, chunk, encoding);
        };

        next();
    };
};

/**
 * Database error handler middleware
 */
const handleDatabaseError = () => {
    return (error, req, res, next) => {
        if (error.name === 'MongoError' || error.name === 'MongooseError') {
            logger.error('Database error:', {
                name: error.name,
                code: error.code,
                message: error.message,
            });

            // Handle specific database errors
            switch (error.code) {
                case 11000:
                    return res.status(409).json({
                        error: {
                            message: 'Duplicate key error',
                            code: 'DUPLICATE_KEY_ERROR',
                            details: error.keyValue,
                        },
                    });
                default:
                    return res.status(500).json({
                        error: {
                            message: 'Database error',
                            code: 'DATABASE_ERROR',
                        },
                    });
            }
        }

        next(error);
    };
};

module.exports = {
    configureDatabaseMiddleware,
    withTransaction,
    handleDatabaseError,
};
