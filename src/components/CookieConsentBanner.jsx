import { useState, useEffect } from "react";
import { setCookie, getCookie } from "../utils/cookieManager.js";
import "./CookieConsentBanner.css";

/**
 * QUEUEUP PDPA COOKIE CONSENT BANNER (CookieConsentBanner.jsx)
 * Displays PDPA Cookie consent bar and allows customizing cookies.
 */
export default function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Preference switches
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(true);

  useEffect(() => {
    const consent = getCookie("queueup_cookie_consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

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
                เว็บไซต์ QueueUp ใช้คุกกี้ (Cookies) เพื่อเพิ่มประสิทธิภาพในการใช้งาน ยืนยันตัวตนเซสชันจองคิว จัดเก็บรหัสบัญชีปลอดภัย และนำเสนอคูปองโปรโมชั่นอาหารที่เหมาะกับคุณ คุณสามารถตั้งค่าตัวเลือกคุกกี้ได้ตามความต้องการ
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
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(8px)", zIndex: 10001 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-white" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid rgba(238, 77, 45, 0.4)", borderRadius: "20px" }}>
              <div className="modal-header border-bottom border-secondary">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-gear-fill text-warning me-2" />
                  ตั้งค่าความยินยอมการใช้คุกกี้ (Cookie Preferences)
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsSettingsOpen(false)} />
              </div>

              <div className="modal-body p-4">
                {/* 1. Necessary Cookies */}
                <div className="d-flex align-items-center justify-content-between p-3 rounded mb-3 bg-dark border border-secondary">
                  <div>
                    <div className="fw-bold text-white mb-1">
                      <i className="bi bi-shield-check text-success me-2" />
                      1. คุกกี้ที่จำเป็นขั้นพื้นฐาน (Strictly Necessary)
                    </div>
                    <div className="text-slate-300 small">
                      จำเป็นสำหรับการเข้าสู่ระบบ เซสชันคิวอาหาร และการปกป้องรหัสบัญชี ปิดการใช้งานไม่ได้
                    </div>
                  </div>
                  <span className="badge bg-success">เปิดใช้งานเสมอ</span>
                </div>

                {/* 2. Analytics Cookies */}
                <div className="d-flex align-items-center justify-content-between p-3 rounded mb-3 bg-dark border border-secondary">
                  <div>
                    <div className="fw-bold text-white mb-1">
                      <i className="bi bi-graph-up-arrow text-info me-2" />
                      2. คุกกี้เพื่อการวิเคราะห์ (Analytics & Performance)
                    </div>
                    <div className="text-slate-300 small">
                      ช่วยวัดประสิทธิภาพการโหลดหน้าเว็บและปรับปรุงการค้นหาอาหารให้รวดเร็วยิ่งขึ้น
                    </div>
                  </div>
                  <div className="form-check form-switch fs-4 ms-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={analyticsConsent}
                      onChange={(e) => setAnalyticsConsent(e.target.checked)}
                    />
                  </div>
                </div>

                {/* 3. Marketing & CRM Cookies */}
                <div className="d-flex align-items-center justify-content-between p-3 rounded bg-dark border border-secondary">
                  <div>
                    <div className="fw-bold text-white mb-1">
                      <i className="bi bi-ticket-perforated-fill text-warning me-2" />
                      3. คุกกี้เพื่อการตลาดและ CRM (Marketing & CRM)
                    </div>
                    <div className="text-slate-300 small">
                      แสดงโค้ดส่วนลด คูปองร้านค้าที่ติดตาม และแจ้งเตือนโปรโมชั่น CRM เฉพาะบุคคล
                    </div>
                  </div>
                  <div className="form-check form-switch fs-4 ms-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsSettingsOpen(false)}>
                  ยกเลิก
                </button>
                <button type="button" className="btn btn-danger btn-sm font-weight-bold" onClick={handleSaveCustomSettings}>
                  บันทึกการตั้งค่าคุกกี้ 💾
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
