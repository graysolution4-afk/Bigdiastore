import React, { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AlertTriangle, Check, Mail, Plus, Shield, Upload, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/firebase';
import { formatNaira, formatTimestamp, toMillis } from '../../lib/format';
import { uploadImageAsset } from '../../lib/upload';
import { AdminActivityLog, AdminRole, Order, UserProfile } from '../../types/store';

export interface ContactMessageItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'new' | 'resolved';
  createdAt: any;
}

export function AdminOverviewPanel({
  orders,
  customers,
  onNavigateTab,
}: {
  orders: Order[];
  customers: UserProfile[];
  onNavigateTab: (tab: string) => void;
}) {
  const { products, seedDatabaseFromDefaults, usingFallbackCatalog } = useStore();

  const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');
  const verifiedRevenue = paidOrders.reduce((s, o) => s + o.totalAmount, 0);
  const pendingOrders = orders.filter(
    (o) => o.orderStatus !== 'Delivered' && o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Refunded'
  ).length;
  const completedOrders = orders.filter((o) => o.orderStatus === 'Delivered').length;
  const lowStockProducts = products.filter((p) => p.stockQuantity <= 5);
  const bestSellers = [...products].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0)).slice(0, 5);

  // Build 7-day SVG bar chart from verified paid orders
  const dailySeries = useMemo(() => {
    const days: Array<{ label: string; key: string; total: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-NG', { weekday: 'short' });
      days.push({ label, key, total: 0 });
    }
    for (const o of paidOrders) {
      const ms = toMillis(o.createdAt);
      if (!ms) continue;
      const key = new Date(ms).toISOString().slice(0, 10);
      const match = days.find((d) => d.key === key);
      if (match) match.total += o.totalAmount;
    }
    return days;
  }, [paidOrders]);

  const maxDay = Math.max(1, ...dailySeries.map((d) => d.total));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#111111]">
            Executive Overview
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Live commerce performance, fulfillment status, and inventory health.
          </p>
        </div>
        {usingFallbackCatalog && (
          <button
            type="button"
            onClick={() => void seedDatabaseFromDefaults()}
            className="px-4 py-2 bg-[#D4AF37] text-[#111111] text-xs font-semibold uppercase tracking-wider"
          >
            Sync Default Catalog to Database
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-neutral-200 bg-white p-5">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">Verified Revenue</p>
          <p className="text-2xl font-semibold text-[#111111] tabular-nums mt-1">
            {formatNaira(verifiedRevenue)}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1 tabular-nums">
            {paidOrders.length} verified paid orders
          </p>
        </div>

        <div className="border border-neutral-200 bg-white p-5">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">Orders Pipeline</p>
          <p className="text-2xl font-semibold text-[#111111] tabular-nums mt-1">{orders.length}</p>
          <p className="text-[11px] text-neutral-500 mt-1 tabular-nums">
            {pendingOrders} active · {completedOrders} delivered
          </p>
        </div>

        <div className="border border-neutral-200 bg-white p-5">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">Registered Clients</p>
          <p className="text-2xl font-semibold text-[#111111] tabular-nums mt-1">
            {customers.length}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">Active client accounts</p>
        </div>

        <div className="border border-neutral-200 bg-white p-5">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">Catalog &amp; Stock</p>
          <p className="text-2xl font-semibold text-[#111111] tabular-nums mt-1">
            {products.length}
          </p>
          <p className="text-[11px] text-[#9E7C16] mt-1 tabular-nums">
            {lowStockProducts.length} low-stock SKUs
          </p>
        </div>
      </div>

      {/* Revenue Chart + Top Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-[#111111]">
              7-Day Verified Revenue
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="text-xs underline text-neutral-600 hover:text-[#111111]"
            >
              Full Analytics
            </button>
          </div>
          <svg viewBox="0 0 420 170" className="w-full h-48" aria-label="7-Day Verified Revenue Bar Chart">
            {dailySeries.map((day, i) => {
              const barHeight = Math.max(4, Math.round((day.total / maxDay) * 115));
              const x = 18 + i * 56;
              const y = 135 - barHeight;
              return (
                <g key={day.key}>
                  <rect
                    x={x}
                    y={y}
                    width={32}
                    height={barHeight}
                    fill={day.total > 0 ? '#D4AF37' : '#E5E5E5'}
                  />
                  <text
                    x={x + 16}
                    y={155}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#666666"
                  >
                    {day.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="lg:col-span-5 border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-[#111111]">
              Best-Selling Products
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('products')}
              className="text-xs underline text-neutral-600 hover:text-[#111111]"
            >
              Manage Products
            </button>
          </div>
          <div className="divide-y divide-neutral-100">
            {bestSellers.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[#111111] truncate">{p.name}</p>
                  <p className="text-xs text-neutral-500 font-mono">{p.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium tabular-nums">
                    {formatNaira(p.discountPrice || p.regularPrice)}
                  </p>
                  <p className="text-[11px] text-neutral-500 tabular-nums">{p.soldCount || 0} sold</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-[#111111]">Recent Orders</h3>
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="text-xs underline text-neutral-600 hover:text-[#111111]"
            >
              View All Orders
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-neutral-500 border-b border-neutral-200">
                <tr>
                  <th className="py-2">Order #</th>
                  <th className="py-2">Customer</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.slice(0, 6).map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 font-mono text-xs font-semibold">{o.orderNumber}</td>
                    <td className="py-2.5">{o.customerName}</td>
                    <td className="py-2.5 text-xs">{o.orderStatus}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">
                      {formatNaira(o.totalAmount)}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-neutral-500">
                      No orders recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-[#111111] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#9E7C16]" /> Low-Stock Alerts
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="text-xs underline text-neutral-600 hover:text-[#111111]"
            >
              Inventory
            </button>
          </div>
          <div className="divide-y divide-neutral-100">
            {lowStockProducts.slice(0, 6).map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-medium text-[#111111] truncate pr-3">{p.name}</span>
                <span className="font-mono font-semibold text-red-700 tabular-nums shrink-0">
                  {p.stockQuantity} left
                </span>
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <p className="text-xs text-neutral-500 py-4">All catalog items are well stocked.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ServerStaffRecord {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
}

export function AdminStaffPanel({ logs }: { logs: AdminActivityLog[] }) {
  const { getBearerToken, adminRole } = useAuth();
  const { notify, logAdminAction } = useStore();
  const [staff, setStaff] = useState<ServerStaffRecord[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('store_manager');
  const [firebaseUid, setFirebaseUid] = useState('');
  const [creating, setCreating] = useState(false);

  const loadStaff = async () => {
    try {
      const token = await getBearerToken();
      if (!token) return;
      const resp = await fetch('/api/admin-auth/staff', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const j = await resp.json();
        setStaff(j.staff || []);
      }
    } catch {
      // handled gracefully
    }
  };

  useEffect(() => {
    if (adminRole === 'super_admin') {
      void loadStaff();
    }
  }, [adminRole]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const token = await getBearerToken();
      const resp = await fetch('/api/admin-auth/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fullName, email, password, role }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j?.error || 'Failed to create staff account.');

      if (firebaseUid.trim()) {
        await setDoc(doc(db, 'admins', firebaseUid.trim()), {
          uid: firebaseUid.trim(),
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          role,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      await logAdminAction('CREATE_ADMIN_STAFF', 'admins', j.staff.id, `Added ${role} ${email}`);
      setFullName('');
      setEmail('');
      setPassword('');
      setFirebaseUid('');
      await loadStaff();
      notify('Administrator staff account created.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Unable to create staff account.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const toggleStaffStatus = async (item: ServerStaffRecord) => {
    try {
      const token = await getBearerToken();
      const resp = await fetch(`/api/admin-auth/staff/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ active: !item.active }),
      });
      if (!resp.ok) throw new Error('Update failed.');
      await loadStaff();
      notify(`${item.email} ${!item.active ? 'activated' : 'suspended'}.`, 'info');
    } catch (err: any) {
      notify(err?.message || 'Unable to update staff status.', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[#111111]">
          Staff Access &amp; Audit Logs
        </h2>
        <p className="text-xs text-neutral-500 mt-1">
          Role-Based Access Control (Super Admin, Store Manager, Content Manager) and chronological activity audit trail.
        </p>
      </div>

      {adminRole === 'super_admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateStaff}
            className="lg:col-span-5 border border-neutral-200 bg-white p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-semibold text-[#111111] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#9E7C16]" /> Add Staff Administrator
            </h3>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name *"
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address *"
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Initial Password (min 8 chars) *"
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
            >
              <option value="store_manager">Store Manager (Orders, Products, Reports)</option>
              <option value="content_manager">Content Manager (Catalog, Banners, Reviews)</option>
              <option value="super_admin">Super Administrator (Full Access)</option>
            </select>
            <input
              type="text"
              value={firebaseUid}
              onChange={(e) => setFirebaseUid(e.target.value)}
              placeholder="Optional Google Firebase UID (for Google SSO)"
              className="w-full border border-neutral-300 px-3 py-2 text-xs font-mono"
            />
            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" /> {creating ? 'Creating...' : 'Create Staff Account'}
            </button>
          </form>

          <div className="lg:col-span-7 border border-neutral-200 bg-white overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#F5F5F5] text-xs uppercase text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="p-3">Administrator</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="p-3">
                      <p className="font-medium text-[#111111]">{s.fullName}</p>
                      <p className="text-xs text-neutral-500">{s.email}</p>
                    </td>
                    <td className="p-3 text-xs uppercase font-mono">{s.role}</td>
                    <td className="p-3 text-xs uppercase">{s.active ? 'Active' : 'Suspended'}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleStaffStatus(s)}
                        className="px-3 py-1 border border-neutral-300 text-xs hover:border-[#111111]"
                      >
                        {s.active ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-xs text-neutral-500">
                      Sign in with server administrator credentials or Super Admin token to manage staff vault records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Audit Trail */}
      <div className="border border-neutral-200 bg-white p-5 space-y-4">
        <h3 className="font-display text-lg font-semibold text-[#111111] flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#9E7C16]" /> Administrator Activity Audit Log
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-neutral-500 border-b border-neutral-200">
              <tr>
                <th className="py-2">Admin</th>
                <th className="py-2">Action</th>
                <th className="py-2">Summary</th>
                <th className="py-2">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {logs.slice(0, 30).map((log) => (
                <tr key={log.id}>
                  <td className="py-2 text-xs">
                    <span className="font-medium">{log.adminEmail}</span>
                    {log.adminRole && (
                      <span className="text-neutral-500 ml-1">({log.adminRole})</span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-xs">{log.action}</td>
                  <td className="py-2 text-xs text-neutral-700">{log.summary}</td>
                  <td className="py-2 text-xs text-neutral-500 whitespace-nowrap">
                    {formatTimestamp(log.createdAt)}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-neutral-500">
                    No activity logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminSettingsPanel({ messages }: { messages: ContactMessageItem[] }) {
  const { settings, saveStoreSettings, notify } = useStore();
  const { getBearerToken, adminRole } = useAuth();

  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Email & WhatsApp provider config on server
  const [resendKey, setResendKey] = useState('');
  const [fromEmail, setFromEmail] = useState('Diamond Store <orders@diamondstore.ng>');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('');
  const [hasResend, setHasResend] = useState(false);
  const [hasWaToken, setHasWaToken] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    void (async () => {
      const token = await getBearerToken();
      if (!token) return;
      const resp = await fetch('/api/notifications/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const j = await resp.json();
        setHasResend(Boolean(j.hasResendApiKey));
        setFromEmail(j.fromEmail || 'Diamond Store <orders@diamondstore.ng>');
        setHasWaToken(Boolean(j.hasWhatsappToken));
        setWhatsappPhoneId(j.whatsappPhoneId || '');
      }
    })();
  }, [getBearerToken]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const token = await getBearerToken();
      const url = await uploadImageAsset(file, 'logo', token);
      setForm({ ...form, logoUrl: url });
      notify('Brand logo uploaded.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Logo upload failed.', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveStoreSettings(form);

      if (adminRole === 'super_admin') {
        const token = await getBearerToken();
        if (token) {
          await fetch('/api/notifications/config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              resendApiKey: resendKey.trim() || undefined,
              fromEmail,
              whatsappToken: whatsappToken.trim() || undefined,
              whatsappPhoneId,
            }),
          });
        }
      }
      setResendKey('');
      setWhatsappToken('');
      notify('Store settings updated.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Unable to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resolveMessage = async (msg: ContactMessageItem) => {
    await updateDoc(doc(db, 'contact_messages', msg.id), {
      status: msg.status === 'new' ? 'resolved' : 'new',
    }).catch(() => {});
  };

  return (
    <div className="space-y-10">
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#111111]">
              Store Settings &amp; Integrations
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Manage store profile, checkout behavior, policy pages, and email/WhatsApp dispatch providers.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#9E7C16] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>

        {/* Identity & Contact */}
        <div className="border border-neutral-200 bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9E7C16]">
            Brand &amp; Contact Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                Store Name
              </label>
              <input
                type="text"
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                Brand Tagline
              </label>
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                Business Email
              </label>
              <input
                type="email"
                value={form.businessEmail || ''}
                onChange={(e) => setForm({ ...form, businessEmail: e.target.value })}
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                WhatsApp Number (digits with country code)
              </label>
              <input
                type="text"
                value={form.whatsappNumber || ''}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                Logo Upload
              </label>
              <div className="flex items-center gap-3">
                <label className="px-3 py-2 border border-[#111111] text-xs font-semibold uppercase cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {form.logoUrl && (
                  <span className="text-xs font-mono text-neutral-500 truncate max-w-[160px]">
                    {form.logoUrl}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
              Flagship Address
            </label>
            <input
              type="text"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Commerce Rules */}
        <div className="border border-neutral-200 bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9E7C16]">
            Checkout &amp; Fulfillment Rules
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                Free Delivery Threshold (₦)
              </label>
              <input
                type="number"
                min={0}
                value={form.freeDeliveryThreshold ?? 150000}
                onChange={(e) =>
                  setForm({ ...form, freeDeliveryThreshold: Number(e.target.value) })
                }
                className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                VAT / Tax Rate (%)
              </label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={form.taxRatePercent ?? 0}
                onChange={(e) => setForm({ ...form, taxRatePercent: Number(e.target.value) })}
                className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div className="flex flex-col justify-center gap-2 pt-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.allowGuestCheckout ?? true}
                  onChange={(e) => setForm({ ...form, allowGuestCheckout: e.target.checked })}
                />
                Allow Guest Checkout
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.autoRestoreStockOnCancel ?? true}
                  onChange={(e) =>
                    setForm({ ...form, autoRestoreStockOnCancel: e.target.checked })
                  }
                />
                Auto-Restore Stock on Cancel/Refund
              </label>
            </div>
          </div>
        </div>

        {/* Email & WhatsApp Dispatch Config */}
        {adminRole === 'super_admin' && (
          <div className="border border-neutral-200 bg-white p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9E7C16]">
              Email (Resend) &amp; WhatsApp Cloud API Credentials
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                  Resend API Key ({hasResend ? 'Configured' : 'Not Set'})
                </label>
                <input
                  type="password"
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  placeholder="re_..."
                  className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                  Sender From Email
                </label>
                <input
                  type="text"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                  WhatsApp Cloud Token ({hasWaToken ? 'Configured' : 'Not Set'})
                </label>
                <input
                  type="password"
                  value={whatsappToken}
                  onChange={(e) => setWhatsappToken(e.target.value)}
                  placeholder="EAAG..."
                  className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                  WhatsApp Phone Number ID
                </label>
                <input
                  type="text"
                  value={whatsappPhoneId}
                  onChange={(e) => setWhatsappPhoneId(e.target.value)}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Storefront Policy Copy */}
        <div className="border border-neutral-200 bg-white p-6 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9E7C16]">
            Editorial &amp; Policy Content
          </h3>
          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
              About Us Editorial Copy
            </label>
            <textarea
              rows={3}
              value={form.aboutContent || ''}
              onChange={(e) => setForm({ ...form, aboutContent: e.target.value })}
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
              Shipping &amp; Returns Policy
            </label>
            <textarea
              rows={3}
              value={form.shippingPolicy || ''}
              onChange={(e) => setForm({ ...form, shippingPolicy: e.target.value })}
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </form>

      {/* Contact Messages Inbox */}
      <div className="border border-neutral-200 bg-white p-6 space-y-4">
        <h3 className="font-display text-xl font-semibold text-[#111111] flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#9E7C16]" /> Concierge Contact Inquiries ({messages.length})
        </h3>
        <div className="divide-y divide-neutral-100">
          {messages.map((m) => (
            <div key={m.id} className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-[#111111]">{m.name}</span>
                  <span className="text-neutral-500">· {m.email}</span>
                  {m.phone && <span className="text-neutral-500">· {m.phone}</span>}
                  <span className="font-mono uppercase text-[11px] text-[#9E7C16]">
                    [{m.status}]
                  </span>
                </div>
                <p className="text-sm font-medium text-[#111111]">{m.subject}</p>
                <p className="text-sm text-neutral-600">{m.message}</p>
              </div>
              <button
                type="button"
                onClick={() => resolveMessage(m)}
                className="px-3 py-1.5 border border-neutral-300 text-xs flex items-center gap-1 shrink-0 hover:border-[#111111]"
              >
                <Check className="w-3.5 h-3.5" />
                {m.status === 'new' ? 'Mark Resolved' : 'Reopen'}
              </button>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-xs text-neutral-500 py-4">No client contact messages yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
