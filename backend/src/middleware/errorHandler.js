/**
 * @fileoverview Centralized error handling middleware for the Billable Hours Tracker.
 * Provides consistent error response formatting across all API endpoints.
 * @module middleware/errorHandler
 */

/**
 * Express error-handling middleware that processes and formats all errors.
 * Provides consistent JSON error responses with appropriate HTTP status codes.
 * 
 * Error handling priority:
 * 1. Joi validation errors (400 Bad Request) - Returns validation details
 * 2. SQLite database errors (500 Internal Server Error) - Generic message for security
 * 3. Custom errors with status property - Uses provided status and message
 * 4. Unknown errors (500 Internal Server Error) - Generic fallback
 * 
 * @param {Error} err - The error object thrown or passed via next(err)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * // Register as the last middleware in Express app
 * app.use(errorHandler);
 * 
 * @example
 * // Trigger from route handler
 * router.post('/data', (req, res, next) => {
 *   const { error } = schema.validate(req.body);
 *   if (error) return next(error); // Handled as Joi validation error
 * });
 * 
 * @example
 * // Custom error with status
 * const err = new Error('Resource not found');
 * err.status = 404;
 * next(err);
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = {
  errorHandler
};
