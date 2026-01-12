/**
 * @fileoverview Work entry management routes for CRUD operations on time tracking records.
 * 
 * This module provides REST API endpoints for managing work entries (billable time
 * records) in the Billable Hours Tracker application. Work entries represent logged
 * time against specific clients and include hours worked, date, and description.
 * 
 * All routes require authentication and enforce data isolation - users can only
 * access work entries they created and for clients they own.
 * 
 * Endpoints:
 * - GET /api/work-entries - List all work entries (with optional client filter)
 * - GET /api/work-entries/:id - Get a specific work entry by ID
 * - POST /api/work-entries - Create a new work entry
 * - PUT /api/work-entries/:id - Update an existing work entry
 * - DELETE /api/work-entries/:id - Delete a work entry
 * 
 * @module routes/workEntries
 * @requires express
 * @requires ../database/init
 * @requires ../middleware/auth
 * @requires ../validation/schemas
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { workEntrySchema, updateWorkEntrySchema } = require('../validation/schemas');

/**
 * Express router instance for work entry management endpoints.
 * @type {import('express').Router}
 */
const router = express.Router();

// Apply authentication middleware to all routes in this router
// This ensures only authenticated users can access work entry endpoints
router.use(authenticateUser);

/**
 * GET /api/work-entries
 * 
 * Retrieves all work entries for the authenticated user, optionally filtered by
 * client ID. Results are sorted by date (newest first) and include the associated
 * client name for display purposes.
 * 
 * @name GetAllWorkEntries
 * @route {GET} /api/work-entries
 * @queryparam {number} [clientId] - Optional client ID to filter entries
 * @authentication Requires x-user-email header
 * @returns {Object} 200 - Array of work entry objects with client names
 * @returns {Object} 400 - Invalid client ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // GET /api/work-entries?clientId=1
 * // Success response
 * { "workEntries": [{ "id": 1, "client_id": 1, "client_name": "Acme Corp", "hours": 2.5, "date": "2024-01-15", ... }] }
 */
