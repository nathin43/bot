import { Routes, Route } from 'react-router-dom';
import ToastContainer from './components/ToastContainer';

// Customer Pages
import Home from './pages/customer/Home';
import Products from './pages/customer/Products';
import ProductDetails from './pages/customer/ProductDetails';
import Services from './pages/customer/Services';
import ServiceDetails from './pages/customer/ServiceDetails';
import Contact from './pages/customer/Contact';
import EasyReturn from './pages/customer/EasyReturn';
import Cart from './pages/customer/Cart';
import Checkout from './pages/customer/Checkout';
import Login from './pages/customer/Login';
import Register from './pages/customer/Register';
import ForgotPassword from './pages/customer/ForgotPassword';
import Orders from './pages/customer/Orders';
import Profile from './pages/customer/Profile';
import SupportMessages from './pages/customer/SupportMessages';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminAddProduct from './pages/admin/AdminAddProduct';
import AdminEditProduct from './pages/admin/AdminEditProduct';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminManagement from './pages/admin/AdminManagement';
import AdminReports from './pages/admin/AdminReports';
import AdminContactMessages from './pages/admin/AdminContactMessages';
import UserReportDetail from './pages/admin/UserReportDetailNew';

// Admin Report Pages
import SalesReport from './pages/admin/SalesReport';
import StockReport from './pages/admin/StockReport';
import CustomerReport from './pages/admin/CustomerReport';
import PaymentReport from './pages/admin/PaymentReport';
import OrderReport from './pages/admin/OrderReport';

// Components
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import MainAdminRoute from './components/MainAdminRoute';

/**
 * Main App Component
 * Routes configuration with React Router v6
 * Future flags enabled for v7 compatibility
 */
function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
        {/* Customer Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/services" element={<Services />} />
        <Route path="/service/:serviceId" element={<ServiceDetails />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/easy-return" element={<EasyReturn />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Protected Customer Routes */}
        <Route path="/checkout" element={<PrivateRoute><Checkout /></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><Orders /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/support-messages" element={<PrivateRoute><SupportMessages /></PrivateRoute>} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><AdminProducts /></AdminRoute>} />
        <Route path="/admin/products/add" element={<AdminRoute><AdminAddProduct /></AdminRoute>} />
        <Route path="/admin/products/edit/:id" element={<AdminRoute><AdminEditProduct /></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
        <Route path="/admin/customers" element={<AdminRoute><AdminCustomers /></AdminRoute>} />
        <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
        <Route path="/admin/reports/sales" element={<AdminRoute><SalesReport /></AdminRoute>} />
        <Route path="/admin/reports/stock" element={<AdminRoute><StockReport /></AdminRoute>} />
        <Route path="/admin/reports/customers" element={<AdminRoute><CustomerReport /></AdminRoute>} />
        <Route path="/admin/reports/payments" element={<AdminRoute><PaymentReport /></AdminRoute>} />
        <Route path="/admin/reports/orders" element={<AdminRoute><OrderReport /></AdminRoute>} />
        <Route path="/admin/reports/user/:userId" element={<AdminRoute><UserReportDetail /></AdminRoute>} />
        <Route path="/admin/contact-messages" element={<AdminRoute><AdminContactMessages /></AdminRoute>} />
        <Route path="/admin/admin-management" element={<MainAdminRoute><AdminManagement /></MainAdminRoute>} />
      </Routes>
    </>
  );
}

export default App;
