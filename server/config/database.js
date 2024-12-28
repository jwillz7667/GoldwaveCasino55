const { Pool } = require('pg');
const logger = require('../utils/logger');

// PostgreSQL connection configuration
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Connection pool settings
    max: process.env.NODE_ENV === 'production' ? 50 : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Test the database connection
const connectDB = async () => {
    try {
        const client = await pool.connect();
        logger.info(`PostgreSQL Connected: ${process.env.DB_HOST}`);
        client.release();
        return pool;
    } catch (error) {
        logger.error('Error connecting to PostgreSQL:', error);
        throw error;
    }
};

// Handle pool errors
pool.on('error', (err) => {
    logger.error('Unexpected error on idle PostgreSQL client:', err);
    process.exit(-1);
});

module.exports = {
    connectDB,
    pool
};
