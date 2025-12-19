/**
 * @fileoverview Jest configuration for the Billable Hours Tracker backend.
 * 
 * This configuration file defines test settings including:
 * - Test environment (Node.js)
 * - Setup files for global mocks
 * - Coverage collection and thresholds
 * - Test file patterns and timeouts
 * 
 * Coverage Thresholds:
 * - Branches: 60% minimum
 * - Functions: 65% minimum
 * - Lines: 60% minimum
 * - Statements: 60% minimum
 * 
 * @module jest.config
 * @see https://jestjs.io/docs/configuration
 */

module.exports = {
  /** Use Node.js test environment for backend testing */
  testEnvironment: 'node',
  
  /** Setup files to run after Jest is initialized (mocks sqlite3) */
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
  
  /** Directory for coverage reports */
  coverageDirectory: 'coverage',
  
  /** Files to include in coverage collection */
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js', // Exclude server startup file
    '!**/node_modules/**'
  ],
  
  /** Coverage report formats */
  coverageReporters: ['text', 'lcov', 'html'],
  
  /** Pattern to find test files */
  testMatch: ['**/__tests__/**/*.test.js'],
  
  /** Minimum coverage thresholds - tests fail if not met */
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 65,
      lines: 60,
      statements: 60
    }
  },
  
  /** Enable verbose test output */
  verbose: true,
  
  /** Test timeout in milliseconds (10 seconds) */
  testTimeout: 10000
};
