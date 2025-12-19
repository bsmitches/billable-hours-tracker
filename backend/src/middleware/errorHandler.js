/**
 * @fileoverview Centralized error handling middleware for the Billable Hours Tracker API.
 * 
 * This module provides a global error handler that catches all errors thrown in route handlers
 * and formats them into consistent JSON error responses. It handles different error types
 * with appropriate HTTP status codes and user-friendly messages.
 * 
 * Error Types Handled:
 * - Joi validation errors (400 Bad Request)
 * - SQLite database errors (500 Internal Server Error)
 * - Custom errors with status codes
 * - Generic/unexpected errors (500 Internal Server Error)
 * 
 * Security Note: Database error details are hidden from clients to prevent
 * information leakage about the database structure or queries.
 * 
 * @module middleware/errorHandler
 */

/**
 * Express error handling middleware that processes all errors thrown in the application.
 * 
 * This middleware must be registered after all route handlers to catch errors.
 * It categorizes errors by type and returns appropriate HTTP responses:
 * 
 * - Joi Validation Errors: Returns 400 with validation details
 * - SQLite Errors: Returns 500 with generic message (hides SQL details for security)
 * - Custom Errors: Uses error.status or defaults to 500
 * - Generic Errors: Returns 500 with error message or default message
 * 
 * @function errorHandler
 * @param {Error} err - The error object thrown by route handlers
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next middleware function (required for error middleware signature)
 * @returns {void}
 * 
 * @example
 * // Register as the last middleware in the Express app
 * app.use(errorHandler);
 * 
 * @example
 * // Throwing errors in route handlers
 * router.post('/clients', (req, res, next) => {
 *   const { error } = clientSchema.validate(req.body);
 *   if (error) {
 *     return next(error); // Will be caught by errorHandler
 *   }
 * });
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  /**
   * Handle Joi validation errors.
   * Joi errors have an isJoi flag and contain detailed validation messages.
   * Returns 400 Bad Request with an array of validation error messages.
   */
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  /**
   * Handle SQLite database errors.
   * SQLite errors have a code property starting with 'SQLITE_'.
   * Returns a generic error message to avoid exposing database details.
   */
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  /**
   * Handle all other errors.
   * Uses the error's status property if available, otherwise defaults to 500.
   * Uses the error's message if available, otherwise returns a generic message.
   */
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}

/**
 * Module exports for error handling middleware.
 * @exports {Object}
 * @property {Function} errorHandler - Express error handling middleware
 */
module.exports = {
  errorHandler
};
