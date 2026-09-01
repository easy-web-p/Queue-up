import { useSelector, useDispatch } from "react-redux";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import Loading from "../pages/Loading.jsx";
import NotFound from "../pages/NotFound.jsx";
import { switchRole } from "../store/authSlice.js";

/**
 * PROTECTED ROUTE GUARD WITH RBAC (Role-Based Access Control)
 * 1. Enforces strict authentication for private pages - redirects to /login if unauthenticated.
 * 2. Enforces Role-Based Access Control for merchant & admin dashboard routes.
 * 3. Hides admin routes from non-admin users by returning 404 (Security by Information Hiding).
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isLoading } = useSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  let savedUser = null;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("queueup_user");
      if (raw) savedUser = JSON.parse(raw);
    } catch (e) {
      console.warn("ProtectedRoute JSON parse error:", e);
    }
  }

  const currentUser = user || savedUser;

  if (isLoading) {
    return <Loading />;
  }

  // 1. If not logged in -> Redirect to /login
  if (!currentUser) {
    // If attempting to access admin route while unauthenticated, show 404 to avoid leaking admin existence
    if (allowedRoles && allowedRoles.includes("admin") && allowedRoles.length === 1) {
      return <NotFound />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Role-Based Access Control (RBAC) Check
  if (allowedRoles && allowedRoles.length > 0) {
    const currentRole = currentUser.activeRole || currentUser.role || (currentUser.roles && currentUser.roles[0]) || "customer";
    const userRoles = currentUser.roles || [currentRole];
    
    // Super Admin privilege override (คุณพิสิษฐ์ or admin role)
    const isSuperAdmin = currentUser.email === "58140@lomsak.ac.th" || currentRole === "admin" || userRoles.includes("admin");
    const hasRole = isSuperAdmin || allowedRoles.includes(currentRole) || allowedRoles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      // 🔒 Security Policy: When a non-admin attempts to access Admin route, render 404 NOT FOUND directly
      if (allowedRoles.includes("admin") && allowedRoles.length === 1) {
        return <NotFound />;
      }
      // Access Denied Screen for unauthorized role
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f172a",
          color: "#f8fafc",
          padding: "20px"
        }}>
          <div style={{
            maxWidth: "500px",
            width: "100%",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "24px",
            padding: "36px",
            textAlign: "center",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 20px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px"
            }}>
              🛡️
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "10px", color: "#f8fafc" }}>
              สิทธิ์การเข้าถึงไม่เพียงพอ (Access Denied)
            </h2>
            <p style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "24px", lineHeight: "1.6" }}>
              หน้านี้สงวนสิทธิ์เฉพาะผู้ใช้ระดับ{" "}
              <strong style={{ color: "#38bdf8" }}>
                {allowedRoles.includes("admin") ? "ผู้ดูแลระบบ (Super Admin)" : "ร้านค้า (Merchant)"}
              </strong>{" "}
              เท่านั้น บัญชีปัจจุบันของคุณ ({currentUser.email || currentUser.name || "Customer"}) ไม่มีสิทธิ์เข้าใช้งาน
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              {allowedRoles.includes("merchant") && (
                <button
                  type="button"
                  onClick={() => {
                    dispatch(switchRole("merchant"));
                    navigate("/merchant/dashboard");
                  }}
                  style={{
                    backgroundColor: "#3b82f6",
                    color: "#ffffff",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "20px",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  🏪 สลับเป็นบทบาทร้านค้า
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/home")}
                style={{
                  backgroundColor: "transparent",
                  color: "#e2e8f0",
                  border: "1px solid #475569",
                  padding: "10px 20px",
                  borderRadius: "20px",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                🏠 กลับสู่หน้าหลัก
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return children;
}

