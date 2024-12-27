const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameSession = require('../models/GameSession');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class UserController {
    async register(req, res) {
        try {
            const { username, password, profile } = req.body;

            // Check if username exists
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ message: 'Username already exists' });
            }

            // Create user
            const user = new User({
                username,
                password,
                profile,
            });

            await user.save();

            // Generate token
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

            res.status(201).json({
                message: 'User registered successfully',
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    profile: user.profile,
                },
            });
        } catch (error) {
            logger.error('Error in user registration:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async login(req, res) {
        try {
            const { username, password } = req.body;

            // Get user with password
            const user = await User.findOne({ username }).select('+password');
            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Check if user is active
            if (user.status !== 'active') {
                return res.status(403).json({ message: 'Account is not active' });
            }

            // Validate password
            const isValidPassword = await user.validatePassword(password);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Update login info
            await user.updateLoginInfo(req.ip, req.headers['user-agent']);

            // Generate token
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

            res.json({
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    balance: user.balance,
                    profile: user.profile,
                    preferences: user.preferences,
                },
            });
        } catch (error) {
            logger.error('Error in user login:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async logout(req, res) {
        try {
            // Update last logout time
            await User.findByIdAndUpdate(req.user._id, {
                lastLogout: new Date(),
            });

            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            logger.error('Error in user logout:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async refreshToken(req, res) {
        try {
            const { token } = req.body;

            // Verify existing token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Generate new token
            const newToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, {
                expiresIn: '24h',
            });

            res.json({ token: newToken });
        } catch (error) {
            logger.error('Error refreshing token:', error);
            res.status(401).json({ message: 'Invalid token' });
        }
    }

    async getProfile(req, res) {
        try {
            const user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json({
                profile: user.profile,
                preferences: user.preferences,
                statistics: user.statistics,
                balance: user.balance,
            });
        } catch (error) {
            logger.error('Error getting user profile:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async updateProfile(req, res) {
        try {
            const updates = req.body;
            const user = await User.findById(req.user._id);

            // Update profile fields
            if (updates.profile) {
                Object.keys(updates.profile).forEach((key) => {
                    user.profile[key] = updates.profile[key];
                });
            }

            // Update preferences
            if (updates.preferences) {
                Object.keys(updates.preferences).forEach((key) => {
                    user.preferences[key] = updates.preferences[key];
                });
            }

            await user.save();

            res.json({
                message: 'Profile updated successfully',
                profile: user.profile,
                preferences: user.preferences,
            });
        } catch (error) {
            logger.error('Error updating user profile:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async updatePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;

            // Get user with password
            const user = await User.findById(req.user._id).select('+password');

            // Validate current password
            const isValidPassword = await user.validatePassword(currentPassword);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid current password' });
            }

            // Update password
            user.password = newPassword;
            await user.save();

            res.json({ message: 'Password updated successfully' });
        } catch (error) {
            logger.error('Error updating password:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getBalance(req, res) {
        try {
            const user = await User.findById(req.user._id);
            res.json({ balance: user.balance });
        } catch (error) {
            logger.error('Error getting balance:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async deposit(req, res) {
        try {
            const { amount, method, transactionId } = req.body;

            // Validate amount
            if (amount <= 0) {
                return res.status(400).json({ message: 'Invalid amount' });
            }

            // Create transaction
            const transaction = new Transaction({
                userId: req.user._id,
                type: 'deposit',
                amount,
                method,
                externalTransactionId: transactionId,
                status: 'pending',
            });

            await transaction.save();

            // Process deposit (implement payment gateway integration here)
            // For now, we'll just update the balance directly
            const user = await User.findById(req.user._id);
            user.balance += amount;
            await user.save();

            // Update transaction status
            transaction.status = 'completed';
            await transaction.save();

            res.json({
                message: 'Deposit successful',
                transaction: {
                    id: transaction._id,
                    amount,
                    type: 'deposit',
                    status: 'completed',
                    timestamp: transaction.createdAt,
                },
                newBalance: user.balance,
            });
        } catch (error) {
            logger.error('Error processing deposit:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async withdraw(req, res) {
        try {
            const { amount, method, withdrawalAddress } = req.body;

            // Validate amount
            if (amount <= 0) {
                return res.status(400).json({ message: 'Invalid amount' });
            }

            // Check balance
            const user = await User.findById(req.user._id);
            if (user.balance < amount) {
                return res.status(400).json({ message: 'Insufficient balance' });
            }

            // Create transaction
            const transaction = new Transaction({
                userId: req.user._id,
                type: 'withdrawal',
                amount,
                method,
                withdrawalAddress,
                status: 'pending',
            });

            await transaction.save();

            // Process withdrawal (implement payment gateway integration here)
            // For now, we'll just update the balance directly
            user.balance -= amount;
            await user.save();

            // Update transaction status
            transaction.status = 'completed';
            await transaction.save();

            res.json({
                message: 'Withdrawal successful',
                transaction: {
                    id: transaction._id,
                    amount,
                    type: 'withdrawal',
                    status: 'completed',
                    timestamp: transaction.createdAt,
                },
                newBalance: user.balance,
            });
        } catch (error) {
            logger.error('Error processing withdrawal:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getGameHistory(req, res) {
        try {
            const { page = 1, limit = 20, gameId, startDate, endDate } = req.query;

            // Build query
            const query = { userId: req.user._id };
            if (gameId) {
                query.gameId = gameId;
            }
            if (startDate || endDate) {
                query.startedAt = {};
                if (startDate) {
                    query.startedAt.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.startedAt.$lte = new Date(endDate);
                }
            }

            // Get game sessions with pagination
            const sessions = await GameSession.find(query)
                .sort({ startedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('gameId', 'name type');

            // Get total count
            const total = await GameSession.countDocuments(query);

            // Get summary statistics
            const summary = await GameSession.aggregate([
                {
                    $match: query,
                },
                {
                    $group: {
                        _id: null,
                        totalSessions: { $sum: 1 },
                        totalWagered: { $sum: '$totalWagered' },
                        totalWon: { $sum: '$totalWon' },
                        averageDuration: { $avg: '$duration' },
                    },
                },
            ]);

            res.json({
                sessions,
                summary: summary[0] || {
                    totalSessions: 0,
                    totalWagered: 0,
                    totalWon: 0,
                    averageDuration: 0,
                },
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            });
        } catch (error) {
            logger.error('Error getting game history:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getFavoriteGames(req, res) {
        try {
            const user = await User.findById(req.user._id).populate(
                'favoriteGames',
                'name type description thumbnail'
            );

            res.json({ favoriteGames: user.favoriteGames });
        } catch (error) {
            logger.error('Error getting favorite games:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getTransactions(req, res) {
        try {
            const { page = 1, limit = 20, type = 'all', startDate, endDate } = req.query;

            // Build query
            const query = { userId: req.user._id };
            if (type !== 'all') {
                query.type = type;
            }
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) {
                    query.createdAt.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.createdAt.$lte = new Date(endDate);
                }
            }

            // Get transactions with pagination
            const transactions = await Transaction.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('gameId', 'name type');

            // Get total count
            const total = await Transaction.countDocuments(query);

            res.json({
                transactions,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            });
        } catch (error) {
            logger.error('Error getting transactions:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getTransactionById(req, res) {
        try {
            const { transactionId } = req.params;

            const transaction = await Transaction.findOne({
                _id: transactionId,
                userId: req.user._id,
            }).populate('gameId', 'name type');

            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            res.json({ transaction });
        } catch (error) {
            logger.error('Error getting transaction:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}

module.exports = new UserController();
