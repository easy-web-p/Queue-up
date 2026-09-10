import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  Ticket,
  ChevronRight,
  Store,
} from "lucide-react";
import {
  selectCartItems,
  selectCartTotalAmount,
  selectCartTotalCount,
  updateQuantity,
  removeItem,
  clearCart,
} from "../../../store/cartSlice";
import { calculateCartItemUnitPrice } from "../../../store/cartPricing.js";

export const MarketplaceCartPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const cartItems = useSelector(selectCartItems);
  const cartAmount = useSelector(selectCartTotalAmount);
  const cartCount = useSelector(selectCartTotalCount);

  const [couponCode, setCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponError, setCouponError] = useState("");

  const storeName = cartItems.length > 0 ? cartItems[0].menuItem?.shopName || "ร้านค้าในโรงอาหาร" : "";

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.trim().toUpperCase() === "WELCOME50") {
      setDiscountAmount(50);
      setCouponError("");
    } else if (couponCode.trim().toUpperCase() === "EARLY20") {
      setDiscountAmount(20);
      setCouponError("");
    } else {
      setCouponError("รหัสคูปองไม่ถูกต้อง หรือหมดอายุแล้ว");
      setDiscountAmount(0);
    }
  };

  const finalTotal = Math.max(0, cartAmount - discountAmount);

  if (cartItems.length === 0) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-[#241C16] border border-white/10 rounded-2xl space-y-4 my-8">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto text-orange-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="font-bold text-lg text-white font-kanit">ตะกร้าของคุณยังว่างอยู่</h2>
        <p className="text-xs text-slate-400">
          เลือกสั่งอาหารจานโปรดจากร้านค้าในโรงอาหารเพื่อรับบริการคิวด่วน
        </p>
        <button
          onClick={() => navigate("/app")}
          className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-md transition-colors"
        >
          สำรวจรายการอาหาร
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-28">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-[#241C16] border border-white/10 text-slate-300 hover:text-white"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-extrabold text-lg font-kanit text-white">ตะกร้าสั่งอาหาร</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-orange-400" /> {storeName} ({cartCount} รายการ)
            </p>
          </div>
        </div>

        <button
          onClick={() => dispatch(clearCart())}
          className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          ล้างตะกร้า
        </button>
      </div>

      {/* Cart Items List */}
      <div className="space-y-3">
        {cartItems.map((item, idx) => {
          const unitPrice = calculateCartItemUnitPrice(item);
          const lineTotal = unitPrice * (item.quantity || 1);

          return (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-white">{item.menuItem?.name}</h3>
                  <div className="text-xs text-orange-400 font-jetbrains mt-0.5">
                    ฿{unitPrice} / จาน
                  </div>

                  {/* Modifiers display */}
                  {Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                    <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                      {item.selectedModifiers.map((mod, mIdx) => (
                        <div key={mIdx}>
                          • {mod.name} {mod.priceModifier ? `(+฿${mod.priceModifier})` : ""}
                        </div>
                      ))}
                    </div>
                  )}

                  {item.customNotes && (
                    <div className="text-[11px] text-amber-400/90 mt-1 italic">
                      หมายเหตุ: "{item.customNotes}"
                    </div>
                  )}
                </div>

                <div className="font-extrabold text-sm text-white font-jetbrains">
                  ฿{lineTotal}
                </div>
              </div>

              {/* Quantity Controls & Delete */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <button
                  onClick={() => dispatch(removeItem(idx))}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ลบรายการ
                </button>

                <div className="flex items-center gap-3 bg-[#1A1410] border border-white/10 rounded-xl p-1 px-2">
                  <button
                    onClick={() => dispatch(updateQuantity({ index: idx, delta: -1 }))}
                    className="p-1 text-slate-400 hover:text-white"
                    aria-label="ลดจำนวน"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-xs text-white font-jetbrains w-5 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => dispatch(updateQuantity({ index: idx, delta: 1 }))}
                    className="p-1 text-slate-400 hover:text-white"
                    aria-label="เพิ่มจำนวน"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coupon Form */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-white font-kanit">
          <Ticket className="w-4 h-4 text-orange-400" />
          <span>คูปองส่วนลด</span>
        </div>
        <form onSubmit={handleApplyCoupon} className="flex gap-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="กรอกโค้ด เช่น WELCOME50"
            className="flex-1 bg-[#1A1410] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 uppercase focus:outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition-colors"
          >
            ใช้งาน
          </button>
        </form>
        {discountAmount > 0 && (
          <div className="text-xs text-emerald-400 font-semibold">
            ✓ ใช้คูปองสำเร็จ ลดทันที ฿{discountAmount}
          </div>
        )}
        {couponError && <div className="text-xs text-rose-400">{couponError}</div>}
      </div>

      {/* Pricing Summary */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-2.5 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span>ยอดรวมค่าอาหาร</span>
          <span className="font-jetbrains text-white font-bold">฿{cartAmount}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex items-center justify-between text-emerald-400">
            <span>ส่วนลดคูปอง</span>
            <span className="font-jetbrains font-bold">-฿{discountAmount}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-sm font-bold text-white">
          <span>ยอดชำระสุทธิ (ประเมิน)</span>
          <span className="text-base text-orange-400 font-jetbrains">฿{finalTotal}</span>
        </div>
      </div>

      {/* Sticky Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1A1410]/95 backdrop-blur-md border-t border-white/10 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-slate-400 block">ยอดสุทธิที่ต้องชำระ</span>
            <span className="text-lg font-extrabold text-white font-jetbrains">฿{finalTotal}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/app/checkout")}
            className="flex-1 py-3 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-950/40"
          >
            <span>ดำเนินการจองสล็อตและชำระเงิน</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceCartPage;
