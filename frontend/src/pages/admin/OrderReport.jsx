import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import useToast from '../../hooks/useToast';
import api from '../../services/api';
import './ReportStyles.css';

const OrderReport = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [orderData, setOrderData] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    paymentMethod: ''
  });
  const [analytics, setAnalytics] = useState({
    totalOrders: 0,
    pending: 0,
    processing: 0,
    delivered: 0
  });

  useEffect(() => {
    fetchOrderData();
  }, []);

  const fetchOrderData = async (isRetry = false) => {
    // Prevent duplicate calls if already loading
    if (loading && !isRetry) return;
    
    setLoading(true);
    try {
      // Check for admin token
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        console.warn('No admin token found, redirecting to login');
        navigate('/admin/login');
        return;
      }

      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);

      const queryString = params.toString();
      const endpoint = queryString ? `/orders?${queryString}` : '/orders';
      
      console.log('Fetching order data from:', endpoint);
      const response = await api.get(endpoint);
      
      // Validate response structure
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format from server');
      }

      const orders = response.data.orders || [];
      setOrderData(orders);
      
      // Calculate analytics
      const pending = orders.filter(o => o.status === 'Pending' || o.orderStatus === 'pending').length;
      const processing = orders.filter(o => 
        o.status === 'Processing' || o.status === 'Shipped' || 
        o.orderStatus === 'processing' || o.orderStatus === 'shipped'
      ).length;
      const delivered = orders.filter(o => o.status === 'Delivered' || o.orderStatus === 'delivered').length;
      
      setAnalytics({
        totalOrders: orders.length,
        pending,
        processing,
        delivered
      });
      
      console.log(`✅ Successfully fetched ${orders.length} orders`);
      setFetchAttempts(0); // Reset attempts on success
      
    } catch (err) {
      console.error('Error fetching orders:', err);
      
      // Handle specific error cases
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.warn('Authentication failed, redirecting to admin login');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin');
        navigate('/admin/login');
        return;
      }
      
      // Retry once if first attempt fails
      if (!isRetry && fetchAttempts < 1) {
        console.log('Retrying order data fetch...');
        setFetchAttempts(prev => prev + 1);
        setTimeout(() => fetchOrderData(true), 1000);
        return;
      }
      
      // Only show error toast for real network/server errors, not for empty data
      if (err.response?.status >= 500 || !err.response) {
        error('Failed to fetch order data. Please try again.');
      } else if (err.response?.status === 404) {
        // 404 means no orders found, which is not an error
        setOrderData([]);
        setAnalytics({
          totalOrders: 0,
          pending: 0,
          processing: 0,
          delivered: 0
        });
      }
      
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    fetchOrderData();
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      paymentMethod: ''
    });
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;
      
      // Title
      doc.setFontSize(20);
      doc.setTextColor(236, 72, 153);
      doc.text('📋 Order Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;
      
      // Date and Filters
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const dateStr = `Generated: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      doc.text(dateStr, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      if (filters.search || filters.status || filters.dateFrom || filters.dateTo || filters.paymentMethod) {
        doc.text('Filters Applied:', 14, yPos);
        yPos += 5;
        if (filters.search) doc.text(`  • Search: ${filters.search}`, 14, yPos), yPos += 5;
        if (filters.status) doc.text(`  • Status: ${filters.status}`, 14, yPos), yPos += 5;
        if (filters.dateFrom) doc.text(`  • From: ${filters.dateFrom}`, 14, yPos), yPos += 5;
        if (filters.dateTo) doc.text(`  • To: ${filters.dateTo}`, 14, yPos), yPos += 5;
        if (filters.paymentMethod) doc.text(`  • Payment: ${filters.paymentMethod}`, 14, yPos), yPos += 5;
        yPos += 5;
      }
      
      // Analytics Summary
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Order Summary', 14, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      const summaryData = [
        ['Total Orders', analytics.totalOrders.toString()],
        ['Pending Orders', analytics.pendingOrders.toString()],
        ['Processing Orders', analytics.processingOrders.toString()],
        ['Delivered Orders', analytics.deliveredOrders.toString()]
      ];
      
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [236, 72, 153], textColor: 255 },
        margin: { left: 14, right: 14 }
      });
      
      yPos = doc.lastAutoTable.finalY + 10;
      
      // Detailed Order Data
      doc.setFontSize(12);
      doc.text('Order Details', 14, yPos);
      yPos += 8;
      
      const tableData = orderData.map(order => [
        order.orderId || order._id?.slice(-8).toUpperCase() || 'N/A',
        order.user?.name || 'N/A',
        formatDate(order.createdAt),
        formatCurrency(order.totalAmount),
        order.paymentMethod || 'N/A',
        order.status || 'Pending',
        (order.items?.length || 0).toString()
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Order ID', 'Customer', 'Date', 'Amount', 'Payment', 'Status', 'Items']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [236, 72, 153], textColor: 255 },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });
      
      // Save PDF
      const fileName = `order-report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      success('Order report exported as PDF successfully');
    } catch (err) {
      error('Failed to export PDF');
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    });
  };

  return (
    <AdminLayout>
      <div className="admin-report-page">
        {/* Header */}
        <div className="report-page-header">
          <button className="btn-back" onClick={() => navigate('/admin/reports')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Reports
          </button>
          <div className="header-content">
            <div className="header-left">
              <div className="header-icon" style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}>
                📋
              </div>
              <div>
                <h1>Order Report</h1>
                <p className="subtitle">View order history, status, and fulfillment</p>
              </div>
            </div>
            <div className="header-actions">
              <button className="btn-toggle-filters" onClick={() => setShowFilters(!showFilters)}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M2 4h14M5 9h8M7 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <button className="btn-export" onClick={handleExportPDF} disabled={exporting}>
                {exporting ? 'Generating PDF...' : 'Export PDF'}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 9v2a2 2 0 01-2 2H3a2 2 0 01-2-2V9M7 10V2M4 5l3-3 3 3"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Analytics Summary */}
        <div className="analytics-summary">
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
              📊
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Total Orders</p>
              <h3 className="analytics-value">{analytics.totalOrders}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
              ⏳
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Pending Orders</p>
              <h3 className="analytics-value">{analytics.pending}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
              🔄
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Processing</p>
              <h3 className="analytics-value">{analytics.processing}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              ✅
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Delivered</p>
              <h3 className="analytics-value">{analytics.delivered}</h3>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filters-grid">
              <div className="filter-item">
                <label>Search Order</label>
                <input 
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Order ID or customer..."
                />
              </div>
              <div className="filter-item">
                <label>Order Status</label>
                <select name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="">All</option>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="filter-item">
                <label>Date From</label>
                <input 
                  type="date"
                  name="dateFrom"
                  value={filters.dateFrom}
                  onChange={handleFilterChange}
                />
              </div>
              <div className="filter-item">
                <label>Date To</label>
                <input 
                  type="date"
                  name="dateTo"
                  value={filters.dateTo}
                  onChange={handleFilterChange}
                />
              </div>
              <div className="filter-item">
                <label>Payment Method</label>
                <select name="paymentMethod" value={filters.paymentMethod} onChange={handleFilterChange}>
                  <option value="">All</option>
                  <option value="COD">Cash on Delivery</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Net Banking">Net Banking</option>
                </select>
              </div>
            </div>
            <div className="filter-actions">
              <button className="btn-apply" onClick={handleApplyFilters}>Apply Filters</button>
              <button className="btn-clear" onClick={handleClearFilters}>Clear All</button>
            </div>
          </div>
        )}

        {/* Order Data Table */}
        <div className="report-table-container">
          <div className="table-info">
            <p>Showing {orderData.length} orders</p>
          </div>

          {loading ? (
            <div className="table-loading">
              <div className="spinner"></div>
              <p>Loading order data...</p>
            </div>
          ) : orderData.length > 0 ? (
            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Items</th>
                    <th>Payment</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orderData.map((order) => (
                    <tr key={order._id}>
                      <td className="order-id">{order.orderId || order._id.slice(-8).toUpperCase()}</td>
                      <td>{order.user?.name || 'N/A'}</td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td className="amount">{formatCurrency(order.totalAmount)}</td>
                      <td className="text-center">{order.items?.length || 0}</td>
                      <td>{order.paymentMethod || 'N/A'}</td>
                      <td>
                        <span className={`status-badge ${order.status?.toLowerCase() || 'pending'}`}>
                          {order.status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" fill="#f3f4f6"/>
                <path d="M32 20v16M32 44h.01" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              <h3>No order data found</h3>
              <p>Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default OrderReport;
