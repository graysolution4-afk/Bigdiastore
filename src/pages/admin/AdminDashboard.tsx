import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  BarChart3,
  Boxes,
  CreditCard,
  ExternalLink,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  Tag,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/firebase';
import {
  AdminActivityLog,
  Order,
  PaymentTransaction,
  UserProfile,
} from '../../types/store';
import {
  AdminBannersPanel,
  AdminCategoriesPanel,
  AdminInventoryPanel,
  AdminProductsPanel,
  AdminReviewsPanel,
} from './AdminCatalogPanels';
import {
  AdminCouponsPanel,
  AdminCustomersPanel,
  AdminOrdersPanel,
  AdminShippingPanel,
} from './AdminCommercePanels';
import {
  AdminPaymentGatewaysPanel,
  AdminReportsPanel,
  AdminTransactionsPanel,
} from './AdminFinancePanels';
import {
  AdminOverviewPanel,
  AdminSettingsPanel,
  AdminStaffPanel,
  ContactMessageItem,
} from './AdminSystemPanels';

interface NavTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<'super_admin' | 'store_manager' | 'content_manager'>;
}

const ADMIN_TABS: NavTabItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    roles: ['super_admin', 'store_manager', 'content_manager'],
  },
  {
    id: 'products',
    label: 'Products',
    icon: ShoppingBag,
    roles: ['super_admin', 'store_manager', 'content_manager'],
  },
  {
    id: 'categories',
    label: 'Categories',
    icon: FolderTree,
    roles: ['super_admin', 'store_manager', 'content_manager'],
  },
  {
    id: 'orders',
    label: 'Orders & Tracking',
    icon: Package,
    roles: ['super_admin', 'store_manager'],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    roles: ['super_admin', 'store_manager'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    roles: ['super_admin', 'store_manager'],
  },
  {
    id: 'gateways',
    label: 'Payment Gateways',
    icon: CreditCard,
    roles: ['super_admin'],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: Receipt,
    roles: ['super_admin', 'store_manager'],
  },
  {
    id: 'shipping',
    label: 'Delivery & Zones',
    icon: Truck,
    roles: ['super_admin', 'store_manager'],
  },
  {
    id: 'coupons',
    label: 'Coupons',
    icon: Tag,
    roles: ['super_admin', 'store_manager'],
  },
  {
    id: 'banners',
    label: 'Banners',
    icon: ImageIcon,
    roles: ['super_admin', 'content_manager'],
  },
  {
    id: 'reviews',
    label: 'Reviews',
    icon: MessageSquare,
    roles: ['super_admin', 'content_manager'],
  },
  {
    id: 'reports',
    label: 'Sales Reports',
    icon: BarChart3,
    roles: ['super_admin', 'store_manager'],
  },
  {
    id: 'staff',
    label: 'Staff & Audit Logs',
    icon: Shield,
    roles: ['super_admin'],
  },
  {
    id: 'settings',
    label: 'Store Settings',
    icon: Settings,
    roles: ['super_admin', 'content_manager'],
  },
];

