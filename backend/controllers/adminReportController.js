const ExcelJS = require('exceljs');
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const ReportMessage = require('../models/ReportMessage');
const { syncUserReportSummaries, upsertUserReportSummariesBulk } = require('../services/userReportSummaryService');

const formatCurrency = (amount) => {
  const numeric = Number(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(numeric);
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const escapeCsvValue = (value) => {
  const stringValue = value == null ? '' : String(value);
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
};

const getActualStatusDetails = (user, now = new Date()) => {
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  if (user.status === 'BLOCKED') {
    return {
      actualStatus: 'BLOCKED',
      actualStatusReason: user.statusReason || 'Account blocked by admin',
      actualStatusChangedAt: user.statusChangedAt,
      actualStatusChangedBy: user.statusChangedBy,
      actualSuspensionUntil: user.suspensionUntil
    };
  }

  if (user.status === 'SUSPENDED') {
    if (user.suspensionUntil && now > new Date(user.suspensionUntil)) {
      return {
        actualStatus: 'ACTIVE',
        actualStatusReason: 'Suspension period ended',
        actualStatusChangedAt: now,
        actualStatusChangedBy: 'system',
        actualSuspensionUntil: user.suspensionUntil
      };
    }
    return {
      actualStatus: 'SUSPENDED',
      actualStatusReason: user.statusReason || 'Account temporarily suspended',
      actualStatusChangedAt: user.statusChangedAt,
      actualStatusChangedBy: user.statusChangedBy,
      actualSuspensionUntil: user.suspensionUntil
    };
  }

  if (user.lastLoginAt && new Date(user.lastLoginAt) < sixtyDaysAgo) {
    return {
      actualStatus: 'INACTIVE',
      actualStatusReason: 'No activity for 60+ days',
      actualStatusChangedAt: user.lastLoginAt,
      actualStatusChangedBy: 'system',
      actualSuspensionUntil: user.suspensionUntil
    };
  }

  return {
    actualStatus: 'ACTIVE',
    actualStatusReason: user.statusReason || null,
    actualStatusChangedAt: user.statusChangedAt,
    actualStatusChangedBy: user.statusChangedBy,
    actualSuspensionUntil: user.suspensionUntil
  };
};

const parseReportFilters = (query) => {
  const {
    search = '',
    accountStatus = '',
    dateFrom = '',
    dateTo = '',
    minOrders = '',
    maxOrders = '',
    minAmount = '',
    maxAmount = ''
  } = query;

  const filters = {};

  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  if (dateFrom || dateTo) {
    filters.createdAt = {};
    if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filters.createdAt.$lte = new Date(dateTo);
  }

  return {
    filters,
    accountStatus,
    minOrders,
    maxOrders,
    minAmount,
    maxAmount
  };
};

const buildUserReportPipeline = ({ filters, accountStatus, minOrders, maxOrders, minAmount, maxAmount, now }) => {
  const normalizedStatus = accountStatus ? accountStatus.toUpperCase() : '';
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const totalOrdersMatch = {};
  if (minOrders) totalOrdersMatch.$gte = parseInt(minOrders, 10);
  if (maxOrders) totalOrdersMatch.$lte = parseInt(maxOrders, 10);

  const totalAmountMatch = {};
  if (minAmount) totalAmountMatch.$gte = parseFloat(minAmount);
  if (maxAmount) totalAmountMatch.$lte = parseFloat(maxAmount);

  const postMatch = {};
  if (Object.keys(totalOrdersMatch).length) postMatch.totalOrders = totalOrdersMatch;
  if (Object.keys(totalAmountMatch).length) postMatch.totalAmountSpent = totalAmountMatch;
  if (normalizedStatus) postMatch.actualStatus = normalizedStatus;

  const pipeline = [
    { $match: filters },
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'user',
        as: 'orders'
      }
    },
    {
      $addFields: {
        totalOrders: { $size: '$orders' },
        totalAmountSpent: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$orders',
                  as: 'order',
                  cond: { 
                    $eq: [
                      { $toLower: { $ifNull: ['$$order.orderStatus', ''] } },
                      'delivered'
                    ]
                  }
                }
              },
              as: 'order',
              in: { $ifNull: ['$$order.totalAmount', 0] }
            }
          }
        },
        lastOrder: { $max: '$orders.createdAt' },
        actualStatus: {
          $switch: {
            branches: [
              { case: { $eq: ['$status', 'BLOCKED'] }, then: 'BLOCKED' },
              {
                case: { $eq: ['$status', 'SUSPENDED'] },
                then: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$suspensionUntil', null] },
                        { $lt: ['$suspensionUntil', now] }
                      ]
                    },
                    'ACTIVE',
                    'SUSPENDED'
                  ]
                }
              },
              { case: { $lt: ['$lastLoginAt', sixtyDaysAgo] }, then: 'INACTIVE' }
            ],
            default: 'ACTIVE'
          }
        }
      }
    },
    ...(Object.keys(postMatch).length ? [{ $match: postMatch }] : []),
    {
      $project: {
        password: 0,
        orders: 0
      }
    },
    { $sort: { createdAt: -1 } }
  ];

  return pipeline;
};

