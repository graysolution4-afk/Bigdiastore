import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatNaira } from '../../lib/format';

export function CartPage() {
  const {
    cart,
    updateCartItem,
    removeFromCart,
    appliedCoupon,
    applyCouponCode,
    removeCoupon,
    settings,
    notify,
  } = useStore();
  const [couponInput, setCouponInput] = useState('');

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discount = appliedCoupon
    ? appliedCoupon.discountType === 'percentage'
      ? Math.round((subtotal * appliedCoupon.discountValue) / 100)
      : Math.min(subtotal, appliedCoupon.discountValue)
    : 0;
  const total = Math.max(0, subtotal - discount);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await applyCouponCode(couponInput, subtotal);
    notify(res.message, res.ok ? 'success' : 'error');
    if (res.ok) setCouponInput('');
  };

  if (cart.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-24 text-center">
        <ShoppingBag className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <h1 className="font-display text-3xl font-semibold text-[#111111] mb-2">Your Shopping Bag is Empty</h1>
        <p className="text-sm text-neutral-600 mb-8">
          Explore our curated Nigerian luxury menswear, footwear, and accessories.
        </p>
        <Link
          to="/shop"
          className="inline-block px-8 py-3.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-widest"
        >
          Shop Now
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111] mb-8">
        Shopping Bag
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Items */}
        <div className="lg:col-span-8 divide-y divide-neutral-200 border-y border-neutral-200">
          {cart.map((item, idx) => (
            <div key={`${item.productId}-${item.size}-${item.color}-${idx}`} className="py-6 flex flex-col sm:flex-row gap-5">
              <Link to={`/product/${item.slug}`} className="w-28 h-28 bg-[#F5F5F5] shrink-0 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </Link>

              <div className="flex-1 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      to={`/product/${item.slug}`}
                      className="text-base font-semibold text-[#111111] hover:text-[#9E7C16]"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs font-mono text-neutral-500 mt-0.5">SKU: {item.sku}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(idx)}
                    className="text-xs text-neutral-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {item.availableSizes && item.availableSizes.length > 0 && (
                    <label className="text-xs text-neutral-600 flex items-center gap-1.5">
                      Size:
                      <select
                        value={item.size}
                        onChange={(e) => updateCartItem(idx, { size: e.target.value })}
                        className="border border-neutral-300 px-2 py-1 text-xs bg-white"
                      >
                        {item.availableSizes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {item.availableColors && item.availableColors.length > 0 && (
                    <label className="text-xs text-neutral-600 flex items-center gap-1.5">
                      Colour:
                      <select
                        value={item.color}
                        onChange={(e) => updateCartItem(idx, { color: e.target.value })}
                        className="border border-neutral-300 px-2 py-1 text-xs bg-white"
                      >
                        {item.availableColors.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center border border-neutral-300">
                    <button
                      type="button"
                      onClick={() =>
                        item.quantity > 1
                          ? updateCartItem(idx, { quantity: item.quantity - 1 })
                          : removeFromCart(idx)
                      }
                      className="p-2 text-neutral-600 hover:text-[#111111]"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-sm font-mono tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        item.quantity < item.maxStock &&
                        updateCartItem(idx, { quantity: item.quantity + 1 })
                      }
                      className="p-2 text-neutral-600 hover:text-[#111111]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-semibold tabular-nums text-[#111111]">
                      {formatNaira(item.price * item.quantity, settings.currencySymbol)}
                    </div>
                    <div className="text-xs text-neutral-500 tabular-nums">
                      {formatNaira(item.price, settings.currencySymbol)} each
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <aside className="lg:col-span-4 border border-neutral-200 p-6 bg-[#F5F5F5] h-fit space-y-5">
          <h2 className="font-display text-2xl font-semibold text-[#111111]">Order Summary</h2>

          <form onSubmit={handleApplyCoupon} className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Coupon code (e.g. DIAMOND10)"
              className="flex-1 bg-white border border-neutral-300 px-3 py-2 text-xs uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#111111] text-white text-xs uppercase tracking-wider whitespace-nowrap shrink-0"
            >
              Apply
            </button>
          </form>

          {appliedCoupon && (
            <div className="flex items-center justify-between text-xs bg-white border border-[#D4AF37] px-3 py-2">
              <span>
                Coupon <strong>{appliedCoupon.code}</strong> active
              </span>
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
            <div className="flex justify-between text-xs text-neutral-500">
              <span>Delivery</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-neutral-300 text-base font-semibold text-[#111111]">
              <span>Estimated Total</span>
              <span className="tabular-nums">{formatNaira(total, settings.currencySymbol)}</span>
            </div>
          </div>

          <Link
            to="/checkout"
            className="block w-full py-3.5 text-center bg-[#111111] text-white text-xs font-semibold uppercase tracking-[0.16em] hover:bg-[#9E7C16] transition-colors"
          >
            Proceed to Checkout
          </Link>
        </aside>
      </div>
    </main>
  );
}
