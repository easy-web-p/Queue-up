import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Flame,
  CheckCircle2,
  Clock,
  Printer,
  ShieldAlert,
  CreditCard,
  User,
} from "lucide-react";
import { maskPhone } from "../../identity/roles/roles";

export const StoreOrderDetailView: React.FC = () => {
  const { shopId = "store-kku-01", orderId = "ord-101" } = useParams<{
    shopId: string;
    orderId: string;
  }>();
  const navigate = useNavigate();

  const [orderStatus, setOrderStatus] = useState<
    "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED"
  >("PREPARING");

  const [order] = useState({
    id: orderId,
    orderRef: "ORD-9021",
    queueNumber: "Q007",
    createdAt: "10 ก.ย. 2026 11:45:12 น.",
    pickupSlot: "12:15 - 12:25 น.",
    customerDisplayName: "น้องพีท วิศวะฯ",
    customerPhoneMasked: maskPhone("0891234821"),
    paymentMethod: "PromptPay QR",
    paymentState: "PAID",
    totalSatang: 5500,
    hasAllergenAlert: true,
    allergenAlertText: "แพ้อาหารทะเลรุนแรงมาก — ห้ามใช้น้ำมันหรือกระทะที่เคยผัดกุ้ง/ปลาหมึก",
    supportTicketLinked: null,
    items: [
      {
        id: "item-1",
        name: "ข้าวกะเพราหมูกรอบไข่ดาว",
        quantity: 1,
        unitPriceSatang: 5500,
        options: ["ระดับความเผ็ด: เผ็ดกลาง", "ไข่ดาวสุกกรอบ", "ไม่ใส่ถั่วงอก"],
        specialInstructions: "ขอช้อนส้อมพลาสติกด้วยครับ",
      },
    ],
    timeline: [
      {
        title: "ลูกค้าส่งคำสั่งซื้อ & ชำระเงินผ่าน PromptPay",
        time: "11:45:12 น.",
        actor: "Customer (System Verified)",
      },
      {
        title: "ระบบตรวจสอบสลิปและยืนยันรับออเดอร์",
        time: "11:45:15 น.",
        actor: "Server Payment Engine",
      },
      {
        title: "ครัวเริ่มเตรียมปรุงอาหาร (Start Preparation)",
        time: "11:48:00 น.",
        actor: "Kitchen Lead (สมหมาย)",
      },
    ],
  });

  const handleUpdateStatus = (newStatus: "PREPARING" | "READY" | "COMPLETED") => {
    setOrderStatus(newStatus);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/business/${shopId}/orders`)}
            className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors"
            aria-label="ย้อนกลับหน้ารายการออเดอร์"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-extrabold text-lg sm:text-xl text-white font-kanit">
                ออเดอร์ #{order.orderRef}
              </h1>
              <span className="font-mono px-3 py-0.5 rounded-lg bg-orange-600 text-white font-black text-sm">
                คิว {order.queueNumber}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              สร้างเมื่อ: {order.createdAt} • นัดรับรอบ: <strong className="text-white">{order.pickupSlot}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
          >
            <Printer className="w-4 h-4 text-zinc-400" />
            <span>พิมพ์ใบเสร็จครัว</span>
          </button>
        </div>
      </div>

      {/* Critical Allergen Alert Banner */}
      {order.hasAllergenAlert && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-xs text-rose-300 uppercase tracking-wide">
              คำเตือนสารก่อภูมิแพ้ที่ต้องระมัดระวังเป็นพิเศษ
            </h4>
            <p className="text-xs text-rose-200/90 mt-0.5 font-medium leading-relaxed">
              {order.allergenAlertText}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Order Details & Privacy-Preserved Profile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Item Details */}
        <div className="md:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-4">
            <h3 className="font-bold text-sm text-white font-kanit pb-3 border-b border-zinc-800">
              รายการอาหารที่สั่ง
            </h3>

            <div className="space-y-4">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800/80 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-white text-sm">
                        {item.quantity}x {item.name}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-bold text-orange-400">
                      ฿{(item.unitPriceSatang * item.quantity) / 100}
                    </span>
                  </div>

                  {item.options && item.options.length > 0 && (
                    <div className="text-xs text-zinc-400 space-y-0.5 pl-3 border-l-2 border-zinc-700">
                      {item.options.map((opt, i) => (
                        <div key={i}>• {opt}</div>
                      ))}
                    </div>
                  )}

                  {item.specialInstructions && (
                    <div className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 px-3 py-1.5 rounded-lg mt-2">
                      <span className="font-bold">หมายเหตุจากลูกค้า: </span>
                      {item.specialInstructions}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            <div className="pt-3 border-t border-zinc-800 space-y-1.5 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>ราคารวมอาหาร</span>
                <span className="font-mono text-white">฿{(order.totalSatang / 100).toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span>ส่วนลดร้านค้า</span>
                <span className="font-mono text-emerald-400">-฿0</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-zinc-800">
                <span>ยอดสุทธิ</span>
                <span className="font-mono text-orange-400">
                  ฿{(order.totalSatang / 100).toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Operational Status Control */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-3">
            <h3 className="font-bold text-sm text-white font-kanit">
              อัปเดตสถานะคิวในครัว
            </h3>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => handleUpdateStatus("PREPARING")}
                className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  orderStatus === "PREPARING"
                    ? "bg-orange-600 text-white shadow-md shadow-orange-950/40"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>กำลังปรุง (In Prep)</span>
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus("READY")}
                className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  orderStatus === "READY"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>พร้อมรับอาหาร (Ready)</span>
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus("COMPLETED")}
                className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  orderStatus === "COMPLETED"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-950/40"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ลูกค้ารับแล้ว (Done)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Masked Customer Context & Payment */}
        <div className="space-y-4">
          {/* Masked Customer Identity */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-3">
            <h3 className="font-bold text-sm text-white font-kanit flex items-center gap-2">
              <User className="w-4 h-4 text-orange-400" />
              <span>ข้อมูลผู้สั่งอาหาร</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-zinc-500">ชื่อแสดง:</span>
                <p className="font-semibold text-white mt-0.5">{order.customerDisplayName}</p>
              </div>
              <div>
                <span className="text-zinc-500">เบอร์ติดต่อ (Masked):</span>
                <p className="font-mono text-zinc-300 mt-0.5">{order.customerPhoneMasked}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-500 leading-relaxed">
              🔒 ตามหลัก <strong>Least Privilege</strong> ข้อมูลประวัติการแพทย์ ผู้ปกครอง ยอดเงินกระเป๋า และประวัติคำสั่งซื้ออื่นจะไม่แสดงแก่ร้านค้า
            </div>
          </div>

          {/* Payment Summary */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-3">
            <h3 className="font-bold text-sm text-white font-kanit flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>การชำระเงิน</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">ช่องทาง:</span>
                <span className="font-medium text-white">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">สถานะ:</span>
                <span className="text-emerald-400 font-bold">ชำระเรียบร้อย (PAID)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ยอดเงินใน Satang:</span>
                <span className="font-mono text-zinc-300">{order.totalSatang} satang</span>
              </div>
            </div>
          </div>

          {/* Audit Timeline */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-3">
            <h3 className="font-bold text-sm text-white font-kanit flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>บันทึกสถานะ (Audit History)</span>
            </h3>

            <div className="space-y-3">
              {order.timeline.map((evt, idx) => (
                <div key={idx} className="text-xs space-y-0.5 pl-3 border-l-2 border-zinc-700">
                  <div className="font-medium text-zinc-200">{evt.title}</div>
                  <div className="text-[11px] text-zinc-500">
                    {evt.time} • โดย {evt.actor}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreOrderDetailView;
