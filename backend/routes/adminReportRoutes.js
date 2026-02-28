const express = require('express');
const router = express.Router();
const {
  getUsersForReports,
  getUserFullReport,
  exportUsersCsv,
  exportUsersExcel,
  syncUserSummaryReports,
  getSalesReport,
  getOrderReport,
  getPaymentReport,
  getStockReport,
  getCustomerReport,
  generateReport,
  getReportHistory,
  getGeneratedReportById
} = require('../controllers/adminReportController');
const { adminProtect } = require('../middleware/auth');

/**
 * Admin Report Routes
 * All routes require admin authentication
 * 
 * Base path: /api/admin/reports
 */

// Specific Report Type Endpoints (Real-time DB data with auto-save)
router.get('/sales', adminProtect, getSalesReport);
router.get('/orders', adminProtect, getOrderReport);
router.get('/payments', adminProtect, getPaymentReport);
router.get('/stock', adminProtect, getStockReport);
router.get('/customers', adminProtect, getCustomerReport);

// Generate and Save Report (POST endpoint)
router.post('/generate', adminProtect, generateReport);

// Get Report History
router.get('/history/:type', adminProtect, getReportHistory);

// Get Specific Generated Report by ID
router.get('/generated/:id', adminProtect, getGeneratedReportById);

// Get all users for admin reports page (with filters, pagination)
router.get('/users', adminProtect, getUsersForReports);

// Get comprehensive user report (orders, reviews, summary)
router.get('/user/:userId', adminProtect, getUserFullReport);

// Sync user summary reports to database
router.post('/sync', adminProtect, syncUserSummaryReports);

// Export users to Excel
router.get('/export/csv', adminProtect, exportUsersCsv);
router.get('/export/excel', adminProtect, exportUsersExcel);

module.exports = router;
