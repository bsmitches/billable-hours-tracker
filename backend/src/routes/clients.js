/**
 * @fileoverview Client management routes for the Billable Hours Tracker.
 * Provides CRUD endpoints for managing client records.
 * All routes require authentication via x-user-email header.
 * @module routes/clients
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { clientSchema, updateClientSchema } = require('../validation/schemas');

/**
 * Express router for client management endpoints.
 * All routes are protected by authentication middleware.
 * @type {import('express').Router}
 */
const router = express.Router();

router.use(authenticateUser);

/**
 * GET /api/clients
 * Retrieves all clients belonging to the authenticated user.
 * Results are sorted alphabetically by client name.
 * 
 * @name GetAllClients
 * @route {GET} /api/clients
 * @headerparam {string} x-user-email - Authenticated user's email address
 * @returns {Object} 200 - Array of client objects
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * GET /api/clients
 * x-user-email: user@example.com
 * 
 * // Response
 * { "clients": [{ "id": 1, "name": "Acme Corp", "description": "...", "created_at": "...", "updated_at": "..." }] }
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
 * GET /api/clients/:id
 * Retrieves a specific client by ID. Only returns the client if it belongs
 * to the authenticated user (data isolation).
 * 
 * @name GetClientById
 * @route {GET} /api/clients/:id
 * @routeparam {number} id - Client ID (positive integer)
 * @headerparam {string} x-user-email - Authenticated user's email address
 * @returns {Object} 200 - Client object
 * @returns {Object} 400 - Invalid client ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Client not found or doesn't belong to user
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * GET /api/clients/1
 * x-user-email: user@example.com
 * 
 * // Response
 * { "client": { "id": 1, "name": "Acme Corp", "description": "...", "created_at": "...", "updated_at": "..." } }
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
 * POST /api/clients
 * Creates a new client for the authenticated user.
 * 
 * @name CreateClient
 * @route {POST} /api/clients
 * @headerparam {string} x-user-email - Authenticated user's email address
 * @bodyparam {string} name - Client name (required, 1-255 characters)
 * @bodyparam {string} [description] - Optional client description (max 1000 characters)
 * @returns {Object} 201 - Created client object with success message
 * @returns {Object} 400 - Validation error (invalid input)
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/clients
 * x-user-email: user@example.com
 * Content-Type: application/json
 * { "name": "Acme Corp", "description": "Primary consulting client" }
 * 
 * // Response
 * { "message": "Client created successfully", "client": { "id": 1, "name": "Acme Corp", ... } }
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
 * PUT /api/clients/:id
 * Updates an existing client. Only updates fields provided in the request body.
 * Requires at least one field to be updated.
 * 
 * @name UpdateClient
 * @route {PUT} /api/clients/:id
 * @routeparam {number} id - Client ID (positive integer)
 * @headerparam {string} x-user-email - Authenticated user's email address
 * @bodyparam {string} [name] - Updated client name (1-255 characters)
 * @bodyparam {string} [description] - Updated description (max 1000 characters)
 * @returns {Object} 200 - Updated client object with success message
 * @returns {Object} 400 - Invalid client ID or validation error
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Client not found or doesn't belong to user
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * PUT /api/clients/1
 * x-user-email: user@example.com
 * Content-Type: application/json
 * { "name": "Acme Corporation" }
 * 
 * // Response
 * { "message": "Client updated successfully", "client": { "id": 1, "name": "Acme Corporation", ... } }
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
 * DELETE /api/clients/:id
 * Deletes a client and all associated work entries (cascade delete).
 * Only deletes if the client belongs to the authenticated user.
 * 
 * @name DeleteClient
 * @route {DELETE} /api/clients/:id
 * @routeparam {number} id - Client ID (positive integer)
 * @headerparam {string} x-user-email - Authenticated user's email address
 * @returns {Object} 200 - Success message
 * @returns {Object} 400 - Invalid client ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Client not found or doesn't belong to user
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * DELETE /api/clients/1
 * x-user-email: user@example.com
 * 
 * // Response
 * { "message": "Client deleted successfully" }
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

module.exports = router;
