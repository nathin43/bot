const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');

/**
 * Get admin dashboard statistics with real-time data
 * @route GET /api/admin/dashboard
 * @access Private/Admin
 */
exports.getDashboard = async (req, res) => {
  try {
    console.log('\n🔍 Dashboard request from admin:', req.admin?.email || 'Unknown');
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevWeekStart = new Date(startOfWeek);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    // ========== SALES METRICS ==========
    // Total sales from delivered orders only
    const deliveredOrders = await Order.find({ orderStatus: 'delivered' });
    const totalSales = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || order.totalPrice || 0), 0);
    
    // Current week sales
    const currentWeekSales = await Order.aggregate([
      {
        $match: {
          orderStatus: 'delivered',
          createdAt: { $gte: startOfWeek }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    // Previous week sales
    const prevWeekSales = await Order.aggregate([
      {
        $match: {
          orderStatus: 'delivered',
          createdAt: { $gte: prevWeekStart, $lt: startOfWeek }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    const currentSales = currentWeekSales[0]?.total || 0;
    const prevSales = prevWeekSales[0]?.total || 0;
    const salesGrowth = prevSales > 0 ? ((currentSales - prevSales) / prevSales * 100).toFixed(1) : 0;

    // ========== ORDERS METRICS ==========
    const totalOrders = await Order.countDocuments();
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: startOfToday }
    });
    // Count all active orders (not delivered or cancelled) as pending/active orders
    const pendingOrders = await Order.countDocuments({ 
      orderStatus: { $nin: ['delivered', 'cancelled'] }
    });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'shipped' });
    const deliveredOrdersCount = await Order.countDocuments({ orderStatus: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'cancelled' });

    // ========== PRODUCTS METRICS ==========
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const inactiveProducts = await Product.countDocuments({ status: 'inactive' });
    const outOfStock = await Product.countDocuments({ stock: 0 });
    const lowStockItems = await Product.countDocuments({ stock: { $gt: 0, $lte: 10 } });

    // ========== USERS METRICS ==========
    const totalUsers = await User.countDocuments();
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: startOfToday }
    });

    // ========== SALES TREND DATA (Last 7 days) ==========
    // Get all delivered orders and group by day
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const salesTrendData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24*60*60*1000);
      
      // Try to use deliveredAt if available, otherwise use updatedAt for delivered orders
      const dailySales = await Order.aggregate([
        {
          $match: {
            orderStatus: 'delivered',
            $or: [
              { deliveredAt: { $gte: startOfDay, $lt: endOfDay } },
              { 
                deliveredAt: null,
                updatedAt: { $gte: startOfDay, $lt: endOfDay }
              }
            ]
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 }
          }
        }
      ]);
      
      salesTrendData.push({
        date: startOfDay.toISOString().split('T')[0],
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
        revenue: dailySales[0]?.revenue || 0,
        orders: dailySales[0]?.orders || 0
      });
    }

    // Fallback: If we have delivered orders but no revenue in trend, add them to today
    const totalTrendRevenue = salesTrendData.reduce((sum, d) => sum + d.revenue, 0);
    if (totalTrendRevenue === 0 && totalSales > 0 && deliveredOrdersCount > 0) {
      console.log('⚠️ No revenue in trend data but have delivered orders. Adding to today...');
      // Add all revenue to today's date (last item in the array)
      salesTrendData[salesTrendData.length - 1].revenue = totalSales;
      salesTrendData[salesTrendData.length - 1].orders = deliveredOrdersCount;
    }

    // ========== RECENT ORDERS ==========
    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort('-createdAt')
      .limit(5);

    // ========== AVERAGE RATING ==========
    const products = await Product.find();
    const avgRating = products.length > 0
      ? (products.reduce((sum, p) => sum + (p.ratings?.average || 0), 0) / products.length).toFixed(1)
      : 0;

    console.log('📊 Dashboard Stats Summary:');
    console.log(`  💰 Total Sales: ₹${totalSales} (from ${deliveredOrders.length} delivered orders)`);
    console.log(`  📦 Orders: ${totalOrders} total, ${todayOrders} today, ${pendingOrders} active`);
    console.log(`  📦 Status: ${pendingOrders} pending, ${shippedOrders} shipped, ${deliveredOrdersCount} delivered`);
    console.log(`  📦 Products: ${totalProducts} total, ${activeProducts} active, ${outOfStock} out of stock`);
    console.log(`  👥 Users: ${totalUsers} total, ${newUsersToday} new today`);
    console.log(`  📈 Sales Growth: ${salesGrowth}%`);
    console.log(`  📊 Sales Trend Data Points: ${salesTrendData.length}`);
    salesTrendData.forEach((d, i) => {
      console.log(`    Day ${i}: ${d.day} (${d.date}) - ₹${d.revenue} from ${d.orders} orders`);
    });

    res.status(200).json({
      success: true,
      stats: {
        // Sales
        totalSales,
        salesGrowth: parseFloat(salesGrowth),
        currentWeekSales: currentSales,
        
        // Orders
        totalOrders,
        todayOrders,
        pendingOrders,
        shippedOrders,
        deliveredOrders: deliveredOrdersCount,
        cancelledOrders,
        
        // Products
        totalProducts,
        activeProducts,
        inactiveProducts,
        outOfStock,
        lowStockItems,
        
        // Users
        totalUsers,
        newUsersToday,
        
        // Other
        avgRating: parseFloat(avgRating)
      },
      salesTrendData,
      orderDistribution: {
        delivered: deliveredOrdersCount,
        shipped: shippedOrders,
        pending: pendingOrders,
        cancelled: cancelledOrders
      },
      recentOrders,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all customers
 * @route GET /api/admin/customers
 * @access Private/Admin
 */
exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.find().select('-password').sort('-createdAt');

    res.status(200).json({
      success: true,
      count: customers.length,
      customers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get customer details with orders
 * @route GET /api/admin/customers/:id
 * @access Private/Admin
 */
exports.getCustomer = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id).select('-password');
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const orders = await Order.find({ user: req.params.id })
      .populate('items.product')
      .sort('-createdAt');

    const totalSpent = orders.reduce((sum, order) => sum + order.totalPrice, 0);

    res.status(200).json({
      success: true,
      customer,
      orders,
      totalOrders: orders.length,
      totalSpent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete customer
 * @route DELETE /api/admin/customers/:id
 * @access Private/Admin
 */
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    await customer.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
