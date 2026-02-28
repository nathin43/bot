import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import API from '../../services/api';
import './AdminOrders.css';

/**
 * Admin Orders Page
 * Modern dashboard for managing all customer orders
 */
const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrders, setExpandedOrders] = useState({});

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data } = await API.get('/orders');
      setOrders(data.orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const { data } = await API.put(`/orders/${orderId}/status`, { orderStatus: newStatus });
      
      // Immediately update the local state with the returned order
      if (data.success && data.order) {
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order._id === orderId ? data.order : order
          )
        );
        console.log(`Order ${orderId} status updated to ${newStatus}, amount: ₹${data.order.totalAmount}`);
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      // Refresh orders to ensure we have latest data
      fetchOrders();
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      pending: 'pending',
      confirmed: 'confirmed',
      processing: 'processing',
      shipped: 'shipped',
      delivered: 'delivered',
      cancelled: 'cancelled'
    };
    return statusMap[status] || 'pending';
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const filterOrders = () => {
    let filtered = orders;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.orderStatus === statusFilter);
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const orderDate = new Date();
      
      switch(dateFilter) {
        case 'today':
          filtered = filtered.filter(order => {
            const oDate = new Date(order.createdAt);
            return oDate.toDateString() === now.toDateString();
          });
          break;
        case 'week':
          orderDate.setDate(orderDate.getDate() - 7);
          filtered = filtered.filter(order => new Date(order.createdAt) >= orderDate);
          break;
        case 'month':
          orderDate.setMonth(orderDate.getMonth() - 1);
          filtered = filtered.filter(order => new Date(order.createdAt) >= orderDate);
          break;
        default:
          break;
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.orderNumber.toLowerCase().includes(query) ||
        order.user?.name.toLowerCase().includes(query) ||
        order.user?.email.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredOrders = filterOrders();

  const totalOrders = orders.length;
  const totalSales = orders.reduce((sum, o) => sum + (o.totalAmount || o.totalPrice || 0), 0);
  // Count all active orders (not delivered or cancelled) as pending
  const pendingOrders = orders.filter(o => 
    o.orderStatus !== 'delivered' && o.orderStatus !== 'cancelled'
  ).length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="loading-spinner"></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-orders-container">
        {/* Header */}
        <div className="orders-header">
          <h1>Orders Management</h1>
          <p>Manage and track all customer orders</p>
        </div>

        {/* Summary Metrics */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon orders-icon">📦</div>
            <div className="metric-content">
              <p className="metric-label">Total Orders</p>
              <h3 className="metric-value">{totalOrders}</h3>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon sales-icon">💰</div>
            <div className="metric-content">
              <p className="metric-label">Total Sales</p>
              <h3 className="metric-value">₹{totalSales.toLocaleString()}</h3>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon pending-icon">⏳</div>
            <div className="metric-content">
              <p className="metric-label">Active Orders</p>
              <h3 className="metric-value">{pendingOrders}</h3>
            </div>
          </div>
        </div>

        {/* Sticky Filter Bar */}
        <div className="filter-bar">
          <div className="filter-search">
            <input
              type="text"
              placeholder="🔍 Search by Order ID or Customer Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-controls">
            <div className="filter-group">
              <label>Status</label>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Date Range</label>
              <select 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="orders-container">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <div key={order._id} className="order-card">
                {/* Order Header */}
                <div className="order-header-section" onClick={() => toggleOrderExpand(order._id)}>
                  <div className="order-header-left">
                    <div className="order-number">
                      <h3>Order #{order.orderNumber}</h3>
                      <span className={`status-badge status-${getStatusBadgeClass(order.orderStatus)}`}>
                        {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                      </span>
                    </div>
                    <div className="order-meta">
                      <span className="meta-item">
                        <span className="icon">📅</span>
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                      <span className="meta-item">
                        <span className="icon">👤</span>
                        {order.user?.name}
                      </span>
                      <span className="meta-item highlight">
                        ₹{(order.totalAmount || order.totalPrice || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="expand-toggle">
                    <span className={`toggle-icon ${expandedOrders[order._id] ? 'expanded' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Expandable Content */}
                {expandedOrders[order._id] && (
                  <div className="order-details">
                    {/* Customer Details */}
                    <div className="detail-section">
                      <h4 className="section-title">👤 Customer Details</h4>
                      <div className="customer-info">
                        <div className="info-row">
                          <span className="icon">📧</span>
                          <div>
                            <p className="info-label">Email</p>
                            <p className="info-value">{order.user?.email}</p>
                          </div>
                        </div>
                        <div className="info-row">
                          <span className="icon">📞</span>
                          <div>
                            <p className="info-label">Phone</p>
                            <p className="info-value">{order.user?.phone}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="detail-section">
                      <h4 className="section-title">📍 Shipping Address</h4>
                      <div className="address-info">
                        <p><strong>{order.shippingAddress.name}</strong></p>
                        <p>{order.shippingAddress.street}, {order.shippingAddress.city}</p>
                        <p>{order.shippingAddress.state} - {order.shippingAddress.zipCode}</p>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="detail-section">
                      <h4 className="section-title">📦 Order Items</h4>
                      <div className="items-list">
                        {order.items.map((item, index) => (
                          <div key={index} className="item-row">
                            <img 
                              src={item.image} 
                              alt={item.name}
                              onError={(e) => {
                                e.target.src = 'https://via.placeholder.com/50x50?text=Product';
                              }}
                              className="item-image"
                            />
                            <div className="item-info">
                              <p className="item-name">{item.name}</p>
                              <p className="item-qty">Qty: {item.quantity}</p>
                            </div>
                            <div className="item-price">
                              ₹{(item.price * item.quantity).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div className="detail-section">
                      <div className="summary-box">
                        <div className="summary-row">
                          <span>Items Total:</span>
                          <span>₹{order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()}</span>
                        </div>
                        <div className="summary-row total">
                          <span>Total Amount:</span>
                          <span>₹{order.totalAmount?.toLocaleString() || order.totalPrice?.toLocaleString() || '0'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Info */}
                    <div className="detail-section">
                      <div className="info-grid">
                        <div className="info-box">
                          <p className="info-label">Payment Method</p>
                          <p className="info-value">{order.paymentMethod}</p>
                        </div>
                        <div className="info-box">
                          <p className="info-label">Payment Status</p>
                          <span className={`status-badge payment-${order.paymentStatus}`}>
                            {order.paymentStatus?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="detail-section action-section">
                      {order.orderStatus !== 'cancelled' && order.orderStatus !== 'delivered' && (
                        <div className="status-update-control">
                          <label>Update Status</label>
                          <select
                            value={order.orderStatus}
                            onChange={(e) => handleStatusChange(order._id, e.target.value)}
                            className="status-select"
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      )}
                      <button className="btn-action">View Full Details</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-orders">
              <p>No orders found</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
