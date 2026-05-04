/**
 * @fileoverview Authentication middleware for the Billable Hours Tracker.
 * Provides email-based authentication suitable for trusted internal networks.
 * Auto-creates users on first authentication attempt.
 * @module middleware/auth
 */

const { getDatabase } = require('../database/init');

/**
 * Express middleware that authenticates users via the x-user-email header.
 * This is a simplified authentication mechanism designed for trusted internal networks.
 * 
 * Authentication flow:
 * 1. Extracts email from x-user-email header
 * 2. Validates email format using regex
 * 3. Checks if user exists in database
 * 4. Auto-creates user if not found (first-time login)
 * 5. Sets req.userEmail for downstream route handlers
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * // Apply to all routes in a router
 * router.use(authenticateUser);
 * 
 * @example
 * // Apply to specific route
 * router.get('/protected', authenticateUser, (req, res) => {
 *   console.log('Authenticated user:', req.userEmail);
 * });
 * 
 * @throws {401} If x-user-email header is missing
 * @throws {400} If email format is invalid
 * @throws {500} If database operation fails
 */
function authenticateUser(req, res, next) {
  const userEmail = req.headers['x-user-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: 'User email required in x-user-email header' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const db = getDatabase();
  
  db.get('SELECT email FROM users WHERE email = ?', [userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!row) {
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
