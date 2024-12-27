const Game = require('../models/Game');
const GameSession = require('../models/GameSession');
const { uploadImage } = require('../utils/fileUpload');
const logger = require('../utils/logger');

class AdminGameController {
    async getGames(req, res) {
        try {
            const { page = 1, limit = 20, search = '', type = 'all' } = req.query;

            // Build query
            const query = {};
            if (type !== 'all') {
                query.type = type;
            }
            if (search) {
                query.name = { $regex: search, $options: 'i' };
            }

            // Get games with pagination
            const games = await Game.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            // Get total count
            const total = await Game.countDocuments(query);

            // Get active players count for each game
            const gamesWithStats = await Promise.all(
                games.map(async (game) => {
                    const activeSessions = await GameSession.countDocuments({
                        gameId: game._id,
                        status: 'active',
                    });

                    return {
                        ...game.toObject(),
                        activePlayers: activeSessions,
                    };
                })
            );

            res.json({
                games: gamesWithStats,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            });
        } catch (error) {
            logger.error('Error getting games:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getGameDetails(req, res) {
        try {
            const { gameId } = req.params;

            // Get game details
            const game = await Game.findById(gameId);
            if (!game) {
                return res.status(404).json({ message: 'Game not found' });
            }

            // Get game statistics
            const stats = await this.getGameStats(gameId);

            res.json({
                game,
                stats,
            });
        } catch (error) {
            logger.error('Error getting game details:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async createGame(req, res) {
        try {
            const { name, type, description, settings } = req.body;
            const thumbnail = req.files && req.files.thumbnail;

            // Check if game name already exists
            const existingGame = await Game.findOne({ name });
            if (existingGame) {
                return res.status(400).json({ message: 'Game name already exists' });
            }

            // Upload thumbnail if provided
            let thumbnailUrl = null;
            if (thumbnail) {
                thumbnailUrl = await uploadImage(thumbnail, 'games');
            }

            // Create game
            const game = new Game({
                name,
                type,
                description,
                thumbnail: thumbnailUrl,
                settings: JSON.parse(settings || '{}'),
                status: 'active',
                createdBy: req.admin._id,
            });

            await game.save();

            res.json({
                message: 'Game created successfully',
                game,
            });
        } catch (error) {
            logger.error('Error creating game:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async updateGame(req, res) {
        try {
            const { gameId } = req.params;
            const { name, type, description, settings, status } = req.body;
            const thumbnail = req.files && req.files.thumbnail;

            // Check if game exists
            const game = await Game.findById(gameId);
            if (!game) {
                return res.status(404).json({ message: 'Game not found' });
            }

            // Check if new name already exists
            if (name && name !== game.name) {
                const existingGame = await Game.findOne({ name });
                if (existingGame) {
                    return res.status(400).json({ message: 'Game name already exists' });
                }
            }

            // Upload new thumbnail if provided
            let thumbnailUrl = game.thumbnail;
            if (thumbnail) {
                thumbnailUrl = await uploadImage(thumbnail, 'games');
            }

            // Update game
            const updatedGame = await Game.findByIdAndUpdate(
                gameId,
                {
                    name: name || game.name,
                    type: type || game.type,
                    description: description || game.description,
                    thumbnail: thumbnailUrl,
                    settings: settings ? JSON.parse(settings) : game.settings,
                    status: status || game.status,
                    updatedBy: req.admin._id,
                },
                { new: true }
            );

            res.json({
                message: 'Game updated successfully',
                game: updatedGame,
            });
        } catch (error) {
            logger.error('Error updating game:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getGameStats(req, res) {
        try {
            const { gameId } = req.params;
            const { startDate, endDate } = req.query;

            // Parse date range
            const dateQuery = {};
            if (startDate) {
                dateQuery.createdAt = { $gte: new Date(startDate) };
            }
            if (endDate) {
                dateQuery.createdAt = { ...dateQuery.createdAt, $lte: new Date(endDate) };
            }

            // Get game session statistics
            const [sessionStats] = await GameSession.aggregate([
                {
                    $match: {
                        gameId,
                        ...dateQuery,
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalSessions: { $sum: 1 },
                        totalPlayers: { $addToSet: '$userId' },
                        totalWagered: { $sum: '$totalWagered' },
                        totalWon: { $sum: '$totalWon' },
                        averageSessionDuration: { $avg: '$duration' },
                    },
                },
            ]);

            // Get daily statistics
            const dailyStats = await GameSession.aggregate([
                {
                    $match: {
                        gameId,
                        ...dateQuery,
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        sessions: { $sum: 1 },
                        uniquePlayers: { $addToSet: '$userId' },
                        wagered: { $sum: '$totalWagered' },
                        won: { $sum: '$totalWon' },
                    },
                },
                {
                    $sort: { _id: 1 },
                },
            ]);

            // Format response
            const stats = {
                overview: {
                    totalSessions: sessionStats ? sessionStats.totalSessions : 0,
                    totalPlayers:
                        sessionStats && sessionStats.totalPlayers
                            ? sessionStats.totalPlayers.length
                            : 0,
                    totalWagered: sessionStats ? sessionStats.totalWagered : 0,
                    totalWon: sessionStats ? sessionStats.totalWon : 0,
                    averageSessionDuration: sessionStats ? sessionStats.averageSessionDuration : 0,
                    houseEdge: sessionStats
                        ? (
                              ((sessionStats.totalWagered - sessionStats.totalWon) /
                                  sessionStats.totalWagered) *
                              100
                          ).toFixed(2)
                        : 0,
                },
                daily: dailyStats.map((day) => ({
                    date: day._id,
                    sessions: day.sessions,
                    uniquePlayers: day.uniquePlayers.length,
                    wagered: day.wagered,
                    won: day.won,
                    revenue: day.wagered - day.won,
                })),
            };

            res.json(stats);
        } catch (error) {
            logger.error('Error getting game stats:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async toggleGameStatus(req, res) {
        try {
            const { gameId } = req.params;
            const { status } = req.body;

            // Update game status
            const game = await Game.findByIdAndUpdate(
                gameId,
                {
                    status,
                    updatedBy: req.admin._id,
                },
                { new: true }
            );

            if (!game) {
                return res.status(404).json({ message: 'Game not found' });
            }

            // If deactivating, end all active sessions
            if (status === 'inactive') {
                await GameSession.updateMany(
                    {
                        gameId,
                        status: 'active',
                    },
                    {
                        status: 'ended',
                        endedBy: 'admin',
                        endedAt: new Date(),
                    }
                );
            }

            res.json({
                message: `Game ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
                game,
            });
        } catch (error) {
            logger.error('Error toggling game status:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}

module.exports = new AdminGameController();
