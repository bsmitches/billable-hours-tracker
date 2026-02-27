/**
 * @fileoverview Authentication route handlers.
 *
 * Provides endpoints for user login (email-based, no password) and for
 * retrieving the current authenticated user's profile. New users are
 * created on-the-fly during the login flow.
 *
 * @module routes/auth
 * @requires express
 * @requires database/init
 * @requires validation/schemas
 * @requires middleware/auth
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

/** @type {import('express').Router} */
const router = express.Router();

/**
 * POST /api/auth/login
 *
 * Authenticates a user by email address. If the email is not yet registered a
 * new user record is created automatically.
 *
 * @name PostLogin
 * @function
 * @param {import('express').Request} req - Must contain `{ email }` in the body
 * @param {import('express').Response} res
 * @returns {Object} 200 - Existing user logged in: `{ message, user: { email, createdAt } }`
 * @returns {Object} 201 - New user created: `{ message, user: { email, createdAt } }`
 * @returns {Object} 400 - Validation error
 * @returns {Object} 500 - Server / database error
 */
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = emailSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email } = value;
    const db = getDatabase();

    // Check if user exists
    db.get('SELECT email, created_at FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row) {
        // User exists
        return res.json({
          message: 'Login successful',
          user: {
            email: row.email,
            createdAt: row.created_at
          }
        });
      } else {
        // Create new user
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
 * GET /api/auth/me
 *
 * Returns profile information for the currently authenticated user.
 * Requires the `x-user-email` header (handled by {@link module:middleware/auth}).
 *
 * @name GetMe
 * @function
 * @param {import('express').Request} req - Authenticated request with `req.userEmail`
 * @param {import('express').Response} res
 * @returns {Object} 200 - `{ user: { email, createdAt } }`
 * @returns {Object} 401 - Missing or invalid authentication header
 * @returns {Object} 404 - User record not found
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
