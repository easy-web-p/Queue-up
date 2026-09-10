import React from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Home,
  Search,
  ReceiptText,
  Heart,
  User,
  ShoppingBag,
  MapPin,
  ChevronDown,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { useCampus } from "../../features/identity/context/CampusContext";
import { selectCartTotalCount, selectCartTotalAmount } from "../../store/cartSlice";
import { useAuth } from "../../context/AuthContext";

export const MarketplaceLayout: React.FC = () => {
  const { activeCampus, availableCampuses, selectCampus, isSwitcherOpen, setIsSwitcherOpen } =
    useCampus();
  const cartCount = useSelector(selectCartTotalCount);
  const cartAmount = useSelector(selectCartTotalAmount);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isCartRoute = location.pathname.startsWith("/app/cart") || location.pathname.startsWith("/app/checkout");

  return (
    <div className="min-h-screen flex flex-col bg-[#16100C] text-white">
      {/* Top Bar / Header */}
      <header className="sticky top-0 z-40 bg-[#16100C]/90 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Platform Badge */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/app")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-bold text-white shadow-md shadow-orange-950/40">
              Q
            </div>
            <div className="hidden sm:block">
              <span className="font-extrabold text-lg tracking-tight font-kanit">QueueUp</span>
              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                MARKET
              </span>
            </div>
          </div>

          {/* Decision 1: Always-Visible Campus Switcher */}
          <button
            type="button"
            onClick={() => setIsSwitcherOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#241C16] border border-orange-500/30 hover:border-orange-500/60 text-xs sm:text-sm font-medium transition-all text-slate-200 hover:text-white group max-w-[220px] sm:max-w-xs truncate"
            title="คลิกเพื่อเปลี่ยนโรงอาหาร/วิทยาเขต"
          >
            <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="truncate">{activeCampus.shortName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-400 shrink-0 transition-transform" />
          </button>

          {/* Right Header: Cart & Profile */}
          <div className="flex items-center gap-2">
            {!isCartRoute && (
              <button
                type="button"
                onClick={() => navigate("/app/cart")}
                className="relative p-2 rounded-xl bg-[#241C16] border border-white/10 text-slate-300 hover:text-white hover:border-orange-500/30 transition-all"
                aria-label="เปิดตะกร้าสินค้า"
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-orange-600 text-white rounded-full text-[11px] font-bold flex items-center justify-center shadow">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate("/app/account")}
              className="w-9 h-9 rounded-full bg-slate-800 border border-white/20 overflow-hidden flex items-center justify-center hover:border-orange-400 transition-colors"
              aria-label="โปรไฟล์ผู้ใช้"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || "Avatar"} loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-slate-300" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Floating Cart Button on Mobile when items exist */}
      {!isCartRoute && cartCount > 0 && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-40 animate-slide-up">
          <button
            type="button"
            onClick={() => navigate("/app/cart")}
            className="flex items-center gap-3 py-3 px-5 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold shadow-2xl shadow-orange-950/60 hover:scale-105 transition-all border border-orange-400/40"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 w-4 h-4 bg-white text-orange-600 rounded-full text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </div>
            <span>ดูตะกร้า ({cartAmount.toFixed(0)} ฿)</span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1A1410]/95 backdrop-blur-lg border-t border-white/10 py-2 px-3">
        <div className="grid grid-cols-5 gap-1 text-center">
          <NavLink
            to="/app"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? "text-orange-400 font-bold" : "text-slate-400 hover:text-slate-200"
              }`
            }
          >
            <Home className="w-5 h-5" />
            <span>หน้าแรก</span>
          </NavLink>

          <NavLink
            to="/app/search"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? "text-orange-400 font-bold" : "text-slate-400 hover:text-slate-200"
              }`
            }
          >
            <Search className="w-5 h-5" />
            <span>ค้นหา</span>
          </NavLink>

          <NavLink
            to="/app/orders"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? "text-orange-400 font-bold" : "text-slate-400 hover:text-slate-200"
              }`
            }
          >
            <ReceiptText className="w-5 h-5" />
            <span>คำสั่งซื้อ</span>
          </NavLink>

          <NavLink
            to="/app/favorites"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? "text-orange-400 font-bold" : "text-slate-400 hover:text-slate-200"
              }`
            }
          >
            <Heart className="w-5 h-5" />
            <span>ที่บันทึก</span>
          </NavLink>

          <NavLink
            to="/app/account"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? "text-orange-400 font-bold" : "text-slate-400 hover:text-slate-200"
              }`
            }
          >
            <User className="w-5 h-5" />
            <span>ฉัน</span>
          </NavLink>
        </div>
      </nav>

      {/* Campus Selector Modal */}
      {isSwitcherOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#241C16] border border-orange-500/30 rounded-2xl shadow-2xl p-6 text-white animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-orange-400" />
                <h3 className="font-bold font-kanit text-lg">เลือกโรงอาหาร / วิทยาเขต</h3>
              </div>
              <button
                onClick={() => setIsSwitcherOpen(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              เลือกล่วงหน้าเพื่อให้ระบบแสดงรายการอาหารและสล็อตเวลาที่เปิดรับของโรงอาหารนั้นๆ
            </p>

            <div className="space-y-2">
              {availableCampuses.map((campus) => {
                const isSelected = campus.id === activeCampus.id;
                return (
                  <button
                    key={campus.id}
                    type="button"
                    onClick={() => selectCampus(campus.id)}
                    className={`w-full flex items-start justify-between p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-orange-500/15 border-orange-500/60 text-white"
                        : "bg-[#1A1410] border-white/10 hover:border-white/20 text-slate-300"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {campus.name}
                        {isSelected && <Sparkles className="w-3.5 h-3.5 text-orange-400" />}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{campus.location}</div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceLayout;
