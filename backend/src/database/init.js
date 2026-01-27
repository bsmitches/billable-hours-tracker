/**
 * @fileoverview Database initialization and management for the Billable Hours Tracker API.
 * Provides SQLite database connection, schema creation, and lifecycle management.
 * Uses an in-memory database for development/demo purposes.
 * @module database/init
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Singleton database instance.
 * @type {sqlite3.Database|null}
 * @private
 */
let db = null;

/**
 * Gets or creates the SQLite database connection.
 * Uses a singleton pattern to ensure only one database connection exists.
 * The database runs in-memory mode, meaning all data is lost on server restart.
 * 
 * @function getDatabase
 * @returns {sqlite3.Database} The SQLite database instance
 * @throws {Error} If database connection fails
 * 
 * @example
 * const db = getDatabase();
 * db.all('SELECT * FROM users', [], (err, rows) => {
 *   // Handle results
 * });
 */
function getDatabase() {
  if (!db) {
    // Use in-memory database as specified in requirements
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
 * Creates the following tables:
 * - users: Stores user accounts (email-based identification)
 * - clients: Stores client records with user ownership
 * - work_entries: Stores billable time entries linked to clients and users
 * 
 * Also creates performance indexes on frequently queried columns.
 * 
 * @async
 * @function initializeDatabase
 * @returns {Promise<void>} Resolves when all tables and indexes are created
 * @throws {Error} If table creation fails
 * 
 * @example
 * await initializeDatabase();
 * console.log('Database ready');
 */
async function initializeDatabase() {
  const database = getDatabase();
  
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      // Create users table - stores user accounts with email as primary key
      database.run(`
        CREATE TABLE IF NOT EXISTS users (
          email TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create clients table - stores client records owned by users
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

      // Create work_entries table - stores billable time entries
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

      // Create indexes for better query performance
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
 * Closes the database connection and releases resources.
 * Sets the singleton instance to null to allow reconnection if needed.
 * Safe to call multiple times - does nothing if database is already closed.
 * 
 * @function closeDatabase
 * @returns {void}
 * 
 * @example
 * // Graceful shutdown
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

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase
};
