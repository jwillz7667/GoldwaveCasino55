const Transaction = require('../models/Transaction');

class TransactionController {
    async getTransactions(req, res) {
        try {
            const { page = 1, limit = 20, type = 'all', userId, startDate, endDate } = req.query;

            // Build query
            const query = {};
            if (type !== 'all') {
                query.type = type;
            }
            if (userId) {
                query.userId = userId;
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
                .populate('userId', 'username')
                .populate('gameId', 'name type')
                .populate('processedBy', 'username');

            // Get total count
            const total = await Transaction.countDocuments(query);

            // Get summary statistics
            const summary = await Transaction.aggregate([
                {
                    $match: query,
                },
                {
                    $group: {
                        _id: '$type',
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
            ]);

            res.json({
                transactions,
                summary: summary.reduce((acc, curr) => {
                    acc[curr._id] = {
                        total: curr.total,
                        count: curr.count,
                    };
                    return acc;
                }, {}),
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async processTransaction(req, res) {
        try {
            const { transactionId } = req.params;

            // Get transaction
            const transaction = await Transaction.findById(transactionId);
            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            // Check if transaction can be processed
            if (transaction.status !== 'pending') {
                return res.status(400).json({ message: 'Transaction cannot be processed' });
            }

            // Process transaction
            await transaction.process(req.admin._id);

            // Log activity
            await req.admin.logActivity(
                'process_transaction',
                { transactionId },
                req.ip,
                req.headers['user-agent']
            );

            res.json({
                message: 'Transaction processed successfully',
                transaction,
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async reverseTransaction(req, res) {
        try {
            const { transactionId } = req.params;
            const { reason } = req.body;

            // Get transaction
            const transaction = await Transaction.findById(transactionId);
            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            // Check if transaction can be reversed
            if (transaction.status !== 'completed') {
                return res.status(400).json({ message: 'Transaction cannot be reversed' });
            }

            // Reverse transaction
            const reversal = await transaction.reverse(req.admin._id, reason);

            // Log activity
            await req.admin.logActivity(
                'reverse_transaction',
                { transactionId, reason },
                req.ip,
                req.headers['user-agent']
            );

            res.json({
                message: 'Transaction reversed successfully',
                transaction,
                reversal,
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getTransactionDetails(req, res) {
        try {
            const { transactionId } = req.params;

            // Get transaction with related data
            const transaction = await Transaction.findById(transactionId)
                .populate('userId', 'username profile')
                .populate('gameId', 'name type')
                .populate('gameSessionId')
                .populate('processedBy', 'username')
                .populate('notes.addedBy', 'username');

            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            res.json({ transaction });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async addTransactionNote(req, res) {
        try {
            const { transactionId } = req.params;
            const { content } = req.body;

            // Get transaction
            const transaction = await Transaction.findById(transactionId);
            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            // Add note
            transaction.notes.push({
                content,
                addedBy: req.admin._id,
            });

            await transaction.save();

            // Log activity
            await req.admin.logActivity(
                'add_transaction_note',
                { transactionId },
                req.ip,
                req.headers['user-agent']
            );

            res.json({
                message: 'Note added successfully',
                transaction,
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getTransactionStats(req, res) {
        try {
            const { startDate, endDate, groupBy = 'day' } = req.query;

            // Build date query
            const dateQuery = {};
            if (startDate || endDate) {
                dateQuery.createdAt = {};
                if (startDate) {
                    dateQuery.createdAt.$gte = new Date(startDate);
                }
                if (endDate) {
                    dateQuery.createdAt.$lte = new Date(endDate);
                }
            }

            // Build group stage based on groupBy parameter
            let groupStage = {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                },
            };

            if (groupBy === 'day') {
                groupStage._id.day = { $dayOfMonth: '$createdAt' };
            } else if (groupBy === 'hour') {
                groupStage._id = {
                    ...groupStage._id,
                    day: { $dayOfMonth: '$createdAt' },
                    hour: { $hour: '$createdAt' },
                };
            }

            // Get transaction statistics
            const stats = await Transaction.aggregate([
                {
                    $match: dateQuery,
                },
                {
                    $group: {
                        ...groupStage,
                        totalTransactions: { $sum: 1 },
                        totalAmount: { $sum: '$amount' },
                        types: {
                            $push: {
                                type: '$type',
                                amount: '$amount',
                            },
                        },
                    },
                },
                {
                    $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 },
                },
            ]);

            // Format response
            const formattedStats = stats.map((stat) => {
                const date = new Date(
                    stat._id.year,
                    stat._id.month - 1,
                    stat._id.day || 1,
                    stat._id.hour || 0
                );

                const typeStats = stat.types.reduce((acc, curr) => {
                    if (!acc[curr.type]) {
                        acc[curr.type] = {
                            count: 0,
                            total: 0,
                        };
                    }
                    acc[curr.type].count += 1;
                    acc[curr.type].total += curr.amount;
                    return acc;
                }, {});

                return {
                    date,
                    totalTransactions: stat.totalTransactions,
                    totalAmount: stat.totalAmount,
                    types: typeStats,
                };
            });

            res.json({ stats: formattedStats });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getPendingTransactions(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const query = { status: 'pending', userId: req.user._id };

            const transactions = await Transaction.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            const total = await Transaction.countDocuments(query);

            res.json({
                transactions,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getTransactionById(req, res) {
        try {
            const { transactionId } = req.params;
            const transaction = await Transaction.findOne({
                _id: transactionId,
                userId: req.user._id
            });

            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            res.json({ transaction });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async createDeposit(req, res) {
        try {
            const { amount, paymentMethod } = req.body;

            const deposit = new Transaction({
                type: 'deposit',
                amount,
                userId: req.user._id,
                paymentMethod,
                status: 'pending'
            });

            await deposit.save();
            res.json({ message: 'Deposit created successfully', transaction: deposit });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async verifyDeposit(req, res) {
        try {
            const { transactionId } = req.body;
            const deposit = await Transaction.findOne({
                _id: transactionId,
                userId: req.user._id,
                type: 'deposit',
                status: 'pending'
            });

            if (!deposit) {
                return res.status(404).json({ message: 'Deposit not found' });
            }

            deposit.status = 'completed';
            await deposit.save();

            // Update user balance
            await req.user.updateBalance(deposit.amount);

            res.json({ message: 'Deposit verified successfully', transaction: deposit });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async cancelDeposit(req, res) {
        try {
            const { transactionId } = req.body;
            const deposit = await Transaction.findOne({
                _id: transactionId,
                userId: req.user._id,
                type: 'deposit',
                status: 'pending'
            });

            if (!deposit) {
                return res.status(404).json({ message: 'Deposit not found' });
            }

            deposit.status = 'cancelled';
            await deposit.save();

            res.json({ message: 'Deposit cancelled successfully', transaction: deposit });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async createWithdrawal(req, res) {
        try {
            const { amount, paymentMethod } = req.body;

            // Check if user has sufficient balance
            if (req.user.balance < amount) {
                return res.status(400).json({ message: 'Insufficient balance' });
            }

            const withdrawal = new Transaction({
                type: 'withdrawal',
                amount: -amount,
                userId: req.user._id,
                paymentMethod,
                status: 'pending'
            });

            // Hold the amount
            await req.user.updateBalance(-amount);
            await withdrawal.save();

            res.json({ message: 'Withdrawal created successfully', transaction: withdrawal });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async verifyWithdrawal(req, res) {
        try {
            const { transactionId } = req.body;
            const withdrawal = await Transaction.findOne({
                _id: transactionId,
                userId: req.user._id,
                type: 'withdrawal',
                status: 'pending'
            });

            if (!withdrawal) {
                return res.status(404).json({ message: 'Withdrawal not found' });
            }

            withdrawal.status = 'completed';
            await withdrawal.save();

            res.json({ message: 'Withdrawal verified successfully', transaction: withdrawal });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async cancelWithdrawal(req, res) {
        try {
            const { transactionId } = req.body;
            const withdrawal = await Transaction.findOne({
                _id: transactionId,
                userId: req.user._id,
                type: 'withdrawal',
                status: 'pending'
            });

            if (!withdrawal) {
                return res.status(404).json({ message: 'Withdrawal not found' });
            }

            // Refund the held amount
            await req.user.updateBalance(-withdrawal.amount); // Note: amount is negative for withdrawals
            withdrawal.status = 'cancelled';
            await withdrawal.save();

            res.json({ message: 'Withdrawal cancelled successfully', transaction: withdrawal });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getDailySummary(req, res) {
        try {
            const summary = await Transaction.aggregate([
                { $match: { userId: req.user._id } },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" }
                        },
                        totalAmount: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } }
            ]);
            res.json({ summary });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getWeeklySummary(req, res) {
        try {
            const summary = await Transaction.aggregate([
                { $match: { userId: req.user._id } },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            week: { $week: "$createdAt" }
                        },
                        totalAmount: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": -1, "_id.week": -1 } }
            ]);
            res.json({ summary });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getMonthlySummary(req, res) {
        try {
            const summary = await Transaction.aggregate([
                { $match: { userId: req.user._id } },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" }
                        },
                        totalAmount: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": -1, "_id.month": -1 } }
            ]);
            res.json({ summary });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getPaymentMethods(req, res) {
        try {
            const paymentMethods = await req.user.getPaymentMethods();
            res.json({ paymentMethods });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async addPaymentMethod(req, res) {
        try {
            const { type, details } = req.body;
            const paymentMethod = await req.user.addPaymentMethod(type, details);
            res.json({ message: 'Payment method added successfully', paymentMethod });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async updatePaymentMethod(req, res) {
        try {
            const { methodId } = req.params;
            const { details } = req.body;
            const paymentMethod = await req.user.updatePaymentMethod(methodId, details);
            res.json({ message: 'Payment method updated successfully', paymentMethod });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async deletePaymentMethod(req, res) {
        try {
            const { methodId } = req.params;
            await req.user.deletePaymentMethod(methodId);
            res.json({ message: 'Payment method deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async getTransactionLimits(req, res) {
        try {
            const limits = await req.user.getTransactionLimits();
            res.json({ limits });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async verifyIdentity(req, res) {
        try {
            const { documents } = req.body;
            await req.user.submitIdentityVerification(documents);
            res.json({ message: 'Identity verification submitted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    async verifyAddress(req, res) {
        try {
            const { documents } = req.body;
            await req.user.submitAddressVerification(documents);
            res.json({ message: 'Address verification submitted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
}

module.exports = new TransactionController();
