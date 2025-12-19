/**
 * @fileoverview Vite configuration for the Billable Hours Tracker frontend.
 * 
 * This configuration file defines build and development server settings:
 * - React plugin for JSX/TSX support
 * - Development server proxy for API requests
 * 
 * Proxy Configuration:
 * - All /api requests are forwarded to the backend server at localhost:3001
 * - This enables the frontend to make API calls without CORS issues
 * 
 * @module vite.config
 * @see https://vite.dev/config/
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  /** Vite plugins - React for JSX transformation */
  plugins: [react()],
  
  /** Development server configuration */
  server: {
    /** Proxy configuration for API requests */
    proxy: {
      /** Forward /api requests to backend server */
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
