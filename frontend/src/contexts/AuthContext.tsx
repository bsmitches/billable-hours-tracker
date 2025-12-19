/**
 * @fileoverview Authentication context provider for the Billable Hours Tracker.
 * 
 * This module provides global authentication state management using React Context.
 * It handles user login, logout, and session persistence via localStorage.
 * 
 * Features:
 * - Email-based authentication (no passwords)
 * - Automatic session restoration on page load
 * - Loading state during authentication checks
 * - Centralized auth state accessible throughout the app
 * 
 * @module contexts/AuthContext
 * @requires react - React library for context and hooks
 * @requires ../types/api - TypeScript type definitions
 * @requires ../api/client - API client for auth endpoints
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type User } from '../types/api';
import apiClient from '../api/client';

/**
 * Shape of the authentication context value.
 * @interface AuthContextType
 */
interface AuthContextType {
  /** Current authenticated user or null if not logged in */
  user: User | null;
  /** Function to log in with email address */
  login: (email: string) => Promise<void>;
  /** Function to log out and clear session */
  logout: () => void;
  /** True while checking authentication status */
  isLoading: boolean;
  /** True if user is authenticated */
  isAuthenticated: boolean;
}

/**
 * React Context for authentication state.
 * Undefined when accessed outside of AuthProvider.
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Custom hook to access authentication context.
 * Must be used within an AuthProvider component.
 * 
 * @returns {AuthContextType} Authentication context value
 * @throws {Error} If used outside of AuthProvider
 * 
 * @example
 * const { user, login, logout, isAuthenticated } = useAuth();
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Props for the AuthProvider component.
 * @interface AuthProviderProps
 */
interface AuthProviderProps {
  /** Child components to wrap with auth context */
  children: ReactNode;
}

/**
 * Authentication provider component.
 * Wraps the application to provide authentication state to all children.
 * Automatically checks for existing session on mount.
 * 
 * @param {AuthProviderProps} props - Component props
 * @returns {JSX.Element} Context provider wrapping children
 * 
 * @example
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const storedEmail = localStorage.getItem('userEmail');
      
      if (storedEmail) {
        try {
          const response = await apiClient.getCurrentUser();
          setUser(response.user);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('userEmail');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string) => {
    try {
      const response = await apiClient.login(email);
      setUser(response.user);
      localStorage.setItem('userEmail', email);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('userEmail');
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