/**
 * Admin Report Controller
 * Handles all admin-side reporting functionality
 * Admins can view reports for ANY user
 */

/**
 * Get all users for admin reports page
 * Includes pagination, filters, search
 * 
 * @route GET /api/admin/reports/users
 * @access Private/Admin
 */
exports.getUsersForReports = async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const now = new Date();
    const { filters, accountStatus, minOrders, maxOrders, minAmount, maxAmount } = parseReportFilters(req.query);

    const skip = (page - 1) * limit;
    const basePipeline = buildUserReportPipeline({
      filters,
      accountStatus,
      minOrders,
      maxOrders,
      minAmount,
      maxAmount,
      now
    });

    const [result] = await User.aggregate([
      ...basePipeline,
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: parseInt(limit, 10) }],
          metadata: [{ $count: 'totalUsers' }]
        }
      }
    ]);

    const users = (result?.data || []).map((user) => ({
      ...user,
      ...getActualStatusDetails(user, now)
    }));

    await upsertUserReportSummariesBulk(users);

    const totalUsers = result?.metadata?.[0]?.totalUsers || 0;

    res.status(200).json({
      success: true,
      users,
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers
    });
  } catch (error) {
    console.error('Error fetching users for reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

/**
 * Get comprehensive report for a specific user (Admin only)
 * Fetches user details, orders, payments, invoices, reviews
 * 
 * @route GET /api/admin/reports/user/:userId
 * @access Private/Admin
 */
exports.getUserFullReport = async (req, res) => {
  try {
    const { userId } = req.params;
    const { dateFrom, dateTo, status } = req.query;

    // Validate userId
    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Fetch user details
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build date filter
    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }

    // Build order query
    const orderQuery = { user: userId };
    if (Object.keys(dateFilter).length > 0) {
      orderQuery.createdAt = dateFilter;
    }
    if (status && status !== 'all') {
      orderQuery.orderStatus = status;
    }

    // Fetch all orders for this user
    const orders = await Order.find(orderQuery)
      .populate('items.product', 'name price images')
      .sort({ createdAt: -1 });

    // Fetch all reviews by this user
    const reviewQuery = { user: userId };
    if (Object.keys(dateFilter).length > 0) {
      reviewQuery.createdAt = dateFilter;
    }
    if (status && status !== 'all' && ['approved', 'rejected', 'pending'].includes(status)) {
      reviewQuery.status = status;
    }

    const reviews = await Review.find(reviewQuery)
      .populate('product', 'name images')
      .sort({ createdAt: -1 });

    // Generate payments from orders
    const payments = orders.map(order => ({
      _id: order._id,
      orderId: order._id,
      createdAt: order.createdAt,
      method: order.paymentMethod || 'N/A',
      amount: order.totalAmount || order.totalPrice || 0,
      status: order.paymentStatus || 'pending',
      transactionId: order.transactionId || null,
      refundAmount: order.orderStatus === 'cancelled' ? order.totalAmount : null
    }));

    // Generate invoices from orders
    const invoices = orders
      .filter(order => ['delivered', 'shipped', 'processing'].includes(order.orderStatus))
      .map(order => ({
        _id: order._id,
        invoiceNumber: order.orderNumber || `INV-${order._id.toString().slice(-8)}`,
        orderId: order._id,
        date: order.createdAt,
        tax: ((order.totalAmount || order.totalPrice || 0) * 0.18).toFixed(2),
        amount: order.totalAmount || order.totalPrice || 0
      }));

    // Prepare response data
    const responseData = {
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        addresses: user.addresses || []
      },
      orders: orders.map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        items: order.items,
        totalAmount: order.totalAmount || order.totalPrice,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        deliveredAt: order.deliveredAt
      })),
      payments,
      invoices,
      reviews: reviews.map(review => ({
        _id: review._id,
        product: review.product,
        productName: review.product?.name || 'Unknown Product',
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt
      })),
      summary: {
        totalOrders: orders.length,
        totalSpent: orders
          .filter(order => order.orderStatus === 'delivered')
          .reduce((sum, order) => sum + (order.totalAmount || order.totalPrice || 0), 0),
        totalReviews: reviews.length,
        deliveredOrders: orders.filter(o => o.orderStatus === 'delivered').length,
        pendingOrders: orders.filter(o => o.orderStatus === 'pending').length,
        cancelledOrders: orders.filter(o => o.orderStatus === 'cancelled').length
      }
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching user full report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user report data',
      error: error.message
    });
  }
};

