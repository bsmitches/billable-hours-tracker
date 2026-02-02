/**
 * @fileoverview Joi validation schemas for API request body validation.
 * Defines schemas for clients, work entries, and authentication requests.
 * All schemas enforce data integrity constraints matching the database schema.
 * 
 * @module validation/schemas
 */

const Joi = require('joi');

/**
 * Validation schema for creating a new client.
 * @type {Joi.ObjectSchema}
 * @property {string} name - Client name (1-255 characters, required)
 * @property {string} [description] - Optional client description (max 1000 characters)
 */
const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow('')
});

/**
 * Validation schema for creating a new work entry.
 * @type {Joi.ObjectSchema}
 * @property {number} clientId - ID of the associated client (positive integer, required)
 * @property {number} hours - Hours worked (positive number, max 24, 2 decimal precision, required)
 * @property {string} [description] - Optional work description (max 1000 characters)
 * @property {string} date - Date of work entry in ISO format (required)
 */
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()
});

/**
 * Validation schema for updating an existing work entry.
 * All fields are optional but at least one must be provided.
 * @type {Joi.ObjectSchema}
 * @property {number} [clientId] - New client ID (positive integer)
 * @property {number} [hours] - Updated hours (positive number, max 24)
 * @property {string} [description] - Updated description (max 1000 characters)
 * @property {string} [date] - Updated date in ISO format
 */
const updateWorkEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  hours: Joi.number().positive().max(24).precision(2).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().optional()
}).min(1);

/**
 * Validation schema for updating an existing client.
 * All fields are optional but at least one must be provided.
 * @type {Joi.ObjectSchema}
 * @property {string} [name] - Updated client name (1-255 characters)
 * @property {string} [description] - Updated description (max 1000 characters)
 */
const updateClientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow('')
}).min(1);

/**
 * Validation schema for user authentication/login requests.
 * @type {Joi.ObjectSchema}
 * @property {string} email - Valid email address (required)
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
