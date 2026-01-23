/**
 * @fileoverview Main Express server configuration for the Billable Hours Tracker API.
 * Sets up middleware stack, routes, and server initialization.
 * 
 * Middleware pipeline (in order):
 * 1. Helmet - Security headers
 * 2. CORS - Cross-origin resource sharing
 * 3. Rate limiting - Request throttling (100 req/15min per IP)
 * 4. Morgan - HTTP request logging
 * 5. Body parsing - JSON and URL-encoded bodies
 * 6. Route handlers - API endpoints
 * 7. Error handler - Centralized error processing
 * 8. 404 handler - Catch-all for undefined routes
 * 
 * @module server
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
 * Express application instance.
 * @type {import('express').Application}
 */
const app = express();

/**
 * Server port number. Defaults to 3001 if PORT environment variable is not set.
 * @type {number}
 */
const PORT = process.env.PORT || 3001;

/**
 * Rate limiter configuration.
 * Limits each IP address to 100 requests per 15-minute window.
 * Helps prevent brute force attacks and API abuse.
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(limiter);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * GET /health
 * Health check endpoint for monitoring and load balancer probes.
 * Returns server status and current timestamp.
 * 
 * @name HealthCheck
 * @route {GET} /health
 * @returns {Object} 200 - Server status with timestamp
 * 
 * @example
 * // Response
 * { "status": "OK", "timestamp": "2024-01-15T10:30:00.000Z" }
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/work-entries', workEntryRoutes);
app.use('/api/reports', reportRoutes);

app.use(errorHandler);

/**
 * Catch-all 404 handler for undefined routes.
 * Returns a JSON error response for any unmatched routes.
 */
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Initializes the database and starts the Express server.
 * This is the main entry point for the application.
 * 
 * Startup sequence:
 * 1. Initialize SQLite database and create tables
 * 2. Start HTTP server on configured port
 * 3. Log startup confirmation with health check URL
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If database initialization or server startup fails (exits with code 1)
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

module.exports = app;
