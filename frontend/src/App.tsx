/**
 * @fileoverview Root application component for the Billable Hours Tracker.
 * 
 * This module sets up the application's core infrastructure including:
 * - Material-UI theme configuration with custom color palette
 * - React Query client for server-side state management
 * - Authentication context provider for global auth state
 * - React Router configuration for client-side navigation
 * 
 * Routes:
 * - /login - Email authentication page (public)
 * - /dashboard - Overview metrics and quick actions (protected)
 * - /clients - Client management CRUD interface (protected)
 * - /work-entries - Work entry tracking interface (protected)
 * - /reports - Report generation and export (protected)
 * 
 * @module App
 * @requires react - React library for UI components
 * @requires react-router-dom - Client-side routing
 * @requires @tanstack/react-query - Server-side state management
 * @requires @mui/material - Material-UI component library
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import WorkEntriesPage from './pages/WorkEntriesPage';
import ReportsPage from './pages/ReportsPage';

/**
 * Material-UI theme configuration.
 * Defines the application's color palette with primary blue and secondary pink.
 */
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

/**
 * React Query client configuration.
 * Configures default query behavior:
 * - retry: 1 - Retry failed queries once before showing error
 * - refetchOnWindowFocus: false - Don't refetch when window regains focus
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Inner application content component with routing logic.
 * Handles authentication state and renders appropriate routes.
 * Protected routes are wrapped in Layout component with navigation.
 * Unauthenticated users are redirected to login page.
 * 
 * @returns {JSX.Element} Router with configured routes
 */
const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/work-entries" element={<WorkEntriesPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
};

/**
 * Root application component.
 * Sets up the provider hierarchy for the application:
 * 1. QueryClientProvider - React Query for data fetching
 * 2. ThemeProvider - Material-UI theming
 * 3. CssBaseline - Normalize CSS across browsers
 * 4. AuthProvider - Authentication state management
 * 
 * @returns {JSX.Element} Fully configured application with all providers
 */
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
