import React, { useState, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';

export const InAppBrowserBanner: React.FC = () => {
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
    const isLine = /Line/i.test(ua);
    const isFb = /FBAN|FBAV/i.test(ua);
    const isInsta = /Instagram/i.test(ua);
    if (isLine || isFb || isInsta) {
      setIsInAppBrowser(true);
    }
  }, []);

  if (!isInAppBrowser || isDismissed) return null;

  return (
    <div className="bg-amber-500 text-stone-900 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between shadow-md relative z-40">
      <div className="flex items-center gap-2">
        <span className="text-base">💡</span>
        <span>
          เพื่อประสบการณ์การสั่งอาหารและรับแจ้งเตือนคิวที่สมบูรณ์แบบ แนะนำให้แตะเมนูมุมขวาบนและเลือก <strong>"เปิดในเบราว์เซอร์ภายนอก (Chrome / Safari)"</strong>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            alert('คัดลอกลิงก์เรียบร้อยแล้ว นำไปวางใน Chrome หรือ Safari ได้เลยครับ');
          }}
          className="px-2.5 py-1 bg-white/30 hover:bg-white/40 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> คัดลอกลิงก์
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-black/10 rounded-full transition-colors"
          aria-label="ปิดการแจ้งเตือน"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
