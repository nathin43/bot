import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';
import { initializeSocket, joinUserRoom, onReceiveReportMessage } from '../../services/socket';
import './UserReports.css';

/**
 * User Reports Component
 * Displays admin-sent report messages in an inbox style
 * Real-time message delivery via WebSocket
 */
const UserReports = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    unreadOnly: false
  });

  // Fetch user's report messages
  const fetchReportMessages = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.unreadOnly) queryParams.append('unreadOnly', 'true');

      const response = await api.get(`/user/reports/messages?${queryParams.toString()}`);
      if (response.data.success) {
        setMessages(response.data.messages);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      toast.error('Failed to fetch report messages');
      console.error('Error fetching report messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchReportMessages();
  }, [user?.id, filters.status, filters.unreadOnly]);

  // Initialize Socket.IO and join user room for real-time messages
  useEffect(() => {
    if (!user?.id) return;

    // Initialize socket connection
    initializeSocket();
    
    // Join user's personal room
    joinUserRoom(user.id);

    // Listen for incoming report messages
    const cleanup = onReceiveReportMessage((response) => {
      if (response.success && response.message) {
        console.log('📨 New report message received:', response.message);
        
        // Add new message to the top of the list
        setMessages(prev => [response.message, ...prev]);
        
        // Increment unread count
        setUnreadCount(prev => prev + 1);
        
        // Show notification
        toast.success('📬 You received a new report message!');
      }
    });

    // Cleanup on unmount
    return () => {
      if (cleanup) cleanup();
    };
  }, [user?.id]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      status: '',
      unreadOnly: false
    });
  };

  // Mark message as read
  const markAsRead = async (messageId, isRead) => {
    if (isRead) return; // Already read

    try {
      const response = await api.patch(`/user/reports/messages/${messageId}/read`);
      if (response.data.success) {
        // Update local state
        setMessages(prev => prev.map(msg =>
          msg._id === messageId ? { ...msg, isRead: true, readAt: new Date() } : msg
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge class
  const getStatusClass = (status) => {
    const statusMap = {
      'Info': 'status-info',
      'Warning': 'status-warning',
      'Issue': 'status-danger',
      'Summary': 'status-success'
    };
    return statusMap[status] || 'status-info';
  };

  // Get status icon
  const getStatusIcon = (status) => {
    const iconMap = {
      'Info': 'ℹ️',
      'Warning': '⚠️',
      'Issue': '❌',
      'Summary': '📊'
    };
    return iconMap[status] || 'ℹ️';
  };

  return (
    <div className="user-reports-section">
      <div className="reports-header">
        <div>
          <h3>📬 My Reports Inbox</h3>
          <p>View report messages sent by admin</p>
        </div>
        {unreadCount > 0 && (
          <div className="unread-badge">
            {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="reports-filters">
        <div className="filter-group">
          <label>Status Filter</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="Info">Info</option>
            <option value="Warning">Warning</option>
            <option value="Issue">Issue</option>
            <option value="Summary">Summary</option>
          </select>
        </div>

        <div className="filter-group checkbox-group">
          <label>
            <input
              type="checkbox"
              name="unreadOnly"
              checked={filters.unreadOnly}
              onChange={handleFilterChange}
            />
            <span>Show unread only</span>
          </label>
        </div>

        <div className="filter-actions">
          <button type="button" className="filter-btn clear" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Message Inbox */}
      <div className="message-inbox">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your messages...</p>
          </div>
        ) : messages.length > 0 ? (
          messages.map(msg => (
            <div
              key={msg._id}
              className={`message-card ${!msg.isRead ? 'unread' : ''}`}
              onClick={() => markAsRead(msg._id, msg.isRead)}
            >
              <div className="message-header">
                <div className="message-title-section">
                  <span className="message-icon">{getStatusIcon(msg.status)}</span>
                  <div className="message-title-wrapper">
                    <h4 className="message-title">{msg.title}</h4>
                    {!msg.isRead && <span className="new-badge">NEW</span>}
                  </div>
                </div>
                <div className="message-meta">
                  <span className={`status-tag ${getStatusClass(msg.status)}`}>
                    {msg.status}
                  </span>
                  <span className="message-date">{formatDate(msg.createdAt)}</span>
                </div>
              </div>

              <div className="message-body">
                <p className="message-text">{msg.message}</p>

                {/* Reference IDs */}
                <div className="message-references">
                  {msg.orderId && (
                    <span className="ref-badge">
                      🧾 Order: <strong>{msg.orderId}</strong>
                    </span>
                  )}
                  {msg.paymentId && (
                    <span className="ref-badge">
                      💳 Payment: <strong>{msg.paymentId}</strong>
                    </span>
                  )}
                  {msg.invoiceId && (
                    <span className="ref-badge">
                      📄 Invoice: <strong>{msg.invoiceId}</strong>
                    </span>
                  )}
                </div>
              </div>

              {msg.isRead && msg.readAt && (
                <div className="message-footer">
                  <small className="read-timestamp">
                    Read on {formatDate(msg.readAt)}
                  </small>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No Messages Yet</h3>
            <p>Your report inbox is empty</p>
            <small>Admin-sent report messages will appear here.</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserReports;
