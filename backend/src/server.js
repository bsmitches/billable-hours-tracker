/**
 * @fileoverview Main Express server configuration and application entry point.
 * 
 * This module initializes and configures the Express application for the Billable
 * Hours Tracker API. It sets up security middleware, request parsing, logging,
 * rate limiting, and mounts all API route handlers.
 * 
 * Server Features:
 * - Security headers via Helmet
 * - CORS configuration for frontend access
 * - Rate limiting to prevent abuse
 * - Request logging with Morgan
 * - Centralized error handling
 * - Health check endpoint for monitoring
 * 
 * @module server
 * @requires express
 * @requires cors
 * @requires helmet
 * @requires morgan
 * @requires express-rate-limit
 * @requires ./routes/auth
 * @requires ./routes/clients
 * @requires ./routes/workEntries
 * @requires ./routes/reports
 * @requires ./database/init
 * @requires ./middleware/errorHandler
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import route handlers
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const workEntryRoutes = require('./routes/workEntries');
const reportRoutes = require('./routes/reports');

// Import database and middleware
const { initializeDatabase } = require('./database/init');
const { errorHandler } = require('./middleware/errorHandler');

/**
 * Express application instance.
 * @type {import('express').Application}
 */
const app = express();

/**
 * Server port - defaults to 3001 if PORT environment variable is not set.
 * @type {number}
 */
const PORT = process.env.PORT || 3001;

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Helmet adds various HTTP headers for security (XSS protection, etc.)
app.use(helmet());

// CORS configuration - allows requests from the frontend application
// In production, FRONTEND_URL should be set to the actual frontend domain
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Rate limiter configuration to prevent abuse and brute force attacks.
 * Limits each IP to 100 requests per 15-minute window.
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
  max: 100 // Maximum requests per window per IP
});
app.use(limiter);

// =============================================================================
// REQUEST LOGGING
// =============================================================================

// Morgan logs all HTTP requests in Apache combined format
// Useful for debugging and monitoring in development/production
app.use(morgan('combined'));

// =============================================================================
// BODY PARSING
// =============================================================================

// Parse JSON request bodies with a 10MB limit
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded request bodies (form submissions)
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

/**
 * GET /health
 * 
 * Health check endpoint for monitoring and load balancer health probes.
 * Returns current server status and timestamp.
 * 
 * @name HealthCheck
 * @route {GET} /health
 * @returns {Object} 200 - Server status with timestamp
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// =============================================================================
// API ROUTES
// =============================================================================

// Mount authentication routes at /api/auth
app.use('/api/auth', authRoutes);

// Mount client management routes at /api/clients
app.use('/api/clients', clientRoutes);

// Mount work entry routes at /api/work-entries
app.use('/api/work-entries', workEntryRoutes);

// Mount report generation routes at /api/reports
app.use('/api/reports', reportRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// Centralized error handler - must be registered after all routes
app.use(errorHandler);

// =============================================================================
// 404 HANDLER
// =============================================================================

/**
 * Catch-all handler for undefined routes.
 * Returns 404 error for any request that doesn't match defined routes.
 */
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// =============================================================================
// SERVER INITIALIZATION
// =============================================================================

/**
 * Initializes the database and starts the Express server.
 * 
 * This function performs the following steps:
 * 1. Initializes the SQLite database and creates tables
 * 2. Starts the HTTP server on the configured port
 * 3. Logs startup information including health check URL
 * 
 * If initialization fails, the process exits with code 1.
 * 
 * @async
 * @function startServer
 * @returns {Promise<void>}
 */
async function startServer() {
  try {
    // Initialize database schema before accepting requests
    await initializeDatabase();
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Export app for testing purposes
module.exports = app;
