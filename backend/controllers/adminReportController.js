const ExcelJS = require('exceljs');
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const ReportMessage = require('../models/ReportMessage');
const GeneratedReport = require('../models/GeneratedReport');
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
 * Get Sales Report - Real-time data from database
 * @route GET /api/admin/reports/sales
 * @access Private/Admin
 */
exports.getSalesReport = async (req, res) => {
  try {
    console.log('📊 [SALES REPORT] Starting...');
    const { dateFrom, dateTo, status, minAmount, maxAmount } = req.query;

    // Build filters
    const filters = {};
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filters.createdAt.$lte = endDate;
      }
    }
    if (status) filters.orderStatus = new RegExp(status, 'i');
    if (minAmount || maxAmount) {
      filters.totalAmount = {};
      if (minAmount) filters.totalAmount.$gte = parseFloat(minAmount);
      if (maxAmount) filters.totalAmount.$lte = parseFloat(maxAmount);
    }

    console.log('📊 [SALES REPORT] Fetching orders with filters:', filters);
    
    // Fetch orders with populated data
    const orders = await Order.find(filters)
      .populate('user', 'name email phone')
      .populate('items.product', 'name image price')
      .sort('-createdAt')
      .lean();
    
    console.log(`📊 [SALES REPORT] Found ${orders.length} orders`);

    // Calculate summary analytics
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => (o.orderStatus || '').toLowerCase() === 'delivered');
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const averageOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;

    // Monthly sales breakdown
    const monthlySales = {};
    orders.forEach(order => {
      const month = new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!monthlySales[month]) {
        monthlySales[month] = { revenue: 0, orders: 0 };
      }
      if ((order.orderStatus || '').toLowerCase() === 'delivered') {
        monthlySales[month].revenue += order.totalAmount || 0;
      }
      monthlySales[month].orders += 1;
    });

    // Top products by revenue
    const productRevenue = {};
    deliveredOrders.forEach(order => {
      (order.items || []).forEach(item => {
        const productId = item.product?._id?.toString() || 'unknown';
        const productName = item.product?.name || item.name || 'Unknown Product';
        if (!productRevenue[productId]) {
          productRevenue[productId] = {
            name: productName,
            revenue: 0,
            quantity: 0
          };
        }
        productRevenue[productId].revenue += (item.price || 0) * (item.quantity || 0);
        productRevenue[productId].quantity += item.quantity || 0;
      });
    });

    const topProducts = Object.values(productRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const summary = {
      totalSales: totalOrders,
      totalRevenue,
      averageOrderValue,
      completedOrders: deliveredOrders.length,
      pendingOrders: orders.filter(o => (o.orderStatus || '').toLowerCase() === 'pending').length,
      cancelledOrders: orders.filter(o => (o.orderStatus || '').toLowerCase() === 'cancelled').length
    };

    const reportData = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderId: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
      user: order.user,
      totalAmount: order.totalAmount,
      status: order.orderStatus,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      items: order.items
    }));

    // Auto-save report to database
    try {
      await GeneratedReport.saveReport(
        'sales',
        summary,
        reportData,
        { dateFrom, dateTo, status, minAmount, maxAmount },
        req.admin?._id
      );
    } catch (saveError) {
      console.error('⚠️  Failed to save report to database:', saveError.message);
      // Continue anyway - don't fail the request if save fails
    }

    console.log(`📊 [SALES REPORT] Completed successfully - ${totalOrders} orders, ₹${totalRevenue.toFixed(2)} revenue`);

    res.status(200).json({
      success: true,
      summary,
      monthlySales,
      topProducts,
      data: reportData
    });
  } catch (error) {
    console.error('Error fetching sales report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales report',
      error: error.message
    });
  }
};

/**
 * Get Order Report - Real-time data from database
 * @route GET /api/admin/reports/orders
 * @access Private/Admin
 */
