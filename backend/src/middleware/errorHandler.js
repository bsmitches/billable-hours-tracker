/**
 * @fileoverview Centralized error handling middleware for the Express application.
 * 
 * This module provides a unified error handler that processes different types of
 * errors (validation, database, application) and returns consistent JSON error
 * responses to clients. It serves as the final middleware in the Express pipeline.
 * 
 * Error types handled:
 * - Joi validation errors (400 Bad Request)
 * - SQLite database errors (500 Internal Server Error)
 * - Custom application errors (uses err.status or defaults to 500)
 * 
 * @module middleware/errorHandler
 */

/**
 * Express error-handling middleware that processes errors and sends JSON responses.
 * 
 * This middleware should be registered after all route handlers to catch any
 * errors thrown or passed via next(error). It categorizes errors by type and
 * returns appropriate HTTP status codes with descriptive error messages.
 * 
 * Error handling priority:
 * 1. Joi validation errors - Returns 400 with validation details
 * 2. SQLite errors - Returns 500 with generic database error message
 * 3. Custom errors - Uses err.status if set, otherwise 500
 * 
 * All errors are logged to console for debugging purposes.
 * 
 * @function errorHandler
 * @param {Error} err - The error object thrown or passed to next()
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function (required for error middleware signature)
 * @returns {void}
 * 
 * @example
 * // Register as the last middleware in Express app
 * app.use(errorHandler);
 * 
 * @example
 * // Passing errors from route handlers
 * router.post('/data', (req, res, next) => {
 *   const { error } = schema.validate(req.body);
 *   if (error) return next(error); // Will be caught by errorHandler
 * });
 */
function errorHandler(err, req, res, next) {
  // Log all errors for debugging and monitoring
  console.error('Error:', err);

  // Handle Joi validation errors - these occur when request body/params fail schema validation
  // Joi errors have an isJoi flag and contain detailed validation failure information
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details.map(detail => detail.message)
    });
  }

  // Handle SQLite database errors - identified by error codes starting with 'SQLITE_'
  // Return generic message to avoid exposing internal database details to clients
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  // Handle all other errors - use custom status if provided, otherwise default to 500
  // This catches application-specific errors and unexpected exceptions
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = {
  errorHandler
};
