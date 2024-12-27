const { CacheService } = require('../services/CacheService');
const logger = require('../utils/logger');

/**
 * Cache middleware factory
 */
const cacheMiddleware = (options = {}) => {
    const {
        ttl = 3600, // Default TTL: 1 hour
        key = (req) => `${req.method}:${req.originalUrl}`,
        condition = () => true,
        serialize = JSON.stringify,
        deserialize = JSON.parse,
    } = options;

    return async (req, res, next) => {
        try {
            // Skip caching if condition is not met
            if (!condition(req)) {
                return next();
            }

            // Generate cache key
            const cacheKey = typeof key === 'function' ? key(req) : key;

            // Try to get from cache
            const cachedResponse = await CacheService.get(cacheKey);
            if (cachedResponse) {
                logger.debug('Cache hit:', {
                    key: cacheKey,
                    path: req.path,
                });

                const { headers, body } = deserialize(cachedResponse);

                // Set cached headers
                Object.entries(headers).forEach(([key, value]) => {
                    res.set(key, value);
                });

                // Add cache status header
                res.set('X-Cache', 'HIT');

                return res.send(body);
            }

            logger.debug('Cache miss:', {
                key: cacheKey,
                path: req.path,
            });

            // Add cache status header
            res.set('X-Cache', 'MISS');

            // Store original send
            const originalSend = res.send;

            // Override send method to cache the response
            res.send = function (body) {
                // Cache the response
                const responseToCache = serialize({
                    headers: res.getHeaders(),
                    body,
                });

                CacheService.set(cacheKey, responseToCache, ttl).catch((error) => {
                    logger.error('Cache set error:', {
                        error: error.message,
                        key: cacheKey,
                    });
                });

                // Call original send
                return originalSend.call(this, body);
            };

            next();
        } catch (error) {
            logger.error('Cache middleware error:', {
                error: error.message,
                path: req.path,
            });
            next(error);
        }
    };
};

/**
 * Cache control middleware
 */
const cacheControl = (options = {}) => {
    const {
        isPublic = true,
        maxAge = 3600,
        staleWhileRevalidate = 60,
        staleIfError = 86400,
        mustRevalidate = false,
        noStore = false,
        noCache = false,
    } = options;

    return (req, res, next) => {
        try {
            const directives = [];

            if (noStore) {
                directives.push('no-store');
            } else if (noCache) {
                directives.push('no-cache');
            } else {
                // Add public/private directive
                directives.push(isPublic ? 'public' : 'private');

                // Add max-age directive
                if (maxAge >= 0) {
                    directives.push(`max-age=${maxAge}`);
                }

                // Add stale-while-revalidate directive
                if (staleWhileRevalidate >= 0) {
                    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
                }

                // Add stale-if-error directive
                if (staleIfError >= 0) {
                    directives.push(`stale-if-error=${staleIfError}`);
                }

                // Add must-revalidate directive
                if (mustRevalidate) {
                    directives.push('must-revalidate');
                }
            }

            // Set Cache-Control header
            res.set('Cache-Control', directives.join(', '));

            // Add Vary header
            res.vary('Accept-Encoding');

            next();
        } catch (error) {
            logger.error('Cache control middleware error:', {
                error: error.message,
                path: req.path,
            });
            next(error);
        }
    };
};

/**
 * Clear cache middleware
 */
const clearCache = (pattern) => {
    return async (req, res, next) => {
        try {
            await CacheService.clear(pattern);

            logger.info('Cache cleared:', {
                pattern,
                path: req.path,
            });

            next();
        } catch (error) {
            logger.error('Clear cache middleware error:', {
                error: error.message,
                pattern,
                path: req.path,
            });
            next(error);
        }
    };
};

module.exports = {
    cacheMiddleware,
    cacheControl,
    clearCache,
};
