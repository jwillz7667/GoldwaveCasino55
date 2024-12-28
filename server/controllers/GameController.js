const Game = require('../models/Game');
const GameSession = require('../models/GameSession');
const Transaction = require('../models/Transaction');
const { calculateWin, validateBet } = require('../utils/gameLogic');
const logger = require('../utils/logger');

class GameController {
    async getGames(req, res) {
        try {
            const { page = 1, limit = 20, type = 'all', search = '' } = req.query;

            // Build query
            const query = { status: 'active' };
            if (type !== 'all') {
                query.type = type;
            }
            if (search) {
                query.name = { $regex: search, $options: 'i' };
            }

            // Get games with pagination
            const games = await Game.find(query)
                .sort({ 'statistics.totalPlays': -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            // Get total count
            const total = await Game.countDocuments(query);

            res.json({
                games,
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

            // Check if game is active
            if (game.status !== 'active') {
                return res.status(403).json({ message: 'Game is not available' });
            }

            res.json({ game });
        } catch (error) {
            logger.error('Error getting game details:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async startGameSession(req, res) {
        try {
            const { gameId } = req.params;

            // Get game
            const game = await Game.findById(gameId);
            if (!game) {
                return res.status(404).json({ message: 'Game not found' });
            }

            // Check if game is active
            if (game.status !== 'active') {
                return res.status(403).json({ message: 'Game is not available' });
            }

            // Check for existing active session
            const existingSession = await GameSession.findOne({
                userId: req.user._id,
                gameId,
                status: 'active',
            });

            if (existingSession) {
                return res.json({ session: existingSession });
            }

            // Create new session
            const session = new GameSession({
                userId: req.user._id,
                gameId,
                clientInfo: {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    device: req.headers['user-agent'],
                },
            });

            await session.save();

            res.json({ session });
        } catch (error) {
            logger.error('Error starting game session:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async placeBet(req, res) {
        try {
            const { gameId } = req.params;
            const { sessionId, bet } = req.body;

            // Validate session
            const session = await GameSession.findOne({
                _id: sessionId,
                userId: req.user._id,
                gameId,
                status: 'active',
            });

            if (!session) {
                return res.status(404).json({ message: 'Invalid session' });
            }

            // Validate bet
            const validationError = validateBet(bet);
            if (validationError) {
                return res.status(400).json({ message: validationError });
            }

            // Check user balance
            if (req.user.balance < bet.amount) {
                return res.status(400).json({ message: 'Insufficient balance' });
            }

            // Process bet transaction
            const betTransaction = new Transaction({
                userId: req.user._id,
                type: 'bet',
                amount: -bet.amount,
                gameId,
                gameSessionId: session._id,
                reference: `BET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                description: `Bet on ${session.gameId}`,
                balanceBefore: req.user.balance,
                balanceAfter: req.user.balance - bet.amount,
            });

            // Calculate win
            const result = await calculateWin(bet, session);

            // Process win transaction if applicable
            let winTransaction = null;
            if (result.winAmount > 0) {
                winTransaction = new Transaction({
                    userId: req.user._id,
                    type: 'win',
                    amount: result.winAmount,
                    gameId,
                    gameSessionId: session._id,
                    reference: `WIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    description: `Win on ${session.gameId}`,
                    balanceBefore: req.user.balance - bet.amount,
                    balanceAfter: req.user.balance - bet.amount + result.winAmount,
                });
            }

            // Add round to session
            await session.addRound(bet, result);

            // Update user balance and statistics
            await req.user.updateGameStats(gameId, bet.amount, result.winAmount);

            // Save all changes
            await Promise.all([
                betTransaction.save(),
                ...(winTransaction ? [winTransaction.save()] : []),
                session.save(),
                req.user.save(),
            ]);

            res.json({
                result,
                balance: req.user.balance - bet.amount + (result.winAmount || 0),
            });
        } catch (error) {
            logger.error('Error placing bet:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async endGameSession(req, res) {
        try {
            const { sessionId } = req.params;

            // Get session
            const session = await GameSession.findOne({
                _id: sessionId,
                userId: req.user._id,
                status: 'active',
            });

            if (!session) {
                return res.status(404).json({ message: 'Session not found' });
            }

            // End session
            await session.endSession('user');

            res.json({
                message: 'Session ended successfully',
                session,
            });
        } catch (error) {
            logger.error('Error ending game session:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getActiveGames(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const games = await Game.find({ status: 'active' })
                .sort({ 'statistics.totalPlays': -1 })
                .skip((page - 1) * limit)
                .limit(limit);
            const total = await Game.countDocuments({ status: 'active' });
            res.json({
                games,
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit)
            });
        } catch (error) {
            logger.error('Error in getActiveGames:', error);
            res.status(500).json({ error: 'Failed to fetch active games' });
        }
    }

    async getPopularGames(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const games = await Game.find({ status: 'active' })
                .sort({ 'statistics.totalPlays': -1 })
                .skip((page - 1) * limit)
                .limit(limit);
            const total = await Game.countDocuments({ status: 'active' });
            res.json({
                games,
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit)
            });
        } catch (error) {
            logger.error('Error in getPopularGames:', error);
            res.status(500).json({ error: 'Failed to fetch popular games' });
        }
    }

    async getNewGames(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const games = await Game.find({ status: 'active' })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);
            const total = await Game.countDocuments({ status: 'active' });
            res.json({
                games,
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit)
            });
        } catch (error) {
            logger.error('Error in getNewGames:', error);
            res.status(500).json({ error: 'Failed to fetch new games' });
        }
    }

    async getGameById(req, res) {
        try {
            const { gameId } = req.params;
            const game = await Game.findById(gameId);
            if (!game) {
                return res.status(404).json({ error: 'Game not found' });
            }
            res.json(game);
        } catch (error) {
            logger.error('Error in getGameById:', error);
            res.status(500).json({ error: 'Failed to fetch game details' });
        }
    }

    async getGameStats(req, res) {
        try {
            const { gameId } = req.params;
            const game = await Game.findById(gameId);
            if (!game) {
                return res.status(404).json({ error: 'Game not found' });
            }
            res.json(game.statistics);
        } catch (error) {
            logger.error('Error in getGameStats:', error);
            res.status(500).json({ error: 'Failed to fetch game statistics' });
        }
    }

    async getGameSessions(req, res) {
        try {
            const { gameId } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const sessions = await GameSession.find({ gameId, userId: req.user._id })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('gameId', 'name type');
            const total = await GameSession.countDocuments({ gameId, userId: req.user._id });
            res.json({
                sessions,
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit)
            });
        } catch (error) {
            logger.error('Error in getGameSessions:', error);
            res.status(500).json({ error: 'Failed to fetch game sessions' });
        }
    }

    async getGameSessionById(req, res) {
        try {
            const { gameId, sessionId } = req.params;
            const session = await GameSession.findOne({
                _id: sessionId,
                gameId,
                userId: req.user._id
            }).populate('gameId', 'name type');
            if (!session) {
                return res.status(404).json({ error: 'Game session not found' });
            }
            res.json(session);
        } catch (error) {
            logger.error('Error in getGameSessionById:', error);
            res.status(500).json({ error: 'Failed to fetch game session details' });
        }
    }

    async spin(req, res) {
        try {
            const { gameId } = req.params;
            const { sessionId } = req.body;

            // Validate session
            const session = await GameSession.findOne({
                _id: sessionId,
                userId: req.user._id,
                gameId,
                status: 'active',
            });

            if (!session) {
                return res.status(404).json({ message: 'Invalid session' });
            }

            // Process the spin action using the placeBet logic since it's essentially the same
            return await this.placeBet(req, res);
        } catch (error) {
            logger.error('Error processing spin:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async deal(req, res) {
        try {
            const { gameId } = req.params;
            const { sessionId } = req.body;

            // Validate session
            const session = await GameSession.findOne({
                _id: sessionId,
                userId: req.user._id,
                gameId,
                status: 'active',
            });

            if (!session) {
                return res.status(404).json({ message: 'Invalid session' });
            }

            // Process the deal action using the placeBet logic since it's essentially the same
            return await this.placeBet(req, res);
        } catch (error) {
            logger.error('Error processing deal:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async hit(req, res) {
        try {
            const { gameId } = req.params;
            const { sessionId } = req.body;

            // Validate session
            const session = await GameSession.findOne({
                _id: sessionId,
                userId: req.user._id,
                gameId,
                status: 'active',
            });

            if (!session) {
                return res.status(404).json({ message: 'Invalid session' });
            }

            // Get the current game round
            const currentRound = session.rounds[session.rounds.length - 1];
            if (!currentRound || currentRound.status !== 'active') {
                return res.status(400).json({ message: 'No active round found' });
            }

            // Process hit action
            const result = await calculateWin({ ...currentRound.bet, action: 'hit' }, session);
            
            // Update round with hit result
            await session.updateRound(result);
            await session.save();

            res.json({ result });
        } catch (error) {
            logger.error('Error processing hit:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async stand(req, res) {
        try {
            const { gameId } = req.params;
            const { sessionId } = req.body;

            // Validate session
            const session = await GameSession.findOne({
                _id: sessionId,
                userId: req.user._id,
                gameId,
                status: 'active',
            });

            if (!session) {
                return res.status(404).json({ message: 'Invalid session' });
            }

            // Get the current game round
            const currentRound = session.rounds[session.rounds.length - 1];
            if (!currentRound || currentRound.status !== 'active') {
                return res.status(400).json({ message: 'No active round found' });
            }

            // Process stand action
            const result = await calculateWin({ ...currentRound.bet, action: 'stand' }, session);
            
            // Update round with stand result
            await session.updateRound(result);
            await session.save();

            // Process win transaction if applicable
            if (result.winAmount > 0) {
                const winTransaction = new Transaction({
                    userId: req.user._id,
                    type: 'win',
                    amount: result.winAmount,
                    gameId,
                    gameSessionId: session._id,
                    reference: `WIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    description: `Win on ${session.gameId}`,
                    balanceBefore: req.user.balance,
                    balanceAfter: req.user.balance + result.winAmount,
                });
                await winTransaction.save();
                await req.user.updateBalance(result.winAmount);
            }

            res.json({
                result,
                balance: req.user.balance
            });
        } catch (error) {
            logger.error('Error processing stand:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async double(req, res) {
        try {
            const { gameId } = req.params;
            const { sessionId } = req.body;

            // Validate session
            const session = await GameSession.findOne({
                _id: sessionId,
                userId: req.user._id,
                gameId,
                status: 'active',
            });

            if (!session) {
                return res.status(404).json({ message: 'Invalid session' });
            }

            // Get the current game round
            const currentRound = session.rounds[session.rounds.length - 1];
            if (!currentRound || currentRound.status !== 'active') {
                return res.status(400).json({ message: 'No active round found' });
            }

            // Check if user has enough balance to double
            const doubleAmount = currentRound.bet.amount;
            if (req.user.balance < doubleAmount) {
                return res.status(400).json({ message: 'Insufficient balance for double' });
            }

            // Process double bet transaction
            const doubleBetTransaction = new Transaction({
                userId: req.user._id,
                type: 'bet',
                amount: -doubleAmount,
                gameId,
                gameSessionId: session._id,
                reference: `DOUBLE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                description: `Double down on ${session.gameId}`,
                balanceBefore: req.user.balance,
                balanceAfter: req.user.balance - doubleAmount,
            });

            // Process double action
            const result = await calculateWin({ 
                ...currentRound.bet, 
                amount: currentRound.bet.amount * 2,
                action: 'double' 
            }, session);
            
            // Update round with double result
            await session.updateRound(result);

            // Process win transaction if applicable
            if (result.winAmount > 0) {
                const winTransaction = new Transaction({
                    userId: req.user._id,
                    type: 'win',
                    amount: result.winAmount,
                    gameId,
                    gameSessionId: session._id,
                    reference: `WIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    description: `Win on ${session.gameId}`,
                    balanceBefore: req.user.balance - doubleAmount,
                    balanceAfter: req.user.balance - doubleAmount + result.winAmount,
                });
                await winTransaction.save();
            }

            // Save all changes
            await Promise.all([
                doubleBetTransaction.save(),
                session.save(),
                req.user.updateBalance(-doubleAmount + (result.winAmount || 0))
            ]);

            res.json({
                result,
                balance: req.user.balance - doubleAmount + (result.winAmount || 0)
            });
        } catch (error) {
            logger.error('Error processing double:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async split(req, res) {
        try {
            const { gameId } = req.params;
            const { sessionId } = req.body;

            // Validate session
            const session = await GameSession.findOne({
                _id: sessionId,
                userId: req.user._id,
                gameId,
                status: 'active',
            });

            if (!session) {
                return res.status(404).json({ message: 'Invalid session' });
            }

            // Get the current game round
            const currentRound = session.rounds[session.rounds.length - 1];
            if (!currentRound || currentRound.status !== 'active') {
                return res.status(400).json({ message: 'No active round found' });
            }

            // Check if split is possible
            if (!currentRound.canSplit) {
                return res.status(400).json({ message: 'Split not possible with current hand' });
            }

            // Check if user has enough balance to split
            const splitAmount = currentRound.bet.amount;
            if (req.user.balance < splitAmount) {
                return res.status(400).json({ message: 'Insufficient balance for split' });
            }

            // Process split bet transaction
            const splitBetTransaction = new Transaction({
                userId: req.user._id,
                type: 'bet',
                amount: -splitAmount,
                gameId,
                gameSessionId: session._id,
                reference: `SPLIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                description: `Split bet on ${session.gameId}`,
                balanceBefore: req.user.balance,
                balanceAfter: req.user.balance - splitAmount,
            });

            // Process split action
            const result = await calculateWin({ 
                ...currentRound.bet,
                action: 'split' 
            }, session);
            
            // Update round with split result
            await session.updateRound(result);

            // Save all changes
            await Promise.all([
                splitBetTransaction.save(),
                session.save(),
                req.user.updateBalance(-splitAmount)
            ]);

            res.json({
                result,
                balance: req.user.balance - splitAmount
            });
        } catch (error) {
            logger.error('Error processing split:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getGameSettings(req, res) {
        try {
            const { gameId } = req.params;
            
            // Get game
            const game = await Game.findById(gameId);
            if (!game) {
                return res.status(404).json({ message: 'Game not found' });
            }

            // Get user-specific settings if they exist
            const userSettings = await GameSession.findOne({ 
                userId: req.user._id,
                gameId,
                status: 'active'
            }).select('settings').lean();

            // Combine default game settings with user settings
            const settings = {
                ...game.defaultSettings,
                ...(userSettings?.settings || {})
            };

            res.json({ settings });
        } catch (error) {
            logger.error('Error getting game settings:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async updateGameSettings(req, res) {
        try {
            const { gameId } = req.params;
            const { settings } = req.body;

            // Get game
            const game = await Game.findById(gameId);
            if (!game) {
                return res.status(404).json({ message: 'Game not found' });
            }

            // Validate settings against game's allowed settings
            const validationError = game.validateSettings(settings);
            if (validationError) {
                return res.status(400).json({ message: validationError });
            }

            // Find or create user's active session
            let session = await GameSession.findOne({
                userId: req.user._id,
                gameId,
                status: 'active'
            });

            if (!session) {
                session = new GameSession({
                    userId: req.user._id,
                    gameId,
                    settings,
                    clientInfo: {
                        ip: req.ip,
                        userAgent: req.headers['user-agent'],
                        device: req.headers['user-agent']
                    }
                });
            } else {
                session.settings = {
                    ...session.settings,
                    ...settings
                };
            }

            await session.save();

            res.json({ 
                message: 'Settings updated successfully',
                settings: session.settings
            });
        } catch (error) {
            logger.error('Error updating game settings:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async addToFavorites(req, res) {
        try {
            const { gameId } = req.params;

            // Check if game exists
            const game = await Game.findById(gameId);
            if (!game) {
                return res.status(404).json({ message: 'Game not found' });
            }

            // Add to user's favorites if not already added
            const user = await req.user.populate('favorites');
            if (!user.favorites.includes(gameId)) {
                user.favorites.push(gameId);
                await user.save();
            }

            res.json({ message: 'Game added to favorites', favorites: user.favorites });
        } catch (error) {
            logger.error('Error adding game to favorites:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async removeFromFavorites(req, res) {
        try {
            const { gameId } = req.params;

            // Remove from user's favorites
            const user = await req.user.populate('favorites');
            user.favorites = user.favorites.filter(id => id.toString() !== gameId);
            await user.save();

            res.json({ message: 'Game removed from favorites', favorites: user.favorites });
        } catch (error) {
            logger.error('Error removing game from favorites:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}

module.exports = new GameController();
