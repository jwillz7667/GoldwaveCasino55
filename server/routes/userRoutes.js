const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register new user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Error creating user' });
        }

        // Create user profile
        db.run(
          'INSERT INTO user_profiles (user_id) VALUES (?)',
          [this.lastID],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Error creating user profile' });
            }

            // Generate token
            const token = jwt.sign({ id: this.lastID }, JWT_SECRET);
            res.status(201).json({ token });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ token });
  });
});

// Get user profile
router.get('/profile', auth, (req, res) => {
  db.get(
    `SELECT u.username, u.email, u.balance, up.*
     FROM users u
     JOIN user_profiles up ON u.id = up.user_id
     WHERE u.id = ?`,
    [req.user.id],
    (err, profile) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      res.json(profile);
    }
  );
});

// Update user profile
router.patch('/profile', auth, (req, res) => {
  const { avatar_url } = req.body;

  db.run(
    'UPDATE user_profiles SET avatar_url = ? WHERE user_id = ?',
    [avatar_url, req.user.id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error updating profile' });
      }
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

// Get transaction history
router.get('/transactions', auth, (req, res) => {
  db.all(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
    (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json(transactions);
    }
  );
});

// Add funds
router.post('/deposit', auth, (req, res) => {
  const { amount } = req.body;
  
  db.run('BEGIN TRANSACTION');

  db.run(
    'UPDATE users SET balance = balance + ? WHERE id = ?',
    [amount, req.user.id],
    (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Error processing deposit' });
      }

      db.run(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [req.user.id, 'DEPOSIT', amount, 'Deposit funds'],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Error recording transaction' });
          }

          db.run('COMMIT');
          res.json({ message: 'Deposit successful' });
        }
      );
    }
  );
});

module.exports = router; 