const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameSession = require('../models/GameSession');

class AdminUserController {
    async getUsers(req, res) {
        try {
            const { page = 1, limit = 20, search = '', status = 'all' } = req.query;

            // Build query
            const query = {};
            if (status !== 'all') {
                query.status = status;
            }
            if (search) {
                query.$or = [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                ];
            }

            // Get users with pagination
            const users = await User.find(query)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            // Get total count
            const total = await User.countDocuments(query);

            res.json({
                users,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getUserDetails(req, res) {
        try {
            const { userId } = req.params;

            // Get user details
            const user = await User.findById(userId).select('-password');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Get user statistics
            const stats = await this.getUserStats(userId);

            res.json({
                user,
                stats,
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async createUser(req, res) {
        try {
            const { username, initialBalance = 0, notes } = req.body;

            // Check if username already exists
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ message: 'Username already exists' });
            }

            // Create user
            const user = new User({
                username,
                balance: initialBalance,
                notes,
                status: 'active',
                createdBy: req.admin._id,
            });

            await user.save();

            // Create initial balance transaction if needed
            if (initialBalance > 0) {
                await Transaction.create({
                    userId: user._id,
                    type: 'credit',
                    amount: initialBalance,
                    reason: 'initial_balance',
                    performedBy: req.admin._id,
                    notes: 'Initial balance on account creation',
                });
            }

            res.json({
                message: 'User created successfully',
                user: {
                    id: user._id,
                    username: user.username,
                    balance: user.balance,
                    status: user.status,
                },
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async updateUser(req, res) {
        try {
            const { userId } = req.params;
            const { status, notes } = req.body;

            // Update user
            const user = await User.findByIdAndUpdate(
                userId,
                {
                    status,
                    notes,
                    updatedBy: req.admin._id,
                },
                { new: true }
            ).select('-password');

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json({
                message: 'User updated successfully',
                user,
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async adjustBalance(req, res) {
        try {
            const { userId } = req.params;
            const { type, amount, reason, notes } = req.body;

            // Get user
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Validate amount
            if (amount <= 0) {
                return res.status(400).json({ message: 'Amount must be greater than 0' });
            }

            // Check if sufficient balance for deduction
            if (type === 'subtract' && user.balance < amount) {
                return res.status(400).json({ message: 'Insufficient balance' });
            }

            // Update balance
            const newBalance = type === 'add' ? user.balance + amount : user.balance - amount;

            await User.findByIdAndUpdate(userId, { balance: newBalance });

            // Create transaction record
            await Transaction.create({
                userId,
                type: type === 'add' ? 'credit' : 'debit',
                amount,
                reason,
                notes,
                performedBy: req.admin._id,
                balanceAfter: newBalance,
            });

            res.json({
                message: 'Balance adjusted successfully',
                newBalance,
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getUserTransactions(req, res) {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 20, type = 'all' } = req.query;

            // Build query
            const query = { userId };
            if (type !== 'all') {
                query.type = type;
            }

            // Get transactions with pagination
            const transactions = await Transaction.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('performedBy', 'username');

            // Get total count
            const total = await Transaction.countDocuments(query);

            res.json({
                transactions,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getUserGameHistory(req, res) {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 20 } = req.query;

            // Get game sessions with pagination
            const sessions = await GameSession.find({ userId })
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('gameId', 'name');

            // Get total count
            const total = await GameSession.countDocuments({ userId });

            res.json({
                sessions,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getUserStats(userId) {
        try {
            // Get transaction statistics
            const [transactionStats] = await Transaction.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: null,
                        totalDeposits: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0],
                            },
                        },
                        totalWithdrawals: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0],
                            },
                        },
                        transactionCount: { $sum: 1 },
                    },
                },
            ]);

            // Get game statistics
            const [gameStats] = await GameSession.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: null,
                        totalGames: { $sum: 1 },
                        totalWagered: { $sum: '$totalWagered' },
                        totalWon: { $sum: '$totalWon' },
                        winCount: {
                            $sum: {
                                $cond: [{ $gt: ['$totalWon', 0] }, 1, 0],
                            },
                        },
                    },
                },
            ]);

            return {
                transactions: transactionStats || {
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    transactionCount: 0,
                },
                games: gameStats || {
                    totalGames: 0,
                    totalWagered: 0,
                    totalWon: 0,
                    winCount: 0,
                },
                winRate: gameStats
                    ? ((gameStats.winCount / gameStats.totalGames) * 100).toFixed(2)
                    : 0,
            };
        } catch (error) {
            throw new Error(`Error getting user stats: ${error.message}`);
        }
    }
}

module.exports = new AdminUserController();
