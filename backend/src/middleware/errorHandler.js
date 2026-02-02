/**
 * @fileoverview Centralized error handling middleware for the Express application.
 * Provides consistent error response formatting for different error types including
 * Joi validation errors, SQLite database errors, and general application errors.
 * 
 * @module middleware/errorHandler
 */

/**
 * Express error handling middleware that processes and formats error responses.
 * Handles specific error types with appropriate HTTP status codes and messages.
 * 
 * Error handling priority:
 * 1. Joi validation errors - Returns 400 with validation details
 * 2. SQLite database errors - Returns 500 with generic database error message
 * 3. Custom errors with status - Returns the specified status code
 * 4. Unknown errors - Returns 500 with generic error message
 * 
 * @param {Error} err - The error object thrown or passed to next()
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Joi validation errors - return detailed validation messages
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
