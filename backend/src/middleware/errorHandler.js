/**
 * @fileoverview Centralized error handling middleware for the Billable Hours Tracker API.
 * Provides consistent error response formatting for various error types.
 * @module middleware/errorHandler
 */

/**
 * Express error handling middleware that processes and formats error responses.
 * Handles Joi validation errors, SQLite database errors, and generic errors
 * with appropriate HTTP status codes and consistent JSON response format.
 * 
 * @function errorHandler
 * @param {Error} err - The error object to handle
 * @param {boolean} [err.isJoi] - Flag indicating a Joi validation error
 * @param {Array<{message: string}>} [err.details] - Joi validation error details
 * @param {string} [err.code] - Error code (e.g., SQLite error codes starting with 'SQLITE_')
 * @param {number} [err.status] - HTTP status code to use for the response
 * @param {string} [err.message] - Error message to include in response
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * // Joi validation error response (400)
 * {
 *   "error": "Validation error",
 *   "details": ["\"email\" must be a valid email"]
 * }
 * 
 * @example
 * // Database error response (500)
 * {
 *   "error": "Database error",
 *   "message": "An error occurred while processing your request"
 * }
 * 
 * @example
 * // Generic error response
 * {
 *   "error": "Custom error message"
 * }
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Joi validation errors - return 400 Bad Request with validation details
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  // SQLite errors - return 500 with generic message to avoid exposing internals
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  // Default error - use provided status or 500, and provided message or generic
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = {
  errorHandler
};
