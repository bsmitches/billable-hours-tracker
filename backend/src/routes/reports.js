/**
 * @fileoverview Report generation and export routes for client time tracking data.
 * 
 * This module provides REST API endpoints for generating and exporting reports
 * in the Billable Hours Tracker application. Reports aggregate work entries by
 * client and can be exported in multiple formats (JSON, CSV, PDF).
 * 
 * All routes require authentication and enforce data isolation - users can only
 * generate reports for their own clients.
 * 
 * Endpoints:
 * - GET /api/reports/client/:clientId - Get JSON report for a client
 * - GET /api/reports/export/csv/:clientId - Export client report as CSV file
 * - GET /api/reports/export/pdf/:clientId - Export client report as PDF file
 * 
 * @module routes/reports
 * @requires express
 * @requires ../database/init
 * @requires ../middleware/auth
 * @requires csv-writer
 * @requires pdfkit
 * @requires path
 * @requires fs
 */

const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateUser } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Express router instance for report generation endpoints.
 * @type {import('express').Router}
 */
const router = express.Router();

// Apply authentication middleware to all routes in this router
// This ensures only authenticated users can access report endpoints
router.use(authenticateUser);

/**
 * GET /api/reports/client/:clientId
 * 
 * Generates a JSON report for a specific client containing all work entries,
 * total hours worked, and entry count. The client must belong to the authenticated user.
 * 
 * @name GetClientReport
 * @route {GET} /api/reports/client/:clientId
 * @routeparam {number} clientId - The client's unique identifier
 * @authentication Requires x-user-email header
 * @returns {Object} 200 - Report object with client info, work entries, and totals
 * @returns {Object} 400 - Invalid client ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Client not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Success response
 * {
 *   "client": { "id": 1, "name": "Acme Corp" },
 *   "workEntries": [{ "id": 1, "hours": 2.5, "date": "2024-01-15", ... }],
 *   "totalHours": 10.5,
 *   "entryCount": 4
 * }
 */
router.get('/client/:clientId', (req, res) => {
  // Parse and validate the client ID from URL parameter
  const clientId = parseInt(req.params.clientId);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  // First verify the client exists and belongs to the authenticated user
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
      
      // Retrieve all work entries for this client, sorted by date (newest first)
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
          
          // Calculate total hours by summing all work entry hours
          // parseFloat ensures proper numeric addition even if stored as string
          const totalHours = workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
          
          // Return comprehensive report data
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
 * GET /api/reports/export/csv/:clientId
 * 
 * Exports a client's work entries as a downloadable CSV file. The file includes
 * columns for date, hours, description, and creation timestamp. A temporary file
 * is created and automatically cleaned up after download.
 * 
 * @name ExportClientReportCSV
 * @route {GET} /api/reports/export/csv/:clientId
 * @routeparam {number} clientId - The client's unique identifier
 * @authentication Requires x-user-email header
 * @returns {File} 200 - CSV file download
 * @returns {Object} 400 - Invalid client ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Client not found
 * @returns {Object} 500 - Internal server error or CSV generation failure
 * 
 * @example
 * // Response headers
 * Content-Type: text/csv
 * Content-Disposition: attachment; filename="Acme_Corp_report_2024-01-15T10-30-00-000Z.csv"
 */
router.get('/export/csv/:clientId', (req, res) => {
  // Parse and validate the client ID from URL parameter
  const clientId = parseInt(req.params.clientId);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  // First verify the client exists and belongs to the authenticated user
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
      
      // Retrieve work entries for CSV export (only needed columns)
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
          
          // Generate unique filename with timestamp to avoid collisions
          // Replace special characters in client name for filesystem safety
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${timestamp}.csv`;
          const tempPath = path.join(__dirname, '../../temp', filename);
          
          // Ensure temp directory exists for storing generated files
          const tempDir = path.dirname(tempPath);
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          // Configure CSV writer with column headers
          const csvWriter = createCsvWriter({
            path: tempPath,
            header: [
              { id: 'date', title: 'Date' },
              { id: 'hours', title: 'Hours' },
              { id: 'description', title: 'Description' },
              { id: 'created_at', title: 'Created At' }
            ]
          });
          
          // Write records to CSV file and send to client
          csvWriter.writeRecords(workEntries)
            .then(() => {
              // Send file as download attachment
              res.download(tempPath, filename, (err) => {
                if (err) {
                  console.error('Error sending file:', err);
                }
                // Clean up temporary file after download completes
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
 * GET /api/reports/export/pdf/:clientId
 * 
 * Exports a client's work entries as a downloadable PDF document. The PDF includes
 * a title, summary statistics (total hours, entry count), and a formatted table
 * of all work entries. The PDF is streamed directly to the response.
 * 
 * @name ExportClientReportPDF
 * @route {GET} /api/reports/export/pdf/:clientId
 * @routeparam {number} clientId - The client's unique identifier
 * @authentication Requires x-user-email header
 * @returns {File} 200 - PDF file download
 * @returns {Object} 400 - Invalid client ID format
 * @returns {Object} 401 - Authentication required
 * @returns {Object} 404 - Client not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Response headers
 * Content-Type: application/pdf
 * Content-Disposition: attachment; filename="Acme_Corp_report_2024-01-15T10-30-00-000Z.pdf"
 */
router.get('/export/pdf/:clientId', (req, res) => {
  // Parse and validate the client ID from URL parameter
  const clientId = parseInt(req.params.clientId);
  
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  
  const db = getDatabase();
  
  // First verify the client exists and belongs to the authenticated user
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
      
      // Retrieve work entries for PDF export
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
          
          // Initialize PDFKit document for streaming PDF generation
          const doc = new PDFDocument();
          
          // Generate unique filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_report_${timestamp}.pdf`;
          
          // Set response headers for PDF download
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          
          // Stream PDF directly to HTTP response (no temp file needed)
          doc.pipe(res);
          
          // Add report title centered at top of page
          doc.fontSize(20).text(`Time Report for ${client.name}`, { align: 'center' });
          doc.moveDown();
          
          // Calculate and display summary statistics
          const totalHours = workEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
          doc.fontSize(14).text(`Total Hours: ${totalHours.toFixed(2)}`);
          doc.text(`Total Entries: ${workEntries.length}`);
          doc.text(`Generated: ${new Date().toLocaleString()}`);
          doc.moveDown();
          
          // Add table header row for work entries
          doc.fontSize(12).text('Date', 50, doc.y, { width: 100 });
          doc.text('Hours', 150, doc.y - 15, { width: 80 });
          doc.text('Description', 230, doc.y - 15, { width: 300 });
          doc.moveDown();
          
          // Draw horizontal separator line below header
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.5);
          
          // Iterate through work entries and add each to the PDF
          workEntries.forEach((entry, index) => {
            const y = doc.y;
            
            // Check if we need a new page (prevent content overflow)
            if (y > 700) {
              doc.addPage();
            }
            
            // Add entry data in table format
            doc.text(entry.date, 50, doc.y, { width: 100 });
            doc.text(entry.hours.toString(), 150, y, { width: 80 });
            doc.text(entry.description || 'No description', 230, y, { width: 300 });
            doc.moveDown();
            
            // Add visual separator line every 5 entries for readability
            if ((index + 1) % 5 === 0) {
              doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
              doc.moveDown(0.5);
            }
          });
          
          // Finalize and close the PDF document (triggers response completion)
          doc.end();
        }
      );
    }
  );
});

module.exports = router;
