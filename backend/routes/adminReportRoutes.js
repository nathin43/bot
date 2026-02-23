const express = require('express');
const router = express.Router();
const {
  getUsersForReports,
  getUserFullReport,
  exportUsersCsv,
  exportUsersExcel,
  syncUserSummaryReports,
  sendReportMessage,
  getAllReportMessages
} = require('../controllers/adminReportController');
const { adminProtect } = require('../middleware/auth');

/**
 * Admin Report Routes
 * All routes require admin authentication
 * 
 * Base path: /api/admin/reports
 */

// Get all users for admin reports page (with filters, pagination)
router.get('/users', adminProtect, getUsersForReports);

// Get comprehensive user report (orders, reviews, summary)
router.get('/user/:userId', adminProtect, getUserFullReport);

// Sync user summary reports to database
router.post('/sync', adminProtect, syncUserSummaryReports);

// Export users to Excel
router.get('/export/csv', adminProtect, exportUsersCsv);
router.get('/export/excel', adminProtect, exportUsersExcel);

// Report Message Routes
router.post('/send', adminProtect, sendReportMessage);
router.post('/send-message', adminProtect, sendReportMessage); // Alternative route for consistency
router.get('/messages', adminProtect, getAllReportMessages);

module.exports = router;
