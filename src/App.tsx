import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { CartDrawer } from './components/store/CartDrawer';
import { ToastContainer } from './components/store/ToastContainer';
import { WhatsAppWidget } from './components/store/WhatsAppWidget';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AccountPage, WishlistPage } from './pages/store/AccountPage';
import { CartPage } from './pages/store/CartPage';
import { CheckoutPage } from './pages/store/CheckoutPage';
import {
  CustomerLoginPage,
  CustomerRegisterPage,
  ForgotPasswordPage,
} from './pages/store/CustomerAuthPages';
import { HomePage } from './pages/store/HomePage';
import {
  AboutPage,
  ContactPage,
  FaqPage,
  NotFoundPage,
  PolicyPage,
} from './pages/store/InfoPages';
import { OrderTrackingPage } from './pages/store/OrderTrackingPage';
import { ProductDetailPage } from './pages/store/ProductDetailPage';
import { ShopPage } from './pages/store/ShopPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppShell() {
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#222222] font-sans">
      <ScrollToTop />
      {!isAdminRoute && <Navbar />}
      {!isAdminRoute && <CartDrawer />}
      <ToastContainer />

      <div className="flex-1">
        <Routes>
          {/* Public Storefront Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/mens-clothing" element={<ShopPage presetGroup="mens-clothing" />} />
          <Route path="/shoes" element={<ShopPage presetGroup="shoes" />} />
          <Route path="/accessories" element={<ShopPage presetGroup="mens-accessories" />} />
          <Route path="/new-arrivals" element={<ShopPage presetCollection="new-arrivals" />} />
          <Route path="/best-sellers" element={<ShopPage presetCollection="best-sellers" />} />
          <Route path="/category/:slug" element={<ShopPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/track-order" element={<OrderTrackingPage />} />

          {/* Customer Account Routes */}
          <Route path="/login" element={<CustomerLoginPage />} />
          <Route path="/register" element={<CustomerRegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />

          {/* Informational & Policy Routes */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/privacy-policy" element={<PolicyPage type="privacy" />} />
          <Route path="/terms" element={<PolicyPage type="terms" />} />
          <Route path="/shipping-returns" element={<PolicyPage type="shipping" />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/*" element={<AdminDashboard />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>

      {!isAdminRoute && <WhatsAppWidget />}
      {!isAdminRoute && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <StoreProvider>
            <AppShell />
          </StoreProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
