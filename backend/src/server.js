/**
 * @module server
 * @description Express application entry point for the Billable Hours Tracker API.
 * Configures middleware (security, rate limiting, logging, body parsing),
 * mounts route handlers, and starts the HTTP server after initializing the database.
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

/** @type {import('express').Application} */
const app = express();

/** @type {number} Server port, defaults to 3001 if PORT env var is not set. */
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

/**
 * @description Rate limiter that restricts each IP to 100 requests per 15-minute window.
 * @type {import('express').RequestHandler}
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(morgan('combined'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * @route GET /health
 * @description Returns a 200 status with an OK message and the current server timestamp.
 * Useful for load-balancer and uptime-monitor health probes.
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
 * @description Catch-all handler for unmatched routes. Returns a 404 JSON response.
 */
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * @async
 * @function startServer
 * @description Initializes the SQLite database and starts the Express HTTP server.
 * Exits the process with code 1 if database initialization fails.
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
