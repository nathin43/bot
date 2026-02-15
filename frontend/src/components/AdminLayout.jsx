import { useContext, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import LightbulbIcon from './LightbulbIcon';
import './AdminLayout.css';

/**
 * Admin Layout Component
 * Provides navigation sidebar for admin pages
 */
const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, adminLogout } = useContext(AuthContext);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Debug: Log admin data
  console.log('AdminLayout - Admin Data:', admin);

  // Fetch unread messages count
  useEffect(() => {
    fetchUnreadCount();
    // Refresh every 2 minutes
    const interval = setInterval(fetchUnreadCount, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const { data } = await API.get('/contact/unread-count');
      if (data.success) {
        setUnreadMessages(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread messages count:', error);
    }
  };

  const handleLogout = () => {
    adminLogout(() => {
      // This callback runs after animation completes
      navigate('/admin/login');
    });
  };

  const menuItems = [
    { path: '/admin/dashboard', icon: '📊', label: 'Dashboard', tooltip: 'Dashboard' },
    { path: '/admin/products', icon: '📦', label: 'Products', tooltip: 'Products' },
    { path: '/admin/orders', icon: '🛒', label: 'Orders', tooltip: 'Orders' },
    { path: '/admin/customers', icon: '👥', label: 'Customers', tooltip: 'Customers' },
    { path: '/admin/reports', icon: '📄', label: 'Reports', tooltip: 'Reports' },
    { path: '/admin/contact-messages', icon: '✉️', label: 'Contact Messages', tooltip: 'Contact Messages' }
  ];

  // Only add Admin Management menu for MAIN_ADMIN (role-based check)
  const adminMenuItems = admin?.role === 'MAIN_ADMIN'
    ? [{ path: '/admin/admin-management', icon: '🔐', label: 'Admin Management', tooltip: 'Admin Management' }]
    : [];

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Branding Section */}
        <div className="sidebar-branding">
          <Link to="/admin/dashboard" className="brand-logo-container">
            <LightbulbIcon size={32} color="#ffffff" />
          </Link>
          {!sidebarCollapsed && (
            <div className="brand-text">
              <h2 className="brand-name">Mani Electrical</h2>
              <p className="brand-label">Admin</p>
            </div>
          )}
        </div>
        <div className="sidebar-divider"></div>

        {/* Navigation Menu */}
        <nav className="sidebar-menu">
          <div className="menu-section">
            {!sidebarCollapsed && <span className="menu-section-label">Management</span>}
            <div className="menu-items">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
                  title={sidebarCollapsed ? item.tooltip : item.label}
                >
                  <span className="menu-icon">{item.icon}</span>
                  {!sidebarCollapsed && <span className="menu-label">{item.label}</span>}
                  {item.path === '/admin/contact-messages' && unreadMessages > 0 && (
                    <span className="menu-badge">{unreadMessages}</span>
                  )}
                  {location.pathname === item.path && <span className="active-indicator"></span>}
                </Link>
              ))}
            </div>
          </div>

          {/* Admin Management Section - MAIN_ADMIN Only */}
          {adminMenuItems.length > 0 && (
            <div className="menu-section">
              {!sidebarCollapsed && <span className="menu-section-label">Administration</span>}
              <div className="menu-items">
                {adminMenuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
                    title={sidebarCollapsed ? item.tooltip : item.label}
                  >
                    <span className="menu-icon">{item.icon}</span>
                    {!sidebarCollapsed && <span className="menu-label">{item.label}</span>}
                    {location.pathname === item.path && <span className="active-indicator"></span>}
                  </Link>
                ))}
              </div>
            </div>
          )}
          
          {/* DEBUG: Show email for testing */}
          {!sidebarCollapsed && (
            <div style={{ padding: '10px', fontSize: '10px', color: '#999', borderTop: '1px solid #ddd', marginTop: 'auto' }}>
              <p>Email: {admin?.email || 'Not logged in'}</p>
              <p>Role: {admin?.role || 'N/A'}</p>
            </div>
          )}
        </nav>

        {/* Collapse Toggle */}
        <div className="sidebar-footer">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            <span className="toggle-icon">{sidebarCollapsed ? '»' : '«'}</span>
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <div className="admin-header">
          <h1>
            {menuItems.find(item => item.path === location.pathname)?.label ||
             adminMenuItems.find(item => item.path === location.pathname)?.label ||
             'Admin Panel'}
          </h1>
          
          <div className="header-actions">
            <a href="/" target="_blank" rel="noopener noreferrer" className="view-site-link">
              🌐 View Site
            </a>
            
            <div className="profile-dropdown-wrapper">
              <button 
                className="profile-btn"
                onClick={() => setProfileOpen(!profileOpen)}
                title={admin?.name}
              >
                <span className="profile-avatar">{admin?.name?.charAt(0)?.toUpperCase() || 'A'}</span>
              </button>
              
              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-header">
                    <p className="profile-name">{admin?.name}</p>
                    <p className="profile-role">{admin?.role}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="profile-logout"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="admin-main">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
