import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Check, PackageCheck, Search, Truck } from 'lucide-react';
import { db } from '../../lib/firebase';
import { formatNaira, formatTimestamp, normalizePhone, sha256Hex } from '../../lib/format';
import { OrderStatus, TrackingEvent } from '../../types/store';

const TIMELINE_STEPS: OrderStatus[] = [
  'Pending Payment',
  'Payment Confirmed',
  'Processing',
  'Ready for Dispatch',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

const STEP_LABELS: Record<string, string> = {
  'Pending Payment': 'Order Placed',
  'Payment Confirmed': 'Payment Confirmed',
  Processing: 'Processing',
  'Ready for Dispatch': 'Ready for Dispatch',
  Shipped: 'Shipped',
  'Out for Delivery': 'Out for Delivery',
  Delivered: 'Delivered',
};

export function OrderTrackingPage() {
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order') || '');
  const [contactVerify, setContactVerify] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trackingRecord, setTrackingRecord] = useState<any | null>(null);

  useEffect(() => {
    const pre = searchParams.get('order');
    if (pre) setOrderNumber(pre);
  }, [searchParams]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTrackingRecord(null);
    const num = orderNumber.trim().toUpperCase();
    const contact = contactVerify.trim();
    if (!num || !contact) {
      setError('Enter both your Order Number and your registered Email or Phone number.');
      return;
    }

    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'order_tracking_public', num));
      if (!snap.exists()) {
        setError('No order found matching that Order Number.');
        return;
      }
      const data = snap.data();
      const inputEmailHash = await sha256Hex(contact);
      const inputPhoneHash = await sha256Hex(normalizePhone(contact));

      if (inputEmailHash !== data.emailHash && inputPhoneHash !== data.phoneHash) {
        setError('The email or phone number provided does not match this order.');
        return;
      }
      setTrackingRecord(data);
    } catch {
      setError('Unable to retrieve order tracking right now.');
    } finally {
      setLoading(false);
    }
  };

  const currentIdx = trackingRecord
    ? TIMELINE_STEPS.indexOf(trackingRecord.orderStatus as OrderStatus)
    : -1;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-2">Live Logistics</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111]">
          Track Your Order
        </h1>
        <p className="text-sm text-neutral-600 mt-2">
          Enter your Diamond Store Order Number along with the email address or phone number used at checkout.
        </p>
      </div>

      <form
        onSubmit={handleTrack}
        className="border border-neutral-200 p-6 bg-[#F5F5F5] grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-10"
      >
        <div className="md:col-span-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
            Order Number
          </label>
          <input
            type="text"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. DMD-261119-4821"
            className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm font-mono uppercase"
          />
        </div>
        <div className="md:col-span-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
            Email or Phone Number
          </label>
          <input
            type="text"
            required
            value={contactVerify}
            onChange={(e) => setContactVerify(e.target.value)}
            placeholder="you@example.com or +234..."
            className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-[#9E7C16] transition-colors"
          >
            <Search className="w-3.5 h-3.5" /> Track
          </button>
        </div>
      </form>

      {error && (
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800 mb-8">
          {error}
        </div>
      )}

      {trackingRecord && (
        <div className="border border-neutral-200 bg-white p-6 sm:p-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-6">
            <div>
              <p className="text-xs font-mono text-neutral-500">ORDER NUMBER</p>
              <h2 className="font-mono text-xl font-semibold text-[#111111]">
                {trackingRecord.orderNumber}
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Placed {formatTimestamp(trackingRecord.createdAt)} · Destination: {trackingRecord.maskedLocation}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Current Status</p>
              <p className="text-base font-semibold text-[#9E7C16]">{trackingRecord.orderStatus}</p>
              <p className="text-xs text-neutral-500 capitalize">
                Payment: {String(trackingRecord.paymentStatus).replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* 7-Step Visual Timeline */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.16em] font-semibold text-neutral-600 mb-5">
              Fulfillment Progress
            </h3>
            {trackingRecord.orderStatus === 'Cancelled' || trackingRecord.orderStatus === 'Refunded' ? (
              <div className="p-4 bg-red-50 border border-red-200 text-sm text-red-900">
                This order is marked as <strong>{trackingRecord.orderStatus}</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
                {TIMELINE_STEPS.map((step, idx) => {
                  const done = currentIdx >= idx;
                  const isCurrent = currentIdx === idx;
                  return (
                    <div
                      key={step}
                      className={`p-3 border text-left sm:text-center ${
                        isCurrent
                          ? 'border-[#D4AF37] bg-[#111111] text-white'
                          : done
                          ? 'border-[#111111] bg-[#F5F5F5] text-[#111111]'
                          : 'border-neutral-200 text-neutral-400'
                      }`}
                    >
                      <div className="flex sm:justify-center mb-1.5">
                        {done ? <Check className="w-4 h-4 text-[#D4AF37]" /> : <PackageCheck className="w-4 h-4" />}
                      </div>
                      <p className="text-[11px] font-medium leading-tight">{STEP_LABELS[step]}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Courier & Rider Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#F5F5F5] p-5 text-sm">
            <div>
              <p className="text-xs text-neutral-500">Courier Company</p>
              <p className="font-medium text-[#111111]">{trackingRecord.deliveryCompany || 'Pending assignment'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Tracking Number</p>
              <p className="font-mono font-medium text-[#111111]">{trackingRecord.trackingNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Estimated Delivery</p>
              <p className="font-medium text-[#111111]">{trackingRecord.estimatedDeliveryDate || '2–4 Business Days'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Dispatch Rider</p>
              <p className="font-medium text-[#111111]">{trackingRecord.riderName || 'Assigned upon dispatch'}</p>
            </div>
          </div>

          {/* Items & History */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] font-semibold text-neutral-600 mb-3">
                Items in Order
              </h3>
              <div className="divide-y divide-neutral-100 border border-neutral-200">
                {(trackingRecord.itemsSummary || []).map((item: any, idx: number) => (
                  <div key={idx} className="p-3 flex justify-between text-sm">
                    <div>
                      <p className="font-medium text-[#111111]">{item.name}</p>
                      <p className="text-xs text-neutral-500">
                        {item.size} · {item.color} · Qty {item.quantity}
                      </p>
                    </div>
                    <span className="tabular-nums font-medium">{formatNaira(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="p-3 flex justify-between text-sm font-semibold bg-[#F5F5F5]">
                  <span>Total</span>
                  <span className="tabular-nums">{formatNaira(trackingRecord.totalAmount || 0)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-[0.16em] font-semibold text-neutral-600 mb-3">
                Tracking Log
              </h3>
              <div className="space-y-3 border-l border-neutral-300 pl-4">
                {((trackingRecord.trackingHistory || []) as TrackingEvent[])
                  .slice()
                  .reverse()
                  .map((ev, idx) => (
                    <div key={idx} className="text-sm">
                      <div className="flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-[#9E7C16]" />
                        <span className="font-semibold text-[#111111]">{ev.status}</span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-0.5">{ev.note}</p>
                      <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
                        {formatTimestamp(ev.timestamp)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
