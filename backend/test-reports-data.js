const mongoose = require('mongoose');
const User = require('./models/User');
const Order = require('./models/Order');
require('dotenv').config();

const testReportsData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get a sample user
    const sampleUser = await User.findOne({});
    if (!sampleUser) {
      console.log('No users found in database');
      await mongoose.disconnect();
      return;
      
    }

    console.log('\n=== Sample User ===');
    console.log('ID:', sampleUser._id);
    console.log('Name:', sampleUser.name);
    console.log('Email:', sampleUser.email);

    // Check orders for this user
    const orders = await Order.find({ user: sampleUser._id });
    console.log('\n=== Orders for this user ===');
    console.log('Total Orders:', orders.length);

    if (orders.length > 0) {
      console.log('\nOrder Details:');
      orders.forEach((order, index) => {
        console.log(`\nOrder ${index + 1}:`);
        console.log('  Order ID:', order._id);
        console.log('  Order Number:', order.orderNumber);
        console.log('  Status:', order.orderStatus);
        console.log('  Total Amount:', order.totalAmount);
        console.log('  Created:', order.createdAt);
      });

      // Calculate totals
      const deliveredOrders = orders.filter(o => o.orderStatus === 'delivered');
      const totalSpent = deliveredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const lastOrderDate = orders.reduce((latest, o) => {
        return !latest || o.createdAt > latest ? o.createdAt : latest;
      }, null);

      console.log('\n=== Calculated Summary ===');
      console.log('Delivered Orders:', deliveredOrders.length);
      console.log('Total Amount Spent:', totalSpent);
      console.log('Last Order Date:', lastOrderDate);
    }

    // Test aggregation pipeline
    console.log('\n=== Testing Aggregation Pipeline ===');
    const result = await User.aggregate([
      { $match: { _id: sampleUser._id } },
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
                    cond: { $eq: ['$$order.orderStatus', 'delivered'] }
                  }
                },
                as: 'order',
                in: { $ifNull: ['$$order.totalAmount', 0] }
              }
            }
          },
          lastOrder: { $max: '$orders.createdAt' }
        }
      }
    ]);

    console.log('Aggregation Result:', JSON.stringify(result[0], null, 2));

    await mongoose.disconnect();
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
};

testReportsData();
