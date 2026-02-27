/**
 * @fileoverview Authentication middleware for the Time Tracking API.
 *
 * Implements a simple email-based authentication scheme where the caller
 * provides their email address via the `x-user-email` HTTP header. If the
 * email belongs to an existing user the request proceeds; otherwise a new
 * user record is created automatically before continuing.
 *
 * @module middleware/auth
 * @requires database/init
 */

const { getDatabase } = require('../database/init');

/**
 * Express middleware that authenticates incoming requests by inspecting the
 * `x-user-email` header.
 *
 * Validation steps:
 * 1. Ensures the header is present (returns 401 if missing).
 * 2. Validates the email format with a basic regex (returns 400 if invalid).
 * 3. Looks up the user in the database; creates the user if not found.
 * 4. Attaches the verified email to `req.userEmail` for downstream handlers.
 *
 * @function authenticateUser
 * @param {import('express').Request} req  - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 */
function authenticateUser(req, res, next) {
  const userEmail = req.headers['x-user-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: 'User email required in x-user-email header' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const db = getDatabase();
  
  // Check if user exists, create if not
  db.get('SELECT email FROM users WHERE email = ?', [userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!row) {
      // Create new user
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

module.exports = {
  authenticateUser
};
