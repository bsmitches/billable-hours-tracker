const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { workEntrySchema, updateWorkEntrySchema } = require('../validation/schemas');

/**
 * @fileoverview Work entry management routes providing CRUD operations for time entries.
 * All routes require authentication via the x-user-email header.
 * Work entries are scoped to the authenticated user for data isolation.
 * 
 * @module routes/workEntries
 */

const router = express.Router();

router.use(authenticateUser);

/**
 * @route GET /api/work-entries
 * @description Retrieves all work entries for the authenticated user.
 * Supports optional filtering by client ID. Results are sorted by date (descending)
 * and then by creation time (descending).
 * 
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * @param {string} [req.query.clientId] - Optional client ID to filter entries.
 * 
 * @returns {Object} 200 - List of work entries retrieved successfully.
 * @returns {Object} 400 - Invalid client ID format in query parameter.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request (all entries)
 * GET /api/work-entries
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Request (filtered by client)
 * GET /api/work-entries?clientId=1
 * 
 * // Response
 * { "workEntries": [{ "id": 1, "client_id": 1, "hours": 2.5, "description": "...", "date": "2024-01-15", "client_name": "Acme Corp" }] }
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
 * @description Retrieves a specific work entry by ID. The work entry must belong
 * to the authenticated user. Includes the associated client name in the response.
 * 
 * @param {string} req.params.id - Work entry ID (must be a valid positive integer).
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * 
 * @returns {Object} 200 - Work entry retrieved successfully.
 * @returns {Object} 400 - Invalid work entry ID format.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 404 - Work entry not found or does not belong to user.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * GET /api/work-entries/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response
 * { "workEntry": { "id": 1, "client_id": 1, "hours": 2.5, "description": "...", "date": "2024-01-15", "client_name": "Acme Corp" } }
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
 * 
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * @param {Object} req.body - Work entry data.
 * @param {number} req.body.clientId - ID of the client to associate with this entry (required).
 * @param {number} req.body.hours - Hours worked (required, positive, max 24, up to 2 decimal places).
 * @param {string} [req.body.description] - Optional description of work performed (max 1000 characters).
 * @param {string} req.body.date - Date of work entry (required, ISO 8601 format).
 * 
 * @returns {Object} 201 - Work entry created successfully.
 * @returns {Object} 400 - Validation error or client not found/not owned by user.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * POST /api/work-entries
 * Headers: { "x-user-email": "user@example.com" }
 * Body: { "clientId": 1, "hours": 2.5, "description": "Frontend development", "date": "2024-01-15" }
 * 
 * // Response
 * { "message": "Work entry created successfully", "workEntry": { "id": 1, "client_id": 1, "hours": 2.5, ... } }
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
 * @description Updates an existing work entry. The work entry must belong to the
 * authenticated user. Supports partial updates (only provided fields are updated).
 * If changing the client, the new client must also belong to the authenticated user.
 * 
 * @param {string} req.params.id - Work entry ID (must be a valid positive integer).
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * @param {Object} req.body - Fields to update (at least one required).
 * @param {number} [req.body.clientId] - New client ID (must belong to user).
 * @param {number} [req.body.hours] - Updated hours worked (positive, max 24, up to 2 decimal places).
 * @param {string} [req.body.description] - Updated description (max 1000 characters).
 * @param {string} [req.body.date] - Updated date (ISO 8601 format).
 * 
 * @returns {Object} 200 - Work entry updated successfully.
 * @returns {Object} 400 - Invalid ID, validation error, or client not found/not owned by user.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 404 - Work entry not found or does not belong to user.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * PUT /api/work-entries/1
 * Headers: { "x-user-email": "user@example.com" }
 * Body: { "hours": 3.0, "description": "Updated: Backend API development" }
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
 * @route DELETE /api/work-entries/:id
 * @description Deletes a work entry. The work entry must belong to the authenticated user.
 * This operation is irreversible.
 * 
 * @param {string} req.params.id - Work entry ID (must be a valid positive integer).
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * 
 * @returns {Object} 200 - Work entry deleted successfully.
 * @returns {Object} 400 - Invalid work entry ID format.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 404 - Work entry not found or does not belong to user.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * DELETE /api/work-entries/1
 * Headers: { "x-user-email": "user@example.com" }
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
