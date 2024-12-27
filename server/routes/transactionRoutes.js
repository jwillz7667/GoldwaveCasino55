const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/TransactionController');
const { authenticateUser } = require('../middleware/auth');

// Transaction listing routes
router.get('/', authenticateUser, TransactionController.getTransactions);
router.get('/pending', authenticateUser, TransactionController.getPendingTransactions);
router.get('/:transactionId', authenticateUser, TransactionController.getTransactionById);

// Deposit routes
router.post('/deposit', authenticateUser, TransactionController.createDeposit);
router.post('/deposit/verify', authenticateUser, TransactionController.verifyDeposit);
router.post('/deposit/cancel', authenticateUser, TransactionController.cancelDeposit);

// Withdrawal routes
router.post('/withdraw', authenticateUser, TransactionController.createWithdrawal);
router.post('/withdraw/verify', authenticateUser, TransactionController.verifyWithdrawal);
router.post('/withdraw/cancel', authenticateUser, TransactionController.cancelWithdrawal);

// Transaction summary routes
router.get('/summary/daily', authenticateUser, TransactionController.getDailySummary);
router.get('/summary/weekly', authenticateUser, TransactionController.getWeeklySummary);
router.get('/summary/monthly', authenticateUser, TransactionController.getMonthlySummary);

// Payment method routes
router.get('/payment-methods', authenticateUser, TransactionController.getPaymentMethods);
router.post('/payment-methods', authenticateUser, TransactionController.addPaymentMethod);
router.put(
    '/payment-methods/:methodId',
    authenticateUser,
    TransactionController.updatePaymentMethod
);
router.delete(
    '/payment-methods/:methodId',
    authenticateUser,
    TransactionController.deletePaymentMethod
);

// Limits and verification routes
router.get('/limits', authenticateUser, TransactionController.getTransactionLimits);
router.post('/verify-identity', authenticateUser, TransactionController.verifyIdentity);
router.post('/verify-address', authenticateUser, TransactionController.verifyAddress);

module.exports = router;
