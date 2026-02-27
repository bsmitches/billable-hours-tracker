/**
 * @fileoverview Joi validation schemas for request body payloads.
 *
 * Each schema defines the shape, constraints, and error messages for data
 * submitted by API consumers. Schemas are consumed by route handlers via
 * `schema.validate(req.body)` and any validation failures are forwarded to
 * the centralized error handler.
 *
 * @module validation/schemas
 * @requires joi
 */

const Joi = require('joi');

/**
 * Schema for creating a new client.
 *
 * @type {import('joi').ObjectSchema}
 * @property {string} name - Client name (1-255 chars, required)
 * @property {string} [description] - Optional description (max 1000 chars)
 */
const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow('')
});

/**
 * Schema for creating a new work entry.
 *
 * @type {import('joi').ObjectSchema}
 * @property {number} clientId - ID of the associated client (positive integer, required)
 * @property {number} hours - Number of hours worked (0-24, up to 2 decimal places, required)
 * @property {string} [description] - Optional description of work performed (max 1000 chars)
 * @property {string} date - ISO 8601 date string (required)
 */
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()
});

/**
 * Schema for partially updating an existing work entry.
 * At least one field must be provided.
 *
 * @type {import('joi').ObjectSchema}
 * @property {number} [clientId] - Updated client ID
 * @property {number} [hours] - Updated hours
 * @property {string} [description] - Updated description
 * @property {string} [date] - Updated ISO 8601 date
 */
const updateWorkEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  hours: Joi.number().positive().max(24).precision(2).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().optional()
}).min(1); // At least one field must be provided

/**
 * Schema for partially updating an existing client.
 * At least one field must be provided.
 *
 * @type {import('joi').ObjectSchema}
 * @property {string} [name] - Updated client name (1-255 chars)
 * @property {string} [description] - Updated description (max 1000 chars)
 */
const updateClientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow('')
}).min(1); // At least one field must be provided

/**
 * Schema for the login endpoint request body.
 *
 * @type {import('joi').ObjectSchema}
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
