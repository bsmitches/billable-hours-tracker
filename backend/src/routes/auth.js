const express = require('express');
const { getDatabase, sql } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Login endpoint - creates user if doesn't exist
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = emailSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email } = value;
    const pool = await getDatabase();

    // Check if user exists
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT email, created_at FROM users WHERE email = @email');

    if (result.recordset.length > 0) {
      // User exists
      return res.json({
        message: 'Login successful',
        user: {
          email: result.recordset[0].email,
          createdAt: result.recordset[0].created_at
        }
      });
    } else {
      // Create new user
      await pool.request()
        .input('email', sql.VarChar, email)
        .query('INSERT INTO users (email) VALUES (@email)');

      res.status(201).json({
        message: 'User created and logged in successfully',
        user: {
          email: email,
          createdAt: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('Database error:', error);
    if (error.isJoi) {
      return next(error);
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const pool = await getDatabase();
    
    const result = await pool.request()
      .input('email', sql.VarChar, req.userEmail)
      .query('SELECT email, created_at FROM users WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        email: result.recordset[0].email,
        createdAt: result.recordset[0].created_at
      }
    });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
