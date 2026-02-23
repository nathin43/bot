const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  getOrdersByUserId,
  getOrderReportDetails
} = require('../controllers/orderController');
const { protect, adminProtect } = require('../middleware/auth');
const { checkCanPlaceOrder } = require('../middleware/checkUserStatus');

/**
 * Order Routes
 * Customer and admin order management
 */

// Admin routes (must come before /:id routes)
router.get('/', adminProtect, getAllOrders);
router.get('/user/:userId', adminProtect, getOrdersByUserId);
router.get('/:id/report-details', adminProtect, getOrderReportDetails);
router.put('/:id/status', adminProtect, updateOrderStatus);

// Customer routes
router.post('/', protect, checkCanPlaceOrder, createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/cancel', protect, cancelOrder);

module.exports = router;
