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
 * @fileoverview Main Express application entry point for the Billable Hours Tracker API.
 * Configures middleware stack, routes, and server initialization.
 * 
 * The middleware pipeline processes requests in the following order:
 * 1. Security headers (Helmet)
 * 2. CORS validation
 * 3. Rate limiting (100 requests per 15 minutes per IP)
 * 4. HTTP request logging (Morgan)
 * 5. Body parsing (JSON and URL-encoded)
 * 6. Route handlers
 * 7. Error handling
 * 8. 404 fallback
 * 
 * @module server
 */

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

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

/**
 * Rate limiter configuration to prevent abuse.
 * Limits each IP address to 100 requests per 15-minute window.
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

app.use(morgan('combined'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * @route GET /health
 * @description Health check endpoint for monitoring and load balancer probes.
 * Returns the current server status and timestamp.
 * 
 * @returns {Object} 200 - Server status with timestamp.
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
 * Fallback handler for undefined routes.
 * Returns a 404 error for any request that doesn't match defined routes.
 */
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Initializes the database and starts the Express server.
 * This function is called automatically when the module is loaded.
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If database initialization fails, the process exits with code 1.
 * 
 * @example
 * // Server startup logs
 * // "Connected to SQLite in-memory database"
 * // "Database tables created successfully"
 * // "Server running on port 3001"
 * // "Health check: http://localhost:3001/health"
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