/**
 * Export users report to Excel
 * 
 * @route GET /api/admin/reports/export/excel
 * @access Private/Admin
 */
exports.exportUsersCsv = async (req, res) => {
  try {
    const now = new Date();
    const { filters, accountStatus, minOrders, maxOrders, minAmount, maxAmount } = parseReportFilters(req.query);
    const basePipeline = buildUserReportPipeline({
      filters,
      accountStatus,
      minOrders,
      maxOrders,
      minAmount,
      maxAmount,
      now
    });

    const users = await User.aggregate(basePipeline);
    await upsertUserReportSummariesBulk(users);
    const rows = users.map((user) => {
      const statusDetails = getActualStatusDetails(user, now);
      return {
        name: user.name || 'Unknown User',
        email: user.email || '',
        status: statusDetails.actualStatus,
        totalOrders: user.totalOrders || 0,
        totalAmountSpent: formatCurrency(user.totalAmountSpent || 0),
        lastOrder: formatDate(user.lastOrder)
      };
    });

    const headers = [
      'User Name',
      'Email',
      'Account Status',
      'Total Orders',
      'Total Amount Spent',
      'Last Order Date'
    ];

    const csvLines = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((row) => [
        escapeCsvValue(row.name),
        escapeCsvValue(row.email),
        escapeCsvValue(row.status),
        escapeCsvValue(row.totalOrders),
        escapeCsvValue(row.totalAmountSpent),
        escapeCsvValue(row.lastOrder)
      ].join(','))
    ];

    const csvContent = `\ufeff${csvLines.join('\n')}`;
    const fileName = `user-reports-${now.toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export CSV',
      error: error.message
    });
  }
};

exports.exportUsersExcel = async (req, res) => {
  try {
    const now = new Date();
    const { filters, accountStatus, minOrders, maxOrders, minAmount, maxAmount } = parseReportFilters(req.query);
    const basePipeline = buildUserReportPipeline({
      filters,
      accountStatus,
      minOrders,
      maxOrders,
      minAmount,
      maxAmount,
      now
    });

    const users = await User.aggregate(basePipeline);
    await upsertUserReportSummariesBulk(users);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('User Reports');

    worksheet.columns = [
      { header: 'User Name', key: 'name', width: 28 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Account Status', key: 'status', width: 16 },
      { header: 'Total Orders', key: 'totalOrders', width: 14 },
      { header: 'Total Amount Spent', key: 'totalAmountSpent', width: 20 },
      { header: 'Last Order Date', key: 'lastOrder', width: 16 }
    ];

    users.forEach((user) => {
      const statusDetails = getActualStatusDetails(user, now);
      worksheet.addRow({
        name: user.name || 'Unknown User',
        email: user.email || '',
        status: statusDetails.actualStatus,
        totalOrders: user.totalOrders || 0,
        totalAmountSpent: formatCurrency(user.totalAmountSpent || 0),
        lastOrder: formatDate(user.lastOrder)
      });
    });

    worksheet.getRow(1).font = { bold: true };

    const fileName = `user-reports-${now.toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export Excel',
      error: error.message
    });
  }
};

