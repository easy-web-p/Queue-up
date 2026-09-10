import React, { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { useToast } from "../../../components/ToastProvider.jsx";

export const StoreInventoryManager: React.FC = () => {
  const toast = useToast();

  const [inventory] = useState([
    {
      id: "inv-1",
      name: "หมูกรอบ (สูตรคั่วเตาถ่าน)",
      category: "เนื้อสัตว์",
      currentQty: 2.5,
      reservedQty: 0.5,
      unit: "กิโลกรัม",
      minThreshold: 3.0,
      isLow: true,
    },
    {
      id: "inv-2",
      name: "ข้าวหอมมะลิ",
      category: "วัตถุดิบหลัก",
      currentQty: 25.0,
      reservedQty: 3.0,
      unit: "กิโลกรัม",
      minThreshold: 10.0,
      isLow: false,
    },
    {
      id: "inv-3",
      name: "ไข่ไก่เบอร์ 2",
      category: "ท็อปปิ้ง",
      currentQty: 90,
      reservedQty: 12,
      unit: "ฟอง",
      minThreshold: 30,
      isLow: false,
    },
  ]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-lg text-white font-kanit">
            จัดการสต็อกและคลังวัตถุดิบ (Inventory)
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            บันทึกการเบิกจ่าย, ปริมาณคงเหลือ, และการแจ้งเตือนของใกล้หมด
          </p>
        </div>

        <button
          onClick={() => toast.info("เปิดฟอร์มรับเข้าวัตถุดิบ (Restock)")}
          className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow"
        >
          <Plus className="w-4 h-4" />
          <span>บันทึกเติมวัตถุดิบ</span>
        </button>
      </div>

      {/* Inventory Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {inventory.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-2xl bg-[#18181B] border space-y-3 ${
              item.isLow ? "border-amber-500/50" : "border-zinc-800"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">{item.name}</h3>
                <span className="text-[11px] text-zinc-400">{item.category}</span>
              </div>
              {item.isLow && (
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 block">คงเหลือพร้อมใช้</span>
                <span className="text-xl font-bold font-jetbrains text-white">
                  {item.currentQty - item.reservedQty} {item.unit}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-zinc-500 block">สำรองในออเดอร์</span>
                <span className="text-xs text-zinc-400 font-jetbrains">
                  {item.reservedQty} {item.unit}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StoreInventoryManager;
