const Admin = require('../models/Admin');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Game = require('../models/Game');
const jwt = require('jsonwebtoken');
const { generateTOTPSecret, verifyTOTP } = require('../utils/auth');
const logger = require('../utils/logger');

class AdminController {
    async login(req, res) {
        try {
            const { username, password, totpCode } = req.body;

            // Get admin with password
            const admin = await Admin.findOne({ username }).select('+password');
            if (!admin) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Validate password
            const isValidPassword = await admin.validatePassword(password);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Check 2FA if enabled
            if (admin.settings.twoFactorAuth.enabled) {
                if (!totpCode) {
                    return res.status(403).json({ message: '2FA code required' });
                }

                const isValidTOTP = verifyTOTP(admin.settings.twoFactorAuth.secret, totpCode);
                if (!isValidTOTP) {
                    return res.status(401).json({ message: 'Invalid 2FA code' });
                }
            }

            // Update login info
            await admin.updateLoginInfo(req.ip, req.headers['user-agent']);

            // Generate token
            const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
                expiresIn: '24h',
            });

            // Log activity
            await admin.logActivity('login', { success: true }, req.ip, req.headers['user-agent']);

            res.json({
                token,
                admin: {
                    id: admin._id,
                    username: admin.username,
                    role: admin.role,
                    profile: admin.profile,
                    permissions: admin.permissions,
                },
            });
        } catch (error) {
            logger.error('Error in admin login:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getDashboardStats(req, res) {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            // Get user statistics
            const [userStats] = await User.aggregate([
                {
                    $facet: {
                        total: [{ $count: 'count' }],
                        active: [{ $match: { status: 'active' } }, { $count: 'count' }],
                        new: [{ $match: { createdAt: { $gte: thisMonth } } }, { $count: 'count' }],
                    },
                },
            ]);

            // Get transaction statistics
            const [transactionStats] = await Transaction.aggregate([
                {
                    $facet: {
                        today: [
                            { $match: { createdAt: { $gte: today } } },
                            {
                                $group: {
                                    _id: '$type',
                                    total: { $sum: '$amount' },
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                        month: [
                            { $match: { createdAt: { $gte: thisMonth } } },
                            {
                                $group: {
                                    _id: '$type',
                                    total: { $sum: '$amount' },
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                    },
                },
            ]);

            // Get game statistics
            const [gameStats] = await Game.aggregate([
                {
                    $facet: {
                        total: [{ $count: 'count' }],
                        active: [{ $match: { status: 'active' } }, { $count: 'count' }],
                        popular: [
                            { $sort: { 'statistics.totalPlays': -1 } },
                            { $limit: 5 },
                            {
                                $project: {
                                    name: 1,
                                    type: 1,
                                    statistics: 1,
                                },
                            },
                        ],
                    },
                },
            ]);

            res.json({
                users: {
                    total: (userStats.total[0] && userStats.total[0].count) || 0,
                    active: (userStats.active[0] && userStats.active[0].count) || 0,
                    new: (userStats.new[0] && userStats.new[0].count) || 0,
                },
                transactions: {
                    today: transactionStats.today.reduce((acc, curr) => {
                        acc[curr._id] = {
                            total: curr.total,
                            count: curr.count,
                        };
                        return acc;
                    }, {}),
                    month: transactionStats.month.reduce((acc, curr) => {
                        acc[curr._id] = {
                            total: curr.total,
                            count: curr.count,
                        };
                        return acc;
                    }, {}),
                },
                games: {
                    total: (gameStats.total[0] && gameStats.total[0].count) || 0,
                    active: (gameStats.active[0] && gameStats.active[0].count) || 0,
                    popular: gameStats.popular || [],
                },
            });
        } catch (error) {
            logger.error('Error getting dashboard stats:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getAdmins(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const search = req.query.search || '';
            const role = req.query.role || 'all';

            // Build query
            const query = {};
            if (role !== 'all') {
                query.role = role;
            }
            if (search) {
                query.$or = [
                    { username: { $regex: search, $options: 'i' } },
                    { 'profile.email': { $regex: search, $options: 'i' } },
                    { 'profile.firstName': { $regex: search, $options: 'i' } },
                    { 'profile.lastName': { $regex: search, $options: 'i' } },
                ];
            }

            // Get admins with pagination
            const admins = await Admin.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            // Get total count
            const total = await Admin.countDocuments(query);

            res.json({
                admins,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            });
        } catch (error) {
            logger.error('Error getting admins:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async createAdmin(req, res) {
        try {
            const { username, password, role, profile } = req.body;

            // Check if username exists
            const existingAdmin = await Admin.findOne({ username });
            if (existingAdmin) {
                return res.status(400).json({ message: 'Username already exists' });
            }

            // Create admin
            const admin = new Admin({
                username,
                password,
                role,
                profile,
                createdBy: req.admin._id,
            });

            await admin.save();

            // Log activity
            await req.admin.logActivity(
                'create_admin',
                { adminId: admin._id },
                req.ip,
                req.headers['user-agent']
            );

            res.status(201).json({
                message: 'Admin created successfully',
                admin: {
                    id: admin._id,
                    username: admin.username,
                    role: admin.role,
                    profile: admin.profile,
                },
            });
        } catch (error) {
            logger.error('Error creating admin:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async updateAdmin(req, res) {
        try {
            const { adminId } = req.params;
            const { role, profile, status } = req.body;

            // Check if admin exists
            const admin = await Admin.findById(adminId);
            if (!admin) {
                return res.status(404).json({ message: 'Admin not found' });
            }

            // Prevent super_admin role modification
            if (admin.role === 'super_admin' && req.admin.role !== 'super_admin') {
                return res.status(403).json({ message: 'Cannot modify super admin' });
            }

            // Update admin
            Object.assign(admin, {
                role,
                profile,
                status,
                updatedBy: req.admin._id,
            });

            await admin.save();

            // Log activity
            await req.admin.logActivity(
                'update_admin',
                { adminId: admin._id },
                req.ip,
                req.headers['user-agent']
            );

            res.json({
                message: 'Admin updated successfully',
                admin: {
                    id: admin._id,
                    username: admin.username,
                    role: admin.role,
                    profile: admin.profile,
                    status: admin.status,
                },
            });
        } catch (error) {
            logger.error('Error updating admin:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async deleteAdmin(req, res) {
        try {
            const { adminId } = req.params;

            // Check if admin exists
            const admin = await Admin.findById(adminId);
            if (!admin) {
                return res.status(404).json({ message: 'Admin not found' });
            }

            // Prevent super_admin deletion
            if (admin.role === 'super_admin') {
                return res.status(403).json({ message: 'Cannot delete super admin' });
            }

            // Prevent self-deletion
            if (admin._id.toString() === req.admin._id.toString()) {
                return res.status(403).json({ message: 'Cannot delete own account' });
            }

            await admin.remove();

            // Log activity
            await req.admin.logActivity(
                'delete_admin',
                { adminId: admin._id },
                req.ip,
                req.headers['user-agent']
            );

            res.json({ message: 'Admin deleted successfully' });
        } catch (error) {
            logger.error('Error deleting admin:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async setup2FA(req, res) {
        try {
            const admin = await Admin.findById(req.admin._id);

            // Generate TOTP secret if not exists
            if (!admin.settings.twoFactorAuth.secret) {
                const { secret, qrCode } = await generateTOTPSecret(admin.username);
                admin.settings.twoFactorAuth.secret = secret;
                await admin.save();

                return res.json({
                    qrCode,
                    secret,
                });
            }

            res.status(400).json({ message: '2FA already set up' });
        } catch (error) {
            logger.error('Error setting up 2FA:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async verify2FA(req, res) {
        try {
            const { totpCode } = req.body;
            const admin = await Admin.findById(req.admin._id);

            // Verify TOTP code
            const isValid = verifyTOTP(admin.settings.twoFactorAuth.secret, totpCode);
            if (!isValid) {
                return res.status(401).json({ message: 'Invalid 2FA code' });
            }

            // Enable 2FA
            admin.settings.twoFactorAuth.enabled = true;
            await admin.save();

            // Log activity
            await admin.logActivity('enable_2fa', null, req.ip, req.headers['user-agent']);

            res.json({ message: '2FA enabled successfully' });
        } catch (error) {
            logger.error('Error verifying 2FA:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async logout(req, res) {
        try {
            // Log activity
            await req.admin.logActivity(
                'logout',
                { success: true },
                req.ip,
                req.headers['user-agent']
            );

            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            logger.error('Error in admin logout:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({ message: 'Refresh token required' });
            }

            const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
            const admin = await Admin.findById(decoded.id);

            if (!admin) {
                return res.status(401).json({ message: 'Invalid refresh token' });
            }

            const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
                expiresIn: '24h',
            });

            res.json({ token });
        } catch (error) {
            logger.error('Error refreshing token:', error);
            res.status(401).json({ message: 'Invalid refresh token' });
        }
    }

    async getProfile(req, res) {
        try {
            const admin = await Admin.findById(req.admin._id).select('-password');

            res.json(admin);
        } catch (error) {
            logger.error('Error getting admin profile:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async updateProfile(req, res) {
        try {
            const { profile } = req.body;

            const admin = await Admin.findByIdAndUpdate(
                req.admin._id,
                { profile },
                { new: true }
            ).select('-password');

            res.json(admin);
        } catch (error) {
            logger.error('Error updating admin profile:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async updatePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;

            const admin = await Admin.findById(req.admin._id).select('+password');

            const isValidPassword = await admin.validatePassword(currentPassword);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid current password' });
            }

            admin.password = newPassword;
            await admin.save();

            res.json({ message: 'Password updated successfully' });
        } catch (error) {
            logger.error('Error updating admin password:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async enable2FA(req, res) {
        try {
            const admin = await Admin.findById(req.admin._id);

            if (admin.settings.twoFactorAuth.enabled) {
                return res.status(400).json({ message: '2FA is already enabled' });
            }

            const secret = generateTOTPSecret();
            admin.settings.twoFactorAuth.secret = secret;
            await admin.save();

            res.json({
                secret,
                qrCode: `otpauth://totp/Casino:${admin.username}?secret=${secret}&issuer=Casino`,
            });
        } catch (error) {
            logger.error('Error enabling 2FA:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async disable2FA(req, res) {
        try {
            const admin = await Admin.findById(req.admin._id);

            admin.settings.twoFactorAuth.enabled = false;
            admin.settings.twoFactorAuth.secret = null;
            await admin.save();

            res.json({ message: '2FA disabled successfully' });
        } catch (error) {
            logger.error('Error disabling 2FA:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    // Add stubs for other required methods
    async getUsers(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getUserById(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async createUser(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async updateUser(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async deleteUser(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getGames(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getGameById(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async createGame(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async updateGame(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async deleteGame(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getTransactions(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getTransactionById(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async processTransaction(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async reverseTransaction(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getUsersReport(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getGamesReport(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getTransactionsReport(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getSystemHealth(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getSystemLogs(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async toggleMaintenance(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }

    async getActivityLogs(req, res) {
        res.status(501).json({ message: 'Not implemented' });
    }
}

// Export an instance of the controller
module.exports = new AdminController();
