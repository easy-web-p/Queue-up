import React from "react";
import { sanitizeLogData } from "../utils/security.js";

/**
 * PRIVACY-PRESERVING RESILIENT ERROR BOUNDARY
 * Catches unhandled runtime crashes, strips PII from logs, and provides a seamless recovery UI.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const sanitizedErr = sanitizeLogData(error?.message || "Unknown error");
    const sanitizedStack = sanitizeLogData(errorInfo?.componentStack || "");
    console.warn("🛡️ [QueueUp Shield] ErrorBoundary caught error:", sanitizedErr, sanitizedStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          className="min-h-[60vh] flex items-center justify-center p-6 text-center bg-slate-950 text-slate-100 font-['Kanit']"
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            backgroundColor: "#0f172a",
            color: "#f8fafc",
          }}
        >
          <div
            className="max-w-md w-full bg-slate-900 border border-orange-500/30 rounded-3xl p-8 shadow-2xl space-y-4"
            style={{
              maxWidth: "480px",
              width: "100%",
              backgroundColor: "#1e293b",
              border: "1px solid rgba(238, 77, 45, 0.3)",
              borderRadius: "24px",
              padding: "32px 24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-2xl bg-orange-500/20 text-orange-500 flex items-center justify-center text-2xl shadow-inner"
              style={{
                width: "56px",
                height: "56px",
                margin: "0 auto 16px",
                borderRadius: "16px",
                backgroundColor: "rgba(238, 77, 45, 0.15)",
                color: "#ee4d2d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              ⚠️
            </div>
            <h3
              className="text-lg font-black text-white"
              style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px", color: "#f8fafc" }}
            >
              ระบบพบข้อขัดข้องชั่วคราว
            </h3>
            <p
              className="text-xs text-slate-400 leading-relaxed"
              style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "20px", lineHeight: "1.5" }}
            >
              ข้อมูลของคุณได้รับการปกป้องอย่างปลอดภัย กรุณากดปุ่มด้านล่างเพื่อโหลดหน้านี้ใหม่อีกครั้ง
            </p>
            <div className="flex gap-3 justify-center pt-2" style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: "#ee4d2d",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "12px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                🔄 ลองใหม่อีกครั้ง
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = "/home")}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-bold text-xs border border-slate-700 transition-all active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: "transparent",
                  color: "#cbd5e1",
                  border: "1px solid #475569",
                  padding: "10px 18px",
                  borderRadius: "12px",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                🏠 กลับหน้าหลัก
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

