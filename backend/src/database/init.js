const sql = require('mssql');
require('dotenv').config();

let pool = null;

async function getDatabase() {
  if (!pool) {
    const config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_HOST,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT) || 1433,
      options: {
        encrypt: true,
        trustServerCertificate: true
      }
    };
    
    pool = await sql.connect(config);
    console.log('Connected to SQL Server');
  }
  return pool;
}

async function initializeDatabase() {
  const pool = await getDatabase();
  
  try {
    // Create users table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      CREATE TABLE users (
        email VARCHAR(255) PRIMARY KEY,
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Create clients table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='clients' AND xtype='U')
      CREATE TABLE clients (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_email VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
      )
    `);

    // Create work_entries table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='work_entries' AND xtype='U')
      CREATE TABLE work_entries (
        id INT IDENTITY(1,1) PRIMARY KEY,
        client_id INT NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        hours DECIMAL(5,2) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
        FOREIGN KEY (user_email) REFERENCES users (email)
      )
    `);

    // Create indexes (SQL Server syntax - check if exists before creating)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_clients_user_email' AND object_id = OBJECT_ID('clients'))
      CREATE INDEX idx_clients_user_email ON clients (user_email)
    `);
    
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_work_entries_client_id' AND object_id = OBJECT_ID('work_entries'))
      CREATE INDEX idx_work_entries_client_id ON work_entries (client_id)
    `);
    
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_work_entries_user_email' AND object_id = OBJECT_ID('work_entries'))
      CREATE INDEX idx_work_entries_user_email ON work_entries (user_email)
    `);
    
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_work_entries_date' AND object_id = OBJECT_ID('work_entries'))
      CREATE INDEX idx_work_entries_date ON work_entries (date)
    `);

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

async function closeDatabase() {
  if (pool) {
    try {
      await pool.close();
      console.log('Database connection closed');
    } catch (err) {
      console.error('Error closing database:', err);
    }
    pool = null;
  }
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  sql
};
