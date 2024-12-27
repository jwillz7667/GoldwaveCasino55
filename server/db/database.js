const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'casino.db'));

// Initialize database tables
const initDatabase = () => {
    db.serialize(() => {
        // Users table
        db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        balance DECIMAL(10,2) DEFAULT 1000.00
      )
    `);

        // User profiles table
        db.run(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY,
        avatar_url TEXT,
        total_winnings DECIMAL(10,2) DEFAULT 0,
        total_losses DECIMAL(10,2) DEFAULT 0,
        vip_status TEXT DEFAULT 'BRONZE',
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

        // Transaction history
        db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    });
};

initDatabase();

module.exports = db;
