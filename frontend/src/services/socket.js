import { io } from 'socket.io-client';

// Socket.IO client instance
let socket = null;

// Get backend URL - use localhost:50004 directly (not proxied like REST API)
// Socket.IO needs direct connection, cannot go through Vite proxy
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:50004';

/**
 * Initialize Socket.IO connection
 * @returns {Socket} Socket.IO client instance
 */
export const initializeSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error.message);
    });
  }

  return socket;
};

/**
 * Get the current socket instance
 * @returns {Socket|null} Socket instance or null if not initialized
 */
export const getSocket = () => {
  return socket;
};

/**
 * Join user's personal room to receive messages
 * @param {string} userId - User ID to join room for
 */
export const joinUserRoom = (userId) => {
  if (!socket) {
    initializeSocket();
  }
  
  if (userId && socket) {
    socket.emit('joinUserRoom', userId);
    console.log('👤 Joined user room:', userId);
  }
};

/**
 * Send report message via WebSocket (Admin only)
 * @param {Object} data - Message data
 * @param {string} data.userId - Target user ID
 * @param {string} data.orderId - Order ID (optional)
 * @param {string} data.paymentId - Payment ID (optional)
 * @param {string} data.invoiceId - Invoice ID (optional)
 * @param {string} data.title - Message title
 * @param {string} data.message - Message content
 * @param {string} data.status - Message status (Info, Warning, Issue, Summary)
 * @param {string} data.sentBy - Admin ID who is sending
 * @returns {Promise} Promise that resolves when message is sent
 */
export const sendReportMessage = (data) => {
  return new Promise((resolve, reject) => {
    if (!socket) {
      initializeSocket();
    }

    if (!socket) {
      reject(new Error('Socket not initialized'));
      return;
    }

    // Set up one-time listeners for response
    socket.once('reportMessageSent', (response) => {
      resolve(response);
    });

    socket.once('reportMessageError', (error) => {
      reject(new Error(error.message || 'Failed to send message'));
    });

    // Emit the message
    socket.emit('sendReportMessage', data);

    // Timeout after 10 seconds
    setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 10000);
  });
};

/**
 * Listen for incoming report messages (User side)
 * @param {Function} callback - Callback function to handle received message
 * @returns {Function} Cleanup function to remove listener
 */
export const onReceiveReportMessage = (callback) => {
  if (!socket) {
    initializeSocket();
  }

  if (socket) {
    socket.on('receiveReportMessage', callback);
    
    // Return cleanup function
    return () => {
      socket.off('receiveReportMessage', callback);
    };
  }

  return () => {};
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔌 Socket disconnected manually');
  }
};

export default {
  initializeSocket,
  getSocket,
  joinUserRoom,
  sendReportMessage,
  onReceiveReportMessage,
  disconnectSocket
};
