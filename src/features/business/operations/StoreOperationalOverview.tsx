import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Users,
  DollarSign,
  ArrowRight,
} from "lucide-react";

export const StoreOperationalOverview: React.FC = () => {
  const { shopId = "store-kku-01" } = useParams<{ shopId: string }>();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(true);

  // Operational metrics for this store
  const metrics = {
    activeOrders: 4,
    preparingOrders: 3,
    readyOrders: 1,
    delayedOrders: 0,
    slotUtilization: 78, // 78% full for peak lunch slot
    lowStockCount: 1,
    staffOnDuty: 3,
    todayGrossSales: 4850,
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Store Status & KDS Action */}
      <div className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-lg sm:text-xl text-white font-kanit">
              ศูนย์ปฏิบัติการร้านค้า: {shopId}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isOpen
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-400 border-rose-500/30"
              }`}
            >
              {isOpen ? "ร้านเปิดรับออเดอร์" : "ร้านปิดชั่วคราว"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            ภาพรวมคิวในครัว ความจุสล็อตเวลา และยอดขายประจำวัน
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              isOpen
                ? "border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            {isOpen ? "ปิดรับออเดอร์ชั่วคราว" : "เปิดรับออเดอร์ทันที"}
          </button>

          <button
            type="button"
            onClick={() => navigate(`/business/${shopId}/operations`)}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-950/40"
          >
            <Flame className="w-4 h-4 text-white animate-pulse" />
            <span>เปิดหน้าจอครัว KDS</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#18181B] border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">คิวที่รอปรุง</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-black text-white font-jetbrains">
            {metrics.preparingOrders} <span className="text-xs font-normal text-zinc-400">คิว</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#18181B] border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">พร้อมรับอาหาร</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-jetbrains">
            {metrics.readyOrders} <span className="text-xs font-normal text-zinc-400">คิว</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#18181B] border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">การใช้สล็อตเวลาพีก</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-jetbrains">
            {metrics.slotUtilization}% <span className="text-xs font-normal text-zinc-400">เต็ม</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#18181B] border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">ยอดขายรวมวันนี้</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-jetbrains">
            ฿{metrics.todayGrossSales}
          </div>
        </div>
      </div>

      {/* Operational Warnings & Staff */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Low Stock Warning */}
        <div className="p-4 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-xs text-white font-kanit">การแจ้งเตือนสต็อกวัตถุดิบ</h3>
            </div>
            <button
              onClick={() => navigate(`/business/${shopId}/inventory`)}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
            >
              <span>จัดการสต็อก</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>หมูกรอบสูตรโบราณ: เหลือ ~2.5 กก. (ใกล้ถึงจุดสั่งเพิ่ม)</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
              เตือนด่วน
            </span>
          </div>
        </div>

        {/* Staff on Duty */}
        <div className="p-4 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-xs text-white font-kanit">พนักงานที่เข้ากะขณะนี้ (3 คน)</h3>
            </div>
            <button
              onClick={() => navigate(`/business/${shopId}/staff`)}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
            >
              <span>ดูกะทำงาน</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-zinc-300">
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60">
              <span>คุณกานต์ (เจ้าของร้าน / หัวหน้าครัว)</span>
              <span className="text-emerald-400 text-[10px] font-bold">● กำลังประจำการ</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60">
              <span>สมชาย (พนักงานปรุงอาหาร)</span>
              <span className="text-emerald-400 text-[10px] font-bold">● กำลังประจำการ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreOperationalOverview;
