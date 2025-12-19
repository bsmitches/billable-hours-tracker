/**
 * @fileoverview Authentication middleware for the Billable Hours Tracker API.
 * 
 * This module provides email-based authentication middleware that validates user identity
 * through the x-user-email HTTP header. It implements a simple authentication scheme
 * suitable for trusted internal network environments.
 * 
 * Authentication Flow:
 * 1. Extract email from x-user-email header
 * 2. Validate email format using regex
 * 3. Check if user exists in database
 * 4. If user doesn't exist, auto-create a new user record
 * 5. Attach userEmail to request object for downstream handlers
 * 
 * Security Note: This authentication model assumes a trusted internal network.
 * For production use in untrusted environments, consider integrating with
 * company SSO, OAuth, or password-based authentication.
 * 
 * @module middleware/auth
 * @requires ../database/init - Database connection module
 */

const { getDatabase } = require('../database/init');

/**
 * Express middleware that authenticates users based on the x-user-email header.
 * 
 * This middleware performs the following operations:
 * 1. Validates the presence of the x-user-email header
 * 2. Validates the email format using a regex pattern
 * 3. Checks if the user exists in the database
 * 4. Auto-creates new users if they don't exist (first-time login)
 * 5. Attaches the authenticated user's email to req.userEmail
 * 
 * @function authenticateUser
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * // Apply to all routes in a router
 * router.use(authenticateUser);
 * 
 * @example
 * // Apply to a specific route
 * router.get('/protected', authenticateUser, (req, res) => {
 *   console.log('Authenticated user:', req.userEmail);
 * });
 * 
 * Response Codes:
 * - 401 Unauthorized: Missing x-user-email header
 * - 400 Bad Request: Invalid email format
 * - 500 Internal Server Error: Database error
 */
function authenticateUser(req, res, next) {
  const userEmail = req.headers['x-user-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: 'User email required in x-user-email header' });
  }

  /**
   * Email validation regex pattern.
   * Matches standard email format: local-part@domain.tld
   * Requires at least one character before @, domain, and TLD.
   */
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const db = getDatabase();
  
  /**
   * Check if user exists in the database.
   * If user exists, proceed to next middleware.
   * If user doesn't exist, create a new user record (auto-registration).
   */
  db.get('SELECT email FROM users WHERE email = ?', [userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!row) {
      /**
       * Auto-create new user on first authentication.
       * This implements automatic user registration for the email-only auth system.
       */
      db.run('INSERT INTO users (email) VALUES (?)', [userEmail], (err) => {
        if (err) {
          console.error('Error creating user:', err);
          return res.status(500).json({ error: 'Failed to create user' });
        }
        
        req.userEmail = userEmail;
        next();
      });
    } else {
      req.userEmail = userEmail;
      next();
    }
  });
}

/**
 * Module exports for authentication middleware.
 * @exports {Object}
 * @property {Function} authenticateUser - Express middleware for user authentication
 */
module.exports = {
  authenticateUser
};