exports.getOrderReport = async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo, paymentMethod } = req.query;

    // Build filters
    const filters = {};
    if (search) {
      filters.$or = [
        { orderNumber: new RegExp(search, 'i') },
        { 'user.name': new RegExp(search, 'i') },
        { 'user.email': new RegExp(search, 'i') }
      ];
    }
    if (status) filters.orderStatus = new RegExp(status, 'i');
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filters.createdAt.$lte = endDate;
      }
    }
    if (paymentMethod) filters.paymentMethod = new RegExp(paymentMethod, 'i');

    // Fetch orders
    const orders = await Order.find(filters)
      .populate('user', 'name email phone')
      .populate('items.product', 'name image price')
      .sort('-createdAt')
      .lean();

    // Calculate summary
    const statusCounts = {
      pending: 0,
      processing: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };

    orders.forEach(order => {
      const status = (order.orderStatus || 'pending').toLowerCase();
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      } else if (['processing', 'shipped', 'confirmed'].includes(status)) {
        statusCounts.processing++;
      }
    });

    const summary = {
      totalOrders: orders.length,
      ...statusCounts
    };

    const reportData = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderId: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
      user: order.user,
      totalAmount: order.totalAmount,
      status: order.orderStatus,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      items: order.items,
      shippingAddress: order.shippingAddress
    }));

    // Auto-save report to database
    try {
      await GeneratedReport.saveReport(
        'orders',
        summary,
        reportData,
        { search, status, dateFrom, dateTo, paymentMethod },
        req.admin?._id
      );
    } catch (saveError) {
      console.error('⚠️  Failed to save order report:', saveError.message);
    }

    res.status(200).json({
      success: true,
      summary,
      data: reportData
    });
  } catch (error) {
    console.error('Error fetching order report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order report',
      error: error.message
    });
  }
};

/**
 * Get Payment Report - Real-time data from database
 * @route GET /api/admin/reports/payments
 * @access Private/Admin
 */
exports.getPaymentReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, paymentMethod, minAmount, maxAmount } = req.query;

    // Build filters
    const filters = {};
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filters.createdAt.$lte = endDate;
      }
    }
    if (paymentMethod) filters.paymentMethod = new RegExp(paymentMethod, 'i');
    if (minAmount || maxAmount) {
      filters.totalAmount = {};
      if (minAmount) filters.totalAmount.$gte = parseFloat(minAmount);
      if (maxAmount) filters.totalAmount.$lte = parseFloat(maxAmount);
    }

    // Fetch orders (payments are tracked through orders)
    const orders = await Order.find(filters)
      .populate('user', 'name email phone')
      .sort('-createdAt')
      .lean();

    // Calculate payment analytics
    const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const codPayments = orders.filter(o => {
      const method = (o.paymentMethod || '').toLowerCase();
      return method === 'cod' || method === 'cash on delivery';
    });
    const onlinePayments = orders.filter(o => {
      const method = (o.paymentMethod || '').toLowerCase();
      return method && method !== 'cod' && method !== 'cash on delivery';
    });

    const paymentStatusCounts = {
      pending: orders.filter(o => (o.paymentStatus || '').toLowerCase() === 'pending').length,
      completed: orders.filter(o => (o.paymentStatus || '').toLowerCase() === 'completed').length,
      failed: orders.filter(o => (o.paymentStatus || '').toLowerCase() === 'failed').length
    };

    const summary = {
      totalTransactions: orders.length,
      totalAmount,
      codPayments: codPayments.length,
      codAmount: codPayments.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      onlinePayments: onlinePayments.length,
      onlineAmount: onlinePayments.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      ...paymentStatusCounts
    };

    const reportData = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderId: order.orderNumber || order._id.toString().slice(-8).toUpperCase(),
      user: order.user,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentDetails: order.paymentDetails,
      createdAt: order.createdAt
    }));

    // Auto-save report to database
    try {
      await GeneratedReport.saveReport(
        'payments',
        summary,
        reportData,
        { dateFrom, dateTo, paymentMethod, minAmount, maxAmount },
        req.admin?._id
      );
    } catch (saveError) {
      console.error('⚠️  Failed to save payment report:', saveError.message);
    }

    res.status(200).json({
      success: true,
      summary,
      data: reportData
    });
  } catch (error) {
    console.error('Error fetching payment report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment report',
      error: error.message
    });
  }
};

/**
 * Get Stock Report - Real-time data from database
 * @route GET /api/admin/reports/stock
 * @access Private/Admin
 */
