const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * @fileoverview Report generation routes for client time tracking data.
 * Provides endpoints to retrieve and export client-specific reports in
 * JSON, CSV, and PDF formats. All routes require authentication.
 * 
 * @module routes/reports
 */

const router = express.Router();

router.use(authenticateUser);

/**
 * @route GET /api/reports/client/:clientId
 * @description Generates a detailed time report for a specific client.
 * Returns all work entries for the client along with aggregated statistics
 * including total hours and entry count. The client must belong to the
 * authenticated user.
 * 
 * @param {string} req.params.clientId - Client ID (must be a valid positive integer).
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * 
 * @returns {Object} 200 - Report generated successfully with client info, work entries, and totals.
 * @returns {Object} 400 - Invalid client ID format.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 404 - Client not found or does not belong to user.
 * @returns {Object} 500 - Internal server error.
 * 
 * @example
 * // Request
 * GET /api/reports/client/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response
 * {
 *   "client": { "id": 1, "name": "Acme Corp" },
 *   "workEntries": [{ "id": 1, "hours": 2.5, "description": "...", "date": "2024-01-15" }],
 *   "totalHours": 25.5,
 *   "entryCount": 10
 * }
 */
router.get('/client/:clientId', (req, res) => {
  const clientId = parseInt(req.params.clientId);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  // Verify client belongs to user
  db.get(
    'SELECT id, name FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, client) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      // Get work entries for this client
      db.all(
        `SELECT id, hours, description, date, created_at, updated_at
         FROM work_entries 
         WHERE client_id = ? AND user_email = ? 
         ORDER BY date DESC`,
        [clientId, req.userEmail],
        (err, workEntries) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
          // Calculate total hours
          const totalHours = workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
          
          res.json({
            client: client,
            workEntries: workEntries,
            totalHours: totalHours,
            entryCount: workEntries.length
          });
        }
      );
    }
  );
});

/**
 * @route GET /api/reports/export/csv/:clientId
 * @description Exports a client's time report as a downloadable CSV file.
 * The CSV includes columns for Date, Hours, Description, and Created At.
 * The file is generated on-demand and cleaned up after download.
 * 
 * @param {string} req.params.clientId - Client ID (must be a valid positive integer).
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * 
 * @returns {File} 200 - CSV file download with Content-Disposition header.
 * @returns {Object} 400 - Invalid client ID format.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 404 - Client not found or does not belong to user.
 * @returns {Object} 500 - Internal server error or CSV generation failure.
 * 
 * @example
 * // Request
 * GET /api/reports/export/csv/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response: CSV file download
 * // Filename: Acme_Corp_report_2024-01-15T10-30-00-000Z.csv
 */
router.get('/export/csv/:clientId', (req, res) => {
  const clientId = parseInt(req.params.clientId);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  // Verify client belongs to user and get data
  db.get(
    'SELECT id, name FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, client) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      // Get work entries
      db.all(
        `SELECT hours, description, date, created_at
         FROM work_entries 
         WHERE client_id = ? AND user_email = ? 
         ORDER BY date DESC`,
        [clientId, req.userEmail],
        (err, workEntries) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
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
          
          csvWriter.writeRecords(workEntries)
            .then(() => {
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
            })
            .catch((error) => {
              console.error('Error creating CSV:', error);
              res.status(500).json({ error: 'Failed to generate CSV report' });
            });
        }
      );
    }
  );
});

/**
 * @route GET /api/reports/export/pdf/:clientId
 * @description Exports a client's time report as a downloadable PDF document.
 * The PDF includes a formatted header with client name, summary statistics
 * (total hours, entry count, generation date), and a table of all work entries.
 * Automatically handles pagination for reports with many entries.
 * 
 * @param {string} req.params.clientId - Client ID (must be a valid positive integer).
 * @param {string} req.headers.x-user-email - Authenticated user's email address.
 * 
 * @returns {File} 200 - PDF file download with Content-Type: application/pdf header.
 * @returns {Object} 400 - Invalid client ID format.
 * @returns {Object} 401 - Authentication required.
 * @returns {Object} 404 - Client not found or does not belong to user.
 * @returns {Object} 500 - Internal server error or PDF generation failure.
 * 
 * @example
 * // Request
 * GET /api/reports/export/pdf/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response: PDF file download
 * // Filename: Acme_Corp_report_2024-01-15T10-30-00-000Z.pdf
 */
router.get('/export/pdf/:clientId', (req, res) => {
  const clientId = parseInt(req.params.clientId);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  // Verify client belongs to user and get data
  db.get(
    'SELECT id, name FROM clients WHERE id = ? AND user_email = ?',
    [clientId, req.userEmail],
    (err, client) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      // Get work entries
      db.all(
        `SELECT hours, description, date, created_at
         FROM work_entries 
         WHERE client_id = ? AND user_email = ? 
         ORDER BY date DESC`,
        [clientId, req.userEmail],
        (err, workEntries) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
          }
          
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
        }
      );
    }
  );
});

module.exports = router;
