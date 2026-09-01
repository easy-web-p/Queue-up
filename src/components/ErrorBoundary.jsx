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
            style={{
              maxWidth: "480px",
              width: "100%",
              backgroundColor: "#1e293b",
              border: "1px solid rgba(238, 77, 45, 0.3)",
              borderRadius: "20px",
              padding: "32px 24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                margin: "0 auto 16px",
                borderRadius: "50%",
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
            <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px", color: "#f8fafc" }}>
              ระบบพบข้อขัดข้องชั่วคราว
            </h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "20px", lineHeight: "1.5" }}>
              ข้อมูลของคุณได้รับการปกป้องอย่างปลอดภัย กรุณากดปุ่มด้านล่างเพื่อโหลดหน้านี้ใหม่อีกครั้ง
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  backgroundColor: "#ee4d2d",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 20px",
                  borderRadius: "20px",
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
                style={{
                  backgroundColor: "transparent",
                  color: "#cbd5e1",
                  border: "1px solid #475569",
                  padding: "8px 18px",
                  borderRadius: "20px",
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

