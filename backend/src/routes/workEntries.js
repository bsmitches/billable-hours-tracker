const express = require('express');
const { getDatabase, sql } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { workEntrySchema, updateWorkEntrySchema } = require('../validation/schemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get all work entries for authenticated user (with optional client filter)
router.get('/', async (req, res) => {
  const { clientId } = req.query;
  
  try {
    const pool = await getDatabase();
    const request = pool.request();
    request.input('userEmail', sql.VarChar, req.userEmail);
    
    let query = `
      SELECT we.id, we.client_id, we.hours, we.description, we.date, 
             we.created_at, we.updated_at, c.name as client_name
      FROM work_entries we
      JOIN clients c ON we.client_id = c.id
      WHERE we.user_email = @userEmail
    `;
    
    if (clientId) {
      const clientIdNum = parseInt(clientId);
      if (isNaN(clientIdNum)) {
        return res.status(400).json({ error: 'Invalid client ID' });
      }
      query += ' AND we.client_id = @clientId';
      request.input('clientId', sql.Int, clientIdNum);
    }
    
    query += ' ORDER BY we.date DESC, we.created_at DESC';
    
    const result = await request.query(query);
    res.json({ workEntries: result.recordset });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific work entry
router.get('/:id', async (req, res) => {
  const workEntryId = parseInt(req.params.id);
  
  if (isNaN(workEntryId)) {
    return res.status(400).json({ error: 'Invalid work entry ID' });
  }
  
  try {
    const pool = await getDatabase();
    
    const result = await pool.request()
      .input('id', sql.Int, workEntryId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query(`SELECT we.id, we.client_id, we.hours, we.description, we.date, 
              we.created_at, we.updated_at, c.name as client_name
       FROM work_entries we
       JOIN clients c ON we.client_id = c.id
       WHERE we.id = @id AND we.user_email = @userEmail`);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Work entry not found' });
    }
    
    res.json({ workEntry: result.recordset[0] });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new work entry
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = workEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { clientId, hours, description, date } = value;
    const pool = await getDatabase();

    // Verify client exists and belongs to user
    const clientCheck = await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('SELECT id FROM clients WHERE id = @clientId AND user_email = @userEmail');

    if (clientCheck.recordset.length === 0) {
      return res.status(400).json({ error: 'Client not found or does not belong to user' });
    }

    // Create work entry and get the new ID
    const insertResult = await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .input('hours', sql.Decimal(5, 2), hours)
      .input('description', sql.Text, description || null)
      .input('date', sql.Date, date)
      .query('INSERT INTO work_entries (client_id, user_email, hours, description, date) OUTPUT INSERTED.id VALUES (@clientId, @userEmail, @hours, @description, @date)');

    const newId = insertResult.recordset[0].id;

    // Return the created work entry with client name
    const result = await pool.request()
      .input('id', sql.Int, newId)
      .query(`SELECT we.id, we.client_id, we.hours, we.description, we.date, 
              we.created_at, we.updated_at, c.name as client_name
       FROM work_entries we
       JOIN clients c ON we.client_id = c.id
       WHERE we.id = @id`);

    res.status(201).json({
      message: 'Work entry created successfully',
      workEntry: result.recordset[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    if (error.isJoi) {
      return next(error);
    }
    return res.status(500).json({ error: 'Failed to create work entry' });
  }
});

// Update work entry
router.put('/:id', async (req, res, next) => {
  try {
    const workEntryId = parseInt(req.params.id);
    
    if (isNaN(workEntryId)) {
      return res.status(400).json({ error: 'Invalid work entry ID' });
    }

    const { error, value } = updateWorkEntrySchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const pool = await getDatabase();

    // Check if work entry exists and belongs to user
    const checkResult = await pool.request()
      .input('id', sql.Int, workEntryId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('SELECT id FROM work_entries WHERE id = @id AND user_email = @userEmail');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Work entry not found' });
    }

    // If clientId is being updated, verify it belongs to user
    if (value.clientId) {
      const clientCheck = await pool.request()
        .input('clientId', sql.Int, value.clientId)
        .input('userEmail', sql.VarChar, req.userEmail)
        .query('SELECT id FROM clients WHERE id = @clientId AND user_email = @userEmail');

      if (clientCheck.recordset.length === 0) {
        return res.status(400).json({ error: 'Client not found or does not belong to user' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const request = pool.request();
    request.input('id', sql.Int, workEntryId);
    request.input('userEmail', sql.VarChar, req.userEmail);

    if (value.clientId !== undefined) {
      updates.push('client_id = @clientId');
      request.input('clientId', sql.Int, value.clientId);
    }

    if (value.hours !== undefined) {
      updates.push('hours = @hours');
      request.input('hours', sql.Decimal(5, 2), value.hours);
    }

    if (value.description !== undefined) {
      updates.push('description = @description');
      request.input('description', sql.Text, value.description || null);
    }

    if (value.date !== undefined) {
      updates.push('date = @date');
      request.input('date', sql.Date, value.date);
    }

    updates.push('updated_at = GETDATE()');

    const updateQuery = `UPDATE work_entries SET ${updates.join(', ')} WHERE id = @id AND user_email = @userEmail`;
    await request.query(updateQuery);

    // Return updated work entry with client name
    const result = await pool.request()
      .input('id', sql.Int, workEntryId)
      .query(`SELECT we.id, we.client_id, we.hours, we.description, we.date, 
              we.created_at, we.updated_at, c.name as client_name
       FROM work_entries we
       JOIN clients c ON we.client_id = c.id
       WHERE we.id = @id`);

    res.json({
      message: 'Work entry updated successfully',
      workEntry: result.recordset[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    if (error.isJoi) {
      return next(error);
    }
    return res.status(500).json({ error: 'Failed to update work entry' });
  }
});

// Delete work entry
router.delete('/:id', async (req, res) => {
  const workEntryId = parseInt(req.params.id);
  
  if (isNaN(workEntryId)) {
    return res.status(400).json({ error: 'Invalid work entry ID' });
  }
  
  try {
    const pool = await getDatabase();
    
    // Check if work entry exists and belongs to user
    const checkResult = await pool.request()
      .input('id', sql.Int, workEntryId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('SELECT id FROM work_entries WHERE id = @id AND user_email = @userEmail');
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Work entry not found' });
    }
    
    // Delete work entry
    await pool.request()
      .input('id', sql.Int, workEntryId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('DELETE FROM work_entries WHERE id = @id AND user_email = @userEmail');
    
    res.json({ message: 'Work entry deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Failed to delete work entry' });
  }
});

module.exports = router;
