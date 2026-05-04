/**
 * @fileoverview Main Express server entry point for the Billable Hours Tracker API.
 * Configures middleware stack, routes, and initializes the database.
 * 
 * @module server
 * 
 * @description
 * Server configuration includes:
 * - Security headers (Helmet)
 * - CORS for frontend communication
 * - Rate limiting for API protection
 * - Request logging (Morgan)
 * - JSON body parsing
 * - Centralized error handling
 * 
 * API Routes:
 * - /api/auth - Authentication endpoints
 * - /api/clients - Client management
 * - /api/work-entries - Work entry tracking
 * - /api/reports - Report generation and export
 * - /health - Health check endpoint
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

const app = express();

/** @type {number} Server port from environment or default 3001 */
const PORT = process.env.PORT || 3001;

// Security middleware - sets various HTTP headers for protection
app.use(helmet());

// CORS configuration - allows frontend to communicate with API
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

/**
 * Rate limiter configuration to prevent API abuse.
 * Limits each IP to 100 requests per 15-minute window.
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// HTTP request logging in Apache combined format
app.use(morgan('combined'));

// Body parsing middleware with 10MB limit for JSON payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * Health check endpoint for monitoring and load balancer probes.
 * @route GET /health
 * @returns {Object} 200 - Status OK with current timestamp
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API route mounting
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/work-entries', workEntryRoutes);
app.use('/api/reports', reportRoutes);

// Centralized error handling middleware
app.use(errorHandler);

// Catch-all 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Initializes the database and starts the Express server.
 * Exits with code 1 if initialization fails.
 * @async
 * @returns {Promise<void>}
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
