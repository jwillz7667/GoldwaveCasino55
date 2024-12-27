const User = require('../models/User');
const cache = require('./CacheService');
const logger = require('../utils/logger');

class UserService {
    constructor() {
        this.cacheKeyPrefix = 'user:';
        this.cacheTTL = {
            user: 3600, // 1 hour
            profile: 7200, // 2 hours
            stats: 300, // 5 minutes
        };
    }

    /**
     * Generate cache key for user
     * @param {string} userId - User ID
     * @param {string} [type='main'] - Cache type (main, profile, stats)
     * @returns {string} Cache key
     */
    getCacheKey(userId, type = 'main') {
        return `${this.cacheKeyPrefix}${userId}:${type}`;
    }

    /**
     * Get user by ID with caching
     * @param {string} userId - User ID
     * @param {boolean} [withPassword=false] - Include password field
     * @returns {Promise<Object>} User object
     */
    async getUserById(userId, withPassword = false) {
        const cacheKey = this.getCacheKey(userId);

        try {
            return await cache.getOrSet(
                cacheKey,
                async () => {
                    const query = User.findById(userId);
                    if (withPassword) {
                        query.select('+password');
                    }
                    const user = await query.lean();
                    if (!user) return null;
                    return user;
                },
                this.cacheTTL.user
            );
        } catch (error) {
            logger.error('Error getting user by ID:', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Get user profile with caching
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User profile
     */
    async getUserProfile(userId) {
        const cacheKey = this.getCacheKey(userId, 'profile');

        try {
            return await cache.getOrSet(
                cacheKey,
                async () => {
                    const user = await User.findById(userId).select('profile preferences').lean();
                    return user ? { profile: user.profile, preferences: user.preferences } : null;
                },
                this.cacheTTL.profile
            );
        } catch (error) {
            logger.error('Error getting user profile:', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Get user statistics with caching
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User statistics
     */
    async getUserStats(userId) {
        const cacheKey = this.getCacheKey(userId, 'stats');

        try {
            return await cache.getOrSet(
                cacheKey,
                async () => {
                    const user = await User.findById(userId)
                        .select('statistics')
                        .populate('statistics.favoriteGames.gameId')
                        .lean();
                    return user ? user.statistics : null;
                },
                this.cacheTTL.stats
            );
        } catch (error) {
            logger.error('Error getting user statistics:', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Update user data and manage cache
     * @param {string} userId - User ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated user
     */
    async updateUser(userId, updateData) {
        try {
            const user = await User.findByIdAndUpdate(userId, updateData, {
                new: true,
                runValidators: true,
            }).lean();

            if (!user) {
                throw new Error('User not found');
            }

            // Invalidate all user-related caches
            await Promise.all([
                cache.del(this.getCacheKey(userId)),
                cache.del(this.getCacheKey(userId, 'profile')),
                cache.del(this.getCacheKey(userId, 'stats')),
            ]);

            return user;
        } catch (error) {
            logger.error('Error updating user:', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Update user balance with optimistic locking
     * @param {string} userId - User ID
     * @param {number} amount - Amount to add (negative for subtraction)
     * @returns {Promise<Object>} Updated user
     */
    async updateBalance(userId, amount) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            if (user.balance + amount < 0) {
                throw new Error('Insufficient balance');
            }

            user.balance += amount;
            await user.save();

            // Invalidate user cache
            await cache.del(this.getCacheKey(userId));

            return user.toObject();
        } catch (error) {
            logger.error('Error updating balance:', { error: error.message, userId, amount });
            throw error;
        }
    }

    /**
     * Get multiple users by IDs with caching
     * @param {string[]} userIds - Array of user IDs
     * @returns {Promise<Object[]>} Array of user objects
     */
    async getUsersByIds(userIds) {
        const cacheKeys = userIds.map((id) => this.getCacheKey(id));

        try {
            const cachedUsers = await cache.mget(cacheKeys);
            const missingIndexes = cachedUsers
                .map((user, index) => (user === null ? index : -1))
                .filter((index) => index !== -1);

            if (missingIndexes.length === 0) {
                return cachedUsers;
            }

            const missingIds = missingIndexes.map((index) => userIds[index]);
            const fetchedUsers = await User.find({ _id: { $in: missingIds } }).lean();

            const cacheUpdates = {};
            fetchedUsers.forEach((user) => {
                cacheUpdates[this.getCacheKey(user._id)] = user;
            });

            await cache.mset(cacheUpdates, this.cacheTTL.user);

            return userIds.map((id, index) => {
                if (cachedUsers[index]) return cachedUsers[index];
                return fetchedUsers.find((u) => u._id.toString() === id.toString()) || null;
            });
        } catch (error) {
            logger.error('Error getting users by IDs:', { error: error.message, userIds });
            throw error;
        }
    }

    /**
     * Search users with pagination and caching
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Pagination and sorting options
     * @returns {Promise<Object>} Search results with pagination info
     */
    async searchUsers(criteria, options = {}) {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;

        const cacheKey = `users:search:${JSON.stringify(
            criteria
        )}:${page}:${limit}:${JSON.stringify(sort)}`;

        try {
            return await cache.getOrSet(
                cacheKey,
                async () => {
                    const query = User.find(criteria)
                        .sort(sort)
                        .skip((page - 1) * limit)
                        .limit(limit)
                        .lean();

                    const [users, total] = await Promise.all([
                        query,
                        User.countDocuments(criteria),
                    ]);

                    return {
                        users,
                        pagination: {
                            page,
                            limit,
                            total,
                            pages: Math.ceil(total / limit),
                        },
                    };
                },
                300 // Cache for 5 minutes
            );
        } catch (error) {
            logger.error('Error searching users:', { error: error.message, criteria });
            throw error;
        }
    }
}

module.exports = new UserService();
