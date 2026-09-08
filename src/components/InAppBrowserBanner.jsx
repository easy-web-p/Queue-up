import { useState } from "react";
import { isInAppBrowser, getInAppBrowserName, copyCurrentUrlToClipboard } from "../utils/browserEnv.js";
import { useToast } from "./ToastProvider.jsx";
import "./InAppBrowserBanner.css";

export default function InAppBrowserBanner() {
  const toast = useToast();
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const isDismissed = sessionStorage.getItem("queueup_dismiss_inapp_banner") === "true";
      return isInAppBrowser() && !isDismissed;
    } catch {
      return false;
    }
  });
  const [browserName] = useState(() => getInAppBrowserName());
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  const handleCopyLink = async () => {
    const success = await copyCurrentUrlToClipboard();
    if (success) {
      setCopied(true);
      toast.success("📋 คัดลอกลิงก์แล้ว! เปิดแอป Safari หรือ Chrome แล้ววางลิงก์ได้เลย");
      setTimeout(() => setCopied(false), 3000);
    } else {
      toast.error("ไม่สามารถคัดลอกลิงก์อัตโนมัติได้ กรุณากด ⋯ เพื่อเปิดใน Safari");
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem("queueup_dismiss_inapp_banner", "true");
    } catch {
      // Ignore sessionStorage exceptions
    }
  };

  return (
    <aside
      className="inapp-browser-banner"
      role="alert"
      aria-label="การแจ้งเตือนเบราว์เซอร์ภายในแอป"
    >
      <div className="inapp-banner-container">
        <div className="inapp-banner-icon-wrapper" aria-hidden="true">
          <span className="inapp-banner-icon">⚠️</span>
        </div>

        <div className="inapp-banner-content">
          <div className="inapp-banner-header">
            <span className="inapp-banner-badge">ตรวจพบ {browserName}</span>
            <span className="inapp-banner-title">ระบบความปลอดภัยจำกัดการล็อกอิน Google</span>
          </div>

          <p className="inapp-banner-description">
            เบราว์เซอร์ภายในแอปนี้จำกัดการเข้าถึง Web Storage ระหว่างโดเมน (auth/missing-initial-state) 
            ทำให้ไม่สามารถล็อกอินด้วย Google ได้โดยตรง กรุณาเปิดผ่าน <strong>Safari หรือ Chrome</strong>
          </p>

          <div className="inapp-banner-steps">
            <span className="inapp-step-item">
              <strong>ขั้นตอน:</strong> 1. แตะปุ่ม <strong>⋯</strong> (จุดสามจุด) ที่มุมบนหรือล่าง
            </span>
            <span className="inapp-step-arrow">→</span>
            <span className="inapp-step-item">
              2. เลือก <strong>"Open in Safari"</strong> หรือ <strong>"เปิดในเบราว์เซอร์ภายนอก"</strong>
            </span>
          </div>
        </div>

        <div className="inapp-banner-actions">
          <button
            type="button"
            className="inapp-btn-copy"
            onClick={handleCopyLink}
            aria-label="คัดลอกลิงก์สำหรับเปิดใน Safari"
          >
            {copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอกลิงก์เปิดใน Safari"}
          </button>
          <button
            type="button"
            className="inapp-btn-dismiss"
            onClick={handleDismiss}
            aria-label="ซ่อนการแจ้งเตือนนี้"
            title="ซ่อนการแจ้งเตือน"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
}
