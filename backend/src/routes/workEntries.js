/**
 * @fileoverview Work entry management routes for the Billable Hours Tracker.
 * Provides CRUD endpoints for managing billable time entries.
 * All routes require authentication via x-user-email header.
 * @module routes/workEntries
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { workEntrySchema, updateWorkEntrySchema } = require('../validation/schemas');

/**
 * Express router for work entry management endpoints.
 * All routes are protected by authentication middleware.
 * @type {import('express').Router}
 */
const router = express.Router();

router.use(authenticateUser);

/**
 * GET /api/work-entries
 * Retrieves all work entries for the authenticated user.
 * Supports optional filtering by client ID. Results include client name
 * and are sorted by date (descending) then creation time (descending).
 * 
 * @name GetAllWorkEntries
 * @route {GET} /api/work-entries
 * @queryparam {number} [clientId] - Optional client ID to filter entries
 * @headerparam {string} x-user-email - Authenticated user's email address
 * @returns {Object} 200 - Array of work entry objects with client names
 * @returns {Object} 400 - Invalid client ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request (all entries)
 * GET /api/work-entries
 * x-user-email: user@example.com
 * 
 * // Request (filtered by client)
 * GET /api/work-entries?clientId=1
 * x-user-email: user@example.com
 * 
 * // Response
 * { "workEntries": [{ "id": 1, "client_id": 1, "client_name": "Acme Corp", "hours": 2.5, "date": "2024-01-15", ... }] }
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
 * GET /api/work-entries/:id
 * Retrieves a specific work entry by ID. Only returns the entry if it belongs
 * to the authenticated user (data isolation). Includes the associated client name.
 * 
 * @name GetWorkEntryById
 * @route {GET} /api/work-entries/:id
 * @routeparam {number} id - Work entry ID (positive integer)
 * @headerparam {string} x-user-email - Authenticated user's email address
 * @returns {Object} 200 - Work entry object with client name
 * @returns {Object} 400 - Invalid work entry ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Work entry not found or doesn't belong to user
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * GET /api/work-entries/1
 * x-user-email: user@example.com
 * 
 * // Response
 * { "workEntry": { "id": 1, "client_id": 1, "client_name": "Acme Corp", "hours": 2.5, "date": "2024-01-15", ... } }
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
 * POST /api/work-entries
 * Creates a new work entry for the authenticated user.
 * Validates that the specified client exists and belongs to the user.
 * 
 * @name CreateWorkEntry
 * @route {POST} /api/work-entries
 * @headerparam {string} x-user-email - Authenticated user's email address
 * @bodyparam {number} clientId - ID of the associated client (required, must belong to user)
 * @bodyparam {number} hours - Hours worked (required, 0.1-24, 2 decimal precision)
 * @bodyparam {string} date - Date of work (required, ISO 8601 format)
 * @bodyparam {string} [description] - Optional work description (max 1000 characters)
 * @returns {Object} 201 - Created work entry object with client name
 * @returns {Object} 400 - Validation error or client not found/doesn't belong to user
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/work-entries
 * x-user-email: user@example.com
 * Content-Type: application/json
 * { "clientId": 1, "hours": 2.5, "date": "2024-01-15", "description": "API development" }
 * 
 * // Response
 * { "message": "Work entry created successfully", "workEntry": { "id": 1, "client_name": "Acme Corp", ... } }
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
 * PUT /api/work-entries/:id
 * Updates an existing work entry. Only updates fields provided in the request body.
 * Requires at least one field to be updated. If clientId is updated, validates
 * that the new client belongs to the authenticated user.
 * 
 * @name UpdateWorkEntry
 * @route {PUT} /api/work-entries/:id
 * @routeparam {number} id - Work entry ID (positive integer)
 * @headerparam {string} x-user-email - Authenticated user's email address
 * @bodyparam {number} [clientId] - New client ID (must belong to user)
 * @bodyparam {number} [hours] - Updated hours (0.1-24, 2 decimal precision)
 * @bodyparam {string} [date] - Updated date (ISO 8601 format)
 * @bodyparam {string} [description] - Updated description (max 1000 characters)
 * @returns {Object} 200 - Updated work entry object with client name
 * @returns {Object} 400 - Invalid ID, validation error, or client not found
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Work entry not found or doesn't belong to user
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * PUT /api/work-entries/1
 * x-user-email: user@example.com
 * Content-Type: application/json
 * { "hours": 3.0, "description": "Updated: API development and testing" }
 * 
 * // Response
 * { "message": "Work entry updated successfully", "workEntry": { "id": 1, "hours": 3.0, ... } }
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
 * DELETE /api/work-entries/:id
 * Deletes a work entry. Only deletes if the entry belongs to the authenticated user.
 * 
 * @name DeleteWorkEntry
 * @route {DELETE} /api/work-entries/:id
 * @routeparam {number} id - Work entry ID (positive integer)
 * @headerparam {string} x-user-email - Authenticated user's email address
 * @returns {Object} 200 - Success message
 * @returns {Object} 400 - Invalid work entry ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Work entry not found or doesn't belong to user
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * DELETE /api/work-entries/1
 * x-user-email: user@example.com
 * 
 * // Response
 * { "message": "Work entry deleted successfully" }
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

module.exports = router;
