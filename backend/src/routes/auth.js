const express = require('express');
const { getDatabase } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

/**
 * @fileoverview Authentication routes for user login and profile retrieval.
 * Provides email-based authentication endpoints suitable for trusted internal networks.
 * Users are automatically created on first login attempt (auto-registration).
 * 
 * @module routes/auth
 */

const router = express.Router();

/**
 * @route POST /api/auth/login
 * @description Authenticates a user by email address. If the user does not exist,
 * a new account is automatically created (auto-registration). This simplified
 * authentication is designed for trusted internal networks.
 * 
 * @param {Object} req.body - Request body containing user credentials.
 * @param {string} req.body.email - User's email address (required, validated format).
 * 
 * @returns {Object} 200 - Login successful for existing user.
 * @returns {Object} 201 - New user created and logged in.
 * @returns {Object} 400 - Validation error (invalid email format).
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * POST /api/auth/login
 * { "email": "user@example.com" }
 * 
 * // Response (existing user)
 * { "message": "Login successful", "user": { "email": "user@example.com", "createdAt": "2024-01-15T10:30:00Z" } }
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
 * @description Retrieves the profile information of the currently authenticated user.
 * Requires the x-user-email header for authentication.
 * 
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * 
 * @returns {Object} 200 - User profile retrieved successfully.
 * @returns {Object} 401 - Authentication required (missing x-user-email header).
 * @returns {Object} 404 - User not found in database.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * GET /api/auth/me
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response
 * { "user": { "email": "user@example.com", "createdAt": "2024-01-15T10:30:00Z" } }
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
