/**
 * @fileoverview Joi validation schemas for the Billable Hours Tracker API.
 * Defines input validation rules for all API endpoints to ensure data integrity.
 * @module validation/schemas
 */

const Joi = require('joi');

/**
 * Validation schema for creating a new client.
 * @type {Joi.ObjectSchema}
 * @property {string} name - Client name (required, 1-255 characters, trimmed)
 * @property {string} [description] - Client description (optional, max 1000 characters, trimmed)
 */
const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow('')
});

/**
 * Validation schema for creating a new work entry.
 * @type {Joi.ObjectSchema}
 * @property {number} clientId - Associated client ID (required, positive integer)
 * @property {number} hours - Hours worked (required, positive, max 24, 2 decimal precision)
 * @property {string} [description] - Work description (optional, max 1000 characters, trimmed)
 * @property {string} date - Date of work (required, ISO 8601 format)
 */
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()
});

/**
 * Validation schema for updating an existing work entry.
 * At least one field must be provided for the update to be valid.
 * @type {Joi.ObjectSchema}
 * @property {number} [clientId] - Updated client ID (optional, positive integer)
 * @property {number} [hours] - Updated hours (optional, positive, max 24, 2 decimal precision)
 * @property {string} [description] - Updated description (optional, max 1000 characters, trimmed)
 * @property {string} [date] - Updated date (optional, ISO 8601 format)
 */
const updateWorkEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  hours: Joi.number().positive().max(24).precision(2).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().optional()
}).min(1); // At least one field must be provided

/**
 * Validation schema for updating an existing client.
 * At least one field must be provided for the update to be valid.
 * @type {Joi.ObjectSchema}
 * @property {string} [name] - Updated client name (optional, 1-255 characters, trimmed)
 * @property {string} [description] - Updated description (optional, max 1000 characters, trimmed)
 */
const updateClientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow('')
}).min(1); // At least one field must be provided

/**
 * Validation schema for email-based authentication.
 * @type {Joi.ObjectSchema}
 * @property {string} email - User's email address (required, valid email format)
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
