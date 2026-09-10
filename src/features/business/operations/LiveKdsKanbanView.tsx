import React, { useState } from "react";
import {
  Flame,
  CheckCircle2,
  Clock,
  QrCode,
  Maximize2,
  ShieldAlert,
} from "lucide-react";

interface KdsOrder {
  id: string;
  queueNumber: string;
  customerAlias: string;
  pickupTime: string;
  elapsedMinutes: number;
  status: "waiting" | "cooking" | "ready";
  items: Array<{ name: string; qty: number; note?: string; modifiers?: string[] }>;
  allergens?: string[];
}

export const LiveKdsKanbanView: React.FC = () => {

  const [orders, setOrders] = useState<KdsOrder[]>([
    {
      id: "ord-101",
      queueNumber: "Q007",
      customerAlias: "นักศึกษา (โต๊ะ 4)",
      pickupTime: "12:15 น.",
      elapsedMinutes: 3,
      status: "cooking",
      items: [
        {
          name: "ข้าวกะเพราหมูกรอบไข่ดาว",
          qty: 1,
          modifiers: ["เผ็ดปานกลาง", "เพิ่มไข่ดาวกรอบ"],
        },
      ],
      allergens: ["ถั่วเหลือง", "ไข่ไก่"],
    },
    {
      id: "ord-102",
      queueNumber: "Q008",
      customerAlias: "คุณสมชาย",
      pickupTime: "12:20 น.",
      elapsedMinutes: 1,
      status: "waiting",
      items: [
        {
          name: "ข้าวหมูแดงหมูกรอบ",
          qty: 2,
          modifiers: ["น้ำราดเยอะๆ"],
        },
      ],
    },
    {
      id: "ord-103",
      queueNumber: "Q005",
      customerAlias: "น้องพลอย",
      pickupTime: "12:10 น.",
      elapsedMinutes: 8,
      status: "ready",
      items: [
        {
          name: "ข้าวกะเพราไก่สับ",
          qty: 1,
          modifiers: ["เผ็ดน้อย"],
        },
      ],
    },
  ]);

  // 1-Tap Bump handler passing through state machine
  const handleBump = (orderId: string, currentStatus: "waiting" | "cooking" | "ready") => {
    setOrders((prev) =>
      prev
        .map((order) => {
          if (order.id !== orderId) return order;
          if (currentStatus === "waiting") {
            return { ...order, status: "cooking" as const };
          }
          if (currentStatus === "cooking") {
            return { ...order, status: "ready" as const };
          }
          return null; // When ready -> completed, archive from screen
        })
        .filter(Boolean) as KdsOrder[]
    );
  };

  const waitingOrders = orders.filter((o) => o.status === "waiting");
  const cookingOrders = orders.filter((o) => o.status === "cooking");
  const readyOrders = orders.filter((o) => o.status === "ready");

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
            <h1 className="text-base font-extrabold text-white font-kanit">
              KDS ครัวสัมผัส (Live Kanban)
            </h1>
          </div>
          <span className="text-xs text-zinc-400">
            {orders.length} ออเดอร์กำลังดำเนินการ
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="เต็มจอ Full Screen สำหรับแขวนแท็บเล็ตในครัว"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3-Column Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Waiting to Cook */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-850 border border-zinc-800 text-xs font-bold text-zinc-300">
            <span>1. รอปฏิบัติงาน ({waitingOrders.length})</span>
            <Clock className="w-4 h-4 text-zinc-400" />
          </div>

          <div className="space-y-3">
            {waitingOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-zinc-900 border border-zinc-750 space-y-3 shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-3xl font-black text-white font-jetbrains">
                      {order.queueNumber}
                    </span>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      เวลานัด: {order.pickupTime} ({order.customerAlias})
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
                    รอ {order.elapsedMinutes} นาที
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800 text-xs text-white">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="font-semibold">
                      • {item.name} x{item.qty}
                      {item.modifiers && (
                        <div className="text-[11px] text-orange-400 font-normal ml-3">
                          {item.modifiers.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 1-Tap Bump Button */}
                <button
                  type="button"
                  onClick={() => handleBump(order.id, "waiting")}
                  className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow"
                >
                  <Flame className="w-4 h-4" />
                  <span>1-Tap: เริ่มปรุงอาหาร</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Cooking / In Prep */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            <span>2. กำลังปรุงในครัว ({cookingOrders.length})</span>
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>

          <div className="space-y-3">
            {cookingOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-zinc-900 border-2 border-amber-500/50 space-y-3 shadow-xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-3xl font-black text-amber-400 font-jetbrains">
                      {order.queueNumber}
                    </span>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      เวลานัด: {order.pickupTime} ({order.customerAlias})
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold animate-pulse">
                    ปรุงอยู่ {order.elapsedMinutes} นาที
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800 text-xs text-white">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="font-semibold">
                      • {item.name} x{item.qty}
                      {item.modifiers && (
                        <div className="text-[11px] text-amber-300 font-normal ml-3">
                          {item.modifiers.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Allergen Warning Banner on Ticket */}
                {order.allergens && order.allergens.length > 0 && (
                  <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-[11px] text-rose-300 flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>ระวังสารก่อภูมิแพ้: {order.allergens.join(", ")}</span>
                  </div>
                )}

                {/* 1-Tap Bump Button */}
                <button
                  type="button"
                  onClick={() => handleBump(order.id, "cooking")}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>1-Tap: ปรุงเสร็จ พร้อมรับ</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Ready for Pickup */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400">
            <span>3. พร้อมรับอาหาร ({readyOrders.length})</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="space-y-3">
            {readyOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-zinc-900 border-2 border-emerald-500/50 space-y-3 shadow-xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-3xl font-black text-emerald-400 font-jetbrains">
                      {order.queueNumber}
                    </span>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      ลูกค้ารับที่หน้าร้าน ({order.customerAlias})
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    รอรับของ
                  </span>
                </div>

                <div className="space-y-1 text-xs text-zinc-300 pt-2 border-t border-zinc-800">
                  {order.items.map((item, idx) => (
                    <div key={idx}>
                      • {item.name} x{item.qty}
                    </div>
                  ))}
                </div>

                {/* 1-Tap Bump Complete */}
                <button
                  type="button"
                  onClick={() => handleBump(order.id, "ready")}
                  className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-zinc-700"
                >
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span>สแกน QR / จบออเดอร์ (Complete)</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveKdsKanbanView;
