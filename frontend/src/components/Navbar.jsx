import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import { useToast } from '../hooks/useToast';
import LightbulbIcon from './LightbulbIcon';
import './Navbar.css';

/**
 * Navigation Bar Component
 * Main navigation for customer website
 */
const Navbar = () => {
  const { isAuthenticated, user, logout } = useContext(AuthContext);
  const { cartCount } = useContext(CartContext);
  const { info } = useToast();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout(() => {
      // This callback runs after animation completes
      info('You have been logged out 👋');
      navigate('/');
    });
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* LEFT - Logo */}
        <div className="nav-left">
          <Link to="/" className="navbar-brand">
            <span className="logo-pill">
              <LightbulbIcon size={30} color="#ffffff" />
            </span>
            <span className="brand-text">Mani Electrical</span>
          </Link>
        </div>

        {/* CENTER - Menu */}
        <div className="nav-center">
          <ul className={`navbar-menu ${menuOpen ? 'open' : ''}`}>
            <li>
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/products" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Products
              </NavLink>
            </li>
            <li>
              <NavLink to="/services" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Services
              </NavLink>
            </li>
            <li>
              <NavLink to="/contact" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Contact
              </NavLink>
            </li>
          </ul>
        </div>

        {/* RIGHT - Cart + Profile + Mobile Toggle */}
        <div className="nav-right">
          <div className="cart-button-wrapper">
            <Link to="/cart" className="cart-button" aria-label="View cart">
              <span className="shimmer"></span>
              <svg className="cart-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="21" r="1" fill="currentColor" stroke="none"></circle>
                <circle cx="20" cy="21" r="1" fill="currentColor" stroke="none"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              {cartCount > 0 && (
                <span className="cart-badge" key={cartCount}>
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </div>

          <div className="auth-dropdown-wrapper">
            <button
              className={`profile-chip ${dropdownOpen ? 'active' : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title={isAuthenticated ? `Logged in as ${user?.name}` : 'Login or Sign Up'}
            >
              <span className="avatar-circle">
                {isAuthenticated && user?.name ? user.name.charAt(0).toUpperCase() : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                )}
              </span>
              <span className="profile-name">{isAuthenticated ? user?.name?.split(' ')[0] : 'Sign In'}</span>
              <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {dropdownOpen && (
              <div className="auth-dropdown-menu active">
                <div className="dropdown-header">
                  <div className="user-greeting">{isAuthenticated ? 'Logged in as' : 'Account'}</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155', marginTop: '4px' }}>
                    {isAuthenticated ? user?.name : 'Guest'}
                  </div>
                </div>
                <div className="dropdown-divider"></div>

                {isAuthenticated ? (
                  <>
                    <Link to="/orders" className="dropdown-item orders-item" onClick={() => setDropdownOpen(false)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
                      </svg>
                      <span>My Orders</span>
                    </Link>

                    <Link to="/support-messages" className="dropdown-item support-item" onClick={() => setDropdownOpen(false)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path>
                      </svg>
                      <span>Support Messages</span>
                    </Link>

                    <Link to="/profile" className="dropdown-item settings-item" onClick={() => setDropdownOpen(false)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"></path>
                      </svg>
                      <span>Settings</span>
                    </Link>

                    <div className="dropdown-divider"></div>

                    <button onClick={handleLogout} className="dropdown-item logout-item">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 3H6a2 2 0 00-2 2v14a2 2 0 002 2h4m7-4l4-4m0 0l-4-4m4 4H9"></path>
                      </svg>
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m-6-4l4 4m0 0l-4 4m4-4H3"></path>
                      </svg>
                      <span>Login</span>
                    </Link>
                    <Link to="/register" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path>
                        <circle cx="10" cy="7" r="4"></circle>
                        <path d="M17 11h6m-3-3v6"></path>
                      </svg>
                      <span>Sign Up</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            className={`menu-toggle ${menuOpen ? 'open' : ''}`}
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span className="menu-toggle-bar"></span>
            <span className="menu-toggle-bar"></span>
            <span className="menu-toggle-bar"></span>
          </button>
        </div>
      </div>

      <div
        className={`nav-overlay ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      ></div>
    </nav>
  );
};

export default Navbar;
