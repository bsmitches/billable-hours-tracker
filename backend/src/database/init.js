/**
 * @module database/init
 * @description SQLite database initialisation and lifecycle management.
 * Uses an in-memory SQLite database and exposes helpers to obtain, initialise,
 * and close the shared connection. Tables are created idempotently on startup.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * @type {import('sqlite3').Database | null}
 * @description Singleton database connection instance. Lazily created by {@link getDatabase}.
 */
let db = null;

/**
 * @function getDatabase
 * @description Returns the singleton SQLite database connection, creating it on first call.
 * The database runs in-memory so all data is lost when the process exits.
 * @returns {import('sqlite3').Database} The active database connection.
 * @throws {Error} If the SQLite driver fails to open the in-memory database.
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
 * @async
 * @function initializeDatabase
 * @description Creates the application schema inside the SQLite database.
 *
 * Tables created:
 * - **users** – keyed by email address.
 * - **clients** – belongs to a user via `user_email`; cascades on delete.
 * - **work_entries** – belongs to both a client and a user; cascades on delete.
 *
 * Indexes are added on foreign-key and date columns to speed up common queries.
 * All statements are wrapped in `serialize()` so they execute sequentially.
 * @returns {Promise<void>} Resolves once every CREATE statement has executed.
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
 * @function closeDatabase
 * @description Gracefully closes the active database connection and resets the singleton.
 * Safe to call even if no connection is open (the call is a no-op in that case).
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
