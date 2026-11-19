import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CreditCard, Lock, ShieldCheck, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { formatNaira } from '../../lib/format';
import { uploadImageAsset } from '../../lib/upload';
import { Order, PaymentProviderId } from '../../types/store';

export function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const {
    cart,
    appliedCoupon,
    applyCouponCode,
    removeCoupon,
    shippingZones,
    activePaymentGateways,
    settings,
    placeOrder,
    markOrderPaymentVerified,
    clearCart,
    notify,
  } = useStore();
  const { isSignedIn, customerProfile, activeEmail, activeName } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedState, setSelectedState] = useState('Lagos');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [instructions, setInstructions] = useState('');

  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderId | ''>('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [verificationState, setVerificationState] = useState<string>('');

  // Pre-fill profile details
  useEffect(() => {
    if (activeName && !fullName) setFullName(activeName);
    if (activeEmail && !email) setEmail(activeEmail);
    if (customerProfile?.phone && !phone) setPhone(customerProfile.phone);
    if (customerProfile?.defaultState) setSelectedState(customerProfile.defaultState);
    if (customerProfile?.defaultCity && !city) setCity(customerProfile.defaultCity);
    if (customerProfile?.defaultAddress && !address) setAddress(customerProfile.defaultAddress);
  }, [activeName, activeEmail, customerProfile]);

  // Select default active gateway dynamically
  useEffect(() => {
    if (activePaymentGateways.length === 0) {
      setSelectedProvider('');
      return;
    }
    const stillValid = activePaymentGateways.some((g) => g.provider === selectedProvider);
    if (!stillValid) {
      const def = activePaymentGateways.find((g) => g.isDefault) || activePaymentGateways[0];
      setSelectedProvider(def.provider);
    }
  }, [activePaymentGateways, selectedProvider]);

  // Verify gateway callback redirect (?verify=1&orderId=...&orderNumber=...&provider=...&reference=...)
  useEffect(() => {
    const verifyFlag = searchParams.get('verify');
    const orderId = searchParams.get('orderId');
    const orderNumber = searchParams.get('orderNumber');
    const provider = searchParams.get('provider') as PaymentProviderId | null;
    const reference =
      searchParams.get('reference') ||
      searchParams.get('tx_ref') ||
      searchParams.get('session_id') ||
      '';
    const expectedAmount = Number(searchParams.get('amount') || 0);

    if (verifyFlag === '1' && orderId && orderNumber && provider && reference) {
      setVerificationState('Verifying payment directly with payment provider...');
      void (async () => {
        try {
          const resp = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider,
              reference,
              expectedAmountNgn: expectedAmount,
              orderNumber,
            }),
          });
          const json = await resp.json();
          if (json?.verified) {
            await markOrderPaymentVerified(orderId, orderNumber, reference, provider, json.paidAmountNgn || expectedAmount);
            clearCart();
            setVerificationState(`Payment verified for Order ${orderNumber} (Ref: ${reference}).`);
            notify('Payment verified and order confirmed.', 'success');
          } else {
            setVerificationState(`Payment verification failed: ${json?.message || 'Not confirmed by provider.'}`);
            notify('Payment could not be verified.', 'error');
          }
        } catch {
          setVerificationState('Unable to verify payment right now. Please contact concierge.');
        }
      })();
    }
  }, [searchParams]);

  const activeZones = useMemo(() => shippingZones.filter((z) => z.active), [shippingZones]);
  const currentZone = useMemo(
    () => activeZones.find((z) => z.state === selectedState) || activeZones[0],
    [activeZones, selectedState]
  );

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discount = appliedCoupon
    ? appliedCoupon.discountType === 'percentage'
      ? Math.round((subtotal * appliedCoupon.discountValue) / 100)
      : Math.min(subtotal, appliedCoupon.discountValue)
    : 0;
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round((taxable * (settings.taxRatePercent || 0)) / 100);

  const freeThreshold =
    (currentZone?.freeDeliveryThreshold && currentZone.freeDeliveryThreshold > 0
      ? currentZone.freeDeliveryThreshold
      : settings.freeDeliveryThreshold) || 150000;
  const deliveryFee = currentZone ? (subtotal >= freeThreshold ? 0 : currentZone.fee) : 0;

  const selectedGateway = activePaymentGateways.find((g) => g.provider === selectedProvider);
  const isCodEligible =
    selectedGateway?.provider === 'cod'
      ? !selectedGateway.codEligibleStates?.length ||
        selectedGateway.codEligibleStates.includes(selectedState)
      : true;
  const codExtraFee =
    selectedGateway?.provider === 'cod' && isCodEligible ? selectedGateway.codExtraFee || 0 : 0;

  const grandTotal = Math.max(0, taxable + taxAmount + deliveryFee + codExtraFee);

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const url = await uploadImageAsset(file, 'payment_proof');
      setProofUrl(url);
      notify('Payment receipt uploaded.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Failed to upload receipt.', 'error');
    } finally {
      setUploadingProof(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settings.allowGuestCheckout === false && !isSignedIn) {
      notify('Please sign in to complete your checkout.', 'error');
      return;
    }
    if (!selectedGateway) {
      notify('No active payment gateway is available. Please contact store support.', 'error');
      return;
    }
    if (selectedGateway.provider === 'cod' && !isCodEligible) {
      notify(`Cash on Delivery is not available in ${selectedState}.`, 'error');
      return;
    }
    if (!fullName.trim() || !email.trim() || !phone.trim() || !city.trim() || !address.trim()) {
      notify('Please complete all required delivery details.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const order = await placeOrder({
        customerName: fullName,
        customerEmail: email,
        customerPhone: phone,
        state: selectedState,
        city,
        deliveryAddress: address,
        deliveryInstructions: instructions,
        paymentProvider: selectedGateway.provider,
        paymentMethod: selectedGateway.displayName,
        paymentProofUrl: proofUrl,
        deliveryFee,
        codExtraFee,
      });

      // Online payment gateways (Paystack, Flutterwave, Stripe) initialize real server checkout
      if (['paystack', 'flutterwave', 'stripe'].includes(selectedGateway.provider)) {
        const callbackUrl = `${window.location.origin}/checkout?verify=1&orderId=${encodeURIComponent(
          order.id
        )}&orderNumber=${encodeURIComponent(order.orderNumber)}&provider=${
          selectedGateway.provider
        }&amount=${grandTotal}`;

        const resp = await fetch('/api/payments/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selectedGateway.provider,
            email,
            name: fullName,
            amountNgn: grandTotal,
            orderNumber: order.orderNumber,
            callbackUrl,
          }),
        });
        const initJson = await resp.json();
        if (!resp.ok || !initJson?.authorizationUrl) {
          setCompletedOrder(order);
          clearCart();
          notify(
            initJson?.error ||
              'Order saved as Pending Payment. Gateway API keys must be configured in Admin → Payment Gateways to launch live checkout.',
            'info'
          );
          return;
        }
        window.location.href = initJson.authorizationUrl;
        return;
      }

      clearCart();
      setCompletedOrder(order);
      notify(`Order ${order.orderNumber} placed successfully.`, 'success');
    } catch (err: any) {
      notify(err?.message || 'Unable to place order.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (verificationState) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <CheckCircle2 className="w-12 h-12 text-[#9E7C16] mx-auto mb-4" />
        <h1 className="font-display text-3xl font-semibold text-[#111111] mb-3">
          Payment Verification Status
        </h1>
        <p className="text-sm text-neutral-700 mb-8">{verificationState}</p>
        <div className="flex justify-center gap-4">
          <Link
            to="/track-order"
            className="px-6 py-3 bg-[#111111] text-white text-xs uppercase tracking-widest"
          >
            Track Your Order
          </Link>
          <Link
            to="/shop"
            className="px-6 py-3 border border-neutral-300 text-xs uppercase tracking-widest"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  if (completedOrder) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="border border-neutral-200 p-8 sm:p-10 bg-white">
          <CheckCircle2 className="w-10 h-10 text-[#9E7C16] mb-4" />
          <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-1">Order Recorded</p>
          <h1 className="font-display text-3xl font-semibold text-[#111111] mb-2">
            Thank You, {completedOrder.customerName}
          </h1>
          <p className="text-sm text-neutral-600 mb-6">
            Your order number is{' '}
            <strong className="font-mono text-[#111111]">{completedOrder.orderNumber}</strong>.
          </p>

          <div className="bg-[#F5F5F5] p-5 text-sm space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="text-neutral-600">Payment Method</span>
              <span className="font-medium">{completedOrder.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Payment Status</span>
              <span className="font-medium capitalize">{completedOrder.paymentStatus.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Total Amount</span>
              <span className="font-semibold tabular-nums">
                {formatNaira(completedOrder.totalAmount, settings.currencySymbol)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to={`/track-order?order=${encodeURIComponent(completedOrder.orderNumber)}`}
              className="px-6 py-3 bg-[#111111] text-white text-xs uppercase tracking-widest"
            >
              Track Order Status
            </Link>
            <Link
              to="/shop"
              className="px-6 py-3 border border-neutral-300 text-xs uppercase tracking-widest"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold text-[#111111] mb-3">
          Your bag is empty
        </h1>
        <p className="text-sm text-neutral-600 mb-6">Add items before proceeding to checkout.</p>
        <Link
          to="/shop"
          className="inline-block px-7 py-3 bg-[#111111] text-white text-xs uppercase tracking-widest"
        >
          Return to Shop
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-5 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16]">Secure Checkout</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111]">
            Delivery &amp; Payment
          </h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Lock className="w-3.5 h-3.5 text-[#9E7C16]" />
          <span>Encrypted Transaction</span>
        </div>
      </div>

      {settings.allowGuestCheckout === false && !isSignedIn && (
        <div className="mb-8 border border-[#D4AF37] bg-[#F5F5F5] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-[#111111]">
            An account is required to place orders. Please sign in or create an account to continue.
          </p>
          <Link
            to="/login"
            className="px-5 py-2.5 bg-[#111111] text-white text-xs uppercase tracking-widest whitespace-nowrap"
          >
            Sign In / Register
          </Link>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Shipping & Payment */}
        <div className="lg:col-span-7 space-y-8">
          {/* Shipping Details */}
          <section className="border border-neutral-200 p-6 sm:p-8 bg-white space-y-5">
            <h2 className="font-display text-2xl font-semibold text-[#111111]">
              1. Delivery Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  State *
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full border border-neutral-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#111111]"
                >
                  {activeZones.map((z) => (
                    <option key={z.id} value={z.state}>
                      {z.state} — {formatNaira(z.fee, settings.currencySymbol)} ({z.estimatedDays})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  City / Area *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={currentZone?.cities?.[0] || 'Victoria Island'}
                  className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Street Delivery Address *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House number, street, estate"
                  className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                Additional Delivery Instructions (Optional)
              </label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Estate gate code, landmark, preferred call time..."
                className="w-full border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
          </section>

          {/* Dynamic Payment Methods */}
          <section className="border border-neutral-200 p-6 sm:p-8 bg-white space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-[#111111]">
                2. Payment Method
              </h2>
              <CreditCard className="w-5 h-5 text-[#9E7C16]" />
            </div>

            {activePaymentGateways.length === 0 ? (
              <div className="p-4 bg-red-50 border border-red-200 text-sm text-red-800">
                No payment gateways are currently active. Please contact the store administrator.
              </div>
            ) : (
              <div className="space-y-3">
                {activePaymentGateways.map((gw) => {
                  const isSelected = selectedProvider === gw.provider;
                  const codBlocked =
                    gw.provider === 'cod' &&
                    gw.codEligibleStates &&
                    gw.codEligibleStates.length > 0 &&
                    !gw.codEligibleStates.includes(selectedState);

                  return (
                    <div
                      key={gw.id}
                      className={`border transition-colors ${
                        isSelected ? 'border-[#111111] bg-[#F5F5F5]/60' : 'border-neutral-200'
                      }`}
                    >
                      <label className="flex items-center justify-between p-4 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={isSelected}
                            disabled={codBlocked}
                            onChange={() => setSelectedProvider(gw.provider)}
                            className="accent-[#111111]"
                          />
                          <div>
                            <div className="text-sm font-semibold text-[#111111]">
                              {gw.displayName}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {gw.provider === 'bank_transfer'
                                ? 'Direct bank transfer with receipt verification'
                                : gw.provider === 'cod'
                                ? codBlocked
                                  ? `Available only in: ${gw.codEligibleStates?.join(', ')}`
                                  : `Pay upon delivery${gw.codExtraFee ? ` (+${formatNaira(gw.codExtraFee)})` : ''}`
                                : `Secure ${gw.mode} checkout`}
                            </div>
                          </div>
                        </div>
                        <ShieldCheck className="w-4 h-4 text-[#9E7C16] shrink-0" />
                      </label>

                      {/* Bank Transfer Configured Details */}
                      {isSelected && gw.provider === 'bank_transfer' && (
                        <div className="px-4 pb-4 pt-2 border-t border-neutral-200 space-y-3 text-sm">
                          <div className="bg-white border border-neutral-200 p-4 space-y-1.5">
                            <p className="text-xs uppercase tracking-wider text-neutral-500">Bank Account Details</p>
                            <p><strong>Bank:</strong> {gw.bankName || 'Not configured'}</p>
                            <p><strong>Account Name:</strong> {gw.accountName || 'Not configured'}</p>
                            <p className="font-mono text-base"><strong>Account Number:</strong> {gw.accountNumber || 'Not configured'}</p>
                            {gw.paymentInstructions && (
                              <p className="text-xs text-neutral-600 pt-1">{gw.paymentInstructions}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                              Upload Payment Receipt (Optional)
                            </label>
                            <label className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 bg-white text-xs cursor-pointer hover:border-[#111111]">
                              <Upload className="w-3.5 h-3.5" />
                              <span>{uploadingProof ? 'Uploading...' : proofUrl ? 'Receipt Uploaded' : 'Choose Image'}</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleProofUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right: Order Summary */}
        <aside className="lg:col-span-5 border border-neutral-200 p-6 sm:p-8 bg-[#F5F5F5] h-fit space-y-6 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl font-semibold text-[#111111]">Order Summary</h2>

          <div className="divide-y divide-neutral-200 max-h-72 overflow-y-auto pr-1">
            {cart.map((item, idx) => (
              <div key={idx} className="py-3 flex gap-3 items-center">
                <img
                  src={item.image}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 object-cover bg-white shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111111] truncate">{item.name}</p>
                  <p className="text-xs text-neutral-500">
                    {item.size} · {item.color} · Qty {item.quantity}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[#111111]">
                  {formatNaira(item.price * item.quantity, settings.currencySymbol)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Coupon code"
              className="flex-1 bg-white border border-neutral-300 px-3 py-2 text-xs uppercase"
            />
            <button
              type="button"
              onClick={async () => {
                const res = await applyCouponCode(couponInput, subtotal);
                notify(res.message, res.ok ? 'success' : 'error');
              }}
              className="px-4 py-2 bg-[#111111] text-white text-xs uppercase tracking-wider"
            >
              Apply
            </button>
          </div>
          {appliedCoupon && (
            <div className="flex justify-between text-xs bg-white border border-[#D4AF37] px-3 py-2">
              <span>Coupon {appliedCoupon.code} applied</span>
              <button type="button" onClick={removeCoupon} className="text-red-700 underline">
                Remove
              </button>
            </div>
          )}

          <div className="space-y-2.5 text-sm border-t border-neutral-200 pt-4">
            <div className="flex justify-between">
              <span className="text-neutral-600">Subtotal</span>
              <span className="tabular-nums font-medium">{formatNaira(subtotal, settings.currencySymbol)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-800">
                <span>Discount</span>
                <span className="tabular-nums">-{formatNaira(discount, settings.currencySymbol)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-600">Delivery ({selectedState})</span>
              <span className="tabular-nums font-medium">
                {deliveryFee === 0 ? 'Complimentary' : formatNaira(deliveryFee, settings.currencySymbol)}
              </span>
            </div>
            {codExtraFee > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-600">Cash on Delivery Fee</span>
                <span className="tabular-nums font-medium">{formatNaira(codExtraFee, settings.currencySymbol)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-600">Tax ({settings.taxRatePercent}%)</span>
                <span className="tabular-nums font-medium">{formatNaira(taxAmount, settings.currencySymbol)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-neutral-300 text-lg font-semibold text-[#111111]">
              <span>Total</span>
              <span className="tabular-nums">{formatNaira(grandTotal, settings.currencySymbol)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || activePaymentGateways.length === 0}
            className="w-full py-4 bg-[#111111] text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-[#9E7C16] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Processing Order...' : `Complete Order · ${formatNaira(grandTotal, settings.currencySymbol)}`}
          </button>
        </aside>
      </form>
    </main>
  );
}
