const { getDatabase } = require('../database/init');

/**
 * @fileoverview Authentication middleware for the billable hours tracker API.
 * Provides email-based authentication suitable for trusted internal networks.
 * Users are automatically created on first authentication attempt.
 * 
 * @module middleware/auth
 */

/**
 * Express middleware that authenticates users via the x-user-email header.
 * This is a simplified authentication mechanism designed for trusted internal
 * networks where password-based authentication is not required.
 * 
 * The middleware performs the following steps:
 * 1. Extracts the email from the x-user-email request header
 * 2. Validates the email format using a regex pattern
 * 3. Checks if the user exists in the database
 * 4. Creates a new user record if the email is not found (auto-registration)
 * 5. Attaches the validated email to req.userEmail for downstream handlers
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {void}
 * 
 * @example
 * // Apply to a single route
 * router.get('/protected', authenticateUser, (req, res) => {
 *   console.log(`Authenticated user: ${req.userEmail}`);
 *   res.json({ message: 'Access granted' });
 * });
 * 
 * @example
 * // Apply to all routes in a router
 * router.use(authenticateUser);
 * 
 * @throws {401} If x-user-email header is missing.
 * @throws {400} If the email format is invalid.
 * @throws {500} If a database error occurs during user lookup or creation.
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
