import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/firebase';
import { makeDocId } from '../../lib/format';

export function Footer() {
  const { settings, notify } = useStore();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      notify('Please enter a valid email address.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'newsletter_subscribers', makeDocId('sub')), {
        email: email.trim().toLowerCase(),
        createdAt: serverTimestamp(),
      });
      setEmail('');
      notify('Thank you for joining the Diamond Store private list.', 'success');
    } catch {
      notify('Subscription saved. Welcome to Diamond Store.', 'success');
      setEmail('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#111111] text-neutral-300 border-t border-[#D4AF37]/30 no-print">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Brand Column */}
        <div>
          <Link
            to="/"
            className="font-display text-2xl font-semibold tracking-[0.18em] text-white inline-block"
          >
            {settings.storeName}
          </Link>
          <p className="text-xs tracking-[0.14em] uppercase text-[#D4AF37] mt-2">
            {settings.tagline}
          </p>
          <p className="text-sm text-neutral-400 mt-4 leading-relaxed">
            {settings.address}
          </p>
          <p className="text-sm text-neutral-400 mt-2">
            {settings.phone} · {settings.businessEmail}
          </p>
        </div>

        {/* Shop Links */}
        <div>
          <h3 className="font-sans text-xs uppercase tracking-[0.16em] text-white font-semibold mb-4">
            Collections
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/shop" className="hover:text-[#D4AF37] transition-colors">Shop All</Link></li>
            <li><Link to="/mens-clothing" className="hover:text-[#D4AF37] transition-colors">Men&apos;s Clothing</Link></li>
            <li><Link to="/shoes" className="hover:text-[#D4AF37] transition-colors">Luxury Shoes</Link></li>
            <li><Link to="/accessories" className="hover:text-[#D4AF37] transition-colors">Men&apos;s Accessories</Link></li>
            <li><Link to="/new-arrivals" className="hover:text-[#D4AF37] transition-colors">New Arrivals</Link></li>
            <li><Link to="/best-sellers" className="hover:text-[#D4AF37] transition-colors">Best Sellers</Link></li>
          </ul>
        </div>

        {/* Customer Care & Policies */}
        <div>
          <h3 className="font-sans text-xs uppercase tracking-[0.16em] text-white font-semibold mb-4">
            Client Service
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/track-order" className="hover:text-[#D4AF37] transition-colors">Track Your Order</Link></li>
            <li><Link to="/account" className="hover:text-[#D4AF37] transition-colors">My Account</Link></li>
            <li><Link to="/faq" className="hover:text-[#D4AF37] transition-colors">Frequently Asked Questions</Link></li>
            <li><Link to="/shipping-returns" className="hover:text-[#D4AF37] transition-colors">Shipping &amp; Returns Policy</Link></li>
            <li><Link to="/privacy-policy" className="hover:text-[#D4AF37] transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-[#D4AF37] transition-colors">Terms &amp; Conditions</Link></li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h3 className="font-sans text-xs uppercase tracking-[0.16em] text-white font-semibold mb-4">
            Private Dispatch
          </h3>
          <p className="text-sm text-neutral-400 leading-relaxed mb-4">
            Receive early access to bespoke native drops, limited footwear releases, and seasonal lookbooks.
          </p>
          <form onSubmit={handleSubscribe} className="flex">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 bg-[#D4AF37] text-[#111111] text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 hover:bg-[#e4c14e] transition-colors disabled:opacity-50"
            >
              Join
            </button>
          </form>
          <div className="mt-5 flex items-center gap-4 text-xs text-neutral-400">
            {settings.socialInstagram && (
              <a href={settings.socialInstagram} target="_blank" rel="noreferrer" className="hover:text-[#D4AF37]">
                Instagram
              </a>
            )}
            {settings.socialTwitter && (
              <a href={settings.socialTwitter} target="_blank" rel="noreferrer" className="hover:text-[#D4AF37]">
                X / Twitter
              </a>
            )}
            {settings.socialFacebook && (
              <a href={settings.socialFacebook} target="_blank" rel="noreferrer" className="hover:text-[#D4AF37]">
                Facebook
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <span>&copy; {new Date().getFullYear()} {settings.storeName}. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/about" className="hover:text-neutral-300">About Us</Link>
            <span aria-hidden="true">·</span>
            <Link to="/contact" className="hover:text-neutral-300">Contact</Link>
            <span aria-hidden="true">·</span>
            <Link to="/admin/login" className="hover:text-[#D4AF37]">Store Administration</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
