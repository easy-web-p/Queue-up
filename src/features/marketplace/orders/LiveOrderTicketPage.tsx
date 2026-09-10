import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  QrCode,
  Clock,
  CheckCircle2,
  Volume2,
  VolumeX,
  LifeBuoy,
  ChevronLeft,
  Flame,
  Store,
} from "lucide-react";

export const LiveOrderTicketPage: React.FC = () => {
  const { orderId = "ORD-001" } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Mock live ticket state
  const ticket = {
    orderId,
    queueNumber: "Q007",
    status: "PREPARING", // 'TO_PAY' | 'PREPARING' | 'READY' | 'COMPLETED'
    shopName: "ร้านคุณกานต์ กะเพราถาด",
    pickupLocation: "โรงอาหารคอมเพล็กซ์ โซน A ล็อค 04",
    pickupTime: "12:15 น.",
    items: [
      { name: "ข้าวกะเพราหมูกรอบไข่ดาว", qty: 1, price: 55, note: "เผ็ดปานกลาง" },
    ],
    totalAmount: 55,
  };

  const steps = [
    { key: "TO_PAY", label: "รับคำสั่งซื้อ" },
    { key: "PREPARING", label: "กำลังปรุงอาหาร" },
    { key: "READY", label: "พร้อมรับอาหาร" },
    { key: "COMPLETED", label: "เสร็จสิ้น" },
  ];

  const currentStepIdx = 1; // PREPARING

  return (
    <div className="max-w-md mx-auto space-y-4 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/app/orders")}
          className="p-2 rounded-xl bg-[#241C16] border border-white/10 text-slate-300 hover:text-white"
          aria-label="กลับหน้ารายการสั่งซื้อ"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-xs text-slate-300">ตั๋วคิวดิจิทัล (Live Ticket)</span>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2 rounded-xl border transition-colors ${
            soundEnabled
              ? "bg-orange-600/20 border-orange-500/40 text-orange-400"
              : "bg-[#241C16] border-white/10 text-slate-500"
          }`}
          title={soundEnabled ? "เปิดเสียงเตือนเมื่อคิวพร้อมรับ" : "ปิดเสียงเตือน"}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Ticket Surface */}
      <div className="p-6 rounded-3xl bg-[#241C16] border border-orange-500/40 shadow-2xl text-center space-y-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />

        {/* Store Name & Location */}
        <div>
          <span className="text-xs text-orange-400 font-semibold flex items-center justify-center gap-1">
            <Store className="w-3.5 h-3.5" /> {ticket.shopName}
          </span>
          <div className="text-[11px] text-slate-400 mt-0.5">{ticket.pickupLocation}</div>
        </div>

        {/* Big Queue Number */}
        <div className="py-3 px-6 rounded-2xl bg-[#1A1410] border border-orange-500/30 inline-block shadow-inner">
          <span className="text-xs text-slate-400 uppercase tracking-widest block font-medium">
            หมายเลขคิวของคุณ
          </span>
          <span className="text-5xl font-black text-white font-jetbrains tracking-tight text-orange-400">
            {ticket.queueNumber}
          </span>
        </div>

        {/* Status Badge */}
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
            <Flame className="w-3.5 h-3.5" /> ครัวกำลังปรุงอาหาร
          </span>
          <p className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5 text-orange-400" /> เวลานัดรับโดยประมาณ {ticket.pickupTime}
          </p>
        </div>

        {/* QR Code for Collection */}
        <div className="pt-2 flex flex-col items-center">
          <div className="p-3 bg-white rounded-2xl shadow-md">
            <div className="w-36 h-36 border-2 border-slate-900 rounded-xl flex items-center justify-center">
              <QrCode className="w-28 h-28 text-slate-900" />
            </div>
          </div>
          <span className="text-[11px] text-slate-400 mt-2">
            ยื่น QR Code นี้ให้แม่ค้าสแกนเพื่อรับอาหาร
          </span>
        </div>

        {/* 4-Step Lifecycle Timeline */}
        <div className="pt-4 border-t border-white/10">
          <div className="grid grid-cols-4 gap-1 text-center">
            {steps.map((step, idx) => {
              const isPast = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={step.key} className="flex flex-col items-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${
                      isPast
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-orange-600 text-white ring-4 ring-orange-500/20"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] ${
                      isCurrent ? "text-orange-400 font-bold" : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Order Items Snapshot */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-2 text-xs">
        <h3 className="font-bold text-white font-kanit">รายการอาหารในออเดอร์นี้</h3>
        {ticket.items.map((item, idx) => (
          <div key={idx} className="flex items-start justify-between text-slate-300">
            <div>
              <span className="font-semibold text-white">{item.name} x{item.qty}</span>
              {item.note && <div className="text-[11px] text-slate-400">({item.note})</div>}
            </div>
            <span className="font-jetbrains">฿{item.price * item.qty}</span>
          </div>
        ))}
      </div>

      {/* Linked Support Action */}
      <div className="text-center pt-2">
        <button
          onClick={() => navigate(`/support/queue?orderId=${orderId}`)}
          className="text-xs text-slate-400 hover:text-orange-400 flex items-center justify-center gap-1.5 mx-auto transition-colors"
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>พบปัญหาในคำสั่งซื้อนี้? ส่งคำขอช่วยเหลือ (Support Ticket)</span>
        </button>
      </div>
    </div>
  );
};

export default LiveOrderTicketPage;
