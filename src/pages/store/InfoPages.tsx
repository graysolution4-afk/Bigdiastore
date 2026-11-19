import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Mail, MapPin, Phone } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/firebase';
import { makeDocId } from '../../lib/format';
import { IMG_HERO } from '../../lib/seedData';

export function AboutPage() {
  const { settings } = useStore();
  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16]">Our Heritage</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#111111]">
            {settings.storeName}
          </h1>
          <p className="text-lg text-[#9E7C16] font-display italic">{settings.tagline}</p>
          <p className="text-sm sm:text-base text-neutral-700 leading-relaxed">
            {settings.aboutContent}
          </p>
          <Link
            to="/shop"
            className="inline-block px-7 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-widest"
          >
            Explore the Collection
          </Link>
        </div>
        <div className="lg:col-span-6 aspect-[4/3] bg-[#F5F5F5] overflow-hidden">
          <img
            src={IMG_HERO}
            alt="Diamond Store Editorial"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </main>
  );
}

export function ContactPage() {
  const { settings, notify } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await setDoc(doc(db, 'contact_messages', makeDocId('msg')), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        subject: subject.trim(),
        message: message.trim(),
        status: 'new',
        createdAt: serverTimestamp(),
      });
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
      notify('Message sent to Diamond Store Concierge.', 'success');
    } catch {
      notify('Unable to submit message right now.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-5 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-1">Concierge</p>
          <h1 className="font-display text-4xl font-semibold text-[#111111]">Contact Us</h1>
          <p className="text-sm text-neutral-600 mt-3 leading-relaxed">
            Questions on sizing, bespoke native orders, wholesale, or delivery status? Reach our Lagos flagship team directly.
          </p>
        </div>
        <div className="space-y-4 text-sm text-neutral-700 pt-2">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-[#9E7C16] mt-0.5 shrink-0" />
            <span>{settings.address}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-[#9E7C16] shrink-0" />
            <span>{settings.phone}</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-[#9E7C16] shrink-0" />
            <span>{settings.businessEmail}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="lg:col-span-7 border border-neutral-200 p-6 sm:p-8 bg-white space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name *"
            className="border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address *"
            className="border border-neutral-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone / WhatsApp Number"
            className="border border-neutral-300 px-3 py-2.5 text-sm"
          />
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject *"
            className="border border-neutral-300 px-3 py-2.5 text-sm"
          />
        </div>
        <textarea
          rows={4}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we assist you? *"
          className="w-full border border-neutral-300 px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={sending}
          className="px-7 py-3 bg-[#111111] text-white text-xs font-semibold uppercase tracking-widest hover:bg-[#9E7C16] transition-colors"
        >
          {sending ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </main>
  );
}

export function FaqPage() {
  const faqs = [
    {
      q: 'How long does delivery take within Nigeria?',
      a: 'Lagos deliveries typically arrive within 1–2 business days. Abuja, Port Harcourt, and other states arrive within 2–5 business days via verified courier partners.',
    },
    {
      q: 'What payment methods are accepted?',
      a: 'Checkout dynamically presents all active methods enabled by Diamond Store, including Paystack, Flutterwave, Stripe, Direct Bank Transfer, and Cash on Delivery in eligible locations.',
    },
    {
      q: 'How do I track my order?',
      a: 'Visit our Track Order page and enter your Order Number alongside the email address or phone number used during checkout.',
    },
    {
      q: 'Can I exchange a garment or shoe size?',
      a: 'Yes. Unworn items in original packaging with tags intact can be exchanged within 7 days of delivery.',
    },
  ];
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
      <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-2">Client Guide</p>
      <h1 className="font-display text-4xl font-semibold text-[#111111] mb-8">
        Frequently Asked Questions
      </h1>
      <div className="divide-y divide-neutral-200 border-y border-neutral-200">
        {faqs.map((item, idx) => (
          <div key={idx} className="py-6">
            <h2 className="text-base font-semibold text-[#111111] mb-2">{item.q}</h2>
            <p className="text-sm text-neutral-600 leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

export function PolicyPage({ type }: { type: 'privacy' | 'terms' | 'shipping' }) {
  const { settings } = useStore();
  const title =
    type === 'privacy'
      ? 'Privacy Policy'
      : type === 'terms'
      ? 'Terms & Conditions'
      : 'Shipping & Returns Policy';
  const body =
    type === 'privacy'
      ? settings.privacyPolicy
      : type === 'terms'
      ? settings.termsConditions
      : settings.shippingPolicy;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
      <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-2">{settings.storeName}</p>
      <h1 className="font-display text-4xl font-semibold text-[#111111] mb-6">{title}</h1>
      <div className="text-sm sm:text-base text-neutral-700 leading-relaxed whitespace-pre-line">
        {body}
      </div>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center">
      <p className="font-mono text-xs text-[#9E7C16] mb-2">404</p>
      <h1 className="font-display text-4xl font-semibold text-[#111111] mb-3">Page Not Found</h1>
      <p className="text-sm text-neutral-600 mb-6">
        The requested page could not be located.
      </p>
      <Link
        to="/"
        className="inline-block px-7 py-3 bg-[#111111] text-white text-xs uppercase tracking-widest"
      >
        Return Home
      </Link>
    </main>
  );
}
