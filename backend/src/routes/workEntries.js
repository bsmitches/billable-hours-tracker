/**
 * @fileoverview Work entry management routes for the Billable Hours Tracker API.
 * 
 * This module provides CRUD (Create, Read, Update, Delete) endpoints for managing
 * work entry records. Work entries represent hours worked for a specific client on
 * a specific date. All routes require authentication and enforce data isolation.
 * 
 * Endpoints:
 * - GET /api/work-entries - List all work entries (with optional client filter)
 * - GET /api/work-entries/:id - Get a specific work entry by ID
 * - POST /api/work-entries - Create a new work entry
 * - PUT /api/work-entries/:id - Update an existing work entry
 * - DELETE /api/work-entries/:id - Delete a work entry
 * 
 * Data Isolation: All queries filter by user_email to ensure users can only
 * access their own data. Additionally, work entries can only be created for
 * clients that belong to the authenticated user.
 * 
 * @module routes/workEntries
 * @requires express - Web framework for Node.js
 * @requires ../database/init - Database connection module
 * @requires ../middleware/auth - Authentication middleware
 * @requires ../validation/schemas - Joi validation schemas
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { workEntrySchema, updateWorkEntrySchema } = require('../validation/schemas');

/**
 * Express router instance for work entry routes.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * Apply authentication middleware to all work entry routes.
 * This ensures all endpoints require a valid x-user-email header.
 */
router.use(authenticateUser);

/**
 * Get all work entries for the authenticated user.
 * Supports optional filtering by client ID via query parameter.
 * Returns entries sorted by date (newest first), then by creation time.
 * 
 * @route GET /api/work-entries
 * @param {string} [req.query.clientId] - Optional client ID to filter entries
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with array of work entry objects (includes client_name)
 * 
 * @example
 * // Request - Get all entries
 * GET /api/work-entries
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Request - Filter by client
 * GET /api/work-entries?clientId=1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response - 200 OK
 * { "workEntries": [{ "id": 1, "client_id": 1, "client_name": "Acme Corp", "hours": 8, "description": "Development", "date": "2024-01-15", ... }] }
 * 
 * Response Codes:
 * - 200 OK: Work entries returned successfully (may be empty array)
 * - 400 Bad Request: Invalid client ID format in query parameter
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
router.get('/', (req, res) => {
  const { clientId } = req.query;
  const db = getDatabase();
  
  let query = `
    SELECT we.id, we.client_id, we.hours, we.description, we.date, 
           we.created_at, we.updated_at, c.name as client_name
    FROM work_entries we
    JOIN clients c ON we.client_id = c.id
    WHERE we.user_email = ?
  `;
  
  const params = [req.userEmail];
  
  if (clientId) {
    const clientIdNum = parseInt(clientId);
    if (isNaN(clientIdNum)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    query += ' AND we.client_id = ?';
    params.push(clientIdNum);
  }
  
  query += ' ORDER BY we.date DESC, we.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json({ workEntries: rows });
  });
});

/**
 * Get a specific work entry by ID.
 * Only returns the entry if it belongs to the authenticated user.
 * Includes the client name in the response.
 * 
 * @route GET /api/work-entries/:id
 * @param {string} req.params.id - Work entry ID (must be a valid integer)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with work entry object (includes client_name)
 * 
 * @example
 * // Request
 * GET /api/work-entries/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response - 200 OK
 * { "workEntry": { "id": 1, "client_id": 1, "client_name": "Acme Corp", "hours": 8, "description": "Development", "date": "2024-01-15", ... } }
 * 
 * Response Codes:
 * - 200 OK: Work entry returned successfully
 * - 400 Bad Request: Invalid work entry ID format
 * - 404 Not Found: Work entry not found or doesn't belong to user
 * - 500 Internal Server Error: Database error
 */
router.get('/:id', (req, res) => {
  const workEntryId = parseInt(req.params.id);
  
  if (isNaN(workEntryId)) {
    return res.status(400).json({ error: 'Invalid work entry ID' });
  }
  
  const db = getDatabase();
  
  db.get(
    `SELECT we.id, we.client_id, we.hours, we.description, we.date, 
            we.created_at, we.updated_at, c.name as client_name
     FROM work_entries we
     JOIN clients c ON we.client_id = c.id
     WHERE we.id = ? AND we.user_email = ?`,
    [workEntryId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Work entry not found' });
      }
      
      res.json({ workEntry: row });
    }
  );
});

