/**
 * @module middleware/auth
 * @description Simple email-based authentication middleware.
 * Extracts the user's email from the `x-user-email` request header, validates
 * its format, and ensures a corresponding row exists in the `users` table
 * (auto-creating one on first contact). On success the verified email is
 * attached to the request as `req.userEmail` for downstream handlers.
 */

const { getDatabase } = require('../database/init');

/**
 * @function authenticateUser
 * @description Express middleware that authenticates requests via the `x-user-email` header.
 *
 * Flow:
 * 1. Reads the `x-user-email` header; responds 401 if missing.
 * 2. Validates the value against a simple email regex; responds 400 if invalid.
 * 3. Looks up the email in the `users` table.
 *    - If the user does not exist, a new row is inserted automatically.
 * 4. Sets `req.userEmail` and calls `next()`.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware callback.
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
