/**
 * @fileoverview Joi validation schemas for the Billable Hours Tracker API.
 * 
 * This module defines validation schemas used to validate request body data
 * before processing. All schemas use Joi for declarative validation with
 * detailed error messages.
 * 
 * Schemas:
 * - clientSchema: Validates client creation requests
 * - updateClientSchema: Validates client update requests (partial updates)
 * - workEntrySchema: Validates work entry creation requests
 * - updateWorkEntrySchema: Validates work entry update requests (partial updates)
 * - emailSchema: Validates email format for authentication
 * 
 * @module validation/schemas
 * @requires joi - Object schema validation library
 */

const Joi = require('joi');

/**
 * Validation schema for creating a new client.
 * 
 * @constant {Joi.ObjectSchema} clientSchema
 * @property {string} name - Client name (required, 1-255 characters, trimmed)
 * @property {string} [description] - Client description (optional, max 1000 characters, trimmed)
 * 
 * @example
 * const { error, value } = clientSchema.validate({
 *   name: 'Acme Corporation',
 *   description: 'Main client for software development'
 * });
 */
const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow('')
});

/**
 * Validation schema for creating a new work entry.
 * 
 * @constant {Joi.ObjectSchema} workEntrySchema
 * @property {number} clientId - Client ID (required, positive integer)
 * @property {number} hours - Hours worked (required, positive, max 24, up to 2 decimal places)
 * @property {string} [description] - Work description (optional, max 1000 characters, trimmed)
 * @property {Date} date - Date of work (required, ISO 8601 format YYYY-MM-DD)
 * 
 * @example
 * const { error, value } = workEntrySchema.validate({
 *   clientId: 1,
 *   hours: 8.5,
 *   description: 'Frontend development',
 *   date: '2024-01-15'
 * });
 */
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()
});

/**
 * Validation schema for updating an existing work entry.
 * Allows partial updates - at least one field must be provided.
 * 
 * @constant {Joi.ObjectSchema} updateWorkEntrySchema
 * @property {number} [clientId] - Updated client ID (optional, positive integer)
 * @property {number} [hours] - Updated hours worked (optional, positive, max 24, up to 2 decimal places)
 * @property {string} [description] - Updated work description (optional, max 1000 characters, trimmed)
 * @property {Date} [date] - Updated date of work (optional, ISO 8601 format YYYY-MM-DD)
 * 
 * @example
 * const { error, value } = updateWorkEntrySchema.validate({
 *   hours: 10,
 *   description: 'Extended development work'
 * });
 */
const updateWorkEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  hours: Joi.number().positive().max(24).precision(2).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().optional()
}).min(1);

/**
 * Validation schema for updating an existing client.
 * Allows partial updates - at least one field must be provided.
 * 
 * @constant {Joi.ObjectSchema} updateClientSchema
 * @property {string} [name] - Updated client name (optional, 1-255 characters, trimmed)
 * @property {string} [description] - Updated client description (optional, max 1000 characters, trimmed)
 * 
 * @example
 * const { error, value } = updateClientSchema.validate({
 *   name: 'Acme Corp International'
 * });
 */
const updateClientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow('')
}).min(1);

/**
 * Validation schema for email-based authentication.
 * Used to validate login requests.
 * 
 * @constant {Joi.ObjectSchema} emailSchema
 * @property {string} email - User's email address (required, valid email format)
 * 
 * @example
 * const { error, value } = emailSchema.validate({
 *   email: 'user@example.com'
 * });
 */
const emailSchema = Joi.object({
  email: Joi.string().email().required()
});

/**
 * Module exports for validation schemas.
 * @exports {Object}
 * @property {Joi.ObjectSchema} clientSchema - Schema for client creation
 * @property {Joi.ObjectSchema} workEntrySchema - Schema for work entry creation
 * @property {Joi.ObjectSchema} updateWorkEntrySchema - Schema for work entry updates
 * @property {Joi.ObjectSchema} updateClientSchema - Schema for client updates
 * @property {Joi.ObjectSchema} emailSchema - Schema for email validation
 */
module.exports = {
  clientSchema,
  workEntrySchema,
  updateWorkEntrySchema,
  updateClientSchema,
  emailSchema
};
