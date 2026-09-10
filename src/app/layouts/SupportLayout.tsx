import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { ShieldCheck, LifeBuoy, Key, BookOpen } from "lucide-react";

export const SupportLayout: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-[#0F172A] text-slate-100 antialiased font-sans">
      {/* Top Banner: Privacy Protection Status */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-emerald-400">ระบบปกป้องข้อมูลส่วนบุคคล (PDPA Compliant)</span>
          <span className="hidden sm:inline text-slate-500">•</span>
          <span className="hidden sm:inline text-slate-400">
            เบอร์โทรและอีเมลลูกค้าถูกซ่อน (Masked PII) เป็นค่าเริ่มต้น
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
            JIT Access Policy: Deny-by-Default
          </span>
        </div>
      </div>

      {/* Main Support Header & Nav */}
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/support/queue")}>
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
              <LifeBuoy className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight font-kanit">QueueUp</span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                SUPPORT DESK
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink
              to="/support/queue"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? "bg-blue-600 text-white font-semibold" : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <LifeBuoy className="w-4 h-4" />
              <span>คิวคำขอช่วยเหลือ</span>
            </NavLink>

            <NavLink
              to="/support/access-requests"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? "bg-blue-600 text-white font-semibold" : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">ขอสิทธิ์ชั่วคราว (JIT)</span>
            </NavLink>

            <NavLink
              to="/support/knowledge-base"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? "bg-blue-600 text-white font-semibold" : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">คู่มือแก้ปัญหา</span>
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Viewport */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default SupportLayout;
