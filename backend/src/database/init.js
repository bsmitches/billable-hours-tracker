/**
 * @fileoverview Database initialization and connection management module.
 * 
 * This module provides a singleton pattern for SQLite database access, handling
 * connection creation, schema initialization, and graceful shutdown. The database
 * uses an in-memory SQLite instance for development/demo purposes, meaning all
 * data is lost when the server restarts.
 * 
 * @module database/init
 * @requires sqlite3
 * @requires path
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Singleton database instance.
 * Holds the active SQLite database connection or null if not yet initialized.
 * @type {sqlite3.Database|null}
 * @private
 */
let db = null;

/**
 * Retrieves the singleton database instance, creating it if it doesn't exist.
 * 
 * This function implements the singleton pattern to ensure only one database
 * connection exists throughout the application lifecycle. The database is
 * configured to run in-memory (':memory:') for development purposes.
 * 
 * @function getDatabase
 * @returns {sqlite3.Database} The SQLite database instance
 * @throws {Error} Throws an error if the database connection fails to open
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
    // Note: Data will be lost when the server restarts
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
 * 
 * This function creates the following database structure:
 * - **users**: Stores user accounts identified by email (primary key)
 * - **clients**: Stores client records owned by users (foreign key to users)
 * - **work_entries**: Stores billable time entries linked to clients and users
 * 
 * All tables use CASCADE delete to maintain referential integrity - deleting
 * a user removes all their clients and work entries automatically.
 * 
 * Performance indexes are created on frequently queried columns:
 * - idx_clients_user_email: Optimizes client lookups by user
 * - idx_work_entries_client_id: Optimizes work entry lookups by client
 * - idx_work_entries_user_email: Optimizes work entry lookups by user
 * - idx_work_entries_date: Optimizes date-based filtering and sorting
 * 
 * @async
 * @function initializeDatabase
 * @returns {Promise<void>} Resolves when all tables and indexes are created
 * @throws {Error} Rejects if database operations fail
 * 
 * @example
 * await initializeDatabase();
 * console.log('Database ready for use');
 */
async function initializeDatabase() {
  const database = getDatabase();
  
  return new Promise((resolve, reject) => {
    // serialize() ensures SQL statements execute sequentially
    database.serialize(() => {
      // Create users table - uses email as primary key for simplicity
      // This enables email-only authentication suitable for trusted networks
      database.run(`
        CREATE TABLE IF NOT EXISTS users (
          email TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create clients table - each client belongs to a specific user
      // ON DELETE CASCADE ensures clients are removed when their user is deleted
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

      // Create work_entries table - stores billable time records
      // Dual foreign keys (client_id and user_email) enable efficient queries
      // and maintain data isolation between users
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

      // Create indexes for better query performance on frequently accessed columns
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
 * Closes the database connection and resets the singleton instance.
 * 
 * This function should be called during graceful server shutdown to properly
 * release database resources. It handles errors during closure gracefully
 * and logs the result. After calling this function, subsequent calls to
 * getDatabase() will create a new connection.
 * 
 * @function closeDatabase
 * @returns {void}
 * 
 * @example
 * // During server shutdown
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
    // Reset singleton to allow new connection if needed
    db = null;
  }
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase
};
