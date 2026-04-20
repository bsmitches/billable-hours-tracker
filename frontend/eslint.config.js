/**
 * @fileoverview ESLint configuration for the Billable Hours Tracker frontend.
 * 
 * This configuration file defines linting rules for TypeScript and React code:
 * - JavaScript recommended rules
 * - TypeScript ESLint recommended rules
 * - React Hooks rules for proper hook usage
 * - React Refresh rules for Vite HMR compatibility
 * 
 * Ignored Paths:
 * - dist/ - Build output directory
 * 
 * @module eslint.config
 * @see https://eslint.org/docs/latest/use/configure/
 */

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  /** Ignore build output directory */
  globalIgnores(['dist']),
  {
    /** Apply to TypeScript files */
    files: ['**/*.{ts,tsx}'],
    
    /** Extend recommended configurations */
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    
    /** Language options for parsing */
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
