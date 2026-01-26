/**
 * @fileoverview Centralized error handling middleware for the Express application.
 * Provides consistent error response formatting across all API endpoints.
 * 
 * @module middleware/errorHandler
 */

/**
 * Express error-handling middleware that processes and formats all errors.
 * This middleware should be registered after all route handlers to catch
 * any errors thrown or passed via next(error).
 * 
 * Handles the following error types:
 * - Joi validation errors: Returns 400 with detailed validation messages
 * - SQLite database errors: Returns 500 with a generic database error message
 * - Custom errors with status: Returns the specified status code
 * - Unknown errors: Returns 500 with a generic internal server error message
 * 
 * All errors are logged to the console for debugging purposes.
 * 
 * @param {Error} err - The error object caught by Express.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {void}
 * 
 * @example
 * // Register as the last middleware in the Express app
 * app.use(errorHandler);
 * 
 * @example
 * // Trigger from a route handler
 * router.post('/data', (req, res, next) => {
 *   const { error } = schema.validate(req.body);
 *   if (error) {
 *     return next(error); // Handled by errorHandler
 *   }
 * });
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
