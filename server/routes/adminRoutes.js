const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const { authenticateAdmin, requirePermission } = require('../middleware/auth');

// Admin authentication routes
router.post('/login', AdminController.login);
router.post('/logout', authenticateAdmin, AdminController.logout);
router.post('/refresh-token', AdminController.refreshToken);

// Admin profile routes
router.get('/profile', authenticateAdmin, AdminController.getProfile);
router.put('/profile', authenticateAdmin, AdminController.updateProfile);
router.put('/password', authenticateAdmin, AdminController.updatePassword);

// 2FA routes
router.post('/2fa/enable', authenticateAdmin, AdminController.enable2FA);
router.post('/2fa/verify', authenticateAdmin, AdminController.verify2FA);
router.post('/2fa/disable', authenticateAdmin, AdminController.disable2FA);

// User management routes
router.get(
    '/users',
    authenticateAdmin,
    requirePermission('users', 'view'),
    AdminController.getUsers
);

router.get(
    '/users/:userId',
    authenticateAdmin,
    requirePermission('users', 'view'),
    AdminController.getUserById
);

router.post(
    '/users',
    authenticateAdmin,
    requirePermission('users', 'create'),
    AdminController.createUser
);

router.put(
    '/users/:userId',
    authenticateAdmin,
    requirePermission('users', 'edit'),
    AdminController.updateUser
);

router.delete(
    '/users/:userId',
    authenticateAdmin,
    requirePermission('users', 'delete'),
    AdminController.deleteUser
);

// Game management routes
router.get(
    '/games',
    authenticateAdmin,
    requirePermission('games', 'view'),
    AdminController.getGames
);

router.get(
    '/games/:gameId',
    authenticateAdmin,
    requirePermission('games', 'view'),
    AdminController.getGameById
);

router.post(
    '/games',
    authenticateAdmin,
    requirePermission('games', 'create'),
    AdminController.createGame
);

router.put(
    '/games/:gameId',
    authenticateAdmin,
    requirePermission('games', 'edit'),
    AdminController.updateGame
);

router.delete(
    '/games/:gameId',
    authenticateAdmin,
    requirePermission('games', 'delete'),
    AdminController.deleteGame
);

// Transaction management routes
router.get(
    '/transactions',
    authenticateAdmin,
    requirePermission('transactions', 'view'),
    AdminController.getTransactions
);

router.get(
    '/transactions/:transactionId',
    authenticateAdmin,
    requirePermission('transactions', 'view'),
    AdminController.getTransactionById
);

router.post(
    '/transactions/:transactionId/process',
    authenticateAdmin,
    requirePermission('transactions', 'process'),
    AdminController.processTransaction
);

router.post(
    '/transactions/:transactionId/reverse',
    authenticateAdmin,
    requirePermission('transactions', 'reverse'),
    AdminController.reverseTransaction
);

// Report routes
router.get(
    '/reports/users',
    authenticateAdmin,
    requirePermission('reports', 'view'),
    AdminController.getUsersReport
);

router.get(
    '/reports/games',
    authenticateAdmin,
    requirePermission('reports', 'view'),
    AdminController.getGamesReport
);

router.get(
    '/reports/transactions',
    authenticateAdmin,
    requirePermission('reports', 'view'),
    AdminController.getTransactionsReport
);

// System management routes
router.get(
    '/system/health',
    authenticateAdmin,
    requirePermission('system', 'view'),
    AdminController.getSystemHealth
);

router.get(
    '/system/logs',
    authenticateAdmin,
    requirePermission('system', 'view_logs'),
    AdminController.getSystemLogs
);

router.post(
    '/system/maintenance',
    authenticateAdmin,
    requirePermission('system', 'manage_settings'),
    AdminController.toggleMaintenance
);

// Admin management routes
router.get(
    '/admins',
    authenticateAdmin,
    requirePermission('system', 'manage_admins'),
    AdminController.getAdmins
);

router.post(
    '/admins',
    authenticateAdmin,
    requirePermission('system', 'manage_admins'),
    AdminController.createAdmin
);

router.put(
    '/admins/:adminId',
    authenticateAdmin,
    requirePermission('system', 'manage_admins'),
    AdminController.updateAdmin
);

router.delete(
    '/admins/:adminId',
    authenticateAdmin,
    requirePermission('system', 'manage_admins'),
    AdminController.deleteAdmin
);

// Activity logs
router.get('/activity', authenticateAdmin, AdminController.getActivityLogs);

module.exports = router;
