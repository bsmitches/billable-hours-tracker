/**
 * @fileoverview Client management routes for the Billable Hours Tracker API.
 * 
 * This module provides CRUD (Create, Read, Update, Delete) endpoints for managing
 * client records. All routes require authentication and enforce data isolation,
 * ensuring users can only access their own clients.
 * 
 * Endpoints:
 * - GET /api/clients - List all clients for the authenticated user
 * - GET /api/clients/:id - Get a specific client by ID
 * - POST /api/clients - Create a new client
 * - PUT /api/clients/:id - Update an existing client
 * - DELETE /api/clients/:id - Delete a client (cascades to work entries)
 * 
 * Data Isolation: All queries filter by user_email to ensure users can only
 * access their own data. This is a critical security feature.
 * 
 * @module routes/clients
 * @requires express - Web framework for Node.js
 * @requires ../database/init - Database connection module
 * @requires ../middleware/auth - Authentication middleware
 * @requires ../validation/schemas - Joi validation schemas
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { clientSchema, updateClientSchema } = require('../validation/schemas');

/**
 * Express router instance for client routes.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * Apply authentication middleware to all client routes.
 * This ensures all endpoints require a valid x-user-email header.
 */
router.use(authenticateUser);

/**
 * Get all clients for the authenticated user.
 * Returns clients sorted alphabetically by name.
 * 
 * @route GET /api/clients
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with array of client objects
 * 
 * @example
 * // Request
 * GET /api/clients
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response - 200 OK
 * { "clients": [{ "id": 1, "name": "Acme Corp", "description": "Main client", "created_at": "...", "updated_at": "..." }] }
 * 
 * Response Codes:
 * - 200 OK: Clients returned successfully (may be empty array)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
router.get('/', (req, res) => {
  const db = getDatabase();
  
  db.all(
    'SELECT id, name, description, created_at, updated_at FROM clients WHERE user_email = ? ORDER BY name',
    [req.userEmail],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      res.json({ clients: rows });
    }
  );
});

/**
 * Get a specific client by ID.
 * Only returns the client if it belongs to the authenticated user.
 * 
 * @route GET /api/clients/:id
 * @param {string} req.params.id - Client ID (must be a valid integer)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with client object
 * 
 * @example
 * // Request
 * GET /api/clients/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response - 200 OK
 * { "client": { "id": 1, "name": "Acme Corp", "description": "Main client", "created_at": "...", "updated_at": "..." } }
 * 
 * Response Codes:
 * - 200 OK: Client returned successfully
 * - 400 Bad Request: Invalid client ID format
 * - 404 Not Found: Client not found or doesn't belong to user
 * - 500 Internal Server Error: Database error
 */
router.get('/:id', (req, res) => {
  const clientId = parseInt(req.params.id);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  db.get(
    'SELECT id, name, description, created_at, updated_at FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      res.json({ client: row });
    }
  );
});

/**
 * Create a new client for the authenticated user.
 * Validates input using Joi schema before creating.
 * 
 * @route POST /api/clients
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Client name (required, 1-100 characters)
 * @param {string} [req.body.description] - Client description (optional, max 500 characters)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with created client object
 * 
 * @example
 * // Request
 * POST /api/clients
 * Headers: { "x-user-email": "user@example.com" }
 * Body: { "name": "Acme Corp", "description": "Main client" }
 * 
 * // Response - 201 Created
 * { "client": { "id": 1, "name": "Acme Corp", "description": "Main client", "user_email": "user@example.com", "created_at": "...", "updated_at": "..." } }
 * 
 * Response Codes:
 * - 201 Created: Client created successfully
 * - 400 Bad Request: Validation error (invalid name or description)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
router.post('/', (req, res, next) => {
  try {
    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { name, description } = value;
    const db = getDatabase();

    db.run(
      'INSERT INTO clients (name, description, user_email) VALUES (?, ?, ?)',
      [name, description || null, req.userEmail],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create client' });
        }

        // Return the created client
        db.get(
          'SELECT id, name, description, created_at, updated_at FROM clients WHERE id = ?',
          [this.lastID],
          (err, row) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Client created but failed to retrieve' });
            }

            res.status(201).json({ 
              message: 'Client created successfully',
              client: row 
            });
          }
        );
      }
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Update an existing client.
 * Only allows updating clients that belong to the authenticated user.
 * Validates input using Joi schema before updating.
 * 
 * @route PUT /api/clients/:id
 * @param {string} req.params.id - Client ID (must be a valid integer)
 * @param {Object} req.body - Request body (at least one field required)
 * @param {string} [req.body.name] - Updated client name (1-100 characters)
 * @param {string} [req.body.description] - Updated client description (max 500 characters)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with updated client object
 * 
 * @example
 * // Request
 * PUT /api/clients/1
 * Headers: { "x-user-email": "user@example.com" }
 * Body: { "name": "Acme Corporation", "description": "Updated description" }
 * 
 * // Response - 200 OK
 * { "message": "Client updated successfully", "client": { "id": 1, "name": "Acme Corporation", "description": "Updated description", "created_at": "...", "updated_at": "..." } }
 * 
 * Response Codes:
 * - 200 OK: Client updated successfully
 * - 400 Bad Request: Invalid client ID or validation error
 * - 404 Not Found: Client not found or doesn't belong to user
 * - 500 Internal Server Error: Database error
 */
router.put('/:id', (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const { error, value } = updateClientSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    // Check if client exists and belongs to user
    db.get(
      'SELECT id FROM clients WHERE id = ? AND user_email = ?',
      [clientId, req.userEmail],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!row) {
          return res.status(404).json({ error: 'Client not found' });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (value.name !== undefined) {
          updates.push('name = ?');
          values.push(value.name);
        }

        if (value.description !== undefined) {
          updates.push('description = ?');
          values.push(value.description || null);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(clientId, req.userEmail);

        const query = `UPDATE clients SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

        db.run(query, values, function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to update client' });
          }

          // Return updated client
          db.get(
            'SELECT id, name, description, created_at, updated_at FROM clients WHERE id = ?',
            [clientId],
            (err, row) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Client updated but failed to retrieve' });
              }

              res.json({
                message: 'Client updated successfully',
                client: row
              });
            }
          );
        });
      }
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a client and all associated work entries.
 * Only allows deleting clients that belong to the authenticated user.
 * Work entries are automatically deleted due to CASCADE foreign key constraint.
 * 
 * @route DELETE /api/clients/:id
 * @param {string} req.params.id - Client ID (must be a valid integer)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with success message
 * 
 * @example
 * // Request
 * DELETE /api/clients/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response - 200 OK
 * { "message": "Client deleted successfully" }
 * 
 * Response Codes:
 * - 200 OK: Client deleted successfully
 * - 400 Bad Request: Invalid client ID format
 * - 404 Not Found: Client not found or doesn't belong to user
 * - 500 Internal Server Error: Database error
 * 
 * @warning Deleting a client will also delete all associated work entries
 */
router.delete('/:id', (req, res) => {
  const clientId = parseInt(req.params.id);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  // Check if client exists and belongs to user
  db.get(
    'SELECT id FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      // Delete client (work entries will be deleted due to CASCADE)
      db.run(
        'DELETE FROM clients WHERE id = ? AND user_email = ?',
        [clientId, req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to delete client' });
          }
          
          res.json({ message: 'Client deleted successfully' });
        }
      );
    }
  );
});

/**
 * Export the router for mounting in the main Express app.
 * @exports router
 */
module.exports = router;
