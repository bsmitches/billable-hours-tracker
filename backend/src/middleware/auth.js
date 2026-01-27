/**
 * @fileoverview Authentication middleware for the Billable Hours Tracker API.
 * Provides email-based authentication suitable for trusted internal networks.
 * @module middleware/auth
 */

const { getDatabase } = require('../database/init');

/**
 * Express middleware that authenticates users based on email header.
 * This middleware validates the x-user-email header, checks email format,
 * and auto-creates users if they don't exist in the database.
 * 
 * @function authenticateUser
 * @param {express.Request} req - Express request object
 * @param {string} req.headers['x-user-email'] - User's email address for authentication
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * // Usage in route definition
 * router.get('/protected', authenticateUser, (req, res) => {
 *   console.log(req.userEmail); // User's authenticated email
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

  // Validate email format using regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const db = getDatabase();
  
  // Check if user exists, create if not (auto-registration)
  db.get('SELECT email FROM users WHERE email = ?', [userEmail], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!row) {
      // Create new user automatically on first authentication
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
