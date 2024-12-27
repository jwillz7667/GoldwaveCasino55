const Redis = require('ioredis');
const logger = require('../utils/logger');

class CacheService {
    constructor() {
        this.client = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        this.client.on('error', (error) => {
            logger.error('Redis connection error:', error);
        });

        this.client.on('connect', () => {
            logger.info('Redis connected successfully');
        });

        // Default TTL in seconds (1 hour)
        this.defaultTTL = 3600;
    }

    /**
     * Get a value from cache
     * @param {string} key - Cache key
     * @returns {Promise<any>} - Cached value or null
     */
    async get(key) {
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Cache get error:', { error: error.message, key });
            return null;
        }
    }

    /**
     * Set a value in cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} [ttl] - Time to live in seconds
     * @returns {Promise<boolean>} - Success status
     */
    async set(key, value, ttl = this.defaultTTL) {
        try {
            await this.client.set(key, JSON.stringify(value), 'EX', ttl);
            return true;
        } catch (error) {
            logger.error('Cache set error:', { error: error.message, key });
            return false;
        }
    }

    /**
     * Delete a value from cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} - Success status
     */
    async del(key) {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Cache delete error:', { error: error.message, key });
            return false;
        }
    }

    /**
     * Clear all cache
     * @returns {Promise<boolean>} - Success status
     */
    async clear() {
        try {
            await this.client.flushall();
            return true;
        } catch (error) {
            logger.error('Cache clear error:', error.message);
            return false;
        }
    }

    /**
     * Get multiple values from cache
     * @param {string[]} keys - Array of cache keys
     * @returns {Promise<any[]>} - Array of cached values
     */
    async mget(keys) {
        try {
            const values = await this.client.mget(keys);
            return values.map((value) => (value ? JSON.parse(value) : null));
        } catch (error) {
            logger.error('Cache mget error:', { error: error.message, keys });
            return keys.map(() => null);
        }
    }

    /**
     * Set multiple values in cache
     * @param {Object.<string, any>} keyValues - Object with key-value pairs
     * @param {number} [ttl] - Time to live in seconds
     * @returns {Promise<boolean>} - Success status
     */
    async mset(keyValues, ttl = this.defaultTTL) {
        try {
            const pipeline = this.client.pipeline();

            Object.entries(keyValues).forEach(([key, value]) => {
                pipeline.set(key, JSON.stringify(value), 'EX', ttl);
            });

            await pipeline.exec();
            return true;
        } catch (error) {
            logger.error('Cache mset error:', {
                error: error.message,
                keys: Object.keys(keyValues),
            });
            return false;
        }
    }

    /**
     * Get or set cache value with callback
     * @param {string} key - Cache key
     * @param {Function} callback - Callback to get value if not cached
     * @param {number} [ttl] - Time to live in seconds
     * @returns {Promise<any>} - Cached or computed value
     */
    async getOrSet(key, callback, ttl = this.defaultTTL) {
        try {
            const cached = await this.get(key);
            if (cached !== null) {
                return cached;
            }

            const value = await callback();
            await this.set(key, value, ttl);
            return value;
        } catch (error) {
            logger.error('Cache getOrSet error:', { error: error.message, key });
            return callback();
        }
    }

    /**
     * Increment a counter in cache
     * @param {string} key - Counter key
     * @param {number} [increment=1] - Increment value
     * @returns {Promise<number>} - New counter value
     */
    async increment(key, increment = 1) {
        try {
            return await this.client.incrby(key, increment);
        } catch (error) {
            logger.error('Cache increment error:', { error: error.message, key });
            return null;
        }
    }

    /**
     * Add value to a sorted set
     * @param {string} key - Set key
     * @param {number} score - Score for sorting
     * @param {string} member - Set member
     * @returns {Promise<boolean>} - Success status
     */
    async zadd(key, score, member) {
        try {
            await this.client.zadd(key, score, JSON.stringify(member));
            return true;
        } catch (error) {
            logger.error('Cache zadd error:', { error: error.message, key });
            return false;
        }
    }

    /**
     * Get range from sorted set
     * @param {string} key - Set key
     * @param {number} start - Start index
     * @param {number} stop - Stop index
     * @returns {Promise<any[]>} - Array of members
     */
    async zrange(key, start, stop) {
        try {
            const members = await this.client.zrange(key, start, stop);
            return members.map((member) => JSON.parse(member));
        } catch (error) {
            logger.error('Cache zrange error:', { error: error.message, key });
            return [];
        }
    }
}

module.exports = new CacheService();
