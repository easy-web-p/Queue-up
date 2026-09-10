import React, { useState } from "react";
import { Outlet, NavLink, useParams, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Flame,
  ClipboardList,
  UtensilsCrossed,
  Package,
  Users,
  Tag,
  DollarSign,
  Settings,
  Store,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const BusinessLayout: React.FC = () => {
  const { shopId = "default" } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  const navItems = [
    { to: `/business/${shopId}/overview`, label: "ภาพรวมร้านค้า", icon: LayoutDashboard },
    { to: `/business/${shopId}/operations`, label: "หน้าจอครัว KDS", icon: Flame, badge: "Live" },
    { to: `/business/${shopId}/orders`, label: "คำสั่งซื้อทั้งหมด", icon: ClipboardList },
    { to: `/business/${shopId}/catalog`, label: "เมนูและหมวดหมู่", icon: UtensilsCrossed },
    { to: `/business/${shopId}/inventory`, label: "สต็อกวัตถุดิบ", icon: Package },
    { to: `/business/${shopId}/staff`, label: "พนักงานและกะ", icon: Users },
    { to: `/business/${shopId}/promotions`, label: "โปรโมชัน & CRM", icon: Tag },
    { to: `/business/${shopId}/finance`, label: "การเงิน & ยอดขาย", icon: DollarSign },
    { to: `/business/${shopId}/settings/store`, label: "ตั้งค่าร้านค้า", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-[#121214] text-slate-100 antialiased font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#18181B] border-r border-zinc-800 flex flex-col shrink-0 hidden md:flex">
        {/* Brand & Store Selector Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-white shadow">
                Q
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight font-kanit">QueueUp</span>
                <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                  Business Console
                </span>
              </div>
            </div>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isStoreOpen ? "bg-emerald-500 shadow-emerald-500/50" : "bg-rose-500 shadow-rose-500/50"
              } shadow-sm`}
              title={isStoreOpen ? "ร้านเปิดรับออเดอร์" : "ร้านปิดชั่วคราว"}
            />
          </div>

          {/* Decision 2: Store Safety Switcher */}
          <button
            type="button"
            onClick={() => navigate("/business/select-store")}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-zinc-700/60 hover:border-orange-500/50 transition-all text-left text-xs group"
            title="คลิกเพื่อสลับร้านค้าที่ดูแล"
          >
            <div className="flex items-center gap-2 truncate">
              <Store className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="font-medium text-zinc-200 truncate">ร้านค้า: {shopId}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-orange-400 shrink-0" />
          </button>
        </div>

        {/* Quick KDS Launch Button */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => navigate(`/business/${shopId}/operations`)}
            className="w-full py-2.5 px-3 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/40 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
            <span>เข้าสู่หน้าจอครัว KDS สัมผัส</span>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-1 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.endsWith("/overview")}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-white font-semibold border-l-2 border-orange-500"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
          <span className="truncate">{user?.email || "แม่ค้าประจำร้าน"}</span>
          <button
            type="button"
            onClick={() => setIsStoreOpen(!isStoreOpen)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
              isStoreOpen
                ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                : "border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
            }`}
          >
            {isStoreOpen ? "เปิดร้าน" : "ปิดร้าน"}
          </button>
        </div>
      </aside>

      {/* Main Operational Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-[#18181B] border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => navigate(`/business/${shopId}/overview`)}>
            <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-white text-xs">
              Q
            </div>
            <span className="font-bold text-sm font-kanit">Business: {shopId}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/business/${shopId}/operations`)}
            className="p-1.5 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30 text-xs font-semibold flex items-center gap-1"
          >
            <Flame className="w-3.5 h-3.5" />
            KDS
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default BusinessLayout;
