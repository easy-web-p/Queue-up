import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  LifeBuoy,
  Flame,
  QrCode,
  Store,
} from "lucide-react";

interface OrderSummary {
  id: string;
  queueNumber: string;
  storeId: string;
  storeName: string;
  orderTime: string;
  pickupSlot: string;
  status: "WAITING_PAYMENT" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  items: {
    name: string;
    quantity: number;
    price: number;
    modifiers?: string[];
  }[];
  totalPriceSatang: number;
  paymentMethod: string;
}

export const CustomerOrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");

  const [orders] = useState<OrderSummary[]>([
    {
      id: "ORD-9021",
      queueNumber: "Q007",
      storeId: "store-kku-01",
      storeName: "ร้านคุณกานต์ กะเพราถาด",
      orderTime: "วันนี้ 11:45 น.",
      pickupSlot: "12:15 - 12:25 น.",
      status: "PREPARING",
      items: [
        {
          name: "ข้าวกะเพราหมูกรอบไข่ดาว",
          quantity: 1,
          price: 55,
          modifiers: ["เผ็ดกลาง", "ไข่ดาวสุก"],
        },
      ],
      totalPriceSatang: 5500,
      paymentMethod: "PromptPay QR",
    },
    {
      id: "ORD-8812",
      queueNumber: "T014",
      storeId: "store-kku-student-01",
      storeName: "Craft Tea Club (ร้านนักศึกษา)",
      orderTime: "เมื่อวานนี้ 13:10 น.",
      pickupSlot: "13:25 - 13:35 น.",
      status: "COMPLETED",
      items: [
        {
          name: "ชาไทยเย็นหวานน้อย ชาใต้แท้",
          quantity: 2,
          price: 35,
          modifiers: ["หวาน 25%"],
        },
      ],
      totalPriceSatang: 7000,
      paymentMethod: "Campus Wallet",
    },
    {
      id: "ORD-8740",
      queueNumber: "N003",
      storeId: "store-kku-02",
      storeName: "ป้าต้อย เตี๋ยวต้มยำ",
      orderTime: "08 ก.ย. 2026 12:00 น.",
      pickupSlot: "12:30 - 12:40 น.",
      status: "COMPLETED",
      items: [
        {
          name: "บะหมี่ต้มยำทะเลน้ำข้น",
          quantity: 1,
          price: 65,
          modifiers: ["ไม่ใส่ถั่วงอก"],
        },
      ],
      totalPriceSatang: 6500,
      paymentMethod: "PromptPay QR",
    },
  ]);

  const filteredOrders = orders.filter((order) => {
    if (statusFilter === "ACTIVE") {
      return ["WAITING_PAYMENT", "PREPARING", "READY"].includes(order.status);
    }
    if (statusFilter === "COMPLETED") {
      return order.status === "COMPLETED" || order.status === "CANCELLED";
    }
    return true;
  });

  const getStatusBadge = (status: OrderSummary["status"]) => {
    switch (status) {
      case "WAITING_PAYMENT":
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span>รอชำระเงิน</span>
          </span>
        );
      case "PREPARING":
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 animate-pulse">
            <Flame className="w-3 h-3" />
            <span>กำลังปรุงในครัว</span>
          </span>
        );
      case "READY":
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <QrCode className="w-3 h-3" />
            <span>พร้อมรับอาหาร</span>
          </span>
        );
      case "COMPLETED":
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>รับอาหารแล้ว</span>
          </span>
        );
      case "CANCELLED":
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>ยกเลิกออเดอร์</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-kanit flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-orange-600" />
            <span>ประวัติการสั่งซื้อ & คิวอาหาร</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            ติดตามคิวแบบเรียลไทม์ และดูประวัติการสั่งอาหารย้อนหลัง
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "ALL"
                ? "bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            ทั้งหมด ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "ACTIVE"
                ? "bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            คิวที่กำลังดำเนิน ({orders.filter((o) => ["WAITING_PAYMENT", "PREPARING", "READY"].includes(o.status)).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("COMPLETED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "COMPLETED"
                ? "bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-base">
              ไม่พบรายการสั่งซื้อตามตัวกรองนี้
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
              สั่งอาหารผ่าน QueueUp เพื่อรับตั๋วคิวดิจิทัลและการแจ้งเตือนเมื่ออาหารพร้อมรับ
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isActive = ["WAITING_PAYMENT", "PREPARING", "READY"].includes(order.status);

            return (
              <div
                key={order.id}
                className={`p-5 rounded-2xl bg-white dark:bg-zinc-900 border transition-all ${
                  isActive
                    ? "border-orange-500/40 shadow-sm shadow-orange-950/10 ring-1 ring-orange-500/20"
                    : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                }`}
              >
                {/* Top Bar: Shop info, status, queue pill */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-600 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {order.storeName}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        <span>{order.orderTime}</span>
                        <span>•</span>
                        <span>รับรอบ: {order.pickupSlot}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="px-3 py-1 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white font-mono font-bold text-sm tracking-wider">
                      {order.queueNumber}
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {/* Items Summary */}
                <div className="py-3 space-y-1.5">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-zinc-200">
                          {item.quantity}x
                        </span>{" "}
                        <span className="text-slate-700 dark:text-zinc-300">{item.name}</span>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 ml-1.5">
                            ({item.modifiers.join(", ")})
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-600 dark:text-zinc-400">
                        ฿{item.price * item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                    <span>ยอดรวมสุทธิ:</span>
                    <span className="font-black text-base text-slate-900 dark:text-white font-jetbrains">
                      ฿{(order.totalPriceSatang / 100).toFixed(0)}
                    </span>
                    <span className="text-[11px] text-slate-400">({order.paymentMethod})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Live Ticket CTA for Active Orders */}
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/app/orders/${order.id}`)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-transform active:scale-95 shadow-sm shadow-orange-950/20"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>ดูตั๋วคิวสด (Live Ticket)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/app/orders/${order.id}`)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        รายละเอียด
                      </button>
                    )}

                    {/* Report Problem (Creates Ticket with Context) */}
                    <button
                      type="button"
                      onClick={() => navigate(`/app/account/support?orderId=${order.id}`)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                      title="รายงานปัญหาเกี่ยวกับออเดอร์นี้"
                    >
                      <LifeBuoy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CustomerOrderHistoryPage;
