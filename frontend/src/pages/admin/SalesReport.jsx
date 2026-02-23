import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import useToast from '../../hooks/useToast';
import api from '../../services/api';
import './ReportStyles.css';

const SalesReport = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    status: ''
  });
  const [analytics, setAnalytics] = useState({
    totalSales: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    completedOrders: 0
  });

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async (isRetry = false) => {
    if (loading && !isRetry) return;
    
    setLoading(true);
    try {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        navigate('/admin/login');
        return;
      }

      const params = new URLSearchParams();
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.minAmount) params.append('minAmount', filters.minAmount);
      if (filters.maxAmount) params.append('maxAmount', filters.maxAmount);
      if (filters.status) params.append('status', filters.status);

      const queryString = params.toString();
      const endpoint = queryString ? `/orders?${queryString}` : '/orders';
      
      const response = await api.get(endpoint);
      
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format from server');
      }

      if (response.data.success) {
        const orders = response.data.orders || [];
        setSalesData(orders);
        
        // Calculate analytics
        const completed = orders.filter(o => o.status === 'Delivered' || o.orderStatus === 'delivered');
        const totalRevenue = completed.reduce((sum, o) => sum + (o.totalAmount || o.totalPrice || 0), 0);
        const avgOrderValue = completed.length > 0 ? totalRevenue / completed.length : 0;
        
        setAnalytics({
          totalSales: orders.length,
          totalRevenue: totalRevenue,
          averageOrderValue: avgOrderValue,
          completedOrders: completed.length
        });
        
        console.log(`✅ Successfully fetched ${orders.length} sales records`);
        setFetchAttempts(0);
      }
    } catch (err) {
      console.error('Error fetching sales:', err);
      
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin');
        navigate('/admin/login');
        return;
      }
      
      if (!isRetry && fetchAttempts < 1) {
        setFetchAttempts(prev => prev + 1);
        setTimeout(() => fetchSalesData(true), 1000);
        return;
      }
      
      if (err.response?.status >= 500 || !err.response) {
        error('Failed to fetch sales data. Please try again.');
      } else if (err.response?.status === 404) {
        setSalesData([]);
        setAnalytics({
          totalSales: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          completedOrders: 0
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
    fetchSalesData();
  };

  const handleClearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      status: ''
    });
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;
      
      // Title
      doc.setFontSize(20);
      doc.setTextColor(59, 130, 246);
      doc.text('💰 Sales Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;
      
      // Date and Filters
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const dateStr = `Generated: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      doc.text(dateStr, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      if (filters.dateFrom || filters.dateTo || filters.status) {
        doc.text('Filters Applied:', 14, yPos);
        yPos += 5;
        if (filters.dateFrom) doc.text(`  • From: ${filters.dateFrom}`, 14, yPos), yPos += 5;
        if (filters.dateTo) doc.text(`  • To: ${filters.dateTo}`, 14, yPos), yPos += 5;
        if (filters.status) doc.text(`  • Status: ${filters.status}`, 14, yPos), yPos += 5;
        yPos += 5;
      }
      
      // Analytics Summary
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Summary Analytics', 14, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      const summaryData = [
        ['Total Sales', analytics.totalSales.toString()],
        ['Total Revenue', formatCurrency(analytics.totalRevenue)],
        ['Average Order Value', formatCurrency(analytics.averageOrderValue)],
        ['Completed Orders', analytics.completedOrders.toString()]
      ];
      
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        margin: { left: 14, right: 14 }
      });
      
      yPos = doc.lastAutoTable.finalY + 10;
      
      // Detailed Data Table
      doc.setFontSize(12);
      doc.text('Detailed Sales Data', 14, yPos);
      yPos += 8;
      
      const tableData = salesData.map(order => [
        order.orderId || order._id?.slice(-8).toUpperCase(),
        order.user?.name || 'N/A',
        formatDate(order.createdAt),
        formatCurrency(order.totalAmount),
        order.paymentMethod || 'N/A',
        order.status || 'Pending'
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Order ID', 'Customer', 'Date', 'Amount', 'Payment', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
      });
      
      // Save PDF
      const fileName = `sales-report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      success('Sales report exported as PDF successfully');
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
              <div className="header-icon">💰</div>
              <div>
                <h1>Sales Report</h1>
                <p className="subtitle">Track revenue, sales trends, and performance metrics</p>
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
              <p className="analytics-label">Total Sales</p>
              <h3 className="analytics-value">{analytics.totalSales}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              💰
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Total Revenue</p>
              <h3 className="analytics-value">{formatCurrency(analytics.totalRevenue)}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
              📈
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Avg Order Value</p>
              <h3 className="analytics-value">{formatCurrency(analytics.averageOrderValue)}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
              ✅
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Completed Orders</p>
              <h3 className="analytics-value">{analytics.completedOrders}</h3>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filters-grid">
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
                <label>Min Amount</label>
                <input 
                  type="number"
                  name="minAmount"
                  value={filters.minAmount}
                  onChange={handleFilterChange}
                  placeholder="₹0"
                  min="0"
                />
              </div>
              <div className="filter-item">
                <label>Max Amount</label>
                <input 
                  type="number"
                  name="maxAmount"
                  value={filters.maxAmount}
                  onChange={handleFilterChange}
                  placeholder="₹100000"
                  min="0"
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
            </div>
            <div className="filter-actions">
              <button className="btn-apply" onClick={handleApplyFilters}>Apply Filters</button>
              <button className="btn-clear" onClick={handleClearFilters}>Clear All</button>
            </div>
          </div>
        )}

        {/* Sales Data Table */}
        <div className="report-table-container">
          <div className="table-info">
            <p>Showing {salesData.length} sales records</p>
          </div>

          {loading ? (
            <div className="table-loading">
              <div className="spinner"></div>
              <p>Loading sales data...</p>
            </div>
          ) : salesData.length > 0 ? (
            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Payment Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.map((order) => (
                    <tr key={order._id}>
                      <td className="order-id">{order.orderId || order._id?.slice(-8).toUpperCase()}</td>
                      <td>{order.user?.name || 'N/A'}</td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td className="amount">{formatCurrency(order.totalAmount)}</td>
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
              <h3>No sales data found</h3>
              <p>Try adjusting your filters or date range</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default SalesReport;