/**
 * Create a new work entry for the authenticated user.
 * Validates input using Joi schema and verifies client ownership before creating.
 * 
 * @route POST /api/work-entries
 * @param {Object} req.body - Request body
 * @param {number} req.body.clientId - Client ID (must belong to authenticated user)
 * @param {number} req.body.hours - Hours worked (0.01 to 24)
 * @param {string} req.body.date - Date of work (YYYY-MM-DD format)
 * @param {string} [req.body.description] - Optional work description (max 500 characters)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with created work entry object (includes client_name)
 * 
 * @example
 * // Request
 * POST /api/work-entries
 * Headers: { "x-user-email": "user@example.com" }
 * Body: { "clientId": 1, "hours": 8, "date": "2024-01-15", "description": "Development work" }
 * 
 * // Response - 201 Created
 * { "message": "Work entry created successfully", "workEntry": { "id": 1, "client_id": 1, "client_name": "Acme Corp", "hours": 8, ... } }
 * 
 * Response Codes:
 * - 201 Created: Work entry created successfully
 * - 400 Bad Request: Validation error or client doesn't belong to user
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
router.post('/', (req, res, next) => {
  try {
    const { error, value } = workEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { clientId, hours, description, date } = value;
    const db = getDatabase();

    // Verify client exists and belongs to user
    db.get(
      'SELECT id FROM clients WHERE id = ? AND user_email = ?',
      [clientId, req.userEmail],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!row) {
          return res.status(400).json({ error: 'Client not found or does not belong to user' });
        }

        // Create work entry
        db.run(
          'INSERT INTO work_entries (client_id, user_email, hours, description, date) VALUES (?, ?, ?, ?, ?)',
          [clientId, req.userEmail, hours, description || null, date],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to create work entry' });
            }

            // Return the created work entry with client name
            db.get(
              `SELECT we.id, we.client_id, we.hours, we.description, we.date, 
                      we.created_at, we.updated_at, c.name as client_name
               FROM work_entries we
               JOIN clients c ON we.client_id = c.id
               WHERE we.id = ?`,
              [this.lastID],
              (err, row) => {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ error: 'Work entry created but failed to retrieve' });
                }

                res.status(201).json({
                  message: 'Work entry created successfully',
                  workEntry: row
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Update an existing work entry.
 * Only allows updating entries that belong to the authenticated user.
 * If changing the client, verifies the new client also belongs to the user.
 * Validates input using Joi schema before updating.
 * 
 * @route PUT /api/work-entries/:id
 * @param {string} req.params.id - Work entry ID (must be a valid integer)
 * @param {Object} req.body - Request body (at least one field required)
 * @param {number} [req.body.clientId] - Updated client ID (must belong to user)
 * @param {number} [req.body.hours] - Updated hours worked (0.01 to 24)
 * @param {string} [req.body.date] - Updated date (YYYY-MM-DD format)
 * @param {string} [req.body.description] - Updated description (max 500 characters)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with updated work entry object (includes client_name)
 * 
 * @example
 * // Request
 * PUT /api/work-entries/1
 * Headers: { "x-user-email": "user@example.com" }
 * Body: { "hours": 10, "description": "Extended development work" }
 * 
 * // Response - 200 OK
 * { "message": "Work entry updated successfully", "workEntry": { "id": 1, "client_id": 1, "hours": 10, ... } }
 * 
 * Response Codes:
 * - 200 OK: Work entry updated successfully
 * - 400 Bad Request: Invalid ID, validation error, or client doesn't belong to user
 * - 404 Not Found: Work entry not found or doesn't belong to user
 * - 500 Internal Server Error: Database error
 */
router.put('/:id', (req, res, next) => {
  try {
    const workEntryId = parseInt(req.params.id);
    
    if (isNaN(workEntryId)) {
      return res.status(400).json({ error: 'Invalid work entry ID' });
    }

    const { error, value } = updateWorkEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    // Check if work entry exists and belongs to user
    db.get(
      'SELECT id FROM work_entries WHERE id = ? AND user_email = ?',
      [workEntryId, req.userEmail],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!row) {
          return res.status(404).json({ error: 'Work entry not found' });
        }

        // If clientId is being updated, verify it belongs to user
        if (value.clientId) {
          db.get(
            'SELECT id FROM clients WHERE id = ? AND user_email = ?',
            [value.clientId, req.userEmail],
            (err, clientRow) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
              }

              if (!clientRow) {
                return res.status(400).json({ error: 'Client not found or does not belong to user' });
              }

              performUpdate();
            }
          );
        } else {
          performUpdate();
        }

        function performUpdate() {
          // Build update query dynamically
          const updates = [];
          const values = [];

          if (value.clientId !== undefined) {
            updates.push('client_id = ?');
            values.push(value.clientId);
          }

          if (value.hours !== undefined) {
            updates.push('hours = ?');
            values.push(value.hours);
          }

          if (value.description !== undefined) {
            updates.push('description = ?');
            values.push(value.description || null);
          }

          if (value.date !== undefined) {
            updates.push('date = ?');
            values.push(value.date);
          }

          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(workEntryId, req.userEmail);

          const query = `UPDATE work_entries SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

          db.run(query, values, function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to update work entry' });
            }

            // Return updated work entry with client name
            db.get(
              `SELECT we.id, we.client_id, we.hours, we.description, we.date, 
                      we.created_at, we.updated_at, c.name as client_name
               FROM work_entries we
               JOIN clients c ON we.client_id = c.id
               WHERE we.id = ?`,
              [workEntryId],
              (err, row) => {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ error: 'Work entry updated but failed to retrieve' });
                }

                res.json({
                  message: 'Work entry updated successfully',
                  workEntry: row
                });
              }
            );
          });
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a work entry.
 * Only allows deleting entries that belong to the authenticated user.
 * 
 * @route DELETE /api/work-entries/:id
 * @param {string} req.params.id - Work entry ID (must be a valid integer)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with success message
 * 
 * @example
 * // Request
 * DELETE /api/work-entries/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response - 200 OK
 * { "message": "Work entry deleted successfully" }
 * 
 * Response Codes:
 * - 200 OK: Work entry deleted successfully
 * - 400 Bad Request: Invalid work entry ID format
 * - 404 Not Found: Work entry not found or doesn't belong to user
 * - 500 Internal Server Error: Database error
 */
router.delete('/:id', (req, res) => {
  const workEntryId = parseInt(req.params.id);
  
  if (isNaN(workEntryId)) {
    return res.status(400).json({ error: 'Invalid work entry ID' });
  }
  
  const db = getDatabase();
  
  // Check if work entry exists and belongs to user
  db.get(
    'SELECT id FROM work_entries WHERE id = ? AND user_email = ?',
    [workEntryId, req.userEmail],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Work entry not found' });
      }
      
      // Delete work entry
      db.run(
        'DELETE FROM work_entries WHERE id = ? AND user_email = ?',
        [workEntryId, req.userEmail],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to delete work entry' });
          }
          
          res.json({ message: 'Work entry deleted successfully' });
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
