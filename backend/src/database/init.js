/**
 * @fileoverview Database initialization and connection management for the
 * Time Tracking API.
 *
 * Provides a singleton SQLite in-memory database instance with table creation,
 * index setup, and graceful shutdown helpers. Because the database is in-memory,
 * all data is lost when the process exits.
 *
 * @module database/init
 * @requires sqlite3
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/** @type {import('sqlite3').Database|null} Singleton database connection */
let db = null;

/**
 * Returns the singleton SQLite database connection, creating it on first call.
 * Subsequent calls return the same connection instance.
 *
 * @function getDatabase
 * @returns {import('sqlite3').Database} The active database connection
 * @throws {Error} If the database connection cannot be opened
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
 * Creates application tables and indexes if they do not already exist.
 *
 * Tables created:
 * - **users** -- stores registered user emails (PK: email)
 * - **clients** -- billable clients owned by a user
 * - **work_entries** -- individual time entries linked to a client and user
 *
 * Indexes created on `clients.user_email`, `work_entries.client_id`,
 * `work_entries.user_email`, and `work_entries.date`.
 *
 * @async
 * @function initializeDatabase
 * @returns {Promise<void>} Resolves when all DDL statements have been executed
 */
async function initializeDatabase() {
  const database = getDatabase();
  
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      // Create users table
      database.run(`
        CREATE TABLE IF NOT EXISTS users (
          email TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create clients table
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

      // Create work_entries table
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

      // Create indexes for better performance
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
 * Closes the active database connection and resets the singleton reference.
 * Safe to call even if no connection is open.
 *
 * @function closeDatabase
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
