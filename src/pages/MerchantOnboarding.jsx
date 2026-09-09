import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * 🔒 LEGACY MERCHANT ONBOARDING GUARD (/portal/th-onboarding & /portal/onboarding)
 * 
 * Direct client store creation and client-side role switching have been permanently deprecated.
 * All merchant and student vendor registrations must go through the official Student Vendor
 * Application workflow (/student-vendor/apply) with staff approval and Cloud Functions authority.
 */
export default function MerchantOnboarding() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/student-vendor/apply", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
      <div className="text-center space-y-4 max-w-md bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          !
        </div>
        <h2 className="text-xl font-bold text-white">กำลังนำคุณไปยังระบบลงทะเบียนผู้ขายนักเรียน...</h2>
        <p className="text-sm text-slate-400">
          ระบบ Merchant Onboarding แบบเดิมถูกแทนที่ด้วยระบบ Student Vendor Onboarding อย่างเป็นทางการแล้ว
        </p>
        <button
          onClick={() => navigate("/student-vendor/apply", { replace: true })}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-sm shadow-lg shadow-emerald-600/30"
        >
          ไปยังระบบลงทะเบียนผู้ขาย
        </button>
      </div>
    </div>
  );
}
