const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
    user: 'casino_admin',
    host: '137.184.43.236',
    database: 'casino',
    password: '6996',
    port: 5432,
});

async function setupTables() {
    const client = await pool.connect();
    try {
        // Create users table first
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                balance DECIMAL(15,2) DEFAULT 0.00,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            );
        `);

        // Create games table second
        await client.query(`
            CREATE TABLE IF NOT EXISTS games (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                thumbnail VARCHAR(255),
                min_bet DECIMAL(15,2) NOT NULL,
                max_bet DECIMAL(15,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'maintenance'))
            );
        `);

        // Create transactions table last
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                type VARCHAR(20) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                admin_id INTEGER REFERENCES admins(id),
                game_id INTEGER REFERENCES games(id),
                status VARCHAR(20) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT valid_type CHECK (type IN ('credit', 'debit', 'bet', 'win'))
            );
        `);

        // Create indexes for games
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
            CREATE INDEX IF NOT EXISTS idx_games_type ON games(type);
        `);

        // Create indexes for transactions
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_game_id ON transactions(game_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
            CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
        `);

        console.log('All tables and indexes created successfully');

    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the setup
setupTables().finally(() => {
    pool.end();
}); 