exports.getStockReport = async (req, res) => {
  try {
    const Product = require('../models/Product');

    const { category, minStock, maxStock, stockStatus } = req.query;

    // Build filters
    const filters = {};
    if (category) filters.category = new RegExp(category, 'i');
    if (minStock !== undefined || maxStock !== undefined) {
      filters.stock = {};
      if (minStock !== undefined) filters.stock.$gte = parseInt(minStock);
      if (maxStock !== undefined) filters.stock.$lte = parseInt(maxStock);
    }

    // Apply stock status filter
    if (stockStatus === 'out') {
      filters.stock = 0;
    } else if (stockStatus === 'low') {
      filters.stock = { $gt: 0, $lte: 10 };
    } else if (stockStatus === 'in') {
      filters.stock = { $gt: 10 };
    }

    // Fetch products
    const products = await Product.find(filters).sort('name').lean();

    // Calculate stock analytics
    const totalProducts = products.length;
    const inStock = products.filter(p => p.stock > 10).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;
    const outOfStock = products.filter(p => p.stock === 0).length;
    const totalStockValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const totalQuantity = products.reduce((sum, p) => sum + (p.stock || 0), 0);

    // Category breakdown
    const categoryBreakdown = {};
    products.forEach(product => {
      const cat = product.category || 'Uncategorized';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = {
          count: 0,
          totalStock: 0,
          totalValue: 0
        };
      }
      categoryBreakdown[cat].count++;
      categoryBreakdown[cat].totalStock += product.stock || 0;
      categoryBreakdown[cat].totalValue += (product.price || 0) * (product.stock || 0);
    });

    const summary = {
      totalProducts,
      inStock,
      lowStock,
      outOfStock,
      totalQuantity,
      totalStockValue
    };

    const reportData = products.map(product => ({
      _id: product._id,
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      stockValue: (product.price || 0) * (product.stock || 0),
      stockStatus: product.stock === 0 ? 'Out of Stock' : product.stock <= 10 ? 'Low Stock' : 'In Stock',
      image: product.image,
      description: product.description,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    }));

    // Auto-save report to database
    try {
      await GeneratedReport.saveReport(
        'stock',
        summary,
        reportData,
        { category, minStock, maxStock, stockStatus },
        req.admin?._id
      );
    } catch (saveError) {
      console.error('⚠️  Failed to save stock report:', saveError.message);
    }

    res.status(200).json({
      success: true,
      summary,
      categoryBreakdown,
      data: reportData
    });
  } catch (error) {
    console.error('Error fetching stock report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock report',
      error: error.message
    });
  }
};

/**
 * Get Customer Report - Real-time data from database
 * @route GET /api/admin/reports/customers
 * @access Private/Admin
 */
