const User = require('../models/User');
const Game = require('../models/Game');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

class AdminAnalyticsController {
    async getDashboardStats(req, res) {
        try {
            const [totalUsers, activeUsers, totalGames, totalTransactions] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({
                    lastActivityAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                }),
                Game.countDocuments(),
                Transaction.countDocuments(),
            ]);

            res.json({
                totalUsers,
                activeUsers,
                totalGames,
                totalTransactions,
            });
        } catch (error) {
            logger.error('Error getting dashboard stats:', { error: error.message });
            res.status(500).json({ message: 'Error fetching dashboard statistics' });
        }
    }

    async getUserActivity(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const query = {};

            if (startDate && endDate) {
                query.createdAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                };
            }

            const userActivity = await User.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            res.json(userActivity);
        } catch (error) {
            logger.error('Error getting user activity:', { error: error.message });
            res.status(500).json({ message: 'Error fetching user activity data' });
        }
    }

    async getGameStats(req, res) {
        try {
            const gameStats = await Game.aggregate([
                {
                    $group: {
                        _id: '$type',
                        totalGames: { $sum: 1 },
                        totalBets: { $sum: '$totalBets' },
                        totalWinnings: { $sum: '$totalWinnings' },
                    },
                },
            ]);

            res.json(gameStats);
        } catch (error) {
            logger.error('Error getting game stats:', { error: error.message });
            res.status(500).json({ message: 'Error fetching game statistics' });
        }
    }

    async getTransactionSummary(req, res) {
        try {
            const { period } = req.query;
            let dateFilter = {};

            switch (period) {
                case 'daily':
                    dateFilter = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
                    break;
                case 'weekly':
                    dateFilter = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
                    break;
                case 'monthly':
                    dateFilter = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
                    break;
                default:
                    dateFilter = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
            }

            const transactions = await Transaction.aggregate([
                {
                    $match: {
                        createdAt: dateFilter,
                    },
                },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount' },
                    },
                },
            ]);

            res.json(transactions);
        } catch (error) {
            logger.error('Error getting transaction summary:', { error: error.message });
            res.status(500).json({ message: 'Error fetching transaction summary' });
        }
    }

    async getRevenueAnalytics(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const query = {};

            if (startDate && endDate) {
                query.createdAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                };
            }

            const revenueData = await Transaction.aggregate([
                { $match: { ...query, type: 'deposit' } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        totalRevenue: { $sum: '$amount' },
                        transactionCount: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            res.json(revenueData);
        } catch (error) {
            logger.error('Error getting revenue analytics:', { error: error.message });
            res.status(500).json({ message: 'Error fetching revenue analytics' });
        }
    }

    async getUserAnalytics(req, res) {
        try {
            const { period = '7d' } = req.query;
            let dateFilter = new Date();

            switch (period) {
                case '24h':
                    dateFilter.setHours(dateFilter.getHours() - 24);
                    break;
                case '7d':
                    dateFilter.setDate(dateFilter.getDate() - 7);
                    break;
                case '30d':
                    dateFilter.setDate(dateFilter.getDate() - 30);
                    break;
                case '90d':
                    dateFilter.setDate(dateFilter.getDate() - 90);
                    break;
                default:
                    dateFilter.setDate(dateFilter.getDate() - 7);
            }

            const analytics = await User.aggregate([
                {
                    $facet: {
                        registrations: [
                            { $match: { createdAt: { $gte: dateFilter } } },
                            {
                                $group: {
                                    _id: {
                                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                                    },
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                        activity: [
                            { $match: { lastActivityAt: { $gte: dateFilter } } },
                            {
                                $group: {
                                    _id: {
                                        $dateToString: {
                                            format: '%Y-%m-%d',
                                            date: '$lastActivityAt',
                                        },
                                    },
                                    uniqueUsers: { $addToSet: '$_id' },
                                },
                            },
                            {
                                $project: {
                                    count: { $size: '$uniqueUsers' },
                                },
                            },
                        ],
                    },
                },
            ]);

            res.json(analytics[0]);
        } catch (error) {
            logger.error('Error getting user analytics:', { error: error.message });
            res.status(500).json({ message: 'Error fetching user analytics' });
        }
    }

    async getGameAnalytics(req, res) {
        try {
            const { period = '7d' } = req.query;
            let dateFilter = new Date();

            switch (period) {
                case '24h':
                    dateFilter.setHours(dateFilter.getHours() - 24);
                    break;
                case '7d':
                    dateFilter.setDate(dateFilter.getDate() - 7);
                    break;
                case '30d':
                    dateFilter.setDate(dateFilter.getDate() - 30);
                    break;
                case '90d':
                    dateFilter.setDate(dateFilter.getDate() - 90);
                    break;
                default:
                    dateFilter.setDate(dateFilter.getDate() - 7);
            }

            const analytics = await Game.aggregate([
                { $match: { createdAt: { $gte: dateFilter } } },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                            type: '$type',
                        },
                        gamesPlayed: { $sum: 1 },
                        totalBets: { $sum: '$totalBets' },
                        totalWinnings: { $sum: '$totalWinnings' },
                    },
                },
                {
                    $group: {
                        _id: '$_id.date',
                        games: {
                            $push: {
                                type: '$_id.type',
                                gamesPlayed: '$gamesPlayed',
                                totalBets: '$totalBets',
                                totalWinnings: '$totalWinnings',
                            },
                        },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            res.json(analytics);
        } catch (error) {
            logger.error('Error getting game analytics:', { error: error.message });
            res.status(500).json({ message: 'Error fetching game analytics' });
        }
    }

    async getTransactionAnalytics(req, res) {
        try {
            const { period = '7d' } = req.query;
            let dateFilter = new Date();

            switch (period) {
                case '24h':
                    dateFilter.setHours(dateFilter.getHours() - 24);
                    break;
                case '7d':
                    dateFilter.setDate(dateFilter.getDate() - 7);
                    break;
                case '30d':
                    dateFilter.setDate(dateFilter.getDate() - 30);
                    break;
                case '90d':
                    dateFilter.setDate(dateFilter.getDate() - 90);
                    break;
                default:
                    dateFilter.setDate(dateFilter.getDate() - 7);
            }

            const analytics = await Transaction.aggregate([
                { $match: { createdAt: { $gte: dateFilter } } },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                            type: '$type',
                        },
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount' },
                    },
                },
                {
                    $group: {
                        _id: '$_id.date',
                        transactions: {
                            $push: {
                                type: '$_id.type',
                                count: '$count',
                                totalAmount: '$totalAmount',
                            },
                        },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            res.json(analytics);
        } catch (error) {
            logger.error('Error getting transaction analytics:', { error: error.message });
            res.status(500).json({ message: 'Error fetching transaction analytics' });
        }
    }

    async exportData(req, res) {
        try {
            const { type } = req.params;
            const { startDate, endDate } = req.query;
            let data;

            switch (type) {
                case 'users':
                    data = await User.find({
                        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
                    }).select('-password -totpSecret');
                    break;
                case 'games':
                    data = await Game.find({
                        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
                    });
                    break;
                case 'transactions':
                    data = await Transaction.find({
                        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
                    });
                    break;
                default:
                    return res.status(400).json({ message: 'Invalid export type' });
            }

            res.json(data);
        } catch (error) {
            logger.error('Error exporting data:', { error: error.message });
            res.status(500).json({ message: 'Error exporting data' });
        }
    }
}

module.exports = new AdminAnalyticsController();
