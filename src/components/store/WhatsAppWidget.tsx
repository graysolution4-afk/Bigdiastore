import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export function WhatsAppWidget() {
  const { settings } = useStore();
  const rawPhone = (settings.whatsappNumber || '2348003426663').replace(/[^0-9]/g, '');
  if (!rawPhone) return null;

  const msg = encodeURIComponent(
    `Hello ${settings.storeName}, I would like assistance with an order or product inquiry.`
  );

  return (
    <a
      href={`https://wa.me/${rawPhone}?text=${msg}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Diamond Store on WhatsApp"
      className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-[#111111] text-white border border-[#D4AF37]/60 px-4 py-3 shadow-lg hover:bg-[#1f1f1f] transition-colors no-print"
    >
      <MessageCircle className="w-4 h-4 text-[#D4AF37]" />
      <span className="text-xs font-medium tracking-wider uppercase hidden sm:inline">
        Concierge
      </span>
    </a>
  );
}
