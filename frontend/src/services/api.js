import axios from 'axios';

/**
 * API Service Configuration
 * Base configuration for all API calls
 * Uses dynamic port detection for development environments
 */

// Determine the backend URL based on environment
const getBackendURL = () => {
  // In development, use the current host and the Vite proxy
  if (import.meta.env.DEV) {
    // This will use the Vite proxy configured in vite.config.js
    return '/api';
  }
  // In production, use the full URL
  return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;
};

const API = axios.create({
  baseURL: getBackendURL(),
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false,
  timeout: 15000  // 15 second timeout for requests
});

// Add token to requests if available
API.interceptors.request.use((config) => {
  // Determine which token to use based on the route
  let token = null;
  const adminToken = localStorage.getItem('adminToken');
  const userToken = localStorage.getItem('token');

  // Admin routes - always use admin token
  if (config.url.includes('/admin') || config.url.includes('/admin-management')) {
    token = adminToken;
  } 
  // Customer's own messages - use user token
  else if (config.url.includes('/contact/my-messages')) {
    token = userToken;
  }
  // Other contact routes - use admin token for GET/PUT/DELETE (POST is public)
  else if (config.url.includes('/contact') && config.method.toLowerCase() !== 'post') {
    token = adminToken;
  }
  // For /orders requests (with or without query params), prefer admin token if it exists
  else if (config.url.startsWith('/orders') && adminToken) {
    token = adminToken;
  }
  // User routes or public routes - use user token
  else {
    token = userToken;
  }

  // If no appropriate token found, try the other one as fallback
  if (!token) {
    token = adminToken || userToken;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('API Request:', config.method.toUpperCase(), config.url, token ? '(with auth)' : '(no auth)');
  return config;
});

// Handle responses and clear invalid tokens
API.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    const url = error.config?.url || '';
    const status = error.response?.status;
    const message = error.response?.data?.message || '';
    
    console.log('API Error:', status, url, message);

    // Handle 401/403 authentication errors
    if (status === 401 || status === 403) {
      // For admin routes, clear admin token and redirect
      if (url.includes('/admin') || url.includes('/orders') || url.includes('/admin-management')) {
        const adminToken = localStorage.getItem('adminToken');
        if (adminToken && (status === 401 || message.includes('expired') || message.includes('invalid'))) {
          console.warn('Admin authentication failed, clearing token');
          localStorage.removeItem('adminToken');
          localStorage.removeItem('admin');
          // Don't redirect here - let components handle it to avoid loops
        }
      }
      // For admin login failures, don't clear tokens
      else if (url.includes('/auth/admin/login')) {
        console.log('Admin login failed - invalid credentials');
      }
      // For logout, clear tokens
      else if (url.includes('logout')) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    return Promise.reject(error);
  }
);

export default API;
