/**
 * @fileoverview Report generation and export routes for the Billable Hours Tracker API.
 * 
 * This module provides endpoints for generating client-specific work reports and
 * exporting them in various formats (JSON, CSV, PDF). Reports aggregate work entries
 * by client and calculate total hours worked.
 * 
 * Endpoints:
 * - GET /api/reports/client/:clientId - Get JSON report for a client
 * - GET /api/reports/export/csv/:clientId - Export client report as CSV file
 * - GET /api/reports/export/pdf/:clientId - Export client report as PDF file
 * 
 * Data Isolation: All queries filter by user_email to ensure users can only
 * generate reports for their own clients.
 * 
 * @module routes/reports
 * @requires express - Web framework for Node.js
 * @requires ../database/init - Database connection module
 * @requires ../middleware/auth - Authentication middleware
 * @requires csv-writer - CSV file generation library
 * @requires pdfkit - PDF document generation library
 * @requires path - Node.js path utilities
 * @requires fs - Node.js file system utilities
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Express router instance for report routes.
 * @type {express.Router}
 */
const router = express.Router();

/**
 * Apply authentication middleware to all report routes.
 * This ensures all endpoints require a valid x-user-email header.
 */
router.use(authenticateUser);

/**
 * Get hourly report for a specific client.
 * Returns all work entries for the client with calculated totals.
 * 
 * @route GET /api/reports/client/:clientId
 * @param {string} req.params.clientId - Client ID (must be a valid integer)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {Object} JSON response with client info, work entries, and totals
 * 
 * @example
 * // Request
 * GET /api/reports/client/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response - 200 OK
 * {
 *   "client": { "id": 1, "name": "Acme Corp" },
 *   "workEntries": [{ "id": 1, "hours": 8, "description": "Development", "date": "2024-01-15", ... }],
 *   "totalHours": 42.5,
 *   "entryCount": 5
 * }
 * 
 * Response Codes:
 * - 200 OK: Report generated successfully
 * - 400 Bad Request: Invalid client ID format
 * - 404 Not Found: Client not found or doesn't belong to user
 * - 500 Internal Server Error: Database error
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
 * Export client report as a CSV file.
 * Generates a downloadable CSV file containing all work entries for the specified client.
 * The file is created temporarily and deleted after download.
 * 
 * @route GET /api/reports/export/csv/:clientId
 * @param {string} req.params.clientId - Client ID (must be a valid integer)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {File} CSV file download with columns: Date, Hours, Description, Created At
 * 
 * @example
 * // Request
 * GET /api/reports/export/csv/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response - 200 OK (file download)
 * Content-Type: text/csv
 * Content-Disposition: attachment; filename="Acme_Corp_report_2024-01-15T10-30-00-000Z.csv"
 * 
 * Response Codes:
 * - 200 OK: CSV file generated and downloaded successfully
 * - 400 Bad Request: Invalid client ID format
 * - 404 Not Found: Client not found or doesn't belong to user
 * - 500 Internal Server Error: Database error or file generation failure
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
 * Export client report as a PDF file.
 * Generates a downloadable PDF document containing all work entries for the specified client.
 * The PDF includes a header with client name, summary statistics, and a formatted table of entries.
 * 
 * PDF Structure:
 * - Title: "Time Report for {Client Name}"
 * - Summary: Total hours, entry count, generation timestamp
 * - Table: Date, Hours, Description columns
 * - Pagination: Automatic page breaks when content exceeds page height
 * 
 * @route GET /api/reports/export/pdf/:clientId
 * @param {string} req.params.clientId - Client ID (must be a valid integer)
 * @middleware authenticateUser - Validates x-user-email header
 * @returns {File} PDF file download
 * 
 * @example
 * // Request
 * GET /api/reports/export/pdf/1
 * Headers: { "x-user-email": "user@example.com" }
 * 
 * // Response - 200 OK (file download)
 * Content-Type: application/pdf
 * Content-Disposition: attachment; filename="Acme_Corp_report_2024-01-15T10-30-00-000Z.pdf"
 * 
 * Response Codes:
 * - 200 OK: PDF file generated and downloaded successfully
 * - 400 Bad Request: Invalid client ID format
 * - 404 Not Found: Client not found or doesn't belong to user
 * - 500 Internal Server Error: Database error or PDF generation failure
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

/**
 * Export the router for mounting in the main Express app.
 * @exports router
 */
module.exports = router;