export function AdminDashboard() {
  const { isAdmin, adminRole, activeEmail, activeName, firebaseUser, authReady, logoutAll, signInWithGoogle } =
    useAuth();
  const { notify } = useStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessageItem[]>([]);

  // Subscribe to protected Firestore collections when Firebase Admin session is active
  useEffect(() => {
    if (!firebaseUser || !isAdmin) return;

    const u1 = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
      (snap) => setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order))),
      (err) => console.warn('Orders snapshot:', err.message)
    );
    const u2 = onSnapshot(
      collection(db, 'users'),
      (snap) => setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile))),
      (err) => console.warn('Users snapshot:', err.message)
    );
    const u3 = onSnapshot(
      query(collection(db, 'payment_transactions'), orderBy('createdAt', 'desc')),
      (snap) =>
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentTransaction))),
      (err) => console.warn('Transactions snapshot:', err.message)
    );
    const u4 = onSnapshot(
      query(collection(db, 'admin_activity_logs'), orderBy('createdAt', 'desc')),
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminActivityLog))),
      (err) => console.warn('Logs snapshot:', err.message)
    );
    const u5 = onSnapshot(
      query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc')),
      (snap) =>
        setContactMessages(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactMessageItem))
        ),
      (err) => console.warn('Messages snapshot:', err.message)
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [firebaseUser, isAdmin]);

  if (authReady && !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  const allowedTabs = ADMIN_TABS.filter((t) =>
    adminRole ? t.roles.includes(adminRole) : true
  );

  const handleSignOut = async () => {
    await logoutAll();
    notify('Signed out of administrator session.', 'info');
    navigate('/admin/login');
  };

  const renderPanel = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <AdminOverviewPanel
            orders={orders}
            customers={customers}
            onNavigateTab={setActiveTab}
          />
        );
      case 'products':
        return <AdminProductsPanel />;
      case 'categories':
        return <AdminCategoriesPanel />;
      case 'orders':
        return <AdminOrdersPanel orders={orders} />;
      case 'customers':
        return <AdminCustomersPanel customers={customers} orders={orders} />;
      case 'inventory':
        return <AdminInventoryPanel />;
      case 'gateways':
        return <AdminPaymentGatewaysPanel />;
      case 'transactions':
        return <AdminTransactionsPanel transactions={transactions} orders={orders} />;
      case 'shipping':
        return <AdminShippingPanel />;
      case 'coupons':
        return <AdminCouponsPanel />;
      case 'banners':
        return <AdminBannersPanel />;
      case 'reviews':
        return <AdminReviewsPanel />;
      case 'reports':
        return <AdminReportsPanel orders={orders} />;
      case 'staff':
        return <AdminStaffPanel logs={logs} />;
      case 'settings':
        return <AdminSettingsPanel messages={contactMessages} />;
      default:
        return (
          <AdminOverviewPanel
            orders={orders}
            customers={customers}
            onNavigateTab={setActiveTab}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden bg-[#111111] text-white px-4 h-14 flex items-center justify-between border-b border-[#D4AF37]/30 no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open admin navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display text-lg tracking-[0.14em] font-semibold">
            DIAMOND ADMIN
          </span>
        </div>
        <Link to="/" className="text-xs text-[#D4AF37] uppercase tracking-wider">
          Storefront
        </Link>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#111111] text-white flex flex-col border-r border-neutral-800 transform transition-transform lg:static lg:translate-x-0 no-print ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold tracking-[0.16em] text-white">
              DIAMOND STORE
            </p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#D4AF37] mt-0.5">
              {adminRole?.replace('_', ' ') || 'Administrator'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {allowedTabs.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium tracking-wide transition-colors text-left ${
                  active
                    ? 'bg-[#D4AF37] text-[#111111] font-semibold'
                    : 'text-neutral-300 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-800 space-y-3 text-xs">
          <div className="text-neutral-400 truncate">
            <p className="text-white font-medium truncate">{activeName || 'Administrator'}</p>
            <p className="text-[11px] truncate">{activeEmail}</p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/"
              className="flex-1 py-2 border border-neutral-700 text-center text-neutral-200 hover:border-[#D4AF37] flex items-center justify-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Store
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 py-2 border border-neutral-700 text-neutral-200 hover:border-red-500 hover:text-red-400 flex items-center justify-center gap-1"
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10">
        {!firebaseUser && (
          <div className="mb-6 p-4 bg-white border border-[#D4AF37] flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div className="text-xs text-neutral-700">
              <strong className="text-[#111111] block mb-0.5">
                Link Authorized Google Session for Direct Database Writes
              </strong>
              Your server vault session is active for payment gateways and staff management. Sign in with your authorized Google account to enable live Firestore writes from the browser.
            </div>
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0"
            >
              Connect Google Auth
            </button>
          </div>
        )}
        {renderPanel()}
      </main>
    </div>
  );
}
