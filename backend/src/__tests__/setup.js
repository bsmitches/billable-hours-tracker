/**
 * @fileoverview Jest test setup file for the Billable Hours Tracker backend.
 * 
 * This file is executed before each test file runs (configured via setupFilesAfterEnv
 * in jest.config.js). It provides global mocks for external dependencies that would
 * otherwise cause issues in the test environment.
 * 
 * Primary Purpose:
 * - Mock the sqlite3 native module to avoid native binary loading issues
 * - Provide a consistent mock database interface for all tests
 * - Enable isolated unit testing without actual database connections
 * 
 * @module __tests__/setup
 * @see jest.config.js - Jest configuration that references this setup file
 */

/**
 * Global mock for the sqlite3 module.
 * 
 * This mock replaces the native sqlite3 module with a Jest mock implementation
 * that simulates database operations without requiring actual SQLite binaries.
 * 
 * Mock Structure:
 * - verbose(): Returns a mock sqlite3 verbose instance
 * - Database: Constructor that returns a mockDatabase object
 * - mockDatabase: Object with mocked database methods (serialize, run, get, all, close)
 * 
 * The mock database methods are Jest functions that can be configured in individual
 * tests to return specific values or simulate errors.
 * 
 * @example
 * // In a test file, you can configure mock behavior:
 * const sqlite3 = require('sqlite3');
 * const db = sqlite3.verbose().Database(':memory:');
 * db.get.mockImplementation((query, params, callback) => {
 *   callback(null, { email: 'test@example.com' });
 * });
 */
jest.mock('sqlite3', () => {
  /**
   * Mock database instance with Jest mock functions for all database operations.
   * @type {Object}
   * @property {Function} serialize - Executes callback immediately (synchronous mock)
   * @property {Function} run - Mock for INSERT/UPDATE/DELETE operations
   * @property {Function} get - Mock for SELECT single row operations
   * @property {Function} all - Mock for SELECT multiple rows operations
   * @property {Function} close - Mock for closing database connection
   */
  const mockDatabase = {
    serialize: jest.fn((callback) => callback()),
    run: jest.fn((query, paramsOrCallback, callback) => {
      const cb = typeof paramsOrCallback === 'function' ? paramsOrCallback : callback;
      if (typeof cb === 'function') cb(null);
    }),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn((callback) => callback && callback(null))
  };

  return {
    verbose: jest.fn(() => ({
      Database: jest.fn((path, callback) => {
        if (callback) callback(null);
        return mockDatabase;
      })
    }))
  };
});
