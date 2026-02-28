import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import API from '../../services/api';
import './AdminCustomers.css';

const getInitials = (name) =>
  name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

const getAvatarGradient = (name) => {
  const g = [
    'linear-gradient(135deg,#8b5cf6,#3b82f6)',
    'linear-gradient(135deg,#1e3a8a,#2563eb)',
    'linear-gradient(135deg,#0891b2,#06b6d4)',
    'linear-gradient(135deg,#059669,#10b981)',
    'linear-gradient(135deg,#7c3aed,#8b5cf6)',
    'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  ];
  return g[name.charCodeAt(0) % g.length];
};

const getStatusColor = (status) => {
  const m = { pending:'warning', confirmed:'info', processing:'info',
    shipped:'primary', delivered:'success', cancelled:'danger' };
  return m[status] || 'primary';
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

const AdminCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    document.body.style.overflow = selectedCustomer ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedCustomer]);

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    try {
      const { data } = await API.get('/admin/customers');
      setCustomers(data.customers);
    } catch (e) {
      console.error('Error fetching customers:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerDetails = async (id) => {
    try {
      const { data } = await API.get(`/admin/customers/${id}`);
      setSelectedCustomer(data.customer);
      setCustomerOrders(data.orders);
    } catch { alert('Failed to fetch customer details'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete customer "${name}"?`)) return;
    try {
      await API.delete(`/admin/customers/${id}`);
      fetchCustomers();
      if (selectedCustomer?._id === id) { setSelectedCustomer(null); setCustomerOrders([]); }
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to delete customer');
    }
  };

  const filteredCustomers = customers
    .filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'name')   return a.name.localeCompare(b.name);
      return 0;
    });

  const totalPages        = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage, currentPage * itemsPerPage
  );

  // Stat helpers
  const now = new Date();
  const thisMonth = customers.filter(c => {
    const d = new Date(c.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const lastMonth = customers.filter(c => {
    const d = new Date(c.createdAt);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }).length;
  const growthRaw  = lastMonth > 0 ? (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1) : null;
  const growthStr  = growthRaw !== null ? `${Number(growthRaw) > 0 ? '+' : ''}${growthRaw}%` : '—';
  const growthColor = growthRaw !== null && Number(growthRaw) < 0 ? 'red' : 'green';

  if (loading) {
    return (
      <AdminLayout>
        <div className="ac-loading">
          <div className="ac-spinner" />
          <span>Loading customers…</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="ac-page">

        {/* ── Page Header ── */}
        <div className="ac-header">
          <div className="ac-header__left">
            <div className="ac-header__icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <h1 className="ac-header__title">Customers</h1>
              <p className="ac-header__sub">Manage and monitor all registered users</p>
            </div>
          </div>
          <div className="ac-header__badge">{customers.length} Total</div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="ac-stats">
          {[
            { label:'Total Customers', value: customers.length,    icon:'👥', color:'blue',
              sub:'All registered users' },
            { label:'New This Month',  value: thisMonth,           icon:'🆕', color:'purple',
              sub:'Joined in current month' },
            { label:'Last Month',      value: lastMonth,           icon:'📅', color:'teal',
              sub:'Joined previous month' },
            { label:'Monthly Growth',  value: growthStr,           icon:'📈', color: growthColor,
              sub:'vs previous month' },
          ].map((s, i) => (
            <div className={`ac-stat ac-stat--${s.color}`} key={i} style={{ animationDelay:`${i*0.07}s` }}>
              <div className="ac-stat__icon">{s.icon}</div>
              <div className="ac-stat__body">
                <div className="ac-stat__value">{s.value}</div>
                <div className="ac-stat__label">{s.label}</div>
                <div className="ac-stat__sub">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="ac-toolbar">
          <div className="ac-search">
            <svg className="ac-search__icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="ac-search__input"
              type="text"
              placeholder="Search by name or email…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
            {searchQuery && (
              <button className="ac-search__clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
          <div className="ac-toolbar__right">
            <select className="ac-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A–Z)</option>
            </select>
            <div className="ac-count">
              <span className="ac-count__num">{filteredCustomers.length}</span>
              <span className="ac-count__label">results</span>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="ac-table-wrap">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Joined</th>
                <th className="ac-th--center">Status</th>
                <th className="ac-th--center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.length > 0 ? paginatedCustomers.map((c, i) => (
                <tr key={c._id} className="ac-row" style={{ animationDelay:`${i*0.04}s` }}>
                  <td>
                    <div className="ac-customer-cell">
                      <div className="ac-avatar" style={{ background: getAvatarGradient(c.name) }}>
                        {getInitials(c.name)}
                      </div>
                      <div className="ac-customer-info">
                        <span className="ac-customer-name">{c.name}</span>
                        <span className="ac-customer-id">ID: {c._id.slice(-6).toUpperCase()}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="ac-contact-cell">
                      <span className="ac-email">{c.email}</span>
                      <span className="ac-phone">{c.phone || '—'}</span>
                    </div>
                  </td>
                  <td className="ac-location">
                    {c.address?.city && c.address?.state
                      ? `${c.address.city}, ${c.address.state}`
                      : c.address?.city || c.address?.state || '—'}
                  </td>
                  <td className="ac-date">{fmtDate(c.createdAt)}</td>
                  <td className="ac-th--center">
                    <span className="ac-badge ac-badge--active">Active</span>
                  </td>
                  <td className="ac-th--center">
                    <div className="ac-actions">
                      <button className="ac-btn ac-btn--view" onClick={() => fetchCustomerDetails(c._id)} title="View Details">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        View
                      </button>
                      <button className="ac-btn ac-btn--delete" onClick={() => handleDelete(c._id, c.name)} title="Delete">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="ac-empty">
                    <div className="ac-empty__icon">👥</div>
                    <div className="ac-empty__title">No customers found</div>
                    <div className="ac-empty__sub">{searchQuery ? 'Try a different search term' : 'No customers registered yet'}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="ac-pagination">
            <button className="ac-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>
              ← Previous
            </button>
            <div className="ac-page-pills">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`ac-page-pill${p === currentPage ? ' ac-page-pill--active' : ''}`} onClick={() => setCurrentPage(p)}>
                  {p}
                </button>
              ))}
            </div>
            <button className="ac-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>
              Next →
            </button>
          </div>
        )}

        {/* ── Customer Details Modal ── */}
        {selectedCustomer && (
          <div className="ac-overlay" onClick={() => setSelectedCustomer(null)}>
            <div className="ac-modal" onClick={e => e.stopPropagation()}>

              <div className="ac-modal__header">
                <div className="ac-modal__avatar" style={{ background: getAvatarGradient(selectedCustomer.name) }}>
                  {getInitials(selectedCustomer.name)}
                </div>
                <div className="ac-modal__meta">
                  <h2 className="ac-modal__name">{selectedCustomer.name}</h2>
                  <span className="ac-badge ac-badge--active">Active Customer</span>
                </div>
                <button className="ac-modal__close" onClick={() => setSelectedCustomer(null)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="ac-modal__body">
                <div className="ac-modal__section">
                  <h3 className="ac-modal__section-title">
                    Personal Information
                  </h3>
                  <div className="ac-modal__info-grid">
                    {[
                      { label:'Full Name',    value: selectedCustomer.name,                   icon:'👤' },
                      { label:'Email',        value: selectedCustomer.email,                  icon:'✉️' },
                      { label:'Phone',        value: selectedCustomer.phone || '—',           icon:'📱' },
                      { label:'Street',       value: selectedCustomer.address?.street || '—', icon:'📍' },
                      { label:'City',         value: selectedCustomer.address?.city   || '—', icon:'🏙️' },
                      { label:'State',        value: selectedCustomer.address?.state  || '—', icon:'🗺️' },
                      { label:'PIN',          value: selectedCustomer.address?.zipCode|| '—', icon:'📮' },
                      { label:'Member Since', value: fmtDate(selectedCustomer.createdAt),     icon:'📅' },
                    ].map((f, i) => (
                      <div className="ac-info-card" key={i}>
                        <span className="ac-info-card__icon">{f.icon}</span>
                        <div className="ac-info-card__body">
                          <span className="ac-info-card__label">{f.label}</span>
                          <span className="ac-info-card__value">{f.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ac-modal__section">
                  <h3 className="ac-modal__section-title">
                    Order History
                    <span className="ac-modal__count">{customerOrders.length}</span>
                  </h3>
                  {customerOrders.length === 0 ? (
                    <div className="ac-modal__no-orders">No orders placed yet</div>
                  ) : (
                    <div className="ac-orders-list">
                      {customerOrders.map(order => (
                        <div className="ac-order-row" key={order._id}>
                          <div className="ac-order-row__left">
                            <span className="ac-order-num">#{order.orderNumber}</span>
                            <span className="ac-order-date">{fmtDate(order.createdAt)}</span>
                          </div>
                          <div className="ac-order-row__right">
                            <span className="ac-order-amount">
                              ₹{(order.totalAmount || order.totalPrice || 0).toLocaleString()}
                            </span>
                            <span className={`ac-badge ac-badge--${getStatusColor(order.orderStatus)}`}>
                              {order.orderStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="ac-modal__footer">
                <button className="ac-btn--delete-lg" onClick={() => { handleDelete(selectedCustomer._id, selectedCustomer.name); setSelectedCustomer(null); }}>
                  Delete Customer
                </button>
                <button className="ac-btn--close-modal" onClick={() => setSelectedCustomer(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};

export default AdminCustomers;
