import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import useToast from '../../hooks/useToast';
import api from '../../services/api';
import './ReportStyles.css';

const CustomerReport = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [customerData, setCustomerData] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    accountStatus: '',
    dateFrom: '',
    dateTo: '',
    minOrders: '',
    maxOrders: '',
    minAmount: '',
    maxAmount: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalUsers: 0
  });
  const [analytics, setAnalytics] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    newCustomersThisMonth: 0,
    averageOrders: 0
  });

  useEffect(() => {
    fetchCustomerData();
  }, [pagination.currentPage, filters]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.currentPage);
      params.append('limit', 15);
      
      if (filters.search) params.append('search', filters.search);
      if (filters.accountStatus) params.append('accountStatus', filters.accountStatus);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.minOrders) params.append('minOrders', filters.minOrders);
      if (filters.maxOrders) params.append('maxOrders', filters.maxOrders);
      if (filters.minAmount) params.append('minAmount', filters.minAmount);
      if (filters.maxAmount) params.append('maxAmount', filters.maxAmount);

      const response = await api.get(`/admin/reports/users?${params.toString()}`);
      if (response.data.success) {
        const customers = response.data.users || [];
        setCustomerData(customers);
        setPagination({
          currentPage: response.data.currentPage,
          totalPages: response.data.totalPages,
          totalUsers: response.data.totalUsers
        });
        
        // Calculate analytics
        const active = customers.filter(c => c.actualStatus === 'ACTIVE' || c.status === 'active').length;
        const avgOrders = customers.length > 0 
          ? customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0) / customers.length 
          : 0;
        
        setAnalytics({
          totalCustomers: response.data.totalUsers,
          activeCustomers: active,
          newCustomersThisMonth: 0,
          averageOrders: Math.round(avgOrders * 10) / 10
        });
      }
    } catch (err) {
      error('Failed to fetch customer data');
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    fetchCustomerData();
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      accountStatus: '',
      dateFrom: '',
      dateTo: '',
      minOrders: '',
      maxOrders: '',
      minAmount: '',
      maxAmount: ''
    });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleViewReport = (userId) => {
    navigate(`/admin/reports/user/${userId}`);
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
      doc.setTextColor(139, 92, 246);
      doc.text('👥 Customer Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;
      
      // Date and Filters
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const dateStr = `Generated: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      doc.text(dateStr, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      if (filters.search || filters.status || filters.dateFrom || filters.dateTo) {
        doc.text('Filters Applied:', 14, yPos);
        yPos += 5;
        if (filters.search) doc.text(`  • Search: ${filters.search}`, 14, yPos), yPos += 5;
        if (filters.status) doc.text(`  • Status: ${filters.status}`, 14, yPos), yPos += 5;
        if (filters.dateFrom) doc.text(`  • From: ${filters.dateFrom}`, 14, yPos), yPos += 5;
        if (filters.dateTo) doc.text(`  • To: ${filters.dateTo}`, 14, yPos), yPos += 5;
        yPos += 5;
      }
      
      // Analytics Summary
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Customer Analytics', 14, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      const summaryData = [
        ['Total Customers', analytics.totalCustomers.toString()],
        ['Active Customers', analytics.activeCustomers.toString()],
        ['Total Orders', analytics.totalOrders.toString()],
        ['Total Revenue', formatCurrency(analytics.totalRevenue)]
      ];
      
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], textColor: 255 },
        margin: { left: 14, right: 14 }
      });
      
      yPos = doc.lastAutoTable.finalY + 10;
      
      // Detailed Customer Data
      doc.setFontSize(12);
      doc.text('Customer Details', 14, yPos);
      yPos += 8;
      
      const tableData = customerData.map(customer => [
        customer.name || 'Unknown',
        customer.email || 'N/A',
        customer.actualStatus || customer.status || 'ACTIVE',
        (customer.totalOrders || 0).toString(),
        formatCurrency(customer.totalAmountSpent || 0),
        formatDate(customer.lastOrder)
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Name', 'Email', 'Status', 'Orders', 'Total Spent', 'Last Order']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246], textColor: 255 },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 40 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { cellWidth: 30 },
          5: { cellWidth: 30 }
        },
        margin: { left: 14, right: 14 }
      });
      
      // Save PDF
      const fileName = `customer-report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      success('Customer report exported as PDF successfully');
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
              <div className="header-icon" style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
                👥
              </div>
              <div>
                <h1>Customer Report</h1>
                <p className="subtitle">Analyze customer behavior and demographics</p>
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
              👥
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Total Customers</p>
              <h3 className="analytics-value">{analytics.totalCustomers}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              ✅
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Active Customers</p>
              <h3 className="analytics-value">{analytics.activeCustomers}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
              📈
            </div>
            <div className="analytics-content">
              <p className="analytics-label">New This Month</p>
              <h3 className="analytics-value">{analytics.newCustomersThisMonth}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
              🛒
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Avg Orders</p>
              <h3 className="analytics-value">{analytics.averageOrders}</h3>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filters-grid">
              <div className="filter-item">
                <label>Search User</label>
                <input 
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Name or email..."
                />
              </div>

              <div className="filter-item">
                <label>Account Status</label>
                <select name="accountStatus" value={filters.accountStatus} onChange={handleFilterChange}>
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
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
                <label>Min Orders</label>
                <input 
                  type="number"
                  name="minOrders"
                  value={filters.minOrders}
                  onChange={handleFilterChange}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div className="filter-item">
                <label>Max Orders</label>
                <input 
                  type="number"
                  name="maxOrders"
                  value={filters.maxOrders}
                  onChange={handleFilterChange}
                  placeholder="100"
                  min="0"
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
            </div>

            <div className="filter-actions">
              <button className="btn-apply" onClick={handleApplyFilters}>Apply Filters</button>
              <button className="btn-clear" onClick={handleClearFilters}>Clear All</button>
            </div>
          </div>
        )}

        {/* Customer Data Table */}
        <div className="report-table-container">
          <div className="table-info">
            <p>Showing {customerData.length} of {pagination.totalUsers} customers</p>
          </div>

          {loading ? (
            <div className="table-loading">
              <div className="spinner"></div>
              <p>Loading customer data...</p>
            </div>
          ) : customerData.length > 0 ? (
            <>
              <div className="table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Email</th>
                      <th>Account Status</th>
                      <th>Total Orders</th>
                      <th>Total Amount Spent</th>
                      <th>Last Order Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerData.map((customer) => (
                      <tr key={customer._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ 
                              width: '36px', 
                              height: '36px', 
                              borderRadius: '50%',
                              background: '#8B5CF6',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: '14px',
                              flexShrink: 0
                            }}>
                              {customer.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <span>{customer.name || 'Unknown User'}</span>
                          </div>
                        </td>
                        <td>{customer.email}</td>
                        <td>
                          <span className={`status-badge ${(customer.actualStatus || customer.status || 'ACTIVE').toLowerCase()}`}>
                            {customer.actualStatus || customer.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="text-center">{customer.totalOrders || 0}</td>
                        <td className="amount">{formatCurrency(customer.totalAmountSpent || 0)}</td>
                        <td>{formatDate(customer.lastOrder)}</td>
                        <td>
                          <button 
                            onClick={() => handleViewReport(customer._id)}
                            style={{
                              padding: '7px 14px',
                              background: '#8B5CF6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = '#7C3AED';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = '#8B5CF6';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            📊 View Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                    disabled={pagination.currentPage === 1}
                    style={{
                      padding: '8px 16px',
                      background: 'white',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '6px',
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(pagination.totalPages, prev.currentPage + 1) }))}
                    disabled={pagination.currentPage === pagination.totalPages}
                    style={{
                      padding: '8px 16px',
                      background: 'white',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '6px',
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" fill="#f3f4f6"/>
                <path d="M32 20v16M32 44h.01" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              <h3>No customer data found</h3>
              <p>Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default CustomerReport;