/**
 * Sync user summary reports for all users (Admin only)
 *
 * @route POST /api/admin/reports/sync
 * @access Private/Admin
 */
exports.syncUserSummaryReports = async (req, res) => {
  try {
    const users = await User.find({}, 'name email');
    const result = await upsertUserReportSummariesBulk(users);

    res.status(200).json({
      success: true,
      matchedCount: result.matchedCount || 0,
      modifiedCount: result.modifiedCount || 0,
      upsertedCount: result.upsertedCount || 0
    });
  } catch (error) {
    console.error('Error syncing user summary reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync user summary reports',
      error: error.message
    });
  }
};

/**
 * Send Report Message to User
 * Admin can send a report message to a specific user
 * 
 * @route POST /api/admin/reports/send
 * @access Private/Admin
 */
exports.sendReportMessage = async (req, res) => {
  try {
    const { userId, orderId, paymentId, invoiceId, title, message, status, sentBy } = req.body;
    const adminId = req.user?.id || sentBy; // Admin sending the message

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    if (!title.trim() || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title and message cannot be empty'
      });
    }

    if (!status || !['Info', 'Warning', 'Issue', 'Summary'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (Info, Warning, Issue, Summary)'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create report message
    const reportMessage = await ReportMessage.create({
      userId,
      orderId: orderId || undefined,
      paymentId: paymentId || undefined,
      invoiceId: invoiceId || undefined,
      title: title.trim(),
      message: message.trim(),
      status,
      sentBy: adminId,
      isRead: false
    });

    // Populate references
    await reportMessage.populate('userId', 'name email');
    await reportMessage.populate('sentBy', 'name email');

    console.log(`✅ Report message sent to user ${userId} by admin ${adminId}`);

    res.status(201).json({
      success: true,
      message: 'Report message sent successfully',
      reportMessage
    });
  } catch (error) {
    console.error('❌ Error sending report message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send report message',
      error: error.message
    });
  }
};

/**
 * Get All Report Messages (Admin View)
 * Admin can see all report messages sent by all admins
 * 
 * @route GET /api/admin/reports/messages
 * @access Private/Admin
 */
exports.getAllReportMessages = async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, status } = req.query;

    // Build filters
    const filters = {};
    if (userId) filters.userId = userId;
    if (status) filters.status = status;

    const skip = (page - 1) * limit;

    const messages = await ReportMessage.find(filters)
      .populate('userId', 'name email')
      .populate('sentBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMessages = await ReportMessage.countDocuments(filters);

    res.status(200).json({
      success: true,
      count: messages.length,
      totalMessages,
      totalPages: Math.ceil(totalMessages / limit),
      currentPage: parseInt(page),
      messages
    });
  } catch (error) {
    console.error('Error fetching report messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report messages',
      error: error.message
    });
  }
};
