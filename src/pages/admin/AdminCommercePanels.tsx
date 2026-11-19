import React, { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Printer, Search, Truck, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/firebase';
import { formatNaira, formatTimestamp } from '../../lib/format';
import { Coupon, Order, OrderStatus, PaymentStatus, ShippingZone, UserProfile } from '../../types/store';

const ORDER_STATUSES: OrderStatus[] = [
  'Pending Payment',
  'Payment Confirmed',
  'Processing',
  'Ready for Dispatch',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Refunded',
];

export function AdminOrdersPanel({ orders }: { orders: Order[] }) {
  const { updateOrderFulfillment, settings, notify } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [payFilter, setPayFilter] = useState('all');
  const [selected, setSelected] = useState<Order | null>(null);

  const [nextOrderStatus, setNextOrderStatus] = useState<OrderStatus>('Processing');
  const [nextPayStatus, setNextPayStatus] = useState<PaymentStatus>('paid');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [deliveryCompany, setDeliveryCompany] = useState('');
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [note, setNote] = useState('');

  const openOrder = (ord: Order) => {
    setSelected(ord);
    setNextOrderStatus(ord.orderStatus);
    setNextPayStatus(ord.paymentStatus);
    setTrackingNumber(ord.trackingNumber || '');
    setDeliveryCompany(ord.deliveryCompany || '');
    setRiderName(ord.riderName || '');
    setRiderPhone(ord.riderPhone || '');
    setEstimatedDate(ord.estimatedDeliveryDate || '');
    setNote('');
  };

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.orderStatus !== statusFilter) return false;
    if (payFilter !== 'all' && o.paymentStatus !== payFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${o.orderNumber} ${o.customerName} ${o.customerEmail}`.toLowerCase().includes(q);
  });

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    await updateOrderFulfillment(selected, {
      orderStatus: nextOrderStatus,
      paymentStatus: nextPayStatus,
      trackingNumber,
      deliveryCompany,
      riderName,
      riderPhone,
      estimatedDeliveryDate: estimatedDate,
      note: note || `Order updated to ${nextOrderStatus}`,
    });
    notify(`Order ${selected.orderNumber} updated.`, 'success');
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      <div className="no-print space-y-4">
        <h2 className="font-display text-2xl font-semibold text-[#111111]">Orders &amp; Dispatch Tracking</h2>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order # or customer..."
              className="w-full pl-9 pr-3 py-2 border border-neutral-300 text-sm bg-white"
            />
          </div>
          <select
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value)}
            className="border border-neutral-300 px-3 py-2 text-sm bg-white"
          >
            <option value="all">All Payment Statuses</option>
            <option value="pending">Pending</option>
            <option value="awaiting_verification">Awaiting Verification</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-neutral-300 px-3 py-2 text-sm bg-white"
          >
            <option value="all">All Fulfillment Statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border border-neutral-200 bg-white overflow-x-auto no-print">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F5F5F5] border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr>
              <th className="py-3 px-4">Order #</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Payment</th>
              <th className="py-3 px-4">Fulfillment</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-neutral-500">
                  No orders match the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((ord) => (
                <tr key={ord.id} className="hover:bg-neutral-50">
                  <td className="py-3 px-4 font-mono text-xs font-semibold">{ord.orderNumber}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#111111]">{ord.customerName}</div>
                    <div className="text-xs text-neutral-500">{ord.city}, {ord.state}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-medium">{ord.paymentMethod}</div>
                    <div className={ord.paymentStatus === 'paid' ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                      {ord.paymentStatus.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs font-medium">{ord.orderStatus}</td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold">
                    {formatNaira(ord.totalAmount, settings.currencySymbol)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => openOrder(ord)}
                      className="px-3 py-1.5 bg-[#111111] text-white text-xs"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Order Detail & Tracking Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
              <div>
                <p className="font-mono text-xs text-[#9E7C16]">{selected.orderNumber}</p>
                <h3 className="font-display text-2xl font-semibold text-[#111111]">
                  {selected.customerName}
                </h3>
                <p className="text-xs text-neutral-500">
                  {selected.customerEmail} · {selected.customerPhone} · Placed {formatTimestamp(selected.createdAt)}
                </p>
              </div>
              <div className="flex gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 border border-neutral-300 text-xs flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Invoice PDF
                </button>
                <button type="button" onClick={() => setSelected(null)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-[#F5F5F5] p-4">
              <div>
                <p className="text-xs uppercase text-neutral-500">Delivery Address</p>
                <p className="font-medium">
                  {selected.deliveryAddress}, {selected.city}, {selected.state}
                </p>
                {selected.deliveryInstructions && (
                  <p className="text-xs text-neutral-600 mt-1">Note: {selected.deliveryInstructions}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-500">Payment Details</p>
                <p className="font-medium">{selected.paymentMethod}</p>
                <p className="text-xs font-mono text-neutral-600">
                  Ref: {selected.paymentReference || 'Manual / COD'}
                </p>
                {selected.paymentProofUrl && (
                  <a
                    href={selected.paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#9E7C16] underline mt-1 inline-block"
                  >
                    View Uploaded Transfer Receipt
                  </a>
                )}
              </div>
            </div>

            <table className="w-full text-sm border-y border-neutral-200">
              <thead className="text-xs uppercase text-neutral-500 border-b border-neutral-200">
                <tr>
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {selected.items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="py-2">{i.name} ({i.size}, {i.color})</td>
                    <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{formatNaira(i.price * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <form onSubmit={handleSaveUpdate} className="space-y-4 border-t border-neutral-200 pt-4 no-print">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#9E7C16]" />
                <h4 className="text-sm font-semibold uppercase tracking-wider">Update Payment &amp; Fulfillment</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase text-neutral-600 mb-1">Payment Status</label>
                  <select
                    value={nextPayStatus}
                    onChange={(e) => setNextPayStatus(e.target.value as PaymentStatus)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="awaiting_verification">Awaiting Verification</option>
                    <option value="paid">Paid (Confirmed)</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase text-neutral-600 mb-1">Order Fulfillment Status</label>
                  <select
                    value={nextOrderStatus}
                    onChange={(e) => setNextOrderStatus(e.target.value as OrderStatus)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase text-neutral-600 mb-1">Courier Company</label>
                  <input
                    type="text"
                    value={deliveryCompany}
                    onChange={(e) => setDeliveryCompany(e.target.value)}
                    placeholder="GIG Logistics / DHL / Dispatch"
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-neutral-600 mb-1">Tracking Number</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-neutral-600 mb-1">Rider Name</label>
                  <input
                    type="text"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-neutral-600 mb-1">Estimated Delivery Date</label>
                  <input
                    type="date"
                    value={estimatedDate}
                    onChange={(e) => setEstimatedDate(e.target.value)}
                    className="w-full border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tracking update note for customer timeline..."
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setSelected(null)} className="px-4 py-2 border border-neutral-300 text-xs">
                  Close
                </button>
                <button type="submit" className="px-6 py-2 bg-[#111111] text-white text-xs font-semibold uppercase">
                  Save Tracking Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminCustomersPanel({ customers, orders }: { customers: UserProfile[]; orders: Order[] }) {
  const { notify } = useStore();
  const [search, setSearch] = useState('');

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${c.fullName} ${c.email} ${c.phone || ''}`.toLowerCase().includes(q);
  });

  const toggleStatus = async (c: UserProfile) => {
    const next = c.status === 'active' ? 'suspended' : 'active';
    await updateDoc(doc(db, 'users', c.uid), { status: next, updatedAt: serverTimestamp() });
    notify(`Customer account ${next}.`, 'info');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold text-[#111111]">Customer Directory</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email..."
          className="border border-neutral-300 px-3 py-2 text-sm bg-white w-64"
        />
      </div>

      <div className="border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F5F5F5] border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4">Default Location</th>
              <th className="py-3 px-4 text-right">Orders</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((c) => {
              const count = orders.filter((o) => o.userId === c.uid || o.customerEmail === c.email).length;
              return (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-medium">{c.fullName}</td>
                  <td className="py-3 px-4 text-xs">
                    <div>{c.email}</div>
                    <div className="text-neutral-500">{c.phone || '—'}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-neutral-600">
                    {c.defaultCity ? `${c.defaultCity}, ` : ''}{c.defaultState || '—'}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">{count}</td>
                  <td className="py-3 px-4 text-xs capitalize">{c.status}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => void toggleStatus(c)}
                      className="text-xs underline text-[#9E7C16]"
                    >
                      {c.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminShippingPanel() {
  const { shippingZones, saveShippingZone, deleteShippingZone, notify } = useStore();
  const [editing, setEditing] = useState<Partial<ShippingZone> | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#111111]">Delivery &amp; Shipping Zones</h2>
          <p className="text-xs text-neutral-500">Configure Nigerian states, delivery fees, free shipping thresholds, and couriers.</p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              state: '',
              cities: [],
              fee: 5000,
              freeDeliveryThreshold: 150000,
              estimatedDays: '2–4 Business Days',
              deliveryCompany: 'GIG Logistics',
              active: true,
            })
          }
          className="px-4 py-2 bg-[#111111] text-white text-xs uppercase tracking-wider"
        >
          Add Delivery Zone
        </button>
      </div>

      <div className="border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F5F5F5] border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr>
              <th className="py-3 px-4">State</th>
              <th className="py-3 px-4">Cities</th>
              <th className="py-3 px-4 text-right">Fee</th>
              <th className="py-3 px-4 text-right">Free Threshold</th>
              <th className="py-3 px-4">Courier</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {shippingZones.map((z) => (
              <tr key={z.id}>
                <td className="py-3 px-4 font-medium">{z.state}</td>
                <td className="py-3 px-4 text-xs text-neutral-600">{(z.cities || []).join(', ')}</td>
                <td className="py-3 px-4 text-right tabular-nums">{formatNaira(z.fee)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{formatNaira(z.freeDeliveryThreshold || 0)}</td>
                <td className="py-3 px-4 text-xs">{z.deliveryCompany} ({z.estimatedDays})</td>
                <td className="py-3 px-4 text-right space-x-2 text-xs">
                  <button type="button" onClick={() => setEditing(z)} className="text-[#9E7C16] underline">
                    Edit
                  </button>
                  <button type="button" onClick={() => void deleteShippingZone(z.id)} className="text-red-600 underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveShippingZone(editing);
              setEditing(null);
              notify('Delivery zone saved.', 'success');
            }}
            className="bg-white max-w-md w-full p-6 space-y-4"
          >
            <h3 className="font-display text-2xl font-semibold">Configure Delivery Zone</h3>
            <input
              type="text"
              required
              value={editing.state || ''}
              onChange={(e) => setEditing({ ...editing, state: e.target.value })}
              placeholder="Nigerian State (e.g. Lagos)"
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={(editing.cities || []).join(', ')}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  cities: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="Cities (comma-separated)"
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                required
                value={editing.fee ?? 0}
                onChange={(e) => setEditing({ ...editing, fee: Number(e.target.value) })}
                placeholder="Fee (₦)"
                className="border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={editing.freeDeliveryThreshold ?? 0}
                onChange={(e) => setEditing({ ...editing, freeDeliveryThreshold: Number(e.target.value) })}
                placeholder="Free Threshold (₦)"
                className="border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <input
              type="text"
              value={editing.deliveryCompany || ''}
              onChange={(e) => setEditing({ ...editing, deliveryCompany: e.target.value })}
              placeholder="Assigned Delivery Company"
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={editing.estimatedDays || ''}
              onChange={(e) => setEditing({ ...editing, estimatedDays: e.target.value })}
              placeholder="Estimated Days (e.g. 1–2 Business Days)"
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-neutral-300 text-xs">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 bg-[#111111] text-white text-xs uppercase">
                Save Zone
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminCouponsPanel() {
  const { coupons, saveCoupon, deleteCoupon, notify } = useStore();
  const [form, setForm] = useState<Partial<Coupon>>({
    code: '',
    discountType: 'percentage',
    discountValue: 10,
    minOrderValue: 50000,
    maxUses: 100,
    expiresAt: '2027-12-31',
    active: true,
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code) return;
    await saveCoupon(form);
    setForm({ ...form, code: '' });
    notify('Coupon created.', 'success');
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold text-[#111111]">Coupons &amp; Discounts</h2>
      <form onSubmit={handleAdd} className="border border-neutral-200 p-5 bg-white grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div>
          <label className="block text-xs uppercase text-neutral-600 mb-1">Code</label>
          <input
            type="text"
            required
            value={form.code || ''}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="LUXURY15"
            className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono uppercase"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-neutral-600 mb-1">Type</label>
          <select
            value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
            className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed (₦)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase text-neutral-600 mb-1">Value</label>
          <input
            type="number"
            required
            value={form.discountValue || 0}
            onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
            className="w-full border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-neutral-600 mb-1">Min Order (₦)</label>
          <input
            type="number"
            value={form.minOrderValue || 0}
            onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })}
            className="w-full border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-neutral-600 mb-1">Expiry</label>
          <input
            type="date"
            value={form.expiresAt || ''}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            className="w-full border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="py-2.5 px-4 bg-[#111111] text-white text-xs font-semibold uppercase">
          Create Coupon
        </button>
      </form>

      <div className="border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F5F5F5] border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr>
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Discount</th>
              <th className="py-3 px-4 text-right">Min Order</th>
              <th className="py-3 px-4 text-right">Usage</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="py-3 px-4 font-mono font-semibold">{c.code}</td>
                <td className="py-3 px-4">
                  {c.discountType === 'percentage' ? `${c.discountValue}%` : formatNaira(c.discountValue)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">{formatNaira(c.minOrderValue || 0)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{c.usedCount || 0} / {c.maxUses || '∞'}</td>
                <td className="py-3 px-4 text-xs">{c.active ? 'Active' : 'Inactive'}</td>
                <td className="py-3 px-4 text-right space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => void saveCoupon({ ...c, active: !c.active })}
                    className="text-[#9E7C16] underline"
                  >
                    {c.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteCoupon(c.id)}
                    className="text-red-600 underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
