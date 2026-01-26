const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * @fileoverview Database initialization and connection management module.
 * Provides singleton access to an SQLite in-memory database with automatic
 * schema creation for the billable hours tracking application.
 * 
 * @module database/init
 */

/**
 * Singleton database instance. Holds the active SQLite connection.
 * @type {sqlite3.Database|null}
 * @private
 */
let db = null;

/**
 * Retrieves the singleton SQLite database instance, creating it if necessary.
 * Uses an in-memory database for development/demo purposes. Data is lost when
 * the server restarts.
 * 
 * @returns {sqlite3.Database} The active SQLite database connection.
 * @throws {Error} If the database connection fails to open.
 * 
 * @example
 * const db = getDatabase();
 * db.all('SELECT * FROM users', [], (err, rows) => {
 *   // handle results
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
 * This function is idempotent and safe to call multiple times.
 * 
 * Creates the following tables:
 * - users: Stores user accounts identified by email
 * - clients: Stores client information owned by users
 * - work_entries: Stores billable time entries linked to clients and users
 * 
 * Also creates performance indexes on frequently queried columns:
 * - idx_clients_user_email: Optimizes client lookups by user
 * - idx_work_entries_client_id: Optimizes work entry lookups by client
 * - idx_work_entries_user_email: Optimizes work entry lookups by user
 * - idx_work_entries_date: Optimizes date-based filtering and sorting
 * 
 * @async
 * @returns {Promise<void>} Resolves when all tables and indexes are created.
 * @throws {Error} If any database operation fails during schema creation.
 * 
 * @example
 * await initializeDatabase();
 * console.log('Database ready for use');
 */
async function initializeDatabase() {
  const database = getDatabase();
  
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run(`
        CREATE TABLE IF NOT EXISTS users (
          email TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

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
 * Safe to call even if no connection exists. Logs the result of the operation.
 * 
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
