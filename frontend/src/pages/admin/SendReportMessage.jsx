import React, { useState, useEffect } from 'react';
import useToast from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { initializeSocket } from '../../services/socket';
import './SendReportMessage.css';

/**
 * Send Report Message Component
 * Admin can send report messages to specific users
 * Supports auto-fill from user/order data
 * Uses WebSocket (Socket.IO) for real-time delivery
 */
const SendReportMessage = ({ user, order, orderId, onSuccess, onCancel }) => {
  const { success, error } = useToast();
  const { admin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  // Status mapping: Order status → Report status
  const getReportStatus = (orderStatus) => {
    const statusMap = {
      'Delivered': 'Summary',
      'Pending': 'Info',
      'Processing': 'Info',
      'Cancelled': 'Warning',
      'Failed': 'Issue',
      'Shipped': 'Info',
      'Confirmed': 'Info'
    };
    return statusMap[orderStatus] || 'Info';
  };

  // Title generation based on order status
  const generateTitle = (orderStatus) => {
    const titleMap = {
      'Delivered': 'Order Delivered Report',
      'Pending': 'Order Pending Update',
      'Processing': 'Order Processing Update',
      'Cancelled': 'Order Cancellation Report',
      'Failed': 'Order Failed Notification',
      'Shipped': 'Order Shipped Notification',
      'Confirmed': 'Order Confirmation Report'
    };
    return titleMap[orderStatus] || 'Order Status Update';
  };

  // Smart Payment ID: Show "Cash on Delivery" for COD orders
  const getPaymentIdValue = (order) => {
    if (!order) return '';
    
    // Check if it's COD or no payment ID exists
    const isCOD = order.paymentMethod === 'COD' || 
                  order.paymentMethod === 'Cash on Delivery' ||
                  order.paymentDetails?.paymentMethod === 'COD';
    const hasPaymentId = order.paymentDetails?.razorpayPaymentId || 
                        order.paymentDetails?.paymentId;
    
    if (isCOD || !hasPaymentId) {
      return 'Cash on Delivery';
    }
    
    return order.paymentDetails?.razorpayPaymentId || 
           order.paymentDetails?.paymentId || '';
  };

  const [formData, setFormData] = useState({
    userId: user?._id || order?.user?._id || '',
    orderId: order?.orderNumber || orderId || '',
    paymentId: getPaymentIdValue(order),
    invoiceId: order?.orderNumber ? `INV-${order.orderNumber}` : '',
    title: order?.status ? generateTitle(order.status) : '',
    message: '',
    status: order?.status ? getReportStatus(order.status) : 'Info'
  });
  const [autoFilled, setAutoFilled] = useState({
    orderId: !!order?.orderNumber,
    paymentId: !!order,
    invoiceId: !!order?.orderNumber,
    title: !!order?.status,
    status: !!order?.status
  });

  // Auto-fetch order details if only orderId is provided
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (orderId && !order && !user) {
        setFetchingDetails(true);
        try {
          const response = await api.get(`/orders/${orderId}/report-details`);
          if (response.data.success) {
            const details = response.data.details;
            
            // Smart auto-fill with fetched order details
            const paymentValue = details.paymentMethod === 'COD' || !details.paymentId 
              ? 'Cash on Delivery' 
              : details.paymentId;
            
            const autoTitle = details.orderStatus 
              ? generateTitle(details.orderStatus) 
              : 'Order Status Update';
            
            const autoStatus = details.orderStatus 
              ? getReportStatus(details.orderStatus) 
              : 'Info';
            
            setFormData(prev => ({
              ...prev,
              userId: details.userId,
              orderId: details.orderId || '',
              paymentId: paymentValue,
              invoiceId: details.invoiceId || '',
              title: autoTitle,
              status: autoStatus
            }));
            
            setAutoFilled({
              orderId: !!details.orderId,
              paymentId: true,
              invoiceId: !!details.invoiceId,
              title: !!details.orderStatus,
              status: !!details.orderStatus
            });
          }
        } catch (err) {
          console.error('Error fetching order details:', err);
          error('Failed to fetch order details');
        } finally {
          setFetchingDetails(false);
        }
      }
    };

    fetchOrderDetails();
  }, [orderId, order, user]);

  // Update form data when order prop changes
  useEffect(() => {
    if (order) {
      const paymentValue = getPaymentIdValue(order);
      const autoTitle = order.status ? generateTitle(order.status) : '';
      const autoStatus = order.status ? getReportStatus(order.status) : 'Info';
      
      setFormData(prev => ({
        ...prev,
        userId: order.user?._id || prev.userId,
        orderId: order.orderNumber || '',
        paymentId: paymentValue,
        invoiceId: order.orderNumber ? `INV-${order.orderNumber}` : '',
        title: autoTitle,
        status: autoStatus
      }));
      
      setAutoFilled({
        orderId: !!order.orderNumber,
        paymentId: !!order,
        invoiceId: !!order.orderNumber,
        title: !!order.status,
        status: !!order.status
      });
    }
  }, [order]);

  // Initialize Socket.IO connection
  useEffect(() => {
    initializeSocket();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      error('Please enter a report title');
      return;
    }
    if (!formData.message.trim()) {
      error('Please enter a message');
      return;
    }
    if (!formData.userId) {
      error('User ID is required');
      return;
    }
    if (!admin || !admin.id) {
      error('Admin session not found. Please login again.');
      return;
    }

    setLoading(true);
    try {
      // Send message via REST API with proper error handling
      const response = await api.post('/admin/reports/send-message', {
        userId: formData.userId,
        orderId: formData.orderId || undefined,
        paymentId: formData.paymentId || undefined,
        invoiceId: formData.invoiceId || undefined,
        title: formData.title.trim(),
        message: formData.message.trim(),
        status: formData.status,
        sentBy: admin.id
      });

      if (response.data.success) {
        success('✅ Report message sent successfully!');
        // Reset form
        setFormData({
          userId: user?._id || order?.user?._id || '',
          orderId: '',
          paymentId: '',
          invoiceId: '',
          title: '',
          message: '',
          status: 'Info'
        });
        if (onSuccess) onSuccess();
      } else {
        error(response.data.message || 'Failed to send report message');
      }
    } catch (err) {
      console.error('Error sending report message:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to send report message';
      error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="send-report-modal-overlay" onClick={onCancel}>
      <div className="send-report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📨 Send Report Message</h3>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        {user && (
          <div className="user-info-banner">
            <div className="user-avatar">{user.name?.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <p>{user.email}</p>
            </div>
          </div>
        )}

        {fetchingDetails && (
          <div className="fetching-banner">
            <div className="spinner-small"></div>
            <span>Loading order details...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="send-report-form">
          {/* Status Type */}
          <div className="form-group">
            <label>
              Report Status * {autoFilled.status && <span className="auto-label">✓ Auto-filled</span>}
            </label>
            <select 
              name="status" 
              value={formData.status} 
              onChange={handleChange}
              required
              className={`form-select ${autoFilled.status ? 'auto-filled' : ''}`}
            >
              <option value="Info">ℹ️ Info</option>
              <option value="Warning">⚠️ Warning</option>
              <option value="Issue">❌ Issue</option>
              <option value="Summary">📊 Summary</option>
            </select>
          </div>

          {/* Title */}
          <div className="form-group">
            <label>
              Report Title * {autoFilled.title && <span className="auto-label">✓ Auto-filled</span>}
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Order Status Update"
              maxLength={200}
              required
              className={`form-input ${autoFilled.title ? 'auto-filled editable' : ''}`}
            />
            <small className="char-count">{formData.title.length}/200</small>
          </div>

          {/* Message */}
          <div className="form-group">
            <label>Message *</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Enter the report message details..."
              rows={5}
              maxLength={2000}
              required
              className="form-textarea"
            />
            <small className="char-count">{formData.message.length}/2000</small>
          </div>

          {/* Auto-filled Reference IDs */}
          <div className="form-row">
            <div className="form-group">
              <label>
                Order ID {autoFilled.orderId && <span className="auto-label">✓ Auto-filled</span>}
              </label>
              <input
                type="text"
                name="orderId"
                value={formData.orderId}
                onChange={handleChange}
                placeholder="e.g., ORD12345"
                className={`form-input ${autoFilled.orderId ? 'auto-filled' : ''}`}
                readOnly={autoFilled.orderId}
              />
            </div>

            <div className="form-group">
              <label>
                Payment ID {autoFilled.paymentId && <span className="auto-label">✓ Auto-filled</span>}
              </label>
              <input
                type="text"
                name="paymentId"
                value={formData.paymentId}
                onChange={handleChange}
                placeholder="e.g., PAY12345"
                className={`form-input ${autoFilled.paymentId ? 'auto-filled' : ''}`}
                readOnly={autoFilled.paymentId}
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              Invoice ID {autoFilled.invoiceId && <span className="auto-label">✓ Auto-filled</span>}
            </label>
            <input
              type="text"
              name="invoiceId"
              value={formData.invoiceId}
              onChange={handleChange}
              placeholder="e.g., INV12345"
              className={`form-input ${autoFilled.invoiceId ? 'auto-filled' : ''}`}
              readOnly={autoFilled.invoiceId}
            />
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button 
              type="button" 
              onClick={onCancel}
              className="btn btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading || fetchingDetails}
            >
              {loading ? 'Sending...' : '📨 Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendReportMessage;
