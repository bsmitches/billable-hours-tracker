/**
 * @module routes/auth
 * @description Authentication route handlers.
 * Provides login (with automatic registration) and a "current user" endpoint.
 * Mounted at `/api/auth`.
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

/** @type {import('express').Router} */
const router = express.Router();

/**
 * @route POST /api/auth/login
 * @description Logs a user in by email. If no account exists for the given
 * email address a new user row is created automatically (201). Existing users
 * receive a 200 with their profile data. The request body is validated against
 * {@link module:validation/schemas.emailSchema}.
 * @body {string} email - A valid email address.
 * @returns {{ message: string, user: { email: string, createdAt: string } }}
 */
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = emailSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email } = value;
    const db = getDatabase();

    db.get('SELECT email, created_at FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row) {
        return res.json({
          message: 'Login successful',
          user: {
            email: row.email,
            createdAt: row.created_at
          }
        });
      } else {
        db.run('INSERT INTO users (email) VALUES (?)', [email], function(err) {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({ error: 'Failed to create user' });
          }

          res.status(201).json({
            message: 'User created and logged in successfully',
            user: {
              email: email,
              createdAt: new Date().toISOString()
            }
          });
        });
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/auth/me
 * @description Returns the profile of the currently authenticated user.
 * Requires the `x-user-email` header (handled by {@link module:middleware/auth.authenticateUser}).
 * @returns {{ user: { email: string, createdAt: string } }}
 */
router.get('/me', authenticateUser, (req, res) => {
  const db = getDatabase();
  
  db.get('SELECT email, created_at FROM users WHERE email = ?', [req.userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        email: row.email,
        createdAt: row.created_at
      }
    });
  });
});

module.exports = router;
