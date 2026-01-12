/**
 * @fileoverview Authentication middleware for the Billable Hours Tracker API.
 * 
 * This module provides email-based authentication middleware designed for trusted
 * internal networks. It validates user identity via the x-user-email header and
 * automatically creates new user accounts on first access (auto-provisioning).
 * 
 * Security Note: This authentication method is intentionally simplified for
 * internal/demo use. For production deployments in untrusted environments,
 * consider implementing JWT tokens with proper password authentication.
 * 
 * @module middleware/auth
 * @requires ../database/init
 */

const { getDatabase } = require('../database/init');

/**
 * Express middleware that authenticates users based on the x-user-email header.
 * 
 * This middleware performs the following operations:
 * 1. Extracts the user email from the x-user-email request header
 * 2. Validates the email format using a regex pattern
 * 3. Checks if the user exists in the database
 * 4. Auto-creates a new user account if the email doesn't exist
 * 5. Attaches the validated email to req.userEmail for downstream handlers
 * 
 * The auto-provisioning behavior enables seamless onboarding - users simply
 * provide their email and are automatically registered on first request.
 * 
 * @function authenticateUser
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * // Apply to a single route
 * router.get('/protected', authenticateUser, (req, res) => {
 *   console.log('Authenticated user:', req.userEmail);
 * });
 * 
 * @example
 * // Apply to all routes in a router
 * router.use(authenticateUser);
 * 
 * @throws {401} When x-user-email header is missing
 * @throws {400} When email format is invalid
 * @throws {500} When database operations fail
 */
function authenticateUser(req, res, next) {
  // Extract email from custom header - this is the primary authentication mechanism
  const userEmail = req.headers['x-user-email'];
  
  // Require authentication header on all protected routes
  if (!userEmail) {
    return res.status(401).json({ error: 'User email required in x-user-email header' });
  }

  // Validate email format using standard email regex pattern
  // Matches: local-part@domain.tld (basic validation, not RFC 5322 compliant)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const db = getDatabase();
  
  // Check if user exists in database, auto-create if not (auto-provisioning)
  db.get('SELECT email FROM users WHERE email = ?', [userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!row) {
      // User doesn't exist - create new account automatically
      // This enables seamless first-time user onboarding
      db.run('INSERT INTO users (email) VALUES (?)', [userEmail], (err) => {
        if (err) {
          console.error('Error creating user:', err);
          return res.status(500).json({ error: 'Failed to create user' });
        }
        
        // Attach email to request for use in route handlers
        req.userEmail = userEmail;
        next();
      });
    } else {
      // Existing user - attach email and continue
      req.userEmail = userEmail;
      next();
    }
  });
}

module.exports = {
  authenticateUser
};
