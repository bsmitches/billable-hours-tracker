/**
 * @module middleware/errorHandler
 * @description Centralised Express error-handling middleware.
 * Catches errors forwarded by route handlers via `next(err)` and maps them
 * to appropriate HTTP responses so that internal details are never leaked.
 */

/**
 * @function errorHandler
 * @description Express error-handling middleware (four-argument signature).
 *
 * Handles the following error categories:
 * - **Joi validation errors** (`err.isJoi === true`) → 400 with field-level details.
 * - **SQLite errors** (error code prefixed with `SQLITE_`) → generic 500 message.
 * - **All other errors** → uses `err.status` if set, otherwise defaults to 500.
 *
 * @param {Error} err - The error object thrown or passed to `next()`.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next callback (required by Express error-handler signature).
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
