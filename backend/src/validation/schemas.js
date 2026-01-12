/**
 * @fileoverview Joi validation schemas for API request body validation.
 * 
 * This module defines validation schemas used throughout the Billable Hours
 * Tracker API to ensure incoming request data meets expected formats and
 * constraints. All schemas use Joi for declarative validation with detailed
 * error messages.
 * 
 * Validation is applied in route handlers before processing requests, and
 * validation errors are handled by the centralized error handler middleware.
 * 
 * @module validation/schemas
 * @requires joi
 */

const Joi = require('joi');

/**
 * Validation schema for creating a new client.
 * 
 * @constant {Joi.ObjectSchema} clientSchema
 * @property {string} name - Client name (required, 1-255 characters, trimmed)
 * @property {string} [description] - Client description (optional, max 1000 characters, can be empty)
 * 
 * @example
 * // Valid input
 * { name: "Acme Corp", description: "Main client for Q1 projects" }
 * { name: "Beta Inc" } // description is optional
 */
const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow('')
});

/**
 * Validation schema for creating a new work entry.
 * 
 * @constant {Joi.ObjectSchema} workEntrySchema
 * @property {number} clientId - Associated client ID (required, positive integer)
 * @property {number} hours - Hours worked (required, positive, max 24, up to 2 decimal places)
 * @property {string} [description] - Work description (optional, max 1000 characters, can be empty)
 * @property {string} date - Date of work (required, ISO 8601 format)
 * 
 * @example
 * // Valid input
 * { clientId: 1, hours: 2.5, date: "2024-01-15", description: "Development work" }
 * { clientId: 1, hours: 8, date: "2024-01-15" } // description is optional
 */
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()
});

/**
 * Validation schema for updating an existing work entry.
 * 
 * All fields are optional, but at least one must be provided (enforced by .min(1)).
 * This enables partial updates (PATCH-like behavior) on work entries.
 * 
 * @constant {Joi.ObjectSchema} updateWorkEntrySchema
 * @property {number} [clientId] - New client ID (optional, positive integer)
 * @property {number} [hours] - Updated hours (optional, positive, max 24, up to 2 decimal places)
 * @property {string} [description] - Updated description (optional, max 1000 characters, can be empty)
 * @property {string} [date] - Updated date (optional, ISO 8601 format)
 * 
 * @example
 * // Valid inputs (partial updates)
 * { hours: 3.0 }
 * { clientId: 2, description: "Updated description" }
 */
const updateWorkEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  hours: Joi.number().positive().max(24).precision(2).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().optional()
}).min(1); // At least one field must be provided for update

/**
 * Validation schema for updating an existing client.
 * 
 * All fields are optional, but at least one must be provided (enforced by .min(1)).
 * This enables partial updates (PATCH-like behavior) on clients.
 * 
 * @constant {Joi.ObjectSchema} updateClientSchema
 * @property {string} [name] - Updated client name (optional, 1-255 characters, trimmed)
 * @property {string} [description] - Updated description (optional, max 1000 characters, can be empty)
 * 
 * @example
 * // Valid inputs (partial updates)
 * { name: "Acme Corporation" }
 * { description: "Updated client description" }
 * { name: "New Name", description: "New description" }
 */
const updateClientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow('')
}).min(1); // At least one field must be provided for update

/**
 * Validation schema for email-based authentication.
 * 
 * Used by the login endpoint to validate the email address format.
 * Joi's built-in email validation ensures RFC 5322 compliance.
 * 
 * @constant {Joi.ObjectSchema} emailSchema
 * @property {string} email - User's email address (required, valid email format)
 * 
 * @example
 * // Valid input
 * { email: "user@example.com" }
 */
const emailSchema = Joi.object({
  email: Joi.string().email().required()
});

module.exports = {
  clientSchema,
  workEntrySchema,
  updateWorkEntrySchema,
  updateClientSchema,
  emailSchema
};
