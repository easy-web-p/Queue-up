import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("QueueUp Global ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#0b1020",
            color: "#ffffff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              background: "rgba(30, 41, 59, 0.9)",
              border: "1px solid rgba(238, 77, 45, 0.4)",
              borderRadius: "20px",
              padding: "36px",
              maxWidth: "500px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <i className="bi bi-exclamation-triangle-fill text-warning" style={{ fontSize: "3rem" }} />
            <h3 style={{ marginTop: "16px", fontWeight: "800", color: "#f8fafc" }}>
              เกิดข้อผิดพลาดในการแสดงผลหน้าเว็บ
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: "1.5" }}>
              ระบบกำลังรีเซ็ตและฟื้นฟูสภาพหน้าเว็บของคุณโดยอัตโนมัติ กรุณากดปุ่มล้างแคชและโหลดใหม่ด้านล่าง
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.href = "/home";
                }}
                style={{
                  background: "#ee4d2d",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                <i className="bi bi-house-door-fill me-1" /> กลับสู่หน้าหลัก Home
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                <i className="bi bi-arrow-clockwise me-1" /> โหลดหน้าเว็บใหม่ (Refresh)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
