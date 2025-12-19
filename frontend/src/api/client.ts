/**
 * @fileoverview API client for the Billable Hours Tracker backend.
 * 
 * This module provides a centralized HTTP client for all API communications.
 * It handles authentication via x-user-email headers, automatic error handling,
 * and provides typed methods for all backend endpoints.
 * 
 * Features:
 * - Automatic email header injection from localStorage
 * - 401 error handling with redirect to login
 * - Request timeout configuration (10 seconds)
 * - Blob response handling for file exports
 * 
 * Endpoint Groups:
 * - Auth: login, getCurrentUser
 * - Clients: CRUD operations for client records
 * - Work Entries: CRUD operations for work entry records
 * - Reports: Report generation and CSV/PDF export
 * 
 * @module api/client
 * @requires axios - HTTP client library
 */

import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

/**
 * Base URL for API requests.
 * Empty string makes requests relative to current origin.
 * Vite proxy forwards /api requests to the backend server.
 */
const API_BASE_URL = '';

/**
 * API client class providing methods for all backend endpoints.
 * Implements singleton pattern via exported instance.
 * 
 * @class ApiClient
 * @example
 * import { apiClient } from './api/client';
 * const clients = await apiClient.getClients();
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add email header
    this.client.interceptors.request.use(
      (config) => {
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
          config.headers['x-user-email'] = userEmail;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear stored email on auth error
          localStorage.removeItem('userEmail');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Authenticate user with email address.
   * Creates new user if email doesn't exist in database.
   * @param {string} email - User's email address
   * @returns {Promise<{message: string, user: User}>} Login response with user data
   */
  async login(email: string) {
    const response = await this.client.post('/api/auth/login', { email });
    return response.data;
  }

  /**
   * Get current authenticated user's profile.
   * @returns {Promise<{user: User}>} Current user data
   */
  async getCurrentUser() {
    const response = await this.client.get('/api/auth/me');
    return response.data;
  }

  /**
   * Get all clients for the authenticated user.
   * @returns {Promise<{clients: Client[]}>} List of user's clients
   */
  async getClients() {
    const response = await this.client.get('/api/clients');
    return response.data;
  }

  /**
   * Get a specific client by ID.
   * @param {number} id - Client ID
   * @returns {Promise<{client: Client}>} Client data
   */
  async getClient(id: number) {
    const response = await this.client.get(`/api/clients/${id}`);
    return response.data;
  }

  /**
   * Create a new client.
   * @param {Object} clientData - Client creation data
   * @param {string} clientData.name - Client name (required)
   * @param {string} [clientData.description] - Client description (optional)
   * @returns {Promise<{message: string, client: Client}>} Created client data
   */
  async createClient(clientData: { name: string; description?: string }) {
    const response = await this.client.post('/api/clients', clientData);
    return response.data;
  }

  /**
   * Update an existing client.
   * @param {number} id - Client ID
   * @param {Object} clientData - Fields to update
   * @param {string} [clientData.name] - New client name
   * @param {string} [clientData.description] - New client description
   * @returns {Promise<{message: string, client: Client}>} Updated client data
   */
  async updateClient(id: number, clientData: { name?: string; description?: string }) {
    const response = await this.client.put(`/api/clients/${id}`, clientData);
    return response.data;
  }

  /**
   * Delete a client by ID.
   * Also deletes all associated work entries (CASCADE).
   * @param {number} id - Client ID
   * @returns {Promise<{message: string}>} Deletion confirmation
   */
  async deleteClient(id: number) {
    const response = await this.client.delete(`/api/clients/${id}`);
    return response.data;
  }

  /**
   * Get all work entries, optionally filtered by client.
   * @param {number} [clientId] - Optional client ID to filter entries
   * @returns {Promise<{workEntries: WorkEntry[]}>} List of work entries
   */
  async getWorkEntries(clientId?: number) {
    const params = clientId ? { clientId } : {};
    const response = await this.client.get('/api/work-entries', { params });
    return response.data;
  }

  /**
   * Get a specific work entry by ID.
   * @param {number} id - Work entry ID
   * @returns {Promise<{workEntry: WorkEntry}>} Work entry data
   */
  async getWorkEntry(id: number) {
    const response = await this.client.get(`/api/work-entries/${id}`);
    return response.data;
  }

  /**
   * Create a new work entry.
   * @param {Object} entryData - Work entry creation data
   * @param {number} entryData.clientId - Associated client ID
   * @param {number} entryData.hours - Hours worked (0.01-24)
   * @param {string} [entryData.description] - Work description
   * @param {string} entryData.date - Date in YYYY-MM-DD format
   * @returns {Promise<{message: string, workEntry: WorkEntry}>} Created work entry
   */
  async createWorkEntry(entryData: { clientId: number; hours: number; description?: string; date: string }) {
    const response = await this.client.post('/api/work-entries', entryData);
    return response.data;
  }

  /**
   * Update an existing work entry.
   * @param {number} id - Work entry ID
   * @param {Object} entryData - Fields to update
   * @param {number} [entryData.clientId] - New client ID
   * @param {number} [entryData.hours] - New hours value
   * @param {string} [entryData.description] - New description
   * @param {string} [entryData.date] - New date
   * @returns {Promise<{message: string, workEntry: WorkEntry}>} Updated work entry
   */
  async updateWorkEntry(id: number, entryData: { clientId?: number; hours?: number; description?: string; date?: string }) {
    const response = await this.client.put(`/api/work-entries/${id}`, entryData);
    return response.data;
  }

  /**
   * Delete a work entry by ID.
   * @param {number} id - Work entry ID
   * @returns {Promise<{message: string}>} Deletion confirmation
   */
  async deleteWorkEntry(id: number) {
    const response = await this.client.delete(`/api/work-entries/${id}`);
    return response.data;
  }

  /**
   * Get a detailed report for a specific client.
   * Includes all work entries and calculated total hours.
   * @param {number} clientId - Client ID
   * @returns {Promise<ClientReport>} Report with client, entries, and totals
   */
  async getClientReport(clientId: number) {
    const response = await this.client.get(`/api/reports/client/${clientId}`);
    return response.data;
  }

  /**
   * Export client report as CSV file.
   * Returns blob data for file download.
   * @param {number} clientId - Client ID
   * @returns {Promise<Blob>} CSV file blob
   */
  async exportClientReportCsv(clientId: number) {
    const response = await this.client.get(`/api/reports/export/csv/${clientId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Export client report as PDF file.
   * Returns blob data for file download.
   * @param {number} clientId - Client ID
   * @returns {Promise<Blob>} PDF file blob
   */
  async exportClientReportPdf(clientId: number) {
    const response = await this.client.get(`/api/reports/export/pdf/${clientId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Check backend server health status.
   * @returns {Promise<{status: string}>} Health check response
   */
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

/**
 * Singleton API client instance.
 * Use this exported instance for all API calls.
 */
export const apiClient = new ApiClient();
export default apiClient;
