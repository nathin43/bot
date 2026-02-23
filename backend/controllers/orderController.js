const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Report = require('../models/Report');
const { upsertUserReportSummary } = require('../services/userReportSummaryService');

/**
 * Create new order
 * @route POST /api/orders
 * @access Private
 */
exports.createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, paymentDetails } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items in order'
      });
    }

    // Calculate total price (items only, no shipping or tax)
    let totalPrice = 0;
    const orderItems = [];

    for (let item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`
        });
      }

      // Check stock
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`
        });
      }

      totalPrice += product.price * item.quantity;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.image,
        quantity: item.quantity,
        price: product.price
      });

      // Update product stock
      product.stock -= item.quantity;
      await product.save();
    }

    // Create order (use new + save to trigger pre-save hook for orderNumber)
    const order = new Order({
      user: req.user.id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      paymentDetails: paymentDetails || {}, // Store payment details if provided
      totalAmount: totalPrice,
      paymentStatus: paymentMethod === 'Cash on Delivery' ? 'pending' : 'pending'
    });

    await order.save();

    // AUTO-GENERATE REPORT WHEN ORDER IS PLACED
    try {
      const user = await require('../models/User').findById(req.user.id);
      
      const reportItems = orderItems.map(item => ({
        product: item.product,
        productName: item.name,
        productPrice: item.price,
        quantity: item.quantity,
        itemTotal: item.price * item.quantity
      }));

      const reportData = {
        user: req.user.id,
        userName: user.name,
        userEmail: user.email,
        order: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        orderDate: order.createdAt,
        items: reportItems,
        totalAmount: totalPrice,
        paymentMethod: paymentMethod,
        transactionId: null,
        paymentStatus: 'pending',
        paymentDate: null,
        shippingAddress: shippingAddress,
        reportType: 'Order Report',
        reportStatus: 'Generated'
      };

      await Report.create(reportData);
    } catch (reportError) {
      // Log error but don't fail order creation
      console.error('Error creating report for order:', reportError.message);
    }

    try {
      await upsertUserReportSummary(req.user.id);
    } catch (summaryError) {
      console.error('Error syncing user report summary after order creation:', summaryError.message);
    }

    // DO NOT clear cart - cart persists for easy re-ordering
    // Cart and Order are independent collections
    // User can reference cart items or place a new order

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get user's orders
 * @route GET /api/orders/myorders
 * @access Private
 */
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'name image price'
      })
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Error in getMyOrders:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single order by ID
 * @route GET /api/orders/:id
 * @access Private
 */
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order or is admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all orders (Admin only)
 * @route GET /api/orders
 * @access Private/Admin
 */
exports.getAllOrders = async (req, res) => {
  try {
    console.log('📦 Fetching all orders for admin...');
    
    const orders = await Order.find()
      .populate('user', 'name email phone')
      .populate({
        path: 'items.product',
        select: 'name image price'
      })
      .sort('-createdAt');

    console.log(`✅ Found ${orders.length} orders`);

    // Calculate total sales using totalAmount field (totalPrice for backward compatibility)
    const totalSales = orders.reduce((sum, order) => sum + (order.totalAmount || order.totalPrice || 0), 0);

    // Always return 200 with success true, even if orders array is empty
    res.status(200).json({
      success: true,
      count: orders.length,
      totalSales,
      orders: orders || [] // Ensure orders is always an array
    });
  } catch (error) {
    console.error('❌ Error in getAllOrders:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders',
      orders: [] // Return empty array even on error
    });
  }
};

/**
 * Get order details for report message auto-fill (Admin only)
 * @route GET /api/orders/:id/report-details
 * @access Private/Admin
 */
exports.getOrderReportDetails = async (req, res) => {
  try {
    const identifier = req.params.id;
    let order;

    // Try to find by MongoDB ObjectId first
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(identifier)
        .populate('user', '_id name email')
        .select('orderNumber user paymentMethod paymentDetails paymentStatus totalAmount orderStatus');
    }
    
    // If not found or not a valid ObjectId, try finding by order number
    if (!order) {
      order = await Order.findOne({ orderNumber: identifier })
        .populate('user', '_id name email')
        .select('orderNumber user paymentMethod paymentDetails paymentStatus totalAmount orderStatus');
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const reportDetails = {
      userId: order.user._id,
      userName: order.user.name,
      userEmail: order.user.email,
      orderId: order.orderNumber,
      paymentId: order.paymentDetails?.razorpayPaymentId || 
                 order.paymentDetails?.paymentId || 
                 order.paymentDetails?.transactionId || 
                 null,
      invoiceId: `INV-${order.orderNumber}`,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      totalAmount: order.totalAmount
    };

    res.status(200).json({
      success: true,
      details: reportDetails
    });
  } catch (error) {
    console.error('Error fetching order report details:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update order status (Admin only)
 * @route PUT /api/orders/:id/status
 * @access Private/Admin
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Log the update for debugging
    console.log(`Updating order ${orderId}: status from ${order.orderStatus} to ${orderStatus}, totalAmount: ₹${order.totalAmount}`);

    order.orderStatus = orderStatus;

    if (orderStatus === 'delivered') {
      order.deliveredAt = Date.now();
      order.paymentStatus = 'paid';
    }

    await order.save();

    try {
      await upsertUserReportSummary(order.user.toString());
    } catch (summaryError) {
      console.error('Error syncing user report summary after status update:', summaryError.message);
    }

    // Log the result
    console.log(`Order ${orderId} updated successfully. New status: ${order.orderStatus}, Amount: ₹${order.totalAmount}`);

    res.status(200).json({
      success: true,
      message: 'Order status updated',
      order
    });
  } catch (error) {
    console.error(`Error updating order status:`, error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Cancel order
 * @route PUT /api/orders/:id/cancel
 * @access Private
 */
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    // Only allow cancellation for pending/confirmed orders
    if (['processing', 'shipped', 'delivered'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order at this stage'
      });
    }

    // Restore product stock
    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    order.orderStatus = 'cancelled';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get orders by user ID (Admin only)
 * @route GET /api/orders/user/:userId
 * @access Private/Admin
 */
exports.getOrdersByUserId = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.userId })
      .populate('items.product', 'name image')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
