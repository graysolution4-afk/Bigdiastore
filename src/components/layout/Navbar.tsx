import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: "Men's Clothing", to: '/mens-clothing' },
  { label: 'Shoes', to: '/shoes' },
  { label: 'Accessories', to: '/accessories' },
  { label: 'New Arrivals', to: '/new-arrivals' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

export function Navbar() {
  const { cart, wishlist, setCartOpen, settings } = useStore();
  const { isSignedIn, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setSearchOpen(false);
    navigate(`/shop?q=${encodeURIComponent(searchTerm.trim())}`);
    setSearchTerm('');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-neutral-200 no-print">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-6">
          {/* Mobile menu toggle + Brand wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-[#111111] hover:text-[#9E7C16] transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              to="/"
              className="font-display text-xl sm:text-2xl font-semibold tracking-[0.16em] text-[#111111] whitespace-nowrap shrink-0"
            >
              {settings.storeName || 'DIAMOND STORE'}
            </Link>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-[13px] font-medium tracking-wide text-[#222222]">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap shrink-0 py-1 border-b transition-colors ${
                    isActive
                      ? 'border-[#D4AF37] text-[#111111]'
                      : 'border-transparent text-neutral-600 hover:text-[#111111] hover:border-neutral-300'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right Functional Action Icons */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search products"
              className="p-2 text-[#111111] hover:text-[#9E7C16] transition-colors"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            <Link
              to={isAdmin ? '/admin' : isSignedIn ? '/account' : '/login'}
              aria-label="Customer account"
              className="p-2 text-[#111111] hover:text-[#9E7C16] transition-colors"
            >
              <User className="w-[18px] h-[18px]" />
            </Link>

            <Link
              to="/wishlist"
              aria-label="Wishlist"
              className="relative p-2 text-[#111111] hover:text-[#9E7C16] transition-colors"
            >
              <Heart className="w-[18px] h-[18px]" />
              {wishlist.length > 0 && (
                <span className="absolute top-1 right-0.5 text-[10px] font-mono tabular-nums font-semibold text-[#9E7C16]">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label="Shopping bag"
              className="relative p-2 text-[#111111] hover:text-[#9E7C16] transition-colors flex items-center gap-1.5"
            >
              <ShoppingBag className="w-[18px] h-[18px]" />
              <span className="text-xs font-mono tabular-nums font-medium">{cartCount}</span>
            </button>
          </div>
        </div>

        {/* Inline Expandable Search Bar */}
        {searchOpen && (
          <div className="border-t border-neutral-200 bg-[#F5F5F5]">
            <form
              onSubmit={handleSearchSubmit}
              className="max-w-[900px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3"
            >
              <Search className="w-4 h-4 text-neutral-500 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search kaftans, blazers, sneakers, wristwatches, SKUs..."
                autoFocus
                className="w-full bg-transparent text-sm text-[#111111] placeholder:text-neutral-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#111111] text-white text-xs uppercase tracking-wider whitespace-nowrap shrink-0 hover:bg-[#222222]"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="p-1.5 text-neutral-500 hover:text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] bg-white h-full flex flex-col justify-between p-6 overflow-y-auto z-10">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
                <span className="font-display text-lg font-semibold tracking-[0.16em] text-[#111111]">
                  {settings.storeName}
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 text-neutral-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="mt-6 flex flex-col space-y-1">
                {NAV_LINKS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="py-2.5 text-sm font-medium text-[#222222] border-b border-neutral-100 hover:text-[#9E7C16]"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/track-order"
                  onClick={() => setMobileOpen(false)}
                  className="py-2.5 text-sm font-medium text-[#222222] border-b border-neutral-100 hover:text-[#9E7C16]"
                >
                  Track Order
                </Link>
                <Link
                  to="/best-sellers"
                  onClick={() => setMobileOpen(false)}
                  className="py-2.5 text-sm font-medium text-[#222222] border-b border-neutral-100 hover:text-[#9E7C16]"
                >
                  Best Sellers
                </Link>
              </nav>
            </div>

            <div className="pt-6 border-t border-neutral-200 space-y-3">
              <Link
                to={isSignedIn ? '/account' : '/login'}
                onClick={() => setMobileOpen(false)}
                className="block w-full py-2.5 text-center bg-[#111111] text-white text-xs uppercase tracking-widest"
              >
                {isSignedIn ? 'My Account' : 'Sign In / Register'}
              </Link>
              <Link
                to="/admin/login"
                onClick={() => setMobileOpen(false)}
                className="block w-full py-2 text-center border border-neutral-300 text-xs uppercase tracking-widest text-neutral-700"
              >
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
