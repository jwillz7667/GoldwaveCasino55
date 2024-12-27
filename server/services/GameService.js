const Game = require('../models/Game');
const cache = require('./CacheService');
const logger = require('../utils/logger');

class GameService {
    constructor() {
        this.cacheKeyPrefix = 'game:';
        this.cacheTTL = {
            game: 3600, // 1 hour
            stats: 300, // 5 minutes
            list: 1800, // 30 minutes
        };
    }

    /**
     * Generate cache key for game
     * @param {string} gameId - Game ID
     * @param {string} [type='main'] - Cache type (main, stats)
     * @returns {string} Cache key
     */
    getCacheKey(gameId, type = 'main') {
        return `${this.cacheKeyPrefix}${gameId}:${type}`;
    }

    /**
     * Get game by ID with caching
     * @param {string} gameId - Game ID
     * @returns {Promise<Object>} Game object
     */
    async getGameById(gameId) {
        const cacheKey = this.getCacheKey(gameId);

        try {
            return await cache.getOrSet(
                cacheKey,
                async () => {
                    const game = await Game.findById(gameId)
                        .populate('createdBy', 'username profile.firstName profile.lastName')
                        .lean();
                    return game;
                },
                this.cacheTTL.game
            );
        } catch (error) {
            logger.error('Error getting game by ID:', { error: error.message, gameId });
            throw error;
        }
    }

    /**
     * Get game statistics with caching
     * @param {string} gameId - Game ID
     * @returns {Promise<Object>} Game statistics
     */
    async getGameStats(gameId) {
        const cacheKey = this.getCacheKey(gameId, 'stats');

        try {
            return await cache.getOrSet(
                cacheKey,
                async () => {
                    const game = await Game.findById(gameId).select('statistics').lean();
                    return game ? game.statistics : null;
                },
                this.cacheTTL.stats
            );
        } catch (error) {
            logger.error('Error getting game statistics:', { error: error.message, gameId });
            throw error;
        }
    }

    /**
     * Update game data and manage cache
     * @param {string} gameId - Game ID
     * @param {Object} updateData - Data to update
     * @param {string} adminId - Admin making the update
     * @returns {Promise<Object>} Updated game
     */
    async updateGame(gameId, updateData, adminId) {
        try {
            const game = await Game.findByIdAndUpdate(
                gameId,
                {
                    ...updateData,
                    updatedBy: adminId,
                },
                { new: true, runValidators: true }
            ).lean();

            if (!game) {
                throw new Error('Game not found');
            }

            // Invalidate game caches
            await Promise.all([
                cache.del(this.getCacheKey(gameId)),
                cache.del(this.getCacheKey(gameId, 'stats')),
                cache.del('games:active'),
                cache.del('games:all'),
            ]);

            return game;
        } catch (error) {
            logger.error('Error updating game:', { error: error.message, gameId });
            throw error;
        }
    }

    /**
     * Update game statistics
     * @param {string} gameId - Game ID
     * @param {number} wager - Wager amount
     * @param {number} win - Win amount
     * @returns {Promise<Object>} Updated game statistics
     */
    async updateGameStats(gameId, wager, win) {
        try {
            const game = await Game.findById(gameId);
            if (!game) {
                throw new Error('Game not found');
            }

            game.statistics.totalPlays += 1;
            game.statistics.totalWagered += wager;
            game.statistics.totalWon += win;
            game.statistics.lastPlayed = new Date();

            await game.save();

            // Invalidate game statistics cache
            await cache.del(this.getCacheKey(gameId, 'stats'));

            return game.statistics;
        } catch (error) {
            logger.error('Error updating game statistics:', {
                error: error.message,
                gameId,
                wager,
                win,
            });
            throw error;
        }
    }

    /**
     * Get active games with caching
     * @returns {Promise<Object[]>} Array of active games
     */
    async getActiveGames() {
        const cacheKey = 'games:active';

        try {
            return await cache.getOrSet(
                cacheKey,
                async () => {
                    return await Game.find({ status: 'active' })
                        .select('-settings')
                        .sort({ 'statistics.totalPlays': -1 })
                        .lean();
                },
                this.cacheTTL.list
            );
        } catch (error) {
            logger.error('Error getting active games:', error.message);
            throw error;
        }
    }

    /**
     * Search games with pagination and caching
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Pagination and sorting options
     * @returns {Promise<Object>} Search results with pagination info
     */
    async searchGames(criteria, options = {}) {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;

        const cacheKey = `games:search:${JSON.stringify(
            criteria
        )}:${page}:${limit}:${JSON.stringify(sort)}`;

        try {
            return await cache.getOrSet(
                cacheKey,
                async () => {
                    const query = Game.find(criteria)
                        .sort(sort)
                        .skip((page - 1) * limit)
                        .limit(limit)
                        .populate('createdBy', 'username profile.firstName profile.lastName')
                        .lean();

                    const [games, total] = await Promise.all([
                        query,
                        Game.countDocuments(criteria),
                    ]);

                    return {
                        games,
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
            logger.error('Error searching games:', { error: error.message, criteria });
            throw error;
        }
    }

    /**
     * Get game performance metrics
     * @param {string} gameId - Game ID
     * @param {string} timeframe - Timeframe for metrics (daily, weekly, monthly)
     * @returns {Promise<Object>} Game performance metrics
     */
    async getGameMetrics(gameId, timeframe = 'daily') {
        const cacheKey = `${this.getCacheKey(gameId)}:metrics:${timeframe}`;

        try {
            return await cache.getOrSet(
                cacheKey,
                async () => {
                    const game = await Game.findById(gameId).lean();
                    if (!game) {
                        throw new Error('Game not found');
                    }

                    // Calculate RTP
                    const rtp =
                        game.statistics.totalWagered === 0
                            ? 0
                            : (
                                  (game.statistics.totalWon / game.statistics.totalWagered) *
                                  100
                              ).toFixed(2);

                    // Calculate average bet
                    const avgBet =
                        game.statistics.totalPlays === 0
                            ? 0
                            : (game.statistics.totalWagered / game.statistics.totalPlays).toFixed(
                                  2
                              );

                    return {
                        rtp: parseFloat(rtp),
                        avgBet: parseFloat(avgBet),
                        totalPlays: game.statistics.totalPlays,
                        totalWagered: game.statistics.totalWagered,
                        totalWon: game.statistics.totalWon,
                        lastPlayed: game.statistics.lastPlayed,
                    };
                },
                300 // Cache for 5 minutes
            );
        } catch (error) {
            logger.error('Error getting game metrics:', {
                error: error.message,
                gameId,
                timeframe,
            });
            throw error;
        }
    }
}

module.exports = new GameService();
