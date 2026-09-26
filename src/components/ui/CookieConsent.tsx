import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import {
  Cookie,
  X,
  SlidersHorizontal
} from 'lucide-react';

export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
  decidedAt: string;
}

const STORAGE_KEY = 'queueup_cookie_consent_v1';

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [showPreferences, setShowPreferences] = useState<boolean>(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({
    necessary: true,
    analytics: true,
    functional: true,
    marketing: false,
    decidedAt: ''
  });

  useEffect(() => {
    // Check localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        // Small delay for smooth entry
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      } else {
        setPrefs(JSON.parse(saved));
      }
    } catch {
      setIsVisible(true);
    }

    // Listen for custom event to reopen preferences (from Footer link)
    const handleReopen = () => {
      setIsVisible(true);
      setShowPreferences(true);
    };
    window.addEventListener('open-cookie-preferences', handleReopen);
    return () => window.removeEventListener('open-cookie-preferences', handleReopen);
  }, []);

  const saveConsent = (updated: CookiePreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Local storage fallback
    }
    setPrefs(updated);
    setIsVisible(false);
    setShowPreferences(false);
  };

  const handleAcceptAll = () => {
    const allOn: CookiePreferences = {
      necessary: true,
      analytics: true,
      functional: true,
      marketing: true,
      decidedAt: new Date().toISOString()
    };
    saveConsent(allOn);
  };

  const handleRejectNonEssential = () => {
    const minOnly: CookiePreferences = {
      necessary: true,
      analytics: false,
      functional: false,
      marketing: false,
      decidedAt: new Date().toISOString()
    };
    saveConsent(minOnly);
  };

  const handleSaveCustom = () => {
    saveConsent({
      ...prefs,
      necessary: true,
      decidedAt: new Date().toISOString()
    });
  };

  if (!isVisible) return null;

  return (
    <aside aria-label="การยินยอมใช้คุกกี้" className="fixed bottom-3 inset-x-3 sm:bottom-5 sm:right-5 sm:left-auto sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="rounded-3xl bg-white border border-orange-200 shadow-2xl p-4 sm:p-5 backdrop-blur-xl text-xs text-stone-700 space-y-3.5 dark:bg-[#09090b] dark:border-zinc-800 dark:text-zinc-300 transition-colors">
        {/* Banner Top Icon + Title */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Cookie className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-stone-900 dark:text-zinc-100 flex items-center gap-1.5">
                การใช้งานคุกกี้ (Cookie Policy)
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-zinc-800 dark:text-zinc-400 font-mono">
                  PDPA
                </span>
              </h4>
              <p className="text-[11px] text-stone-600 dark:text-zinc-400 mt-0.5">
                QueueUp ใช้คุกกี้เพื่อจดจำสถานะคิว ความปลอดภัย และความสะดวกในการสั่งอาหาร
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 p-1 cursor-pointer"
            title="ปิดชั่วคราว"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Detailed Preferences Accordion if expanded */}
        {showPreferences && (
          <div className="p-3 rounded-2xl bg-orange-50/70 border border-orange-200/80 space-y-3 pt-3 dark:bg-black/60 dark:border-zinc-800 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-stone-900 dark:text-zinc-200 text-xs">1. คุกกี้ที่จำเป็นอย่างยิ่ง (Strictly Necessary)</div>
                <div className="text-[10px] text-stone-600 dark:text-zinc-400">จดจำตั๋วคิว ตะกร้าสินค้า และการยืนยันตัวตน</div>
              </div>
              <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded dark:bg-orange-500/20 dark:text-orange-400">
                จำเป็นเสมอ
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-stone-900 dark:text-zinc-200 text-xs">2. คุกกี้เพื่อการวิเคราะห์ (Analytics)</div>
                <div className="text-[10px] text-stone-600 dark:text-zinc-400">วัดความเร็วในการออกคิวและสถิติการใช้งาน</div>
              </div>
              <input
                type="checkbox"
                checked={prefs.analytics}
                onChange={e => setPrefs(prev => ({ ...prev, analytics: e.target.checked }))}
                className="rounded border-orange-300 text-orange-600 focus:ring-orange-500/20 w-4 h-4"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-stone-900 dark:text-zinc-200 text-xs">3. คุกกี้เพื่อฟังก์ชันและการปรับแต่ง (Preferences)</div>
                <div className="text-[10px] text-stone-600 dark:text-zinc-400">จดจำร้านค้าที่ชอบและตัวกรองสารก่อภูมิแพ้</div>
              </div>
              <input
                type="checkbox"
                checked={prefs.functional}
                onChange={e => setPrefs(prev => ({ ...prev, functional: e.target.checked }))}
                className="rounded border-orange-300 text-orange-600 focus:ring-orange-500/20 w-4 h-4"
              />
            </div>
          </div>
        )}

        {/* Buttons Action Group */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {showPreferences ? (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={handleSaveCustom}
                className="text-xs py-1.5 px-3 flex-1"
              >
                บันทึกการตั้งค่า
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPreferences(false)}
                className="text-xs py-1.5 px-3"
              >
                ย้อนกลับ
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={handleAcceptAll}
                className="text-xs py-1.5 px-3 font-bold flex-1"
              >
                ยอมรับทั้งหมด
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRejectNonEssential}
                className="text-xs py-1.5 px-3"
              >
                ปฏิเสธส่วนเสริม
              </Button>
              <button
                type="button"
                onClick={() => setShowPreferences(true)}
                className="p-2 rounded-xl bg-orange-100/80 hover:bg-orange-200 text-stone-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 transition-colors cursor-pointer"
                title="ตั้งค่าคุกกี้แบบกำหนดเอง"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
