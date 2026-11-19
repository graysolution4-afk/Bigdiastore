import React from 'react';
import { useStore } from '../../context/StoreContext';

export function ToastContainer() {
  const { toasts } = useStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2 max-w-sm no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 text-xs font-medium border shadow-lg ${
            t.tone === 'error'
              ? 'bg-red-950 text-white border-red-700'
              : t.tone === 'success'
              ? 'bg-[#111111] text-white border-[#D4AF37]'
              : 'bg-white text-[#111111] border-neutral-300'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
