/**
 * @module validation/schemas
 * @description Joi validation schemas used across route handlers to sanitise
 * and validate incoming request bodies before they reach the database layer.
 */

const Joi = require('joi');

/**
 * @constant {import('joi').ObjectSchema} clientSchema
 * @description Validates the body of a new-client request.
 * @property {string} name - Required; 1-255 characters, trimmed.
 * @property {string} [description] - Optional; up to 1000 characters.
 */
const clientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(1000).optional().allow('')
});

/**
 * @constant {import('joi').ObjectSchema} workEntrySchema
 * @description Validates the body of a new work-entry request.
 * @property {number} clientId - Required; positive integer referencing a client.
 * @property {number} hours - Required; positive number up to 24, two decimal places.
 * @property {string} [description] - Optional; up to 1000 characters.
 * @property {string} date - Required; ISO 8601 date string.
 */
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()
});

/**
 * @constant {import('joi').ObjectSchema} updateWorkEntrySchema
 * @description Validates partial updates to an existing work entry.
 * At least one field must be provided (enforced by `.min(1)`).
 * Accepts the same fields as {@link workEntrySchema} but all are optional.
 */
const updateWorkEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  hours: Joi.number().positive().max(24).precision(2).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().optional()
}).min(1);

/**
 * @constant {import('joi').ObjectSchema} updateClientSchema
 * @description Validates partial updates to an existing client.
 * At least one field must be provided (enforced by `.min(1)`).
 */
const updateClientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().trim().max(1000).optional().allow('')
}).min(1);

/**
 * @constant {import('joi').ObjectSchema} emailSchema
 * @description Validates the login request body.
 * @property {string} email - Required; must be a valid email address.
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
