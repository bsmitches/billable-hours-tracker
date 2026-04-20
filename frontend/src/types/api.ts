/**
 * @fileoverview TypeScript type definitions for the Billable Hours Tracker API.
 * 
 * This module defines interfaces for all data structures used in API
 * communication between the frontend and backend. Types are organized into:
 * - Entity types: User, Client, WorkEntry
 * - Request types: Create/Update payloads for each entity
 * - Response types: API response wrappers
 * 
 * @module types/api
 */

/**
 * User entity representing an authenticated user.
 * @interface User
 */
export interface User {
  /** User's email address (primary identifier) */
  email: string;
  /** ISO timestamp of user creation */
  createdAt: string;
}

/**
 * Client entity representing a billable client.
 * @interface Client
 */
export interface Client {
  /** Unique client identifier */
  id: number;
  /** Client name */
  name: string;
  /** Optional client description */
  description: string | null;
  /** ISO timestamp of client creation */
  created_at: string;
  /** ISO timestamp of last update */
  updated_at: string;
}

/**
 * Work entry entity representing hours worked for a client.
 * @interface WorkEntry
 */
export interface WorkEntry {
  /** Unique work entry identifier */
  id: number;
  /** Associated client ID */
  client_id: number;
  /** Hours worked (0.01-24) */
  hours: number;
  /** Optional work description */
  description: string | null;
  /** Date of work in YYYY-MM-DD format */
  date: string;
  /** ISO timestamp of entry creation */
  created_at: string;
  /** ISO timestamp of last update */
  updated_at: string;
  /** Client name (included in joined queries) */
  client_name?: string;
}

/**
 * Work entry with guaranteed client name (from joined query).
 * @interface WorkEntryWithClient
 * @extends WorkEntry
 */
export interface WorkEntryWithClient extends WorkEntry {
  /** Client name (always present in this type) */
  client_name: string;
}

/**
 * Client report with aggregated work data.
 * @interface ClientReport
 */
export interface ClientReport {
  /** Client entity */
  client: Client;
  /** All work entries for this client */
  workEntries: WorkEntry[];
  /** Sum of all hours worked */
  totalHours: number;
  /** Number of work entries */
  entryCount: number;
}

/**
 * Request payload for creating a new client.
 * @interface CreateClientRequest
 */
export interface CreateClientRequest {
  /** Client name (required, 1-255 characters) */
  name: string;
  /** Optional client description (max 1000 characters) */
  description?: string;
}

/**
 * Request payload for updating an existing client.
 * All fields are optional for partial updates.
 * @interface UpdateClientRequest
 */
export interface UpdateClientRequest {
  /** New client name */
  name?: string;
  /** New client description */
  description?: string;
}

/**
 * Request payload for creating a new work entry.
 * @interface CreateWorkEntryRequest
 */
export interface CreateWorkEntryRequest {
  /** Associated client ID (must belong to user) */
  clientId: number;
  /** Hours worked (0.01-24) */
  hours: number;
  /** Optional work description */
  description?: string;
  /** Date of work in YYYY-MM-DD format */
  date: string;
}

/**
 * Request payload for updating an existing work entry.
 * All fields are optional for partial updates.
 * @interface UpdateWorkEntryRequest
 */
export interface UpdateWorkEntryRequest {
  /** New client ID */
  clientId?: number;
  /** New hours value */
  hours?: number;
  /** New description */
  description?: string;
  /** New date */
  date?: string;
}

/**
 * Request payload for user login.
 * @interface LoginRequest
 */
export interface LoginRequest {
  /** User's email address */
  email: string;
}

/**
 * Response from successful login.
 * @interface LoginResponse
 */
export interface LoginResponse {
  /** Success message */
  message: string;
  /** Authenticated user data */
  user: User;
}

/**
 * Generic API response wrapper.
 * @interface ApiResponse
 * @template T - Type of the data payload
 */
export interface ApiResponse<T> {
  /** Response data (on success) */
  data?: T;
  /** Error message (on failure) */
  error?: string;
  /** Additional message */
  message?: string;
}
