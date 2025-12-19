/**
 * @fileoverview Main Express server configuration and entry point for the Billable Hours Tracker API.
 * 
 * This file sets up the Express application with all necessary middleware, routes, and security
 * configurations. It serves as the central hub for the backend API, handling HTTP requests for
 * authentication, client management, work entry tracking, and report generation.
 * 
 * The server uses an in-memory SQLite database for development purposes, which means data
 * is not persisted between server restarts. For production use, this should be configured
 * to use a persistent database.
 * 
 * @module server
 * @requires express - Web framework for Node.js
 * @requires cors - Cross-Origin Resource Sharing middleware
 * @requires helmet - Security middleware for HTTP headers
 * @requires morgan - HTTP request logger middleware
 * @requires express-rate-limit - Rate limiting middleware to prevent abuse
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const workEntryRoutes = require('./routes/workEntries');
const reportRoutes = require('./routes/reports');

const { initializeDatabase } = require('./database/init');
const { errorHandler } = require('./middleware/errorHandler');

/**
 * Express application instance configured with middleware and routes.
 * @type {express.Application}
 */
const app = express();

/**
 * Server port number. Defaults to 3001 if PORT environment variable is not set.
 * @type {number}
 */
const PORT = process.env.PORT || 3001;

/**
 * Security middleware configuration.
 * Helmet sets various HTTP headers to help protect the app from well-known web vulnerabilities.
 */
app.use(helmet());

/**
 * CORS (Cross-Origin Resource Sharing) configuration.
 * Allows the frontend application to make requests to this API from a different origin.
 * @property {string} origin - Allowed origin URL (defaults to localhost:5173 for development)
 * @property {boolean} credentials - Enables sending cookies and authentication headers
 */
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

/**
 * Rate limiter configuration to prevent API abuse and DDoS attacks.
 * Limits each IP address to a maximum number of requests within a time window.
 * @type {express.RequestHandler}
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 100 // Maximum 100 requests per IP per window
});
app.use(limiter);

/**
 * HTTP request logging middleware.
 * Uses 'combined' format which includes remote address, user, timestamp, method, URL,
 * HTTP version, status code, response size, referrer, and user agent.
 */
app.use(morgan('combined'));

/**
 * Request body parsing middleware.
 * Parses incoming JSON payloads with a maximum size limit of 10MB.
 * Also parses URL-encoded bodies for form submissions.
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * Health check endpoint for monitoring and load balancer health probes.
 * @route GET /health
 * @returns {Object} JSON object with status 'OK' and current timestamp
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

/**
 * API Route Mounting.
 * All API routes are prefixed with /api and organized by resource type.
 * - /api/auth - Authentication endpoints (login, user info)
 * - /api/clients - Client CRUD operations
 * - /api/work-entries - Work entry CRUD operations
 * - /api/reports - Report generation and export endpoints
 */
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/work-entries', workEntryRoutes);
app.use('/api/reports', reportRoutes);

/**
 * Global error handling middleware.
 * Catches all errors thrown in route handlers and formats appropriate error responses.
 * Handles Joi validation errors, SQLite errors, and generic errors.
 */
app.use(errorHandler);

/**
 * Catch-all 404 handler for undefined routes.
 * Returns a JSON error response for any request that doesn't match defined routes.
 * @route * (all methods, all paths not matched above)
 * @returns {Object} JSON object with error message
 */
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Initializes the database and starts the Express server.
 * This function is called when the module is executed directly.
 * It ensures the database schema is created before accepting requests.
 * 
 * @async
 * @function startServer
 * @returns {Promise<void>}
 * @throws {Error} If database initialization fails, logs error and exits with code 1
 */
async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

/**
 * Export the Express app instance for testing purposes.
 * This allows test files to import the app and make requests without starting the server.
 * @exports app
 */
module.exports = app;
