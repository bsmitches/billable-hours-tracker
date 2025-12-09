const express = require('express');
const { getDatabase, sql } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get hourly report for specific client
router.get('/client/:clientId', async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  try {
    const pool = await getDatabase();
    
    // Verify client belongs to user
    const clientResult = await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('SELECT id, name FROM clients WHERE id = @clientId AND user_email = @userEmail');
    
    if (clientResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const client = clientResult.recordset[0];
    
    // Get work entries for this client
    const entriesResult = await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query(`SELECT id, hours, description, date, created_at, updated_at
       FROM work_entries 
       WHERE client_id = @clientId AND user_email = @userEmail 
       ORDER BY date DESC`);
    
    const workEntries = entriesResult.recordset;
    
    // Calculate total hours
    const totalHours = workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
    
    res.json({
      client: client,
      workEntries: workEntries,
      totalHours: totalHours,
      entryCount: workEntries.length
    });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Export client report as CSV
router.get('/export/csv/:clientId', async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  try {
    const pool = await getDatabase();
    
    // Verify client belongs to user and get data
    const clientResult = await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('SELECT id, name FROM clients WHERE id = @clientId AND user_email = @userEmail');
    
    if (clientResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const client = clientResult.recordset[0];
    
    // Get work entries
    const entriesResult = await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query(`SELECT hours, description, date, created_at
       FROM work_entries 
       WHERE client_id = @clientId AND user_email = @userEmail 
       ORDER BY date DESC`);
    
    const workEntries = entriesResult.recordset;
    
    // Create temporary CSV file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${timestamp}.csv`;
    const tempPath = path.join(__dirname, '../../temp', filename);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const csvWriter = createCsvWriter({
      path: tempPath,
      header: [
        { id: 'date', title: 'Date' },
        { id: 'hours', title: 'Hours' },
        { id: 'description', title: 'Description' },
        { id: 'created_at', title: 'Created At' }
      ]
    });
    
    await csvWriter.writeRecords(workEntries);
    
    // Send file and clean up
    res.download(tempPath, filename, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up temp file
      fs.unlink(tempPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting temp file:', unlinkErr);
        }
      });
    });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Export client report as PDF
router.get('/export/pdf/:clientId', async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  try {
    const pool = await getDatabase();
    
    // Verify client belongs to user and get data
    const clientResult = await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query('SELECT id, name FROM clients WHERE id = @clientId AND user_email = @userEmail');
    
    if (clientResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const client = clientResult.recordset[0];
    
    // Get work entries
    const entriesResult = await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('userEmail', sql.VarChar, req.userEmail)
      .query(`SELECT hours, description, date, created_at
       FROM work_entries 
       WHERE client_id = @clientId AND user_email = @userEmail 
       ORDER BY date DESC`);
    
    const workEntries = entriesResult.recordset;
    
    // Create PDF
    const doc = new PDFDocument();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${timestamp}.pdf`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(20).text(`Time Report for ${client.name}`, { align: 'center' });
    doc.moveDown();
    
    const totalHours = workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
    doc.fontSize(14).text(`Total Hours: ${totalHours.toFixed(2)}`);
    doc.text(`Total Entries: ${workEntries.length}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();
    
    // Add table header
    doc.fontSize(12).text('Date', 50, doc.y, { width: 100 });
    doc.text('Hours', 150, doc.y - 15, { width: 80 });
    doc.text('Description', 230, doc.y - 15, { width: 300 });
    doc.moveDown();
    
    // Add horizontal line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    
    // Add work entries
    workEntries.forEach((entry, index) => {
      const y = doc.y;
      
      // Check if we need a new page
      if (y > 700) {
        doc.addPage();
      }
      
      doc.text(entry.date, 50, doc.y, { width: 100 });
      doc.text(entry.hours.toString(), 150, y, { width: 80 });
      doc.text(entry.description || 'No description', 230, y, { width: 300 });
      doc.moveDown();
      
      // Add separator line every 5 entries
      if ((index + 1) % 5 === 0) {
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);
      }
    });
    
    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
