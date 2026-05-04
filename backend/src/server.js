/**
 * @fileoverview Main Express server configuration and initialization for the Billable Hours Tracker API.
 * This module sets up middleware, routes, and starts the HTTP server.
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
 * @type {express.Application}
 */
const app = express();

/**
 * Server port number, defaults to 3001 if not specified in environment.
 * @type {number}
 */
const PORT = process.env.PORT || 3001;

// Security middleware - adds various HTTP headers for security
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

/**
 * Rate limiter configuration to prevent abuse.
 * Limits each IP to 100 requests per 15-minute window.
 * @type {express.RequestHandler}
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// HTTP request logging middleware
app.use(morgan('combined'));

// Body parsing middleware with 10MB limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * Health check endpoint.
 * @route GET /health
 * @returns {Object} 200 - Health status with timestamp
 * @example response - 200 - Success
 * {
 *   "status": "OK",
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/work-entries', workEntryRoutes);
app.use('/api/reports', reportRoutes);

// Centralized error handling middleware
app.use(errorHandler);

/**
 * 404 handler for undefined routes.
 * @route * (all unmatched routes)
 * @returns {Object} 404 - Route not found error
 */
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Initializes the database and starts the Express server.
 * This function sets up the SQLite database tables and begins listening for HTTP requests.
 * @async
 * @function startServer
 * @returns {Promise<void>}
 * @throws {Error} If database initialization fails or server cannot start
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
