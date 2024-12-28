CREATE DATABASE casino;
\c casino

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 1000.00,
    is_active BOOLEAN DEFAULT true,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(32),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    min_bet DECIMAL(15,2) DEFAULT 1.00,
    max_bet DECIMAL(15,2) DEFAULT 10000.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game sessions table
CREATE TABLE game_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    game_id INTEGER REFERENCES games(id),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    initial_balance DECIMAL(15,2),
    final_balance DECIMAL(15,2),
    status VARCHAR(20)
);

-- Bets table
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    game_id INTEGER REFERENCES games(id),
    session_id INTEGER REFERENCES game_sessions(id),
    amount DECIMAL(15,2) NOT NULL,
    outcome VARCHAR(50),
    payout DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_game_id ON bets(game_id);
CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);

-- Create casino_admin user and grant privileges
CREATE USER casino_admin WITH PASSWORD 'casino_admin123!@#';
GRANT ALL PRIVILEGES ON DATABASE casino TO casino_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO casino_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO casino_admin;

-- Insert default admin user (password: admin123!@#)
INSERT INTO admin_users (username, email, password_hash, role)
VALUES ('admin', 'admin@goldwave.casino', '$2b$10$6Q5X9X7K8X1X1X1X1X1X1OqX1X1X1X1X1X1X1X1X1X1X1X1X1X1', 'super_admin'); 