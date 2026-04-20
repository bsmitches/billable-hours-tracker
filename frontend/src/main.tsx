/**
 * @fileoverview Application entry point for the Billable Hours Tracker frontend.
 * 
 * This file bootstraps the React application by mounting the root App component
 * to the DOM. It uses React 18's createRoot API for concurrent rendering features
 * and wraps the app in StrictMode for development-time checks.
 * 
 * @module main
 * @requires react - React library for UI components
 * @requires react-dom/client - React DOM client for rendering
 * @requires ./App - Root application component
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/**
 * Mount the React application to the DOM.
 * Uses the root element with id 'root' from index.html.
 * StrictMode enables additional development checks and warnings.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
