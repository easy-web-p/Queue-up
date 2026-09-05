import { useState } from "react";
import { Link } from "react-router-dom";
import { setCookie, getCookie } from "../utils/cookieManager.js";
import "./CookieConsentBanner.css";

/**
 * QUEUEUP PDPA COOKIE CONSENT BANNER (CookieConsentBanner.jsx)
 * Displays PDPA Cookie consent bar and allows customizing cookies.
 */
export default function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(() => !getCookie("queueup_cookie_consent"));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Preference switches
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(true);

  // Accept All Cookies
  const handleAcceptAll = () => {
    setCookie("queueup_cookie_consent", "accepted", 365);
    setCookie("queueup_cookie_necessary", "true", 365);
    setCookie("queueup_cookie_analytics", "true", 365);
    setCookie("queueup_cookie_marketing", "true", 365);
    setIsVisible(false);
    setIsSettingsOpen(false);
  };

  // Reject Non-Essential Cookies
  const handleRejectNonEssential = () => {
    setCookie("queueup_cookie_consent", "essential_only", 365);
    setCookie("queueup_cookie_necessary", "true", 365);
    setCookie("queueup_cookie_analytics", "false", 365);
    setCookie("queueup_cookie_marketing", "false", 365);
    setIsVisible(false);
    setIsSettingsOpen(false);
  };

  // Save Customized Settings
  const handleSaveCustomSettings = () => {
    setCookie("queueup_cookie_consent", "customized", 365);
    setCookie("queueup_cookie_necessary", "true", 365);
    setCookie("queueup_cookie_analytics", analyticsConsent ? "true" : "false", 365);
    setCookie("queueup_cookie_marketing", marketingConsent ? "true" : "false", 365);
    setIsVisible(false);
    setIsSettingsOpen(false);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Floating Bottom Cookie Consent Banner */}
      <div className="qup-cookie-banner-wrapper">
        <div className="qup-cookie-banner-content">
          <div className="d-flex align-items-center gap-3">
            <div className="qup-cookie-icon-box">
              <i className="bi bi-shield-lock-fill" />
            </div>
            <div className="qup-cookie-text-box">
              <div className="qup-cookie-title">
                การจัดเก็บคุกกี้บนเว็บไซต์ (PDPA Cookie Compliance)
              </div>
              <p className="qup-cookie-desc">
                เว็บไซต์ QueueUp ใช้คุกกี้ (Cookies) เพื่อเพิ่มประสิทธิภาพในการใช้งาน ยืนยันตัวตนเซสชันจองคิว จัดเก็บรหัสบัญชีปลอดภัย และนำเสนอคูปองโปรโมชั่นอาหารที่เหมาะกับคุณ{" "}
                <Link to="/pdpa?tab=privacy" className="text-warning text-decoration-underline ms-1">
                  อ่านนโยบาย PDPA ฉบับเต็ม
                </Link>
              </p>
            </div>
          </div>

          <div className="qup-cookie-actions">
            <button className="qup-btn-cookie-secondary" onClick={() => setIsSettingsOpen(true)}>
              <i className="bi bi-sliders me-1" /> ตั้งค่าคุกกี้
            </button>
            <button className="qup-btn-cookie-secondary" onClick={handleRejectNonEssential}>
              จำเป็นเท่านั้น
            </button>
            <button className="qup-btn-cookie-accept" onClick={handleAcceptAll}>
              <i className="bi bi-check-lg me-1" /> ยอมรับคุกกี้ทั้งหมด
            </button>
          </div>
        </div>
      </div>

      {/* Cookie Custom Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-['IBM_Plex_Sans_Thai']">
          <div className="bg-gradient-to-br from-slate-900 via-stone-900 to-slate-950 border border-orange-500/40 rounded-3xl shadow-2xl max-w-lg w-full text-white overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-amber-400">
                  <i className="bi bi-gear-fill" />
                </div>
                <div>
                  <h5 className="font-['Kanit'] font-bold text-base mb-0 text-white">
                    ตั้งค่าความยินยอมการใช้คุกกี้
                  </h5>
                  <span className="text-[11px] text-slate-400">PDPA Cookie Preferences</span>
                </div>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => setIsSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* 1. Necessary Cookies */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-start justify-between gap-3">
                <div>
                  <div className="font-['Kanit'] font-bold text-sm text-white flex items-center gap-2 mb-1">
                    <i className="bi bi-shield-check text-emerald-400" />
                    <span>1. คุกกี้ที่จำเป็นขั้นพื้นฐาน (Strictly Necessary)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-0">
                    จำเป็นสำหรับการเข้าสู่ระบบ เซสชันคิวอาหาร และการปกป้องรหัสบัญชี ปิดการใช้งานไม่ได้
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[11px] font-bold shrink-0">
                  เปิดใช้งานเสมอ
                </span>
              </div>

              {/* 2. Analytics Cookies */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-start justify-between gap-3">
                <div>
                  <div className="font-['Kanit'] font-bold text-sm text-white flex items-center gap-2 mb-1">
                    <i className="bi bi-graph-up-arrow text-sky-400" />
                    <span>2. คุกกี้เพื่อการวิเคราะห์ (Analytics & Performance)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-0">
                    ช่วยวัดประสิทธิภาพการโหลดหน้าเว็บและปรับปรุงการค้นหาอาหารให้รวดเร็วยิ่งขึ้น
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={analyticsConsent}
                    onChange={(e) => setAnalyticsConsent(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" />
                </label>
              </div>

              {/* 3. Marketing & CRM Cookies */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-start justify-between gap-3">
                <div>
                  <div className="font-['Kanit'] font-bold text-sm text-white flex items-center gap-2 mb-1">
                    <i className="bi bi-ticket-perforated-fill text-amber-400" />
                    <span>3. คุกกี้เพื่อการตลาดและ CRM (Marketing & CRM)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-0">
                    แสดงโค้ดส่วนลด คูปองร้านค้าที่ติดตาม และแจ้งเตือนโปรโมชั่น CRM เฉพาะบุคคล
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" />
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => setIsSettingsOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-['Kanit'] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                onClick={handleSaveCustomSettings}
              >
                บันทึกการตั้งค่าคุกกี้ 💾
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