exports.getCustomerReport = async (req, res) => {
  try {
    const { accountStatus, minOrders, maxOrders, dateFrom, dateTo, search } = req.query;

    // Build filters for users
    const userFilters = { role: { $in: ['customer', 'CUSTOMER', 'user'] } };

    if (search) {
      userFilters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (dateFrom || dateTo) {
      userFilters.createdAt = {};
      if (dateFrom) userFilters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        userFilters.createdAt.$lte = endDate;
      }
    }

    // Aggregate users with order counts
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const pipeline = [
      { $match: userFilters },
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
          totalSpent: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$orders',
                    as: 'order',
                    cond: {
                      $not: {
                        $in: [
                          { $toLower: { $ifNull: ['$$order.orderStatus', ''] } },
                          ['cancelled']
                        ]
                      }
                    }
                  }
                },
                as: 'order',
                in: { $ifNull: ['$$order.totalAmount', 0] }
              }
            }
          },
          lastOrderDate: { $max: '$orders.createdAt' },
          actualStatus: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'BLOCKED'] }, then: 'BLOCKED' },
                { case: { $eq: ['$status', 'SUSPENDED'] }, then: 'SUSPENDED' },
                { case: { $lt: ['$lastLoginAt', sixtyDaysAgo] }, then: 'INACTIVE' }
              ],
              default: 'ACTIVE'
            }
          }
        }
      }
    ];

    // Apply order count filters
    if (minOrders || maxOrders) {
      const orderMatch = {};
      if (minOrders) orderMatch.$gte = parseInt(minOrders);
      if (maxOrders) orderMatch.$lte = parseInt(maxOrders);
      pipeline.push({ $match: { totalOrders: orderMatch } });
    }

    // Apply amount filters
    const { minAmount, maxAmount } = req.query;
    if (minAmount || maxAmount) {
      const amountMatch = {};
      if (minAmount) amountMatch.$gte = parseFloat(minAmount);
      if (maxAmount) amountMatch.$lte = parseFloat(maxAmount);
      pipeline.push({ $match: { totalSpent: amountMatch } });
    }

    // Apply account status filter
    if (accountStatus) {
      pipeline.push({ $match: { actualStatus: accountStatus.toUpperCase() } });
    }

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $project: { password: 0, orders: 0 } });

    const users = await User.aggregate(pipeline);

    // Calculate analytics
    const totalCustomers = users.length;
    const activeCustomers = users.filter(u => u.actualStatus === 'ACTIVE').length;
    const newCustomers = users.filter(u => new Date(u.createdAt) >= thirtyDaysAgo).length;
    const totalRevenue = users.reduce((sum, u) => sum + (u.totalSpent || 0), 0);
    const averageOrdersPerCustomer = totalCustomers > 0 ? users.reduce((sum, u) => sum + (u.totalOrders || 0), 0) / totalCustomers : 0;

    // Top customers by spending
    const topCustomers = users
      .filter(u => u.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    const summary = {
      totalCustomers,
      activeCustomers,
      inactiveCustomers: users.filter(u => u.actualStatus === 'INACTIVE').length,
      blockedCustomers: users.filter(u => u.actualStatus === 'BLOCKED').length,
      newCustomers,
      totalRevenue,
      averageOrdersPerCustomer: parseFloat(averageOrdersPerCustomer.toFixed(2))
    };

    const reportData = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      status: user.actualStatus,
      totalOrders: user.totalOrders,
      totalSpent: user.totalSpent,
      lastOrderDate: user.lastOrderDate,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    }));

    // Auto-save report to database
    try {
      await GeneratedReport.saveReport(
        'customers',
        summary,
        reportData,
        { accountStatus, minOrders, maxOrders, dateFrom, dateTo },
        req.admin?._id
      );
    } catch (saveError) {
      console.error('⚠️  Failed to save customer report:', saveError.message);
    }

    res.status(200).json({
      success: true,
      summary,
      topCustomers,
      data: reportData
    });
  } catch (error) {
    console.error('Error fetching customer report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer report',
      error: error.message
    });
  }
};

/**
 * Generate and Save Report - Manually trigger report generation
 * @route POST /api/admin/reports/generate
 * @access Private/Admin
 */
exports.generateReport = async (req, res) => {
  try {
    const { type, filters = {} } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Report type is required'
      });
    }

    const validTypes = ['sales', 'orders', 'payments', 'stock', 'customers'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Call the appropriate report function based on type
    let reportResult;
    const mockReq = { query: filters, admin: req.admin };
    const mockRes = {
      status: (code) => ({
        json: (data) => { reportResult = { statusCode: code, ...data }; }
      })
    };

    switch (type) {
      case 'sales':
        await exports.getSalesReport(mockReq, mockRes);
        break;
      case 'orders':
        await exports.getOrderReport(mockReq, mockRes);
        break;
      case 'payments':
        await exports.getPaymentReport(mockReq, mockRes);
        break;
      case 'stock':
        await exports.getStockReport(mockReq, mockRes);
        break;
      case 'customers':
        await exports.getCustomerReport(mockReq, mockRes);
        break;
    }

    if (reportResult && reportResult.success) {
      res.status(201).json({
        success: true,
        message: `${type} report generated and saved successfully`,
        reportId: reportResult._id,
        summary: reportResult.summary,
        recordCount: reportResult.data?.length || 0
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to generate ${type} report`,
        error: reportResult?.message
      });
    }
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
 * Get Report History - Fetch previously generated reports
 * @route GET /api/admin/reports/history/:type
 * @access Private/Admin
 */
exports.getReportHistory = async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 10 } = req.query;

    const validTypes = ['sales', 'orders', 'payments', 'stock', 'customers'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const history = await GeneratedReport.getHistory(type, parseInt(limit));

    res.status(200).json({
      success: true,
      type,
      historyCount: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching report history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report history',
      error: error.message
    });
  }
};

/**
 * Get Specific Generated Report by ID
 * @route GET /api/admin/reports/generated/:id
 * @access Private/Admin
 */
exports.getGeneratedReportById = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await GeneratedReport.findById(id).lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching generated report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report',
      error: error.message
    });
  }
};
