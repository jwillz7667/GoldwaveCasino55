require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const session = require('express-session');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;

// Database configuration
const pool = new Pool({
    user: 'casino_admin',
    host: 'localhost',
    database: 'casino',
    password: '6996',
    port: 5432,
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
};

const requireAdmin = async (req, res, next) => {
    try {
        // Check session-based auth first
        if (req.session.userId && req.session.userRole === 'admin') {
            return next();
        }

        // Check token-based auth
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(401).json({ message: 'Unauthorized' });
    }
};

// User Authentication Routes
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ message: 'Account is not active' });
        }

        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        res.json({
            id: user.id,
            username: user.username,
            balance: user.balance,
            role: user.role
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const admin = result.rows[0];
        const validPassword = await bcrypt.compare(password, admin.password);

        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        req.session.userId = admin.id;
        req.session.userRole = admin.role;
        
        res.json({
            id: admin.id,
            username: admin.username,
            role: admin.role
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// User Management Routes
app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, balance, role FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    const { username, password, email, initialBalance = 0 } = req.body;
    
    console.log('Creating new user:', { username, email, initialBalance });
    
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            console.log('Transaction started');
            
            // Check if username already exists
            const existingUser = await client.query(
                'SELECT username FROM users WHERE username = $1',
                [username]
            );
            console.log('Existing user check:', existingUser.rows);
            
            if (existingUser.rows.length > 0) {
                throw new Error('Username already exists');
            }
            
            // If email is provided, check if it already exists
            if (email) {
                const existingEmail = await client.query(
                    'SELECT email FROM users WHERE email = $1',
                    [email]
                );
                console.log('Existing email check:', existingEmail.rows);
                
                if (existingEmail.rows.length > 0) {
                    throw new Error('Email already exists');
                }
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            console.log('Password hashed');
            
            // Create user
            const result = await client.query(
                'INSERT INTO users (username, email, password, balance, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [username, email || null, hashedPassword, initialBalance, 'user', 'active']
            );
            console.log('User created:', result.rows[0]);
            
            // Record initial balance transaction if any
            if (initialBalance > 0) {
                const txn = await client.query(
                    'INSERT INTO transactions (user_id, type, amount, admin_id) VALUES ($1, $2, $3, $4) RETURNING *',
                    [result.rows[0].id, 'credit', initialBalance, req.session.userId]
                );
                console.log('Initial balance transaction created:', txn.rows[0]);
            }
            
            await client.query('COMMIT');
            console.log('Transaction committed');
            
            // Return more user details
            res.json({
                id: result.rows[0].id,
                username: result.rows[0].username,
                email: result.rows[0].email,
                balance: result.rows[0].balance,
                role: result.rows[0].role,
                status: result.rows[0].status
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Transaction rolled back:', error);
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('User creation error:', error);
        res.status(400).json({ message: error.message });
    }
});

// Game Routes
app.get('/api/games', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM games WHERE active = true');
        res.json(result.rows);
    } catch (error) {
        console.error('Games fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Social Features
app.get('/api/social/games', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM games WHERE active = true');
        res.json(result.rows);
    } catch (error) {
        console.error('Games fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/live/games', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM games WHERE active = true');
        res.json(result.rows);
    } catch (error) {
        console.error('Games fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/promotions', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM games WHERE active = true');
        res.json(result.rows);
    } catch (error) {
        console.error('Games fetch error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin Routes
app.get('/api/admin/check-auth', requireAdmin, (req, res) => {
    res.json({ authenticated: true });
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, 
                u.username, 
                u.email, 
                u.balance, 
                u.role, 
                u.status,
                u.created_at,
                COUNT(DISTINCT t.id) as transaction_count,
                COALESCE(SUM(CASE WHEN t.type = 'win' THEN t.amount ELSE 0 END), 0) as total_winnings
            FROM users u
            LEFT JOIN transactions t ON u.id = t.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        
        console.log('Fetched users:', result.rows);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

// Game Section Routes
app.get('/api/games/section/:section', requireAuth, async (req, res) => {
    const { section } = req.params;
    try {
        let query = 'SELECT * FROM games WHERE active = true';
        const params = [];

        switch (section) {
            case 'popular':
                query += ' AND popularity > 0 ORDER BY popularity DESC';
                break;
            case 'newExclusive':
                query += ' AND is_exclusive = true ORDER BY created_at DESC';
                break;
            case 'spinsWins':
                query += ' AND type = \'slots\'';
                break;
            case 'jackpotPlay':
                query += ' AND has_jackpot = true';
                break;
            case 'holdWin':
                query += ' AND type = \'hold_and_win\'';
                break;
            // forYou section will be handled with user preferences
            case 'forYou':
                query += ' AND id IN (SELECT game_id FROM user_preferences WHERE user_id = $1)';
                params.push(req.session.userId);
                break;
            // lobby is default, returns all active games
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error loading games section:', error);
        res.status(500).json({ message: 'Failed to load games' });
    }
});

// Serve the appropriate HTML file based on the route
app.get('/', (req, res) => {
    if (req.session.userId && req.session.userRole === 'user') {
        res.redirect('/casino');
    } else {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    }
});

app.get('/casino', requireAuth, (req, res) => {
    if (req.session.userRole === 'user') {
        res.sendFile(path.join(__dirname, '../dist/casino.html'));
    } else {
        res.redirect('/');
    }
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/admin/index.html'));
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
