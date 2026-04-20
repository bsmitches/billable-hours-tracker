const express = require('express');
const { getDatabase, sql } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const { clientSchema, updateClientSchema } = require('../validation/schemas');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get all clients for authenticated user
router.get('/', async (req, res) => {
  try {
    const pool = await getDatabase();
    
    const result = await pool.request()
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('SELECT id, name, description, created_at, updated_at FROM clients WHERE user_email = @userEmail ORDER BY name');
    
    res.json({ clients: result.recordset });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific client
router.get('/:id', async (req, res) => {
  const clientId = parseInt(req.params.id);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  try {
    const pool = await getDatabase();
    
    const result = await pool.request()
      .input('id', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('SELECT id, name, description, created_at, updated_at FROM clients WHERE id = @id AND user_email = @userEmail');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    res.json({ client: result.recordset[0] });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new client
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { name, description } = value;
    const pool = await getDatabase();

    // Insert and get the new ID using OUTPUT clause
    const insertResult = await pool.request()
      .input('name', sql.VarChar, name)
      .input('description', sql.Text, description || null)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('INSERT INTO clients (name, description, user_email) OUTPUT INSERTED.id VALUES (@name, @description, @userEmail)');

    const newId = insertResult.recordset[0].id;

    // Return the created client
    const result = await pool.request()
      .input('id', sql.Int, newId)
      .query('SELECT id, name, description, created_at, updated_at FROM clients WHERE id = @id');

    res.status(201).json({ 
      message: 'Client created successfully',
      client: result.recordset[0] 
    });
  } catch (error) {
    console.error('Database error:', error);
    if (error.isJoi) {
      return next(error);
    }
    return res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.put('/:id', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const { error, value } = updateClientSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const pool = await getDatabase();

    // Check if client exists and belongs to user
    const checkResult = await pool.request()
      .input('id', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('SELECT id FROM clients WHERE id = @id AND user_email = @userEmail');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Build update query dynamically
    const updates = [];
    const request = pool.request();
    request.input('id', sql.Int, clientId);
    request.input('userEmail', sql.VarChar, req.userEmail);

    if (value.name !== undefined) {
      updates.push('name = @name');
      request.input('name', sql.VarChar, value.name);
    }

    if (value.description !== undefined) {
      updates.push('description = @description');
      request.input('description', sql.Text, value.description || null);
    }

    updates.push('updated_at = GETDATE()');

    const updateQuery = `UPDATE clients SET ${updates.join(', ')} WHERE id = @id AND user_email = @userEmail`;
    await request.query(updateQuery);

    // Return updated client
    const result = await pool.request()
      .input('id', sql.Int, clientId)
      .query('SELECT id, name, description, created_at, updated_at FROM clients WHERE id = @id');

    res.json({
      message: 'Client updated successfully',
      client: result.recordset[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    if (error.isJoi) {
      return next(error);
    }
    return res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client
router.delete('/:id', async (req, res) => {
  const clientId = parseInt(req.params.id);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  try {
    const pool = await getDatabase();
    
    // Check if client exists and belongs to user
    const checkResult = await pool.request()
      .input('id', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('SELECT id FROM clients WHERE id = @id AND user_email = @userEmail');
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Delete client (work entries will be deleted due to CASCADE)
    await pool.request()
      .input('id', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('DELETE FROM clients WHERE id = @id AND user_email = @userEmail');
    
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
