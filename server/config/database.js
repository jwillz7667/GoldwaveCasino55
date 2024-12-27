const mongoose = require('mongoose');
const logger = require('../utils/logger');

// MongoDB connection options with optimized settings
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: false, // We'll handle indexes manually
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 50,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    w: 'majority',
    readConcern: { level: 'local' },
    retryReads: true
};

// Add production-specific options
if (process.env.NODE_ENV === 'production') {
    options.readPreference = 'secondaryPreferred';
    options.readConcern.level = 'majority';
    options.maxPoolSize = 100;
    options.minPoolSize = 10;
}

// Create indexes with progress monitoring
const createIndexes = async () => {
    try {
        const Game = mongoose.model('Game');
        const User = mongoose.model('User');
        const Admin = mongoose.model('Admin');
        const Transaction = mongoose.model('Transaction');
        const GameSession = mongoose.model('GameSession');

        logger.info('Dropping existing indexes...');
        
        // Drop existing indexes
        await Promise.all([
            Game.collection.dropIndexes(),
            User.collection.dropIndexes(),
            Admin.collection.dropIndexes(),
            Transaction.collection.dropIndexes(),
            GameSession.collection.dropIndexes()
        ]);

        logger.info('Creating new indexes...');

        // Create indexes for Game collection
        await Game.collection.createIndexes([
            { key: { name: 1 }, unique: true, name: 'game_name_unique' },
            { key: { type: 1 }, name: 'game_type_idx' },
            { key: { status: 1 }, name: 'game_status_idx' },
            { key: { createdAt: -1 }, name: 'game_created_idx' }
        ]);
        logger.info('Game indexes created');

        // Create indexes for User collection
        await User.collection.createIndexes([
            { key: { email: 1 }, unique: true, name: 'user_email_unique' },
            { key: { username: 1 }, unique: true, name: 'user_username_unique' }
        ]);
        logger.info('User indexes created');

        // Create indexes for Admin collection
        await Admin.collection.createIndexes([
            { key: { email: 1 }, unique: true, name: 'admin_email_unique' },
            { key: { username: 1 }, unique: true, name: 'admin_username_unique' }
        ]);
        logger.info('Admin indexes created');

        // Create indexes for Transaction collection
        await Transaction.collection.createIndexes([
            { key: { userId: 1 }, name: 'transaction_user_idx' },
            { key: { type: 1 }, name: 'transaction_type_idx' },
            { key: { status: 1 }, name: 'transaction_status_idx' },
            { key: { createdAt: -1 }, name: 'transaction_created_idx' }
        ]);
        logger.info('Transaction indexes created');

        // Create indexes for GameSession collection
        await GameSession.collection.createIndexes([
            { key: { userId: 1 }, name: 'session_user_idx' },
            { key: { gameId: 1 }, name: 'session_game_idx' },
            { key: { status: 1 }, name: 'session_status_idx' },
            { key: { createdAt: -1 }, name: 'session_created_idx' }
        ]);
        logger.info('GameSession indexes created');

        logger.info('All indexes created successfully');
    } catch (error) {
        logger.error('Error managing indexes:', error);
        // Don't throw the error, just log it
        logger.warn('Continuing without indexes...');
    }
};

// Connect to MongoDB with enhanced error handling and monitoring
const connectDB = async () => {
    try {
        // Add event listeners before connecting
        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected successfully');
        });

        mongoose.connection.on('connected', () => {
            logger.info('MongoDB connection established');
        });

        // Connect to MongoDB
        const conn = await mongoose.connect(process.env.MONGODB_URI, options);
        logger.info(`MongoDB Connected: ${conn.connection.host}`);

        // Create indexes after successful connection
        await createIndexes();

        return conn;
    } catch (error) {
        logger.error('Error connecting to MongoDB:', error);
        // Retry connection after delay
        setTimeout(() => {
            logger.info('Retrying MongoDB connection...');
            connectDB();
        }, 5000);
        throw error;
    }
};

module.exports = {
    connectDB,
    createIndexes
};
