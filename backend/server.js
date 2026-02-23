const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const net = require('net');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:5000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

/**
 * Check if a port is available
 */
const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
};

/**
 * Find an available port starting from the default port
 */
const findAvailablePort = async (startPort, maxAttempts = 20) => {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`No available ports found between ${startPort} and ${startPort + maxAttempts - 1}`);
};

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:5000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger for debugging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const hasAuth = req.headers.authorization ? '🔐' : '🔓';
  console.log(`[${timestamp}] ${hasAuth} ${req.method} ${req.path}`);
  next();
});

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// Socket.IO Event Handlers
// ============================================
const ReportMessage = require('./models/ReportMessage');

io.on('connection', (socket) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] 🔌 Socket connected: ${socket.id}`);

  // User joins their personal room to receive messages
  socket.on('joinUserRoom', (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`[${timestamp}] 👤 User ${userId} joined their room`);
    }
  });

  // Admin sends a report message to a specific user
  socket.on('sendReportMessage', async (data) => {
    try {
      const { userId, orderId, paymentId, invoiceId, title, message, status, sentBy } = data;

      // Validate required fields
      if (!userId || !title || !message || !sentBy) {
        socket.emit('reportMessageError', { 
          success: false, 
          message: 'Missing required fields: userId, title, message, or sentBy' 
        });
        return;
      }

      // Create the report message in database
      const reportMessage = await ReportMessage.create({
        userId,
        orderId: orderId || undefined,
        paymentId: paymentId || undefined,
        invoiceId: invoiceId || undefined,
        title,
        message,
        status: status || 'Info',
        sentBy,
        isRead: false
      });

      // Populate user and admin references
      await reportMessage.populate('userId', 'name email');
      await reportMessage.populate('sentBy', 'name email');

      console.log(`[${timestamp}] 📨 Report message sent to user ${userId}`);

      // Send to the specific user's room (real-time delivery)
      io.to(userId).emit('receiveReportMessage', {
        success: true,
        message: reportMessage
      });

      // Confirm to sender (admin)
      socket.emit('reportMessageSent', {
        success: true,
        message: 'Report message sent successfully',
        data: reportMessage
      });

    } catch (error) {
      console.error(`[${timestamp}] ❌ Error sending report message:`, error.message);
      socket.emit('reportMessageError', {
        success: false,
        message: error.message || 'Failed to send report message'
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`[${timestamp}] 🔌 Socket disconnected: ${socket.id}`);
  });
});

// ============================================
// REST API Routes
// ============================================
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/admin-management', require('./routes/adminManagementRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/returns', require('./routes/returnRoutes'));
app.use('/api/reports', require('./routes/reportRoutes')); // Legacy reports (backward compatibility)
app.use('/api/admin/reports', require('./routes/adminReportRoutes')); // Admin reports (new)
app.use('/api/user/reports', require('./routes/userReportRoutes')); // User reports (new)
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🔌 Electric Shop API',
    version: '1.0.0',
    status: 'Running'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
const DEFAULT_PORT = 5000;
let PORT = process.env.PORT || DEFAULT_PORT;
let dbConnected = false;
let server = null;

/**
 * Attempt to connect to database with automatic retry logic
 */
const connectToDatabase = async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3000; // 3 seconds

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n📡 Attempting database connection (${attempt}/${MAX_RETRIES})...`);
      await connectDB();
      console.log('✅ Database connected successfully');
      dbConnected = true;
      return true;
    } catch (error) {
      console.warn(`❌ Database connection attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Retrying in ${RETRY_DELAY / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      } else {
        console.warn('⚠️  Max retry attempts reached. Running with mock data fallback.');
        return false;
      }
    }
  }
};

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Initialize database connection and start server
const startServer = async () => {
  try {
    // Validate required environment variables
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not set in .env file');
    }

    // Auto-connect to MongoDB with retry logic
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    } else {
      console.warn('⚠️  MONGODB_URI not configured. Running with mock data only.');
      dbConnected = false;
    }
    
    // Find an available port before attempting to listen
    const DEFAULT_PORT = 5000;
    let desiredPort = parseInt(process.env.PORT, 10) || DEFAULT_PORT;
    
    try {
      PORT = await findAvailablePort(desiredPort);
      if (PORT !== desiredPort) {
        console.log(`⚠️  Port ${desiredPort} was in use. Using port ${PORT} instead.`);
      }
    } catch (err) {
      console.error(`❌ ${err.message}`);
      console.error('Please close other applications using these ports.');
      process.exit(1);
    }
    
    server = httpServer.listen(PORT, '127.0.0.1', () => {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 API URL: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket URL: ws://localhost:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Database: ${dbConnected ? '✅ Connected' : '⚠️  Disconnected (mock mode)'}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
      console.log(`${'='.repeat(50)}\n`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} error: ${err.message}`);
        console.error('Please try running again or use a different port.');
        process.exit(1);
      } else {
        throw err;
      }
    });

    // Periodically attempt to reconnect if database is down
    if (process.env.MONGODB_URI && !dbConnected) {
      const reconnectInterval = setInterval(async () => {
        console.log('\n🔄 Attempting to reconnect to database...');
        const connected = await connectToDatabase();
        if (connected) {
          console.log('🎉 Database reconnected successfully!');
          clearInterval(reconnectInterval);
        }
      }, 30000); // Try every 30 seconds
    }

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error(`\n❌ Unhandled Rejection: ${err.message}`);
      console.error('Stack:', err.stack);
      if (server) {
        server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error(`\n❌ Uncaught Exception: ${err.message}`);
      console.error('Stack:', err.stack);
      if (server) {
        server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => {
      console.log('\n⏹️  SIGTERM signal received: closing HTTP server');
      if (server) {
        server.close(() => {
          console.log('✅ HTTP server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });

    process.on('SIGINT', () => {
      console.log('\n⏹️  SIGINT signal received: closing HTTP server');
      if (server) {
        server.close(() => {
          console.log('✅ HTTP server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });

    return server;
  } catch (error) {
    console.error(`\n${'='.repeat(50)}`);
    console.error(`❌ Failed to start server: ${error.message}`);
    console.error(`${'='.repeat(50)}`);
    console.error('\n📋 Troubleshooting Steps:');
    console.error('1. Run "npm run validate" to check environment');
    console.error('2. Verify .env file has JWT_SECRET');
    console.error('3. Run "npm run test-db" to test database connection');
    console.error('4. Check that MongoDB Atlas is accessible');
    console.error('5. Verify your IP is whitelisted in MongoDB Atlas\n');
    process.exit(1);
  }
};

startServer();
