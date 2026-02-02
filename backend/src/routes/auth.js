/**
 * @fileoverview Authentication routes for user login and profile retrieval.
 * Implements email-based authentication with automatic user creation.
 * 
 * @module routes/auth
 * 
 * @description
 * Available endpoints:
 * - POST /api/auth/login - Authenticate user (auto-creates if new)
 * - GET /api/auth/me - Get current authenticated user's profile
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticates a user by email address. Creates a new user if the email doesn't exist.
 * 
 * @name LoginUser
 * @route {POST} /api/auth/login
 * @bodyparam {string} email - User's email address
 * @returns {Object} 200 - Login successful with user data
 * @returns {Object} 201 - New user created and logged in
 * @returns {Object} 400 - Validation error (invalid email format)
 * @returns {Object} 500 - Internal server error
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
 * Retrieves the currently authenticated user's profile information.
 * Requires authentication via x-user-email header.
 * 
 * @name GetCurrentUser
 * @route {GET} /api/auth/me
 * @authentication Required - x-user-email header
 * @returns {Object} 200 - User profile data (email, createdAt)
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - User not found
 * @returns {Object} 500 - Internal server error
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
