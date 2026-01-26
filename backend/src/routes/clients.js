const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { clientSchema, updateClientSchema } = require('../validation/schemas');

/**
 * @fileoverview Client management routes providing CRUD operations for clients.
 * All routes require authentication via the x-user-email header.
 * Clients are scoped to the authenticated user for data isolation.
 * 
 * @module routes/clients
 */

const router = express.Router();

router.use(authenticateUser);

/**
 * @route GET /api/clients
 * @description Retrieves all clients belonging to the authenticated user.
 * Results are sorted alphabetically by client name.
 * 
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * 
 * @returns {Object} 200 - List of clients retrieved successfully.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * GET /api/clients
 * Headers: { "x-user-email": "user@example.com" }
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
 * @route GET /api/clients/:id
 * @description Retrieves a specific client by ID. The client must belong to
 * the authenticated user.
 * 
 * @param {string} req.params.id - Client ID (must be a valid positive integer).
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * 
 * @returns {Object} 200 - Client retrieved successfully.
 * @returns {Object} 400 - Invalid client ID format.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 404 - Client not found or does not belong to user.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * GET /api/clients/1
 * Headers: { "x-user-email": "user@example.com" }
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
 * @route POST /api/clients
 * @description Creates a new client for the authenticated user.
 * The client name is required and must be unique per user.
 * 
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * @param {Object} req.body - Client data.
 * @param {string} req.body.name - Client name (required, 1-255 characters).
 * @param {string} [req.body.description] - Optional client description (max 1000 characters).
 * 
 * @returns {Object} 201 - Client created successfully.
 * @returns {Object} 400 - Validation error (invalid or missing fields).
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * POST /api/clients
 * Headers: { "x-user-email": "user@example.com" }
 * Body: { "name": "Acme Corp", "description": "Enterprise client" }
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
 * @route PUT /api/clients/:id
 * @description Updates an existing client. The client must belong to the
 * authenticated user. Supports partial updates (only provided fields are updated).
 * 
 * @param {string} req.params.id - Client ID (must be a valid positive integer).
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * @param {Object} req.body - Fields to update (at least one required).
 * @param {string} [req.body.name] - Updated client name (1-255 characters).
 * @param {string} [req.body.description] - Updated client description (max 1000 characters).
 * 
 * @returns {Object} 200 - Client updated successfully.
 * @returns {Object} 400 - Invalid client ID or validation error.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 404 - Client not found or does not belong to user.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * PUT /api/clients/1
 * Headers: { "x-user-email": "user@example.com" }
 * Body: { "name": "Acme Corporation" }
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
 * @route DELETE /api/clients/:id
 * @description Deletes a client and all associated work entries. The client must
 * belong to the authenticated user. This operation is irreversible and will cascade
 * delete all work entries linked to the client.
 * 
 * @param {string} req.params.id - Client ID (must be a valid positive integer).
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * 
 * @returns {Object} 200 - Client deleted successfully.
 * @returns {Object} 400 - Invalid client ID format.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 404 - Client not found or does not belong to user.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * DELETE /api/clients/1
 * Headers: { "x-user-email": "user@example.com" }
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
