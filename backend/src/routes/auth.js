/**
 * @fileoverview Authentication routes for user login and profile retrieval.
 * 
 * This module provides REST API endpoints for user authentication in the
 * Billable Hours Tracker application. It implements a simplified email-based
 * authentication system designed for trusted internal networks.
 * 
 * Endpoints:
 * - POST /api/auth/login - Authenticate or register a user by email
 * - GET /api/auth/me - Retrieve the current authenticated user's profile
 * 
 * @module routes/auth
 * @requires express
 * @requires ../database/init
 * @requires ../validation/schemas
 * @requires ../middleware/auth
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { emailSchema } = require('../validation/schemas');
const { authenticateUser } = require('../middleware/auth');

/**
 * Express router instance for authentication endpoints.
 * @type {import('express').Router}
 */
const router = express.Router();

/**
 * POST /api/auth/login
 * 
 * Authenticates a user by email address. If the user doesn't exist, a new
 * account is automatically created (auto-provisioning). This endpoint does
 * not require prior authentication.
 * 
 * @name LoginUser
 * @route {POST} /api/auth/login
 * @bodyparam {string} email - The user's email address (required, must be valid format)
 * @returns {Object} 200 - Login successful with existing user data
 * @returns {Object} 201 - New user created and logged in
 * @returns {Object} 400 - Validation error (invalid email format)
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request body
 * { "email": "user@example.com" }
 * 
 * // Success response (existing user)
 * { "message": "Login successful", "user": { "email": "user@example.com", "createdAt": "2024-01-01T00:00:00.000Z" } }
 * 
 * // Success response (new user)
 * { "message": "User created and logged in successfully", "user": { "email": "user@example.com", "createdAt": "2024-01-01T00:00:00.000Z" } }
 */
router.post('/login', async (req, res, next) => {
  try {
    // Validate request body against email schema
    const { error, value } = emailSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email } = value;
    const db = getDatabase();

    // Check if user already exists in the database
    db.get('SELECT email, created_at FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (row) {
        // User exists - return login success with user data
        return res.json({
          message: 'Login successful',
          user: {
            email: row.email,
            createdAt: row.created_at
          }
        });
      } else {
        // User doesn't exist - create new account (auto-provisioning)
        db.run('INSERT INTO users (email) VALUES (?)', [email], function(err) {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({ error: 'Failed to create user' });
          }

          // Return 201 Created status for new user registration
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
 * Retrieves the profile information for the currently authenticated user.
 * Requires the x-user-email header for authentication.
 * 
 * @name GetCurrentUser
 * @route {GET} /api/auth/me
 * @authentication Requires x-user-email header
 * @returns {Object} 200 - User profile data
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - User not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request headers
 * { "x-user-email": "user@example.com" }
 * 
 * // Success response
 * { "user": { "email": "user@example.com", "createdAt": "2024-01-01T00:00:00.000Z" } }
 */
router.get('/me', authenticateUser, (req, res) => {
  const db = getDatabase();
  
  // Retrieve user profile using the authenticated email from middleware
  db.get('SELECT email, created_at FROM users WHERE email = ?', [req.userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // This should rarely happen since authenticateUser creates users automatically
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
