import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import API from "../../services/api";
import "./AdminDashboard.css";

// Animated counter hook - defined outside component
const useAnimatedCounter = (end, duration = 1000) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);

  useEffect(() => {
    if (end === null || end === undefined) return;
    
    const endValue = typeof end === 'string' ? parseFloat(end.replace(/[^0-9.-]/g, '')) : end;
    if (isNaN(endValue)) {
      setCount(0);
      return;
    }

    let startTime;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOutCubic * endValue));

      if (progress < 1) {
        countRef.current = requestAnimationFrame(step);
      }
    };

    countRef.current = requestAnimationFrame(step);
    
    return () => {
      if (countRef.current) {
        cancelAnimationFrame(countRef.current);
      }
    };
  }, [end, duration]);

  return count;
};

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [salesTrend, setSalesTrend] = useState([]);
  const [orderDist, setOrderDist] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    fetchDashboard();
    // Auto-refresh every 5 minutes
    refreshIntervalRef.current = setInterval(fetchDashboard, 300000);
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  const fetchDashboard = async () => {
    try {
      setError(null);
      const { data } = await API.get("/admin/dashboard");
      console.log("📊 Dashboard data received:", data);
      if (data.success) {
        setStats(data.stats);
        console.log("📈 Sales Trend Data:", data.salesTrendData);
        setSalesTrend(data.salesTrendData || []);
        
        // Convert orderDistribution object to array format for donut chart
        if (data.orderDistribution) {
          const distArray = [
            { _id: 'Delivered', count: data.orderDistribution.delivered || 0 },
            { _id: 'Shipped', count: data.orderDistribution.shipped || 0 },
            { _id: 'Pending', count: data.orderDistribution.pending || 0 },
            { _id: 'Cancelled', count: data.orderDistribution.cancelled || 0 }
          ].filter(item => item.count > 0); // Only include statuses with orders
          setOrderDist(distArray);
        } else {
          setOrderDist([]);
        }
        
        setRecentOrders(data.recentOrders || []);
      }
    } catch (err) {
      console.error("Dashboard error:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboard();
  };

  const fmt = (n) => {
    if (n === null || n === undefined) return '₹0';
    return `₹${(n || 0).toLocaleString("en-IN")}`;
  };

  const formatNumber = (n) => {
    if (n === null || n === undefined) return '0';
    return (n || 0).toLocaleString("en-IN");
  };

  const growth = (() => {
    const v = parseFloat(stats?.salesGrowth) || 0;
    return { val: Math.abs(v).toFixed(1), up: v >= 0 };
  })();

  const buildAreaPath = (data, W = 700, H = 260) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data.map((d) => d.revenue || 0), 1);
    if (max === 0) {
      // Generate mock visualization when no revenue data
      const mockPoints = data.map((d, i) => ({
        x: (i / (data.length - 1)) * W,
        y: H - 20 // Flat line at bottom
      }));
      const linePath = mockPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
      const areaPath = linePath + ` L${W},${H} L0,${H} Z`;
      return { line: linePath, area: areaPath };
    }
    const pts = data.map((d, i) => ({
      x: (i / (data.length - 1)) * W,
      y: H - Math.max(((d.revenue || 0) / max) * (H * 0.85), 10),
    }));
    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const areaPath = linePath + ` L${W},${H} L0,${H} Z`;
    return { line: linePath, area: areaPath };
  };

  // Use the sales trend data directly (it's already daily data from backend)
  const paths = buildAreaPath(salesTrend);
  const hasRevenue = salesTrend.some(d => (d.revenue || 0) > 0);

  const formatDate = () => {
    const d = new Date();
    const opts = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    return d.toLocaleDateString("en-IN", opts);
  };

  // Animated stat values
  const animatedRevenue = useAnimatedCounter(stats?.totalSales || 0, 1500);
  const animatedOrders = useAnimatedCounter(stats?.totalOrders || 0, 1200);
  const animatedCustomers = useAnimatedCounter(stats?.totalUsers || 0, 1000);

  if (loading && !stats) {
    return (
      <AdminLayout>
        <div className="dash-loading">
          <div className="dash-spinner"></div>
          <p>Loading Dashboard...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error && !stats) {
    return (
      <AdminLayout>
        <div className="dash-content">
          <div className="dash-container">
            <div className="dash-empty" style={{ minHeight: '60vh' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>{error}</p>
              <button className="dash-btn dash-btn--primary" onClick={handleRefresh}>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="dash-content">
        <div className="dash-container">
          {/* WELCOME */}
          <section className="dash-welcome">
            <div className="dash-welcome__info">
              <h1>
                Welcome back, Admin <span className="wave"></span>
              </h1>
              <p>{formatDate()}</p>
            </div>
            <div className="dash-welcome__actions">
              <button className="dash-btn dash-btn--secondary" onClick={handleRefresh} disabled={loading}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="20" height="20">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Refresh
              </button>
            </div>
          </section>

          {/* STATS - 3 Cards */}
          <section className="dash-stats">
            <div className="dash-stat" style={{ 
              '--stat-color': '#2563eb', 
              '--stat-color-light': '#3b82f6',
              '--stat-bg': '#eff6ff',
              '--stat-bg-light': '#dbeafe'
            }}>
              <div className="dash-stat__header">
                <div className="dash-stat__icon">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <span className={`dash-stat__trend dash-stat__trend--${growth.up ? "up" : "down"}`}>
                  {growth.up ? "" : ""} {growth.val}%
                </span>
              </div>
              <div className="dash-stat__body">
                <div className="dash-stat__label">Total Revenue</div>
                <div className="dash-stat__value">{fmt(animatedRevenue)}</div>
                <div className="dash-stat__meta">vs last month</div>
              </div>
              <div className="dash-stat__chart">
                {[45, 50, 48, 60, 65, 58, 70, 80].map((h, i) => (
                  <div key={i} className="dash-stat__bar" style={{ height: `${h}%` }}></div>
                ))}
              </div>
            </div>

            <div className="dash-stat" style={{ 
              '--stat-color': '#10b981',
              '--stat-color-light': '#34d399',
              '--stat-bg': '#d1fae5',
              '--stat-bg-light': '#a7f3d0'
            }}>
              <div className="dash-stat__header">
                <div className="dash-stat__icon">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"/>
                    <circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                </div>
                <span className="dash-stat__trend dash-stat__trend--up"> 12%</span>
              </div>
              <div className="dash-stat__body">
                <div className="dash-stat__label">Total Orders</div>
                <div className="dash-stat__value">{formatNumber(animatedOrders)}</div>
                <div className="dash-stat__meta">All time orders</div>
              </div>
              <div className="dash-stat__chart">
                {[40, 55, 50, 62, 58, 68, 75, 70].map((h, i) => (
                  <div key={i} className="dash-stat__bar" style={{ height: `${h}%` }}></div>
                ))}
              </div>
            </div>

            <div className="dash-stat" style={{ 
              '--stat-color': '#8b5cf6',
              '--stat-color-light': '#a78bfa',
              '--stat-bg': '#ede9fe',
              '--stat-bg-light': '#ddd6fe'
            }}>
              <div className="dash-stat__header">
                <div className="dash-stat__icon">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <span className="dash-stat__trend dash-stat__trend--up"> 8%</span>
              </div>
              <div className="dash-stat__body">
                <div className="dash-stat__label">Total Customers</div>
                <div className="dash-stat__value">{formatNumber(animatedCustomers)}</div>
                <div className="dash-stat__meta">Registered users</div>
              </div>
              <div className="dash-stat__chart">
                {[35, 42, 48, 55, 60, 65, 72, 78].map((h, i) => (
                  <div key={i} className="dash-stat__bar" style={{ height: `${h}%` }}></div>
                ))}
              </div>
            </div>
          </section>

          {/* QUICK STATS - Horizontal Layout */}
          <section className="dash-quick-stats">
            <div className="dash-quick-stat" style={{ '--stat-color': '#ef4444' }}>
              <div className="dash-quick-stat__icon">
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="dash-quick-stat__content">
                <div className="dash-quick-stat__value">{stats?.lowStockCount || 0}</div>
                <div className="dash-quick-stat__label">Low Stock</div>
              </div>
            </div>

            <div className="dash-quick-stat" style={{ '--stat-color': '#f59e0b' }}>
              <div className="dash-quick-stat__icon">
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="24" height="24">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="dash-quick-stat__content">
                <div className="dash-quick-stat__value">{stats?.pendingOrders || 0}</div>
                <div className="dash-quick-stat__label">Pending</div>
              </div>
            </div>

            <div className="dash-quick-stat" style={{ '--stat-color': '#10b981' }}>
              <div className="dash-quick-stat__icon">
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="24" height="24">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="dash-quick-stat__content">
                <div className="dash-quick-stat__value">{stats?.deliveredOrders || 0}</div>
                <div className="dash-quick-stat__label">Delivered</div>
              </div>
            </div>

            <div className="dash-quick-stat" style={{ '--stat-color': '#8b5cf6' }}>
              <div className="dash-quick-stat__icon">
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <polyline points="17 11 19 13 23 9"/>
                </svg>
              </div>
              <div className="dash-quick-stat__content">
                <div className="dash-quick-stat__value">{stats?.totalUsers || 0}</div>
                <div className="dash-quick-stat__label">Active Users</div>
              </div>
            </div>
          </section>

          {/* QUICK ACTIONS - Horizontal Layout */}
          <section className="dash-quick-actions">
            <Link 
              to="/admin/products/new" 
              className="dash-quick-action" 
              style={{ 
                '--action-color': '#2563eb', 
                '--action-bg': '#eff6ff',
                '--action-hover': '#1d4ed8'
              }}
            >
              <div className="dash-quick-action__icon">
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="24" height="24">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
              <span>Add Product</span>
            </Link>
            <Link 
              to="/admin/orders" 
              className="dash-quick-action" 
              style={{ 
                '--action-color': '#10b981',
                '--action-bg': '#d1fae5',
                '--action-hover': '#059669'
              }}
            >
              <div className="dash-quick-action__icon">
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M6 2L3 6v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V6l-3-4H6zM3 6h18M16 10a4 4 0 1 1-8 0"/>
                </svg>
              </div>
              <span>Manage Orders</span>
            </Link>
            <Link 
              to="/admin/categories" 
              className="dash-quick-action" 
              style={{ 
                '--action-color': '#8b5cf6',
                '--action-bg': '#ede9fe',
                '--action-hover': '#7c3aed'
              }}
            >
              <div className="dash-quick-action__icon">
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M3 3h7v7H3z"/>
                  <path d="M14 3h7v7h-7z"/>
                  <path d="M14 14h7v7h-7z"/>
                  <path d="M3 14h7v7H3z"/>
                </svg>
              </div>
              <span>Categories</span>
            </Link>
            <Link 
              to="/admin/reports" 
              className="dash-quick-action" 
              style={{ 
                '--action-color': '#f59e0b',
                '--action-bg': '#fef3c7',
                '--action-hover': '#d97706'
              }}
            >
              <div className="dash-quick-action__icon">
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
              </div>
              <span>View Reports</span>
            </Link>
          </section>

          {/* CHARTS */}
          <section className="dash-charts">
            {/* Area Chart */}
            <div className="dash-card">
              <div className="dash-card__header">
                <div>
                  <h2 className="dash-card__title">Revenue Trend</h2>
                  <p className="dash-card__subtitle">Sales performance over last 7 days</p>
                </div>
              </div>
              {paths ? (
                <>
                  <div className="dash-chart-wrap">
                    <svg className="dash-chart-svg" viewBox="0 0 700 260" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3"/>
                          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02"/>
                        </linearGradient>
                        <filter id="shadow">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
                        </filter>
                      </defs>
                      <path d={paths.area} fill="url(#areaGrad)"/>
                      <path d={paths.line} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#shadow)"/>
                    </svg>
                  </div>
                  <div className="dash-chart-labels">
                    {salesTrend.map((d, i) => (
                      <span key={i}>{d.day || d.date?.split('-')[2] || i}</span>
                    ))}
                  </div>
                  {!hasRevenue && (
                    <div style={{ 
                      padding: '12px', 
                      marginTop: '12px', 
                      background: '#fef3c7', 
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '0.875rem',
                      color: '#92400e'
                    }}>
                      ⚠️ No revenue data yet. Complete orders with "delivered" status to see the trend.
                    </div>
                  )}
                </>
              ) : (
                <div className="dash-empty">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="48" height="48">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                  <p>No revenue data available</p>
                  <small>Complete delivered orders to see the sales trend</small>
                </div>
              )}
            </div>

            {/* Donut Chart */}
            <div className="dash-card">
              <div className="dash-card__header">
                <div>
                  <h2 className="dash-card__title">Order Distribution</h2>
                  <p className="dash-card__subtitle">By status</p>
                </div>
                <Link to="/admin/orders" className="dash-link">
                  View All
                  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </Link>
              </div>
              {orderDist && orderDist.length > 0 ? (
                <div className="dash-donut-wrap">
                  <div className="dash-donut">
                    <svg className="dash-donut-svg" viewBox="0 0 160 160">
                      {(() => {
                        const total = orderDist.reduce((s, d) => s + (d.count || 0), 0);
                        const colors = ["#10b981", "#f59e0b", "#ef4444", "#6b7280"];
                        let offset = 0;
                        const R = 60, C = 80, circ = 2 * Math.PI * R;
                        return orderDist.map((d, i) => {
                          const pct = (d.count || 0) / total;
                          const len = pct * circ;
                          const seg = (
                            <circle
                              key={i}
                              className="dash-donut-seg"
                              cx={C}
                              cy={C}
                              r={R}
                              fill="none"
                              stroke={colors[i % colors.length]}
                              strokeWidth="20"
                              strokeDasharray={`${len} ${circ}`}
                              strokeDashoffset={-offset}
                            />
                          );
                          offset += len;
                          return seg;
                        });
                      })()}
                    </svg>
                    <div className="dash-donut-center">
                      <div className="dash-donut-total">
                        {orderDist.reduce((s, d) => s + (d.count || 0), 0).toLocaleString()}
                      </div>
                      <div className="dash-donut-label">Orders</div>
                    </div>
                  </div>
                  <div className="dash-donut-legend">
                    {orderDist.map((d, i) => {
                      const colors = ["#10b981", "#f59e0b", "#ef4444", "#6b7280"];
                      const total = orderDist.reduce((s, x) => s + (x.count || 0), 0);
                      const pct = ((d.count || 0) / total * 100).toFixed(1);
                      return (
                        <div key={i} className="dash-legend-item">
                          <div className="dash-legend-dot" style={{ background: colors[i % colors.length] }}></div>
                          <div className="dash-legend-name">{d._id || "Unknown"}</div>
                          <div className="dash-legend-count">{(d.count || 0).toLocaleString()}</div>
                          <div className="dash-legend-pct">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="dash-empty">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                  <p>No order data</p>
                </div>
              )}
            </div>
          </section>

          {/* BOTTOM */}
          <section className="dash-bottom-full">
            {/* Table */}
            <div className="dash-card">
              <div className="dash-card__header">
                <div>
                  <h2 className="dash-card__title">Recent Orders</h2>
                  <p className="dash-card__subtitle">Latest transactions</p>
                </div>
                <Link to="/admin/orders" className="dash-link">
                  View All
                  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </Link>
              </div>
              <div className="dash-table-wrap">
                {recentOrders.length > 0 ? (
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th className="dash-th-right">Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((o, i) => (
                        <tr key={o._id || i}>
                          <td className="dash-td-mono">#{(o.orderId || "").slice(-8)}</td>
                          <td className="dash-td-name">{o.user?.name || "Guest"}</td>
                          <td className="dash-td-muted">
                            {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN") : "-"}
                          </td>
                          <td className="dash-td-right dash-td-bold">{fmt(o.totalAmount)}</td>
                          <td>
                            <span 
                              className="dash-status" 
                              style={{
                                background: o.status === "Delivered" ? "#d1fae5" : 
                                          o.status === "Processing" ? "#fef3c7" : 
                                          o.status === "Cancelled" ? "#fee2e2" : "#f3f4f6",
                                color: o.status === "Delivered" ? "#059669" : 
                                      o.status === "Processing" ? "#d97706" : 
                                      o.status === "Cancelled" ? "#dc2626" : "#6b7280"
                              }}
                            >
                              {o.status || "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="dash-empty">
                    <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V6l-3-4H6zM3 6h18M16 10a4 4 0 1 1-8 0"/>
                    </svg>
                    <p>No orders yet</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
