const Joi = require('joi');

/**
 * @fileoverview Joi validation schemas for API request body validation.
 * These schemas define the expected structure and constraints for all
 * incoming data to ensure data integrity and security.
 * 
 * @module validation/schemas
 */

/**
 * Validation schema for creating a new client.
 * 
 * @type {Joi.ObjectSchema}
 * @property {string} name - Client name (required, 1-255 characters, trimmed).
 * @property {string} [description] - Optional client description (max 1000 characters, trimmed).
 * 
 * @example
 * const { error, value } = clientSchema.validate({
 *   name: 'Acme Corporation',
 *   description: 'Our primary enterprise client'
 * });
 */
const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow('')
});

/**
 * Validation schema for creating a new work entry.
 * 
 * @type {Joi.ObjectSchema}
 * @property {number} clientId - ID of the associated client (required, positive integer).
 * @property {number} hours - Hours worked (required, positive, max 24, up to 2 decimal places).
 * @property {string} [description] - Optional work description (max 1000 characters, trimmed).
 * @property {string} date - Date of work entry (required, ISO 8601 format).
 * 
 * @example
 * const { error, value } = workEntrySchema.validate({
 *   clientId: 1,
 *   hours: 2.5,
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
 * At least one field must be provided. All fields are optional to support
 * partial updates (PATCH-style semantics).
 * 
 * @type {Joi.ObjectSchema}
 * @property {number} [clientId] - New client ID (positive integer).
 * @property {number} [hours] - Updated hours worked (positive, max 24, up to 2 decimal places).
 * @property {string} [description] - Updated work description (max 1000 characters, trimmed).
 * @property {string} [date] - Updated date (ISO 8601 format).
 * 
 * @example
 * const { error, value } = updateWorkEntrySchema.validate({
 *   hours: 3.0,
 *   description: 'Updated: Backend API development'
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
 * At least one field must be provided. All fields are optional to support
 * partial updates (PATCH-style semantics).
 * 
 * @type {Joi.ObjectSchema}
 * @property {string} [name] - Updated client name (1-255 characters, trimmed).
 * @property {string} [description] - Updated client description (max 1000 characters, trimmed).
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
 * Validation schema for email-based authentication requests.
 * 
 * @type {Joi.ObjectSchema}
 * @property {string} email - User's email address (required, must be valid email format).
 * 
 * @example
 * const { error, value } = emailSchema.validate({
 *   email: 'user@example.com'
 * });
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
