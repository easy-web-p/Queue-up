import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import Loading from "../pages/Loading.jsx";
import NotFound from "../pages/NotFound.jsx";
import { switchRole } from "../store/authSlice.js";
import { canAccessRole, isUserSuperAdmin } from "../utils/authRoles.js";

export interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireApprovedVendor?: boolean;
}

/**
 * PROTECTED ROUTE GUARD WITH RBAC (Role-Based Access Control)
 * 1. Enforces strict authentication for private pages - redirects to /login if unauthenticated.
 * 2. Enforces Role-Based Access Control for merchant & admin dashboard routes.
 * 3. Hides admin routes from non-admin users by returning 404 (Security by Information Hiding).
 */
export function ProtectedRoute({
  children,
  allowedRoles = [],
  requireApprovedVendor = false,
}: ProtectedRouteProps) {
  const { user, isLoading } = useSelector((state: any) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const isSuperAdmin = isUserSuperAdmin(user);
  const requiresElevatedRole = Boolean(
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes("customer")
  );

  // 🔒 Wait for Firebase Auth verification and Profile loading before evaluating role-restricted routes
  if (
    isLoading || 
    (user && user.isVerifiedAuth !== true && requiresElevatedRole) ||
    (user && !isSuperAdmin && !user.isProfileLoaded && !user.isProfileError && requiresElevatedRole)
  ) {
    return <Loading />;
  }

  const currentUser = user;

  // 🔒 Profile Error Guard: Only for strictly elevated routes (e.g. merchant dashboard, admin panel)
  // where normal customers are NOT allowed and user is not superadmin.
  if (
    !isSuperAdmin &&
    currentUser &&
    currentUser.isProfileError === true &&
    requiresElevatedRole &&
    (allowedRoles.includes("merchant") || allowedRoles.includes("admin"))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-['Kanit']">
        <div className="bg-slate-900 border border-red-500/40 rounded-3xl shadow-2xl p-8 text-center max-w-md w-full space-y-4">
          <div className="w-14 h-14 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto text-2xl">
            ⚠️
          </div>
          <h4 className="text-xl font-bold text-white mb-1">ไม่สามารถโหลดข้อมูลสิทธิ์ได้</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลโปรไฟล์ กรุณารีเฟรชหน้าเว็บหรือลองเข้าสู่ระบบใหม่อีกครั้ง
          </p>
          <div className="space-y-2 pt-2">
            <button
              type="button"
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer text-sm"
              onClick={() => window.location.reload()}
            >
              🔄 ลองใหม่อีกครั้ง
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition-all active:scale-95 cursor-pointer text-xs"
                onClick={() => navigate("/")}
              >
                🏠 กลับหน้าหลัก
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition-all active:scale-95 cursor-pointer text-xs"
                onClick={() => navigate("/login")}
              >
                🔑 เข้าสู่ระบบใหม่
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 1. If not logged in -> Redirect to /login
  if (!currentUser) {
    // If attempting to access admin route while unauthenticated, show 404 to avoid leaking admin existence (Information Hiding)
    if (allowedRoles && allowedRoles.includes("admin") && allowedRoles.length === 1) {
      return <NotFound />;
    }
    const destinationPath = `${location.pathname}${location.search || ""}`;
    return <Navigate to="/login" state={{ from: destinationPath }} replace />;
  }

  // 2. Role-Based Access Control (RBAC) Check using centralized helper
  if (allowedRoles && allowedRoles.length > 0) {
    const isSuperAdmin = isUserSuperAdmin(currentUser);
    const hasRole = allowedRoles.some((role) => canAccessRole(currentUser, role));

    if (!hasRole) {
      // 🔒 Security Policy: When a non-admin attempts to access Admin route, render 404 NOT FOUND directly
      if (allowedRoles.includes("admin") && !isSuperAdmin) {
        return <NotFound />;
      }
      // Access Denied Screen for unauthorized role
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 font-['Kanit']">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 text-red-500 flex items-center justify-center text-3xl shadow-inner">
              🛡️
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">
                สิทธิ์การเข้าถึงไม่เพียงพอ (Access Denied)
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                หน้านี้สงวนสิทธิ์เฉพาะผู้ใช้ระดับ{" "}
                <strong className="text-sky-400">
                  {allowedRoles.includes("admin") ? "ผู้ดูแลระบบ (Super Admin)" : "ร้านค้า (Merchant)"}
                </strong>{" "}
                เท่านั้น บัญชีปัจจุบันของคุณ ({currentUser.email || currentUser.name || "Customer"}) ไม่มีสิทธิ์เข้าใช้งาน
              </p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap pt-2">
              {allowedRoles.includes("merchant") && (
                <button
                  type="button"
                  onClick={() => {
                    dispatch(switchRole("merchant"));
                    navigate("/merchant/dashboard");
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  🏪 สลับเป็นบทบาทร้านค้า
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/home")}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-bold text-xs border border-slate-700 transition-all active:scale-95 cursor-pointer"
              >
                🏠 กลับสู่หน้าหลัก
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // 3. Student Vendor Approval Check (ห้ามเข้าหน้าจัดการเมนูหรือ KDS ก่อนผ่านอนุมัติ)
  if (requireApprovedVendor && currentUser?.role === 'student_vendor') {
    const isApproved = currentUser?.isApprovedVendor === true || currentUser?.vendorStatus === 'APPROVED';
    if (!isApproved) {
      return <Navigate to="/student-vendor/onboarding" replace />;
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
