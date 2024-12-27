require('dotenv').config();
const express = require('express');
const { connectDB, createIndexes } = require('./config/database');
const { configureServer, startServer } = require('./config/server');
const logger = require('./utils/logger');

// Import routes
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const gameRoutes = require('./routes/gameRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

// Import controllers
const AdminController = require('./controllers/AdminController');
const UserController = require('./controllers/UserController');

// Import middleware
const { authenticateAdmin, authenticateUser } = require('./middleware/auth');

// Create Express app
const app = express();

// Configure server
configureServer(app);

// API version prefix
const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

// Public routes (no authentication required)
app.post(`${API_PREFIX}/admin/login`, AdminController.login);
app.post(`${API_PREFIX}/user/login`, UserController.login);
app.post(`${API_PREFIX}/user/register`, UserController.register);

// Protected routes
app.use(`${API_PREFIX}/admin`, authenticateAdmin, adminRoutes);
app.use(`${API_PREFIX}/user`, authenticateUser, userRoutes);
app.use(`${API_PREFIX}/games`, gameRoutes);
app.use(`${API_PREFIX}/transactions`, authenticateUser, transactionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date(),
        environment: process.env.NODE_ENV,
    });
});

// Initialize server
const initializeServer = async () => {
    try {
        // Connect to database
        await connectDB();

        // Create database indexes
        await createIndexes();

        // Start server
        const port = process.env.PORT || 3000;
        const { server, monitoringServer } = await startServer(app, port);

        // Export for testing
        return { app, server, monitoringServer };
    } catch (error) {
        logger.error('Failed to initialize server:', error);
        throw error;
    }
};

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    initializeServer();
}

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    throw reason;
});

module.exports = { initializeServer };
