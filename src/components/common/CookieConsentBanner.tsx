import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('queueup_cookie_consent_v1');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('queueup_cookie_consent_v1', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('queueup_cookie_consent_v1', 'essential_only');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
      <div className="p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-white">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 shrink-0">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <h4 className="font-semibold text-sm mb-1 flex items-center gap-1.5">
              การใช้งานคุกกี้และความเป็นส่วนตัว (PDPA)
            </h4>
            <p className="text-stone-600 dark:text-zinc-400 leading-relaxed mb-3">
              QueueUp ใช้คุกกี้เพื่อบันทึกสถานะคิว ประวัติคำสั่งซื้อ และเพิ่มความสะดวกรวดเร็วในการใช้งานตามนโยบายคุ้มครองข้อมูลส่วนบุคคล
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAccept}
                className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-xs shadow-sm transition-all"
              >
                ยอมรับทั้งหมด
              </button>
              <button
                onClick={handleDecline}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition-all"
              >
                เฉพาะจำเป็น
              </button>
              <Link
                to="/pdpa"
                className="ml-auto text-orange-600 hover:underline flex items-center gap-1 text-[11px]"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> อ่านนโยบาย
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
