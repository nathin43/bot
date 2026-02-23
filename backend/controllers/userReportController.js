const Order = require('../models/Order');
const Report = require('../models/Report');
const ReportMessage = require('../models/ReportMessage');

/**
 * User Report Controller
 * Handles customer-side reporting functionality
 * Users can ONLY view their OWN reports
 */

/**
 * Get logged-in user's own reports
 * Fetches reports for the authenticated user only
 * 
 * @route GET /api/user/reports
 * @access Private/User
 */
exports.getMyReports = async (req, res) => {
  try {
    const userId = req.user.id; // Get from JWT token
    const { page = 1, limit = 10, status, type, startDate, endDate } = req.query;

    // Build filter query (ONLY for this user)
    const filters = { user: userId };
    
    if (status) filters.reportStatus = status;
    if (type) filters.reportType = type;
    if (startDate || endDate) {
      filters.reportGeneratedAt = {};
      if (startDate) filters.reportGeneratedAt.$gte = new Date(startDate);
      if (endDate) filters.reportGeneratedAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const reports = await Report.find(filters)
      .populate('order', 'orderNumber orderStatus totalAmount')
      .sort({ reportGeneratedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalReports = await Report.countDocuments(filters);

    res.status(200).json({
      success: true,
      count: reports.length,
      totalReports,
      totalPages: Math.ceil(totalReports / limit),
      currentPage: parseInt(page),
      reports
    });
  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
};

/**
 * Get logged-in user's orders for reporting
 * 
 * @route GET /api/user/reports/orders
 * @access Private/User
 */
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    const filters = { user: userId };
    
    if (status) filters.orderStatus = status;
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find(filters)
      .populate('items.product', 'name price images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalOrders = await Order.countDocuments(filters);

    // Calculate summary
    const allOrders = await Order.find({ user: userId });
    const summary = {
      totalOrders: allOrders.length,
      totalSpent: allOrders.reduce((sum, order) => sum + (order.totalAmount || order.totalPrice || 0), 0),
      deliveredOrders: allOrders.filter(o => o.orderStatus === 'delivered').length,
      pendingOrders: allOrders.filter(o => o.orderStatus === 'pending').length,
      cancelledOrders: allOrders.filter(o => o.orderStatus === 'cancelled').length
    };

    res.status(200).json({
      success: true,
      orders,
      summary,
      totalOrders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

/**
 * Download user's own report
 * 
 * @route GET /api/user/reports/download/:reportId
 * @access Private/User
 */
exports.downloadMyReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reportId } = req.params;

    const report = await Report.findOne({ _id: reportId, user: userId })
      .populate('order')
      .populate('items.product');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or you do not have access'
      });
    }

    // Mark as downloaded
    report.reportStatus = 'Downloaded';
    report.downloadedAt = new Date();
    await report.save();

    res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download report',
      error: error.message
    });
  }
};

/**
 * Generate report for user's own order
 * 
 * @route POST /api/user/reports/generate/:orderId
 * @access Private/User
 */
exports.generateMyReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Verify order belongs to this user
    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or you do not have access'
      });
    }

    // Check if report already exists
    const existingReport = await Report.findOne({ order: orderId });
    if (existingReport) {
      return res.status(200).json({
        success: true,
        message: 'Report already exists',
        report: existingReport
      });
    }

    // Create new report
    const reportItems = order.items.map(item => ({
      product: item.product._id,
      productName: item.product.name,
      productPrice: item.price,
      quantity: item.quantity,
      itemTotal: item.price * item.quantity
    }));

    const newReport = await Report.create({
      user: userId,
      userName: req.user.name,
      userEmail: req.user.email,
      order: orderId,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      orderDate: order.createdAt,
      items: reportItems,
      totalAmount: order.totalAmount || order.totalPrice,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddress,
      reportType: 'Order Report',
      reportStatus: 'Generated'
    });

    res.status(201).json({
      success: true,
      message: 'Report generated successfully',
      report: newReport
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

/**
 * Get User's Report Messages (Inbox)
 * Users can view ONLY their own report messages sent by admin
 * 
 * @route GET /api/user/reports/messages
 * @access Private/User
 */
exports.getMyReportMessages = async (req, res) => {
  try {
    const userId = req.user.id; // Get from JWT token
    const { page = 1, limit = 20, status, unreadOnly } = req.query;

    // Build filter query (ONLY for this user)
    const filters = { userId };
    
    if (status) filters.status = status;
    if (unreadOnly === 'true') filters.isRead = false;

    const skip = (page - 1) * limit;

    const messages = await ReportMessage.find(filters)
      .populate('sentBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMessages = await ReportMessage.countDocuments(filters);
    const unreadCount = await ReportMessage.countDocuments({ userId, isRead: false });

    res.status(200).json({
      success: true,
      count: messages.length,
      totalMessages,
      unreadCount,
      totalPages: Math.ceil(totalMessages / limit),
      currentPage: parseInt(page),
      messages
    });
  } catch (error) {
    console.error('Error fetching user report messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report messages',
      error: error.message
    });
  }
};

/**
 * Mark Report Message as Read
 * User marks their own report message as read
 * 
 * @route PATCH /api/user/reports/messages/:messageId/read
 * @access Private/User
 */
exports.markReportMessageAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    // Find message and verify ownership
    const message = await ReportMessage.findOne({ _id: messageId, userId });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Report message not found or you do not have access'
      });
    }

    // Update read status
    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    res.status(200).json({
      success: true,
      message: 'Report message marked as read',
      reportMessage: message
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
};
