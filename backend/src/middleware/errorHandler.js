/**
 * @fileoverview Centralized error-handling middleware for the Time Tracking API.
 *
 * Catches errors forwarded by route handlers and translates them into
 * appropriate JSON error responses. Handles Joi validation errors (400),
 * SQLite database errors (500), and generic unhandled errors.
 *
 * @module middleware/errorHandler
 * @see {@link https://expressjs.com/en/guide/error-handling.html}
 */

/**
 * Express error-handling middleware (4-arity signature).
 *
 * @function errorHandler
 * @param {Error} err  - The error object thrown or passed via `next(err)`
 * @param {import('express').Request} req  - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  // SQLite errors
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = {
  errorHandler
};
