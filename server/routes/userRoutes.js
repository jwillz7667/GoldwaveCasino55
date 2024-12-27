const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { authenticateUser } = require('../middleware/auth');

// Authentication routes
router.post('/register', UserController.register);
router.post('/login', UserController.login);
router.post('/logout', authenticateUser, UserController.logout);
router.post('/refresh-token', UserController.refreshToken);

// Profile routes
router.get('/profile', authenticateUser, UserController.getProfile);
router.put('/profile', authenticateUser, UserController.updateProfile);
router.put('/password', authenticateUser, UserController.updatePassword);

// Balance routes
router.get('/balance', authenticateUser, UserController.getBalance);
router.post('/deposit', authenticateUser, UserController.deposit);
router.post('/withdraw', authenticateUser, UserController.withdraw);

// Game history routes
router.get('/games/history', authenticateUser, UserController.getGameHistory);
router.get('/games/favorites', authenticateUser, UserController.getFavoriteGames);

// Transaction routes
router.get('/transactions', authenticateUser, UserController.getTransactions);
router.get('/transactions/:transactionId', authenticateUser, UserController.getTransactionById);

module.exports = router;
