/**
 * @fileoverview Client management routes for CRUD operations on client records.
 * 
 * This module provides REST API endpoints for managing clients in the Billable
 * Hours Tracker application. All routes require authentication and enforce
 * data isolation - users can only access their own clients.
 * 
 * Endpoints:
 * - GET /api/clients - List all clients for the authenticated user
 * - GET /api/clients/:id - Get a specific client by ID
 * - POST /api/clients - Create a new client
 * - PUT /api/clients/:id - Update an existing client
 * - DELETE /api/clients/:id - Delete a client (cascades to work entries)
 * 
 * @module routes/clients
 * @requires express
 * @requires ../database/init
 * @requires ../middleware/auth
 * @requires ../validation/schemas
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { clientSchema, updateClientSchema } = require('../validation/schemas');

/**
 * Express router instance for client management endpoints.
 * @type {import('express').Router}
 */
const router = express.Router();

// Apply authentication middleware to all routes in this router
// This ensures only authenticated users can access client endpoints
router.use(authenticateUser);

/**
 * GET /api/clients
 * 
 * Retrieves all clients belonging to the authenticated user, sorted alphabetically
 * by name. Each client includes its ID, name, description, and timestamps.
 * 
 * @name GetAllClients
 * @route {GET} /api/clients
 * @authentication Requires x-user-email header
 * @returns {Object} 200 - Array of client objects
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Success response
 * { "clients": [{ "id": 1, "name": "Acme Corp", "description": "Main client", "created_at": "...", "updated_at": "..." }] }
 */
router.get('/', (req, res) => {
  const db = getDatabase();
  
  // Query clients filtered by authenticated user's email for data isolation
  // Results are sorted alphabetically by name for consistent ordering
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
 * 
 * Retrieves a specific client by ID. The client must belong to the authenticated
 * user - attempting to access another user's client returns 404.
 * 
 * @name GetClientById
 * @route {GET} /api/clients/:id
 * @routeparam {number} id - The client's unique identifier
 * @authentication Requires x-user-email header
 * @returns {Object} 200 - Client object
 * @returns {Object} 400 - Invalid client ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Client not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Success response
 * { "client": { "id": 1, "name": "Acme Corp", "description": "Main client", "created_at": "...", "updated_at": "..." } }
 */
router.get('/:id', (req, res) => {
  // Parse and validate the client ID from URL parameter
  const clientId = parseInt(req.params.id);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  // Query includes user_email filter to enforce data isolation
  // Users cannot access clients belonging to other users
  db.get(
    'SELECT id, name, description, created_at, updated_at FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      // Return 404 if client doesn't exist or belongs to another user
      if (!row) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      res.json({ client: row });
    }
  );
});

/**
 * POST /api/clients
 * 
 * Creates a new client for the authenticated user. The client name is required,
 * while description is optional. Returns the newly created client with its
 * auto-generated ID and timestamps.
 * 
 * @name CreateClient
 * @route {POST} /api/clients
 * @authentication Requires x-user-email header
 * @bodyparam {string} name - Client name (required, 1-255 characters)
 * @bodyparam {string} [description] - Client description (optional, max 1000 characters)
 * @returns {Object} 201 - Newly created client object
 * @returns {Object} 400 - Validation error
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request body
 * { "name": "Acme Corp", "description": "Main client for Q1 projects" }
 * 
 * // Success response
 * { "message": "Client created successfully", "client": { "id": 1, "name": "Acme Corp", ... } }
 */
router.post('/', (req, res, next) => {
  try {
    // Validate request body against client schema
    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { name, description } = value;
    const db = getDatabase();

    // Insert new client with authenticated user as owner
    db.run(
      'INSERT INTO clients (name, description, user_email) VALUES (?, ?, ?)',
      [name, description || null, req.userEmail],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create client' });
        }

        // Retrieve the newly created client using lastID from the insert
        // this.lastID contains the auto-generated primary key
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
 * 
 * Updates an existing client's information. At least one field (name or description)
 * must be provided. The client must belong to the authenticated user.
 * 
 * @name UpdateClient
 * @route {PUT} /api/clients/:id
 * @routeparam {number} id - The client's unique identifier
 * @authentication Requires x-user-email header
 * @bodyparam {string} [name] - Updated client name (1-255 characters)
 * @bodyparam {string} [description] - Updated client description (max 1000 characters)
 * @returns {Object} 200 - Updated client object
 * @returns {Object} 400 - Invalid client ID or validation error
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Client not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request body (partial update)
 * { "name": "Acme Corporation" }
 * 
 * // Success response
 * { "message": "Client updated successfully", "client": { "id": 1, "name": "Acme Corporation", ... } }
 */
router.put('/:id', (req, res, next) => {
  try {
    // Parse and validate the client ID from URL parameter
    const clientId = parseInt(req.params.id);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // Validate request body - at least one field must be provided
    const { error, value } = updateClientSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    // First verify the client exists and belongs to the authenticated user
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

        // Build update query dynamically based on provided fields
        // This allows partial updates (PATCH-like behavior)
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

        // Always update the timestamp when modifying the record
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(clientId, req.userEmail);

        const query = `UPDATE clients SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

        db.run(query, values, function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to update client' });
          }

          // Retrieve and return the updated client record
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
 * 
 * Deletes a client and all associated work entries (via CASCADE). The client
 * must belong to the authenticated user. This operation is irreversible.
 * 
 * @name DeleteClient
 * @route {DELETE} /api/clients/:id
 * @routeparam {number} id - The client's unique identifier
 * @authentication Requires x-user-email header
 * @returns {Object} 200 - Success message
 * @returns {Object} 400 - Invalid client ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Client not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Success response
 * { "message": "Client deleted successfully" }
 */
router.delete('/:id', (req, res) => {
  // Parse and validate the client ID from URL parameter
  const clientId = parseInt(req.params.id);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  // First verify the client exists and belongs to the authenticated user
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
      
      // Delete the client - associated work entries are automatically
      // removed due to ON DELETE CASCADE foreign key constraint
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
