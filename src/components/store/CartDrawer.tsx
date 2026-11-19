import React from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatNaira } from '../../lib/format';

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, updateCartItem, removeFromCart, settings } = useStore();

  if (!cartOpen) return null;

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const freeThreshold = settings.freeDeliveryThreshold || 150000;
  const remainingForFree = Math.max(0, freeThreshold - subtotal);

  return (
    <div className="fixed inset-0 z-50 flex justify-end no-print">
      <div className="fixed inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
      <aside className="relative z-10 w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#111111]" />
            <h2 className="font-display text-xl font-semibold text-[#111111]">Shopping Bag</h2>
            <span className="text-xs font-mono tabular-nums text-neutral-500">({cart.reduce((s, i) => s + i.quantity, 0)})</span>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="Close bag"
            className="p-2 text-neutral-500 hover:text-[#111111]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Delivery Progress */}
        {cart.length > 0 && (
          <div className="px-6 py-2.5 bg-[#F5F5F5] border-b border-neutral-200 text-xs text-neutral-700">
            {remainingForFree > 0 ? (
              <span>
                Add <strong className="tabular-nums text-[#111111]">{formatNaira(remainingForFree, settings.currencySymbol)}</strong> more for complimentary delivery.
              </span>
            ) : (
              <span className="text-[#9E7C16] font-medium">
                Your order qualifies for complimentary standard delivery.
              </span>
            )}
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-neutral-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="w-10 h-10 text-neutral-300 mb-3" />
              <p className="font-display text-lg text-[#111111] mb-1">Your bag is empty</p>
              <p className="text-sm text-neutral-500 mb-6">
                Explore our tailored garments, footwear, and timepieces.
              </p>
              <Link
                to="/shop"
                onClick={() => setCartOpen(false)}
                className="px-6 py-2.5 bg-[#111111] text-white text-xs uppercase tracking-widest hover:bg-[#222222]"
              >
                Explore Collection
              </Link>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={`${item.productId}-${item.size}-${item.color}`} className="py-4 flex gap-4">
                <Link
                  to={`/product/${item.slug}`}
                  onClick={() => setCartOpen(false)}
                  className="w-20 h-20 bg-[#F5F5F5] shrink-0 overflow-hidden"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/product/${item.slug}`}
                      onClick={() => setCartOpen(false)}
                      className="text-sm font-medium text-[#111111] hover:text-[#9E7C16] line-clamp-1"
                    >
                      {item.name}
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeFromCart(idx)}
                      aria-label="Remove item"
                      className="text-neutral-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {item.size} · {item.color}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center border border-neutral-300">
                      <button
                        type="button"
                        onClick={() =>
                          item.quantity > 1
                            ? updateCartItem(idx, { quantity: item.quantity - 1 })
                            : removeFromCart(idx)
                        }
                        className="p-1.5 text-neutral-600 hover:text-[#111111]"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2.5 text-xs font-mono tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          item.quantity < item.maxStock &&
                          updateCartItem(idx, { quantity: item.quantity + 1 })
                        }
                        className="p-1.5 text-neutral-600 hover:text-[#111111]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-[#111111]">
                      {formatNaira(item.price * item.quantity, settings.currencySymbol)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-neutral-200 bg-white space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">Subtotal</span>
              <span className="text-base font-semibold tabular-nums text-[#111111]">
                {formatNaira(subtotal, settings.currencySymbol)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Link
                to="/cart"
                onClick={() => setCartOpen(false)}
                className="py-3 text-center border border-[#111111] text-[#111111] text-xs font-semibold uppercase tracking-wider hover:bg-neutral-50"
              >
                View Bag
              </Link>
              <Link
                to="/checkout"
                onClick={() => setCartOpen(false)}
                className="py-3 text-center bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#222222]"
              >
                Checkout
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
