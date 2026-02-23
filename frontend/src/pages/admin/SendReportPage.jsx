import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import useToast from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './SendReportPage.css';

/**
 * Send Report Message Page
 * Full page layout for admin to send report messages to users
 * Supports auto-fill from user/order data
 */
const SendReportPage = () => {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { admin } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

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
    userId: userId || '',
    orderId: orderId || '',
    paymentId: '',
    invoiceId: '',
    title: '',
    message: '',
    status: 'Info'
  });

  const [autoFilled, setAutoFilled] = useState({
    orderId: false,
    paymentId: false,
    invoiceId: false,
    title: false,
    status: false
  });

  // Fetch user details
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!userId) return;
      
      try {
        const response = await api.get(`/admin/customers/${userId}`);
        if (response.data.success) {
          setUserInfo(response.data.customer);
        }
      } catch (err) {
        console.error('Error fetching user details:', err);
        error('Failed to fetch user details');
      }
    };

    fetchUserDetails();
  }, [userId]);

  // Auto-fetch order details if orderId is provided
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) return;

      setFetchingDetails(true);
      try {
        const response = await api.get(`/orders/${orderId}/report-details`);
        if (response.data.success) {
          const details = response.data.details;
          
          // Smart payment ID handling
          const paymentValue = details.paymentMethod === 'COD' || !details.paymentId 
            ? 'Cash on Delivery' 
            : details.paymentId;
          
          const autoTitle = details.orderStatus ? generateTitle(details.orderStatus) : 'Order Status Update';
          const autoStatus = details.orderStatus ? getReportStatus(details.orderStatus) : 'Info';
          
          setFormData(prev => ({
            ...prev,
            orderId: details.orderId || orderId,
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
    };

    fetchOrderDetails();
  }, [orderId]);

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
        // Redirect back to user report page
        setTimeout(() => {
          navigate(`/admin/reports/user/${userId}`);
        }, 1000);
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

  const handleBack = () => {
    navigate(`/admin/reports/user/${userId}`);
  };

  return (
    <AdminLayout>
      <div className="send-report-page">
        <div className="page-header">
          <button className="back-btn" onClick={handleBack}>
            ← Back to User Report
          </button>
          <h1>📨 Send Report Message</h1>
        </div>

        <div className="page-container">
          {/* User Info Card */}
          {userInfo && (
            <div className="user-info-card">
              <div className="user-avatar-large">
                {userInfo.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <h3>{userInfo.name || 'Unknown User'}</h3>
                <p className="user-email">{userInfo.email}</p>
                {userInfo.phone && <p className="user-phone">📱 {userInfo.phone}</p>}
              </div>
            </div>
          )}

          {fetchingDetails && (
            <div className="fetching-banner">
              <div className="spinner-small"></div>
              <span>Loading order details...</span>
            </div>
          )}

          {/* Report Form Card */}
          <div className="form-card">
            <form onSubmit={handleSubmit}>
              {/* Status Type */}
              <div className="form-group">
                <label>
                  Report Status * 
                  {autoFilled.status && <span className="auto-badge">✓ Auto-filled</span>}
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
                  Report Title * 
                  {autoFilled.title && <span className="auto-badge">✓ Auto-filled</span>}
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
                  rows={6}
                  maxLength={2000}
                  required
                  className="form-textarea"
                />
                <small className="char-count">{formData.message.length}/2000</small>
              </div>

              {/* Auto-filled Reference IDs */}
              <div className="ids-section">
                <h3>Reference Information</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Order ID 
                      {autoFilled.orderId && <span className="auto-badge">✓ Auto-filled</span>}
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
                      Payment ID 
                      {autoFilled.paymentId && <span className="auto-badge">✓ Auto-filled</span>}
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
                    Invoice ID 
                    {autoFilled.invoiceId && <span className="auto-badge">✓ Auto-filled</span>}
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
              </div>

              {/* Sticky Action Buttons */}
              <div className="form-actions-sticky">
                <button 
                  type="button" 
                  onClick={handleBack}
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
                  {loading ? (
                    <>
                      <span className="spinner-inline"></span>
                      Sending...
                    </>
                  ) : (
                    '📨 Send Message'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SendReportPage;
