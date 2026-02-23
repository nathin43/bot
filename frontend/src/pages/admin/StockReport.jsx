import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import useToast from '../../hooks/useToast';
import api from '../../services/api';
import './ReportStyles.css';

const StockReport = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stockData, setStockData] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    brand: '',
    stockStatus: ''
  });
  const [analytics, setAnalytics] = useState({
    totalProducts: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0
  });

  useEffect(() => {
    fetchStockData();
  }, []);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '1000'); // Fetch all products for stock report
      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);
      if (filters.brand) params.append('brand', filters.brand);

      const response = await api.get(`/products?${params.toString()}`);
      const products = response.data.products || response.data || [];
      setStockData(products);
      
      // Calculate analytics
      const inStock = products.filter(p => p.stock > 10).length;
      const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;
      const outOfStock = products.filter(p => p.stock === 0).length;
      
      setAnalytics({
        totalProducts: products.length,
        inStock,
        lowStock,
        outOfStock
      });
    } catch (err) {
      error('Failed to fetch stock data');
      console.error('Error fetching stock:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    fetchStockData();
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      category: '',
      brand: '',
      stockStatus: ''
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
      doc.setTextColor(16, 185, 129);
      doc.text('📦 Stock Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;
      
      // Date and Filters
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const dateStr = `Generated: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      doc.text(dateStr, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      if (filters.search || filters.category || filters.brand || filters.stockStatus) {
        doc.text('Filters Applied:', 14, yPos);
        yPos += 5;
        if (filters.search) doc.text(`  • Search: ${filters.search}`, 14, yPos), yPos += 5;
        if (filters.category) doc.text(`  • Category: ${filters.category}`, 14, yPos), yPos += 5;
        if (filters.brand) doc.text(`  • Brand: ${filters.brand}`, 14, yPos), yPos += 5;
        if (filters.stockStatus) doc.text(`  • Status: ${filters.stockStatus}`, 14, yPos), yPos += 5;
        yPos += 5;
      }
      
      // Analytics Summary
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Inventory Summary', 14, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      const summaryData = [
        ['Total Products', analytics.totalProducts.toString()],
        ['In Stock', analytics.inStock.toString()],
        ['Low Stock', analytics.lowStock.toString()],
        ['Out of Stock', analytics.outOfStock.toString()]
      ];
      
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: 255 },
        margin: { left: 14, right: 14 }
      });
      
      yPos = doc.lastAutoTable.finalY + 10;
      
      // Detailed Stock Data
      doc.setFontSize(12);
      doc.text('Detailed Stock Data', 14, yPos);
      yPos += 8;
      
      const tableData = stockData.map(product => [
        product.name,
        product.category || 'N/A',
        product.brand || 'N/A',
        formatCurrency(product.price),
        product.stock.toString(),
        product.stock > 10 ? 'In Stock' : product.stock > 0 ? 'Low Stock' : 'Out of Stock'
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Product Name', 'Category', 'Brand', 'Price', 'Stock', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: 255 },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
      });
      
      // Save PDF
      const fileName = `stock-report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      success('Stock report exported as PDF successfully');
    } catch (err) {
      error('Failed to export PDF');
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

  const getStockStatus = (stock) => {
    if (stock > 10) return { status: 'In Stock', class: 'in-stock' };
    if (stock > 0) return { status: 'Low Stock', class: 'low-stock' };
    return { status: 'Out of Stock', class: 'out-of-stock' };
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
              <div className="header-icon" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                📦
              </div>
              <div>
                <h1>Stock Report</h1>
                <p className="subtitle">Monitor inventory levels and stock movements</p>
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
              <p className="analytics-label">Total Products</p>
              <h3 className="analytics-value">{analytics.totalProducts}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              ✅
            </div>
            <div className="analytics-content">
              <p className="analytics-label">In Stock</p>
              <h3 className="analytics-value">{analytics.inStock}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
              ⚠️
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Low Stock</p>
              <h3 className="analytics-value">{analytics.lowStock}</h3>
            </div>
          </div>
          <div className="analytics-card">
            <div className="analytics-icon" style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
              ❌
            </div>
            <div className="analytics-content">
              <p className="analytics-label">Out of Stock</p>
              <h3 className="analytics-value">{analytics.outOfStock}</h3>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filters-grid">
              <div className="filter-item">
                <label>Search Product</label>
                <input 
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Product name..."
                />
              </div>
              <div className="filter-item">
                <label>Category</label>
                <input 
                  type="text"
                  name="category"
                  value={filters.category}
                  onChange={handleFilterChange}
                  placeholder="Category..."
                />
              </div>
              <div className="filter-item">
                <label>Brand</label>
                <input 
                  type="text"
                  name="brand"
                  value={filters.brand}
                  onChange={handleFilterChange}
                  placeholder="Brand..."
                />
              </div>
            </div>
            <div className="filter-actions">
              <button className="btn-apply" onClick={handleApplyFilters}>Apply Filters</button>
              <button className="btn-clear" onClick={handleClearFilters}>Clear All</button>
            </div>
          </div>
        )}

        {/* Stock Data Table */}
        <div className="report-table-container">
          <div className="table-info">
            <p>Showing {stockData.length} products</p>
          </div>

          {loading ? (
            <div className="table-loading">
              <div className="spinner"></div>
              <p>Loading stock data...</p>
            </div>
          ) : stockData.length > 0 ? (
            <div className="table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Price</th>
                    <th>Stock Quantity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.map((product) => {
                    const stockStatus = getStockStatus(product.stock);
                    return (
                      <tr key={product._id}>
                        <td>{product.name}</td>
                        <td>{product.category}</td>
                        <td>{product.brand}</td>
                        <td className="amount">{formatCurrency(product.price)}</td>
                        <td className="text-center" style={{ fontWeight: 600 }}>{product.stock}</td>
                        <td>
                          <span className={`status-badge ${stockStatus.class}`}>
                            {stockStatus.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" fill="#f3f4f6"/>
                <path d="M32 20v16M32 44h.01" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              <h3>No stock data found</h3>
              <p>Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default StockReport;
