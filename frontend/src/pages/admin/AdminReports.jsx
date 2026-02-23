import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import './AdminReportsNewStyle.css';

const AdminReports = () => {
  const navigate = useNavigate();

  // Report categories data
  const reportCategories = [
    {
      id: 'sales',
      title: 'Sales Report',
      description: 'Track revenue, sales trends, and performance metrics',
      icon: '💰',
      color: '#3B82F6',
      path: '/admin/reports/sales'
    },
    {
      id: 'stock',
      title: 'Stock Report',
      description: 'Monitor inventory levels and stock movements',
      icon: '📦',
      color: '#10B981',
      path: '/admin/reports/stock'
    },
    {
      id: 'customers',
      title: 'Customer Report',
      description: 'Analyze customer behavior and demographics',
      icon: '👥',
      color: '#8B5CF6',
      path: '/admin/reports/customers'
    },
    {
      id: 'payments',
      title: 'Payment Report',
      description: 'Review payment transactions and methods',
      icon: '💳',
      color: '#F59E0B',
      path: '/admin/reports/payments'
    },
    {
      id: 'orders',
      title: 'Order Report',
      description: 'View order history, status, and fulfillment',
      icon: '📋',
      color: '#EC4899',
      path: '/admin/reports/orders'
    }
  ];

  const handleNavigateToReport = (path) => {
    navigate(path);
  };

  return (
    <AdminLayout>
      <div className="admin-reports">
        {/* Main Header */}
        <div className="reports-main-header">
          <div className="header-left">
            <h1>📊 Reports Dashboard</h1>
            <p className="subtitle">Access comprehensive business analytics and reports</p>
          </div>
        </div>

        {/* Report Categories Section */}
        <div className="report-categories-section">
          <h2 className="section-title">Report Categories</h2>
          <div className="report-categories-grid">
            {reportCategories.map((category) => (
              <div
                key={category.id}
                className="report-category-card"
                onClick={() => handleNavigateToReport(category.path)}
                style={{ '--category-color': category.color }}
              >
                <div className="category-icon-wrapper">
                  <span className="category-icon">{category.icon}</span>
                </div>
                <div className="category-content">
                  <h3 className="category-title">{category.title}</h3>
                  <p className="category-description">{category.description}</p>
                </div>
                <div className="category-arrow">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