router.get('/', (req, res) => {
  // Extract optional client filter from query parameters
  const { clientId } = req.query;
  const db = getDatabase();
  
  // Base query joins work_entries with clients to include client name
  // Filtered by authenticated user's email for data isolation
  let query = `
    SELECT we.id, we.client_id, we.hours, we.description, we.date, 
           we.created_at, we.updated_at, c.name as client_name
    FROM work_entries we
    JOIN clients c ON we.client_id = c.id
    WHERE we.user_email = ?
  `;
  
  const params = [req.userEmail];
  
  // Add optional client filter if provided
  if (clientId) {
    const clientIdNum = parseInt(clientId);
    if (isNaN(clientIdNum)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    query += ' AND we.client_id = ?';
    params.push(clientIdNum);
  }
  
  // Sort by date descending (newest first), then by creation time
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
 * GET /api/work-entries/:id
 * 
 * Retrieves a specific work entry by ID. The entry must belong to the authenticated
 * user - attempting to access another user's entry returns 404.
 * 
 * @name GetWorkEntryById
 * @route {GET} /api/work-entries/:id
 * @routeparam {number} id - The work entry's unique identifier
 * @authentication Requires x-user-email header
 * @returns {Object} 200 - Work entry object with client name
 * @returns {Object} 400 - Invalid work entry ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Work entry not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Success response
 * { "workEntry": { "id": 1, "client_id": 1, "client_name": "Acme Corp", "hours": 2.5, "date": "2024-01-15", ... } }
 */
router.get('/:id', (req, res) => {
  // Parse and validate the work entry ID from URL parameter
  const workEntryId = parseInt(req.params.id);
  
  if (isNaN(workEntryId)) {
    return res.status(400).json({ error: 'Invalid work entry ID' });
  }
  
  const db = getDatabase();
  
  // Query includes user_email filter to enforce data isolation
  // Join with clients table to include client name in response
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
      
      // Return 404 if entry doesn't exist or belongs to another user
      if (!row) {
        return res.status(404).json({ error: 'Work entry not found' });
      }
      
      res.json({ workEntry: row });
    }
  );
});

/**
 * POST /api/work-entries
 * 
 * Creates a new work entry for the authenticated user. The entry must be associated
 * with a client that belongs to the user. Hours must be between 0.1 and 24.
 * 
 * @name CreateWorkEntry
 * @route {POST} /api/work-entries
 * @authentication Requires x-user-email header
 * @bodyparam {number} clientId - ID of the client to associate with (required)
 * @bodyparam {number} hours - Hours worked (required, 0.1-24, up to 2 decimal places)
 * @bodyparam {string} date - Date of work in ISO format (required)
 * @bodyparam {string} [description] - Description of work performed (optional, max 1000 chars)
 * @returns {Object} 201 - Newly created work entry object
 * @returns {Object} 400 - Validation error or client not found
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request body
 * { "clientId": 1, "hours": 2.5, "date": "2024-01-15", "description": "Development work" }
 * 
 * // Success response
 * { "message": "Work entry created successfully", "workEntry": { "id": 1, "client_id": 1, ... } }
 */
router.post('/', (req, res, next) => {
  try {
    // Validate request body against work entry schema
    const { error, value } = workEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { clientId, hours, description, date } = value;
    const db = getDatabase();

    // First verify the client exists and belongs to the authenticated user
    // This prevents users from creating entries for other users' clients
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

        // Insert the new work entry with authenticated user as owner
        db.run(
          'INSERT INTO work_entries (client_id, user_email, hours, description, date) VALUES (?, ?, ?, ?, ?)',
          [clientId, req.userEmail, hours, description || null, date],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to create work entry' });
            }

            // Retrieve the newly created entry with client name using lastID
            // this.lastID contains the auto-generated primary key
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
 * PUT /api/work-entries/:id
 * 
 * Updates an existing work entry. At least one field must be provided. If changing
 * the client, the new client must belong to the authenticated user.
 * 
 * @name UpdateWorkEntry
 * @route {PUT} /api/work-entries/:id
 * @routeparam {number} id - The work entry's unique identifier
 * @authentication Requires x-user-email header
 * @bodyparam {number} [clientId] - New client ID to associate with
 * @bodyparam {number} [hours] - Updated hours worked (0.1-24)
 * @bodyparam {string} [date] - Updated date in ISO format
 * @bodyparam {string} [description] - Updated description (max 1000 chars)
 * @returns {Object} 200 - Updated work entry object
 * @returns {Object} 400 - Invalid ID, validation error, or client not found
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Work entry not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request body (partial update)
 * { "hours": 3.0, "description": "Updated description" }
 * 
 * // Success response
 * { "message": "Work entry updated successfully", "workEntry": { "id": 1, ... } }
 */
router.put('/:id', (req, res, next) => {
  try {
    // Parse and validate the work entry ID from URL parameter
    const workEntryId = parseInt(req.params.id);
    
    if (isNaN(workEntryId)) {
      return res.status(400).json({ error: 'Invalid work entry ID' });
    }

    // Validate request body - at least one field must be provided
    const { error, value } = updateWorkEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getDatabase();

    // First verify the work entry exists and belongs to the authenticated user
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

        // If clientId is being updated, verify the new client belongs to the user
        // This prevents reassigning entries to other users' clients
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

        /**
         * Performs the actual database update after all validations pass.
         * Builds a dynamic UPDATE query based on provided fields.
         * @private
         */
        function performUpdate() {
          // Build update query dynamically based on provided fields
          // This allows partial updates (PATCH-like behavior)
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

          // Always update the timestamp when modifying the record
          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(workEntryId, req.userEmail);

          const query = `UPDATE work_entries SET ${updates.join(', ')} WHERE id = ? AND user_email = ?`;

          db.run(query, values, function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to update work entry' });
            }

            // Retrieve and return the updated entry with client name
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
 * DELETE /api/work-entries/:id
 * 
 * Deletes a work entry. The entry must belong to the authenticated user.
 * This operation is irreversible.
 * 
 * @name DeleteWorkEntry
 * @route {DELETE} /api/work-entries/:id
 * @routeparam {number} id - The work entry's unique identifier
 * @authentication Requires x-user-email header
 * @returns {Object} 200 - Success message
 * @returns {Object} 400 - Invalid work entry ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Work entry not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Success response
 * { "message": "Work entry deleted successfully" }
 */
router.delete('/:id', (req, res) => {
  // Parse and validate the work entry ID from URL parameter
  const workEntryId = parseInt(req.params.id);
  
  if (isNaN(workEntryId)) {
    return res.status(400).json({ error: 'Invalid work entry ID' });
  }
  
  const db = getDatabase();
  
  // First verify the work entry exists and belongs to the authenticated user
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
      
      // Delete the work entry from the database
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

module.exports = router;
