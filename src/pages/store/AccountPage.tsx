import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { LogOut, Package, Printer, User } from 'lucide-react';
import { ProductCard } from '../../components/store/ProductCard';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/firebase';
import { formatNaira, formatTimestamp } from '../../lib/format';
import { Order } from '../../types/store';

export function AccountPage() {
  const {
    isSignedIn,
    authReady,
    firebaseUser,
    customerProfile,
    activeName,
    activeEmail,
    updateCustomerProfile,
    logoutAll,
    getBearerToken,
  } = useAuth();
  const { shippingZones, settings, notify } = useStore();

  const [tab, setTab] = useState<'orders' | 'profile' | 'password'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultState, setDefaultState] = useState('Lagos');
  const [defaultCity, setDefaultCity] = useState('');
  const [defaultAddress, setDefaultAddress] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (activeName) setFullName(activeName);
    if (customerProfile) {
      setPhone(customerProfile.phone || '');
      setDefaultState(customerProfile.defaultState || 'Lagos');
      setDefaultCity(customerProfile.defaultCity || '');
      setDefaultAddress(customerProfile.defaultAddress || '');
    }
  }, [activeName, customerProfile]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, 'orders'), where('userId', '==', firebaseUser.uid));
    return onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
      },
      (err) => console.warn('My orders error:', err.message)
    );
  }, [firebaseUser]);

  if (authReady && !isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateCustomerProfile({ fullName, phone, defaultState, defaultCity, defaultAddress });
      notify('Profile and delivery address updated.', 'success');
    } catch {
      notify('Failed to update profile.', 'error');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = await getBearerToken();
      const resp = await fetch('/api/customer-auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error);
      setCurrentPassword('');
      setNewPassword('');
      notify('Password updated successfully.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Unable to change password.', 'error');
    }
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-6 mb-8 no-print">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16]">Client Account</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111]">
            Welcome, {activeName || 'Valued Client'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">{activeEmail}</p>
        </div>

        <button
          type="button"
          onClick={() => void logoutAll()}
          className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-xs uppercase tracking-wider hover:border-[#111111]"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
        <aside className="lg:col-span-3 space-y-1">
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`w-full text-left px-4 py-3 text-sm font-medium border ${
              tab === 'orders' ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white border-neutral-200'
            }`}
          >
            My Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`w-full text-left px-4 py-3 text-sm font-medium border ${
              tab === 'profile' ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white border-neutral-200'
            }`}
          >
            Profile &amp; Saved Address
          </button>
          <button
            type="button"
            onClick={() => setTab('password')}
            className={`w-full text-left px-4 py-3 text-sm font-medium border ${
              tab === 'password' ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white border-neutral-200'
            }`}
          >
            Security &amp; Password
          </button>
          <Link
            to="/wishlist"
            className="block w-full text-left px-4 py-3 text-sm font-medium border border-neutral-200 bg-white hover:bg-[#F5F5F5]"
          >
            Saved Wishlist
          </Link>
        </aside>

        <section className="lg:col-span-9">
          {tab === 'orders' && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="border border-neutral-200 p-10 text-center bg-[#F5F5F5]">
                  <Package className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
                  <p className="text-sm text-neutral-600 mb-4">You have not placed any orders yet.</p>
                  <Link
                    to="/shop"
                    className="inline-block px-6 py-2.5 bg-[#111111] text-white text-xs uppercase tracking-widest"
                  >
                    Explore Catalogue
                  </Link>
                </div>
              ) : (
                orders.map((ord) => (
                  <div key={ord.id} className="border border-neutral-200 p-5 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3 mb-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[#111111]">{ord.orderNumber}</p>
                        <p className="text-xs text-neutral-500">{formatTimestamp(ord.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="font-medium text-[#9E7C16]">{ord.orderStatus}</span>
                        <span className="tabular-nums font-semibold text-[#111111]">
                          {formatNaira(ord.totalAmount, settings.currencySymbol)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <span className="text-neutral-600">
                        {ord.items.length} item(s) · {ord.city}, {ord.state}
                      </span>
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/track-order?order=${encodeURIComponent(ord.orderNumber)}`}
                          className="text-[#111111] underline"
                        >
                          Track Order
                        </Link>
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(ord)}
                          className="text-[#9E7C16] underline"
                        >
                          View Invoice
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'profile' && (
            <form onSubmit={handleProfileSave} className="border border-neutral-200 p-6 bg-white space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-[#9E7C16]" />
                <h2 className="font-display text-2xl font-semibold text-[#111111]">
                  Profile &amp; Default Delivery Address
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Default State
                  </label>
                  <select
                    value={defaultState}
                    onChange={(e) => setDefaultState(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
                  >
                    {shippingZones.map((z) => (
                      <option key={z.id} value={z.state}>{z.state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={defaultCity}
                    onChange={(e) => setDefaultCity(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Delivery Street Address
                </label>
                <input
                  type="text"
                  value={defaultAddress}
                  onChange={(e) => setDefaultAddress(e.target.value)}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#111111] text-white text-xs uppercase tracking-widest"
              >
                Save Changes
              </button>
            </form>
          )}

          {tab === 'password' && (
            <form onSubmit={handlePasswordChange} className="border border-neutral-200 p-6 bg-white space-y-4 max-w-lg">
              <h2 className="font-display text-2xl font-semibold text-[#111111]">Change Password</h2>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#111111] text-white text-xs uppercase tracking-widest"
              >
                Update Password
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Printable Invoice Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-neutral-200 pb-4 mb-6">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#111111]">
                  {settings.storeName} INVOICE
                </h2>
                <p className="font-mono text-xs text-neutral-500 mt-1">{selectedOrder.orderNumber}</p>
              </div>
              <div className="flex gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-[#111111] text-white text-xs flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-3 py-1.5 border border-neutral-300 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="text-sm space-y-1 mb-6">
              <p><strong>Client:</strong> {selectedOrder.customerName}</p>
              <p><strong>Address:</strong> {selectedOrder.deliveryAddress}, {selectedOrder.city}, {selectedOrder.state}</p>
              <p><strong>Payment:</strong> {selectedOrder.paymentMethod} ({selectedOrder.paymentStatus})</p>
            </div>
            <table className="w-full text-sm border-y border-neutral-200 mb-4">
              <thead>
                <tr className="text-left text-xs uppercase text-neutral-500 border-b border-neutral-200">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {selectedOrder.items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="py-2">{i.name} ({i.size}, {i.color})</td>
                    <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{formatNaira(i.price * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right space-y-1 text-sm">
              <p>Delivery: {formatNaira(selectedOrder.deliveryFee)}</p>
              <p className="text-base font-semibold">Total: {formatNaira(selectedOrder.totalAmount)}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export function WishlistPage() {
  const { wishlist, publishedProducts } = useStore();
  const saved = publishedProducts.filter((p) => wishlist.includes(p.id));

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="border-b border-neutral-200 pb-6 mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16]">Saved Pieces</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111]">
          My Wishlist ({saved.length})
        </h1>
      </div>

      {saved.length === 0 ? (
        <div className="border border-neutral-200 p-14 text-center bg-[#F5F5F5]">
          <p className="text-sm text-neutral-600 mb-5">Your wishlist is currently empty.</p>
          <Link
            to="/shop"
            className="inline-block px-7 py-3 bg-[#111111] text-white text-xs uppercase tracking-widest"
          >
            Browse Collections
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {saved.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}
