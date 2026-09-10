import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Store, ChevronRight, AlertTriangle } from "lucide-react";

// Mock stores assigned to current merchant account
const ASSIGNED_STORES = [
  {
    id: "store-kku-01",
    name: "ร้านคุณกานต์ กะเพราถาด",
    zone: "โรงอาหารคอมเพล็กซ์ โซน A ล็อค 04",
    role: "Store Owner",
    isOpen: true,
    activeOrders: 4,
  },
  {
    id: "store-kku-student-01",
    name: "Craft Tea Club (ร้านเครื่องดื่มนักศึกษา)",
    zone: "โรงอาหารคอมเพล็กซ์ โซน C ล็อค 12",
    role: "Store Manager",
    isOpen: true,
    activeOrders: 1,
  },
];

export const StoreSelectorPage: React.FC = () => {
  const navigate = useNavigate();

  // Decision 2: If exactly 1 store assigned, redirect immediately
  useEffect(() => {
    if (ASSIGNED_STORES.length === 1) {
      navigate(`/business/${ASSIGNED_STORES[0].id}/overview`, { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#121214] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center font-bold text-white text-xl mx-auto shadow-lg shadow-orange-950/40">
            Q
          </div>
          <h1 className="text-xl font-bold font-kanit text-white">QueueUp Business Console</h1>
          <p className="text-xs text-zinc-400">
            เลือกร้านค้าที่คุณต้องการเข้าปฏิบัติงานประจำวัน
          </p>
        </div>

        {/* Operational Safety Alert */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <span className="font-bold text-amber-300">ความปลอดภัยในการจัดการ: </span>
            คุณได้รับมอบหมายให้ดูแลมากกว่า 1 ร้านค้า กรุณาเลือกร้านค้าให้ตรงกับหน้าที่เพื่อป้องกันการอัปเดตสต็อกหรือราคาผิดร้าน
          </div>
        </div>

        {/* Store List */}
        <div className="space-y-3">
          {ASSIGNED_STORES.map((store) => (
            <div
              key={store.id}
              onClick={() => navigate(`/business/${store.id}/overview`)}
              className="p-4 rounded-2xl bg-[#18181B] border border-zinc-800 hover:border-orange-500/50 cursor-pointer transition-all flex items-center justify-between group shadow-sm hover:shadow-orange-950/20"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-orange-400 group-hover:bg-orange-600/20 transition-colors">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white group-hover:text-orange-400 transition-colors">
                      {store.name}
                    </h3>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        store.isOpen ? "bg-emerald-400" : "bg-zinc-600"
                      }`}
                      title={store.isOpen ? "เปิดทำการ" : "ปิดทำการ"}
                    />
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{store.zone}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                    <span className="text-orange-400/90 font-medium">{store.role}</span>
                    <span>•</span>
                    <span>{store.activeOrders} ออเดอร์ที่กำลังดำเนินการ</span>
                  </div>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
            </div>
          ))}
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-zinc-500">
          สิทธิ์การเข้าถึงถูกจำกัดเฉพาะร้านค้าที่ได้รับมอบหมายเท่านั้น
        </p>
      </div>
    </div>
  );
};

export default StoreSelectorPage;
