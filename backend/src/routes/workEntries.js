/**
 * @fileoverview Work entry management routes for the Billable Hours Tracker API.
 * Provides CRUD operations for managing billable time entries.
 * @module routes/workEntries
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { workEntrySchema, updateWorkEntrySchema } = require('../validation/schemas');

/**
 * Express router for work entry endpoints.
 * All routes require authentication via x-user-email header.
 * @type {express.Router}
 */
const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @route GET /api/work-entries
 * @description Retrieves all work entries for the authenticated user.
 * Supports optional filtering by client ID. Results are ordered by date descending.
 * @param {string} [req.query.clientId] - Optional client ID to filter entries
 * @param {string} req.headers['x-user-email'] - User's email for authentication
 * @returns {Object} 200 - Array of work entry objects with client names
 * @returns {Object} 400 - Invalid client ID format
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 500 - Internal server error
 * @example response - 200
 * {
 *   "workEntries": [
 *     {
 *       "id": 1,
 *       "client_id": 1,
 *       "hours": 2.5,
 *       "description": "Development work",
 *       "date": "2024-01-15",
 *       "created_at": "2024-01-15T10:30:00.000Z",
 *       "updated_at": "2024-01-15T10:30:00.000Z",
 *       "client_name": "Acme Corp"
 *     }
 *   ]
 * }
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
 * @route GET /api/work-entries/:id
 * @description Retrieves a specific work entry by ID.
 * Only returns the entry if it belongs to the authenticated user.
 * @param {string} req.params.id - Work entry ID (must be a valid integer)
 * @param {string} req.headers['x-user-email'] - User's email for authentication
 * @returns {Object} 200 - Work entry object with client name
 * @returns {Object} 400 - Invalid work entry ID
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 404 - Work entry not found
 * @returns {Object} 500 - Internal server error
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
 * @route POST /api/work-entries
 * @description Creates a new work entry for the authenticated user.
 * The specified client must exist and belong to the authenticated user.
 * @param {Object} req.body - Request body
 * @param {number} req.body.clientId - ID of the client to associate the entry with (required)
 * @param {number} req.body.hours - Number of hours worked (required, 0.01-24, 2 decimal precision)
 * @param {string} req.body.date - Date of work in ISO format (required)
 * @param {string} [req.body.description] - Description of work performed (optional, max 1000 characters)
 * @param {string} req.headers['x-user-email'] - User's email for authentication
 * @returns {Object} 201 - Created work entry object with success message
 * @returns {Object} 400 - Validation error or client not found
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 500 - Internal server error
 * @example request
 * {
 *   "clientId": 1,
 *   "hours": 2.5,
 *   "date": "2024-01-15",
 *   "description": "Development work"
 * }
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
 * @route PUT /api/work-entries/:id
 * @description Updates an existing work entry. Only updates the entry if it belongs to the authenticated user.
 * At least one field must be provided. If clientId is updated, the new client must belong to the user.
 * @param {string} req.params.id - Work entry ID (must be a valid integer)
 * @param {Object} req.body - Request body with fields to update
 * @param {number} [req.body.clientId] - Updated client ID
 * @param {number} [req.body.hours] - Updated hours (0.01-24, 2 decimal precision)
 * @param {string} [req.body.date] - Updated date in ISO format
 * @param {string} [req.body.description] - Updated description (max 1000 characters)
 * @param {string} req.headers['x-user-email'] - User's email for authentication
 * @returns {Object} 200 - Updated work entry object with success message
 * @returns {Object} 400 - Invalid work entry ID, validation error, or client not found
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 404 - Work entry not found
 * @returns {Object} 500 - Internal server error
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
 * @route DELETE /api/work-entries/:id
 * @description Deletes a work entry. Only deletes the entry if it belongs to the authenticated user.
 * @param {string} req.params.id - Work entry ID (must be a valid integer)
 * @param {string} req.headers['x-user-email'] - User's email for authentication
 * @returns {Object} 200 - Success message
 * @returns {Object} 400 - Invalid work entry ID
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 404 - Work entry not found
 * @returns {Object} 500 - Internal server error
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
