/**
 * @fileoverview Database initialization and connection management module.
 * 
 * This module provides functions for managing the SQLite database connection and schema.
 * It implements a singleton pattern for the database connection to ensure only one
 * connection exists throughout the application lifecycle.
 * 
 * The database uses an in-memory SQLite database for development, which means all data
 * is lost when the server restarts. For production use, the database path should be
 * changed to a persistent file location.
 * 
 * Database Schema:
 * - users: Stores user accounts (email-based authentication)
 * - clients: Stores client records owned by users
 * - work_entries: Stores hourly work records linked to clients and users
 * 
 * @module database/init
 * @requires sqlite3 - SQLite database driver for Node.js
 * @requires path - Node.js path utilities (imported but not currently used)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Singleton database connection instance.
 * Initialized as null and created on first call to getDatabase().
 * @type {sqlite3.Database|null}
 * @private
 */
let db = null;

/**
 * Gets or creates the SQLite database connection.
 * Implements a singleton pattern to ensure only one database connection exists.
 * Uses an in-memory database for development purposes.
 * 
 * @function getDatabase
 * @returns {sqlite3.Database} The SQLite database instance
 * @throws {Error} If the database connection fails to open
 * 
 * @example
 * const db = getDatabase();
 * db.all('SELECT * FROM users', [], (err, rows) => {
 *   // Handle results
 * });
 */
function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(':memory:', (err) => {
      if (err) {
        console.error('Error opening database:', err);
        throw err;
      }
      console.log('Connected to SQLite in-memory database');
    });
  }
  return db;
}

/**
 * Initializes the database schema by creating all required tables and indexes.
 * This function should be called once when the server starts, before handling any requests.
 * 
 * Creates the following tables:
 * 
 * **users** - User accounts table
 * - email (TEXT, PRIMARY KEY): User's email address, used as unique identifier
 * - created_at (DATETIME): Timestamp when the user was created
 * 
 * **clients** - Client records table
 * - id (INTEGER, PRIMARY KEY): Auto-incrementing client ID
 * - name (TEXT, NOT NULL): Client name
 * - description (TEXT): Optional client description
 * - user_email (TEXT, NOT NULL): Foreign key to users table (owner)
 * - created_at (DATETIME): Timestamp when the client was created
 * - updated_at (DATETIME): Timestamp when the client was last updated
 * 
 * **work_entries** - Work time entries table
 * - id (INTEGER, PRIMARY KEY): Auto-incrementing entry ID
 * - client_id (INTEGER, NOT NULL): Foreign key to clients table
 * - user_email (TEXT, NOT NULL): Foreign key to users table
 * - hours (DECIMAL(5,2), NOT NULL): Hours worked (0.01 to 24)
 * - description (TEXT): Optional work description
 * - date (DATE, NOT NULL): Date the work was performed
 * - created_at (DATETIME): Timestamp when the entry was created
 * - updated_at (DATETIME): Timestamp when the entry was last updated
 * 
 * Also creates indexes for optimized query performance on frequently filtered columns.
 * 
 * @async
 * @function initializeDatabase
 * @returns {Promise<void>} Resolves when all tables and indexes are created
 * 
 * @example
 * await initializeDatabase();
 * console.log('Database ready');
 */
async function initializeDatabase() {
  const database = getDatabase();
  
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      /**
       * Users table - stores user accounts with email-based authentication.
       * Email serves as the primary key since authentication is email-only.
       */
      database.run(`
        CREATE TABLE IF NOT EXISTS users (
          email TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      /**
       * Clients table - stores client records owned by users.
       * Each client belongs to a single user (identified by user_email).
       * ON DELETE CASCADE ensures clients are deleted when their owner is deleted.
       */
      database.run(`
        CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          user_email TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
        )
      `);

      /**
       * Work entries table - stores hourly work records.
       * Each entry is linked to both a client and a user.
       * ON DELETE CASCADE ensures entries are deleted when their client or user is deleted.
       */
      database.run(`
        CREATE TABLE IF NOT EXISTS work_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id INTEGER NOT NULL,
          user_email TEXT NOT NULL,
          hours DECIMAL(5,2) NOT NULL,
          description TEXT,
          date DATE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
          FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
        )
      `);

      /**
       * Database indexes for query optimization.
       * These indexes improve performance for common query patterns:
       * - idx_clients_user_email: Speeds up client lookups by user
       * - idx_work_entries_client_id: Speeds up work entry lookups by client
       * - idx_work_entries_user_email: Speeds up work entry lookups by user
       * - idx_work_entries_date: Speeds up date-based filtering and sorting
       */
      database.run(`CREATE INDEX IF NOT EXISTS idx_clients_user_email ON clients (user_email)`);
      database.run(`CREATE INDEX IF NOT EXISTS idx_work_entries_client_id ON work_entries (client_id)`);
      database.run(`CREATE INDEX IF NOT EXISTS idx_work_entries_user_email ON work_entries (user_email)`);
      database.run(`CREATE INDEX IF NOT EXISTS idx_work_entries_date ON work_entries (date)`);

      console.log('Database tables created successfully');
      resolve();
    });
  });
}

/**
 * Closes the database connection gracefully.
 * Should be called when shutting down the server to ensure proper cleanup.
 * After calling this function, getDatabase() will create a new connection if called again.
 * 
 * @function closeDatabase
 * @returns {void}
 * 
 * @example
 * process.on('SIGTERM', () => {
 *   closeDatabase();
 *   process.exit(0);
 * });
 */
function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
    db = null;
  }
}

/**
 * Module exports for database management functions.
 * @exports {Object}
 * @property {Function} getDatabase - Gets or creates the database connection
 * @property {Function} initializeDatabase - Creates database schema
 * @property {Function} closeDatabase - Closes the database connection
 */
module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase
};
