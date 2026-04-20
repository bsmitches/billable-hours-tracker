/**
 * @fileoverview Authentication routes for the Billable Hours Tracker API.
 * 
 * This module provides endpoints for user authentication and profile retrieval.
 * It implements a simple email-based authentication system where users can log in
 * with just their email address (no password required).
 * 
 * Endpoints:
 * - POST /api/auth/login - Authenticate user (creates account if new)
 * - GET /api/auth/me - Get current authenticated user's profile
 * 
 * @module routes/auth
 * @requires express - Web framework for Node.js
 * @requires ../database/init - Database connection module
 * @requires ../validation/schemas - Joi validation schemas
 * @requires ../middleware/auth - Authentication middleware
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

/**
 * Express router instance for authentication routes.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * Login endpoint - authenticates a user by email.
 * If the user doesn't exist, a new account is automatically created.
 * 
 * @route POST /api/auth/login
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User's email address
 * @returns {Object} JSON response with message and user object
 * 
 * @example
 * // Request
 * POST /api/auth/login
 * { "email": "user@example.com" }
 * 
 * // Response (existing user) - 200 OK
 * { "message": "Login successful", "user": { "email": "user@example.com", "createdAt": "2024-01-01T00:00:00.000Z" } }
 * 
 * // Response (new user) - 201 Created
 * { "message": "User created and logged in successfully", "user": { "email": "user@example.com", "createdAt": "2024-01-01T00:00:00.000Z" } }
 * 
 * Response Codes:
 * - 200 OK: Existing user logged in successfully
 * - 201 Created: New user created and logged in
 * - 400 Bad Request: Invalid email format
 * - 500 Internal Server Error: Database error
 */
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = emailSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email } = value;
    const db = getDatabase();

    /**
     * Check if user exists in the database.
     * Returns user data if found, null if not found.
     */
    db.get('SELECT email, created_at FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row) {
        /**
         * User exists - return login success with user data.
         */
        return res.json({
          message: 'Login successful',
          user: {
            email: row.email,
            createdAt: row.created_at
          }
        });
      } else {
        /**
         * User doesn't exist - create new user account.
         * This implements automatic registration on first login.
         */
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
 * Get current user profile endpoint.
 * Returns the authenticated user's profile information.
 * Requires authentication via x-user-email header.
 * 
 * @route GET /api/auth/me
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with user object
 * 
 * @example
 * // Request
 * GET /api/auth/me
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response - 200 OK
 * { "user": { "email": "user@example.com", "createdAt": "2024-01-01T00:00:00.000Z" } }
 * 
 * Response Codes:
 * - 200 OK: User profile returned successfully
 * - 401 Unauthorized: Missing x-user-email header
 * - 404 Not Found: User not found in database
 * - 500 Internal Server Error: Database error
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

/**
 * Export the router for mounting in the main Express app.
 * @exports router
 */
module.exports = router;
