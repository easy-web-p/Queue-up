import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Store,
  Clock,
  MapPin,
  ShieldCheck,
  Lock,
  Save,
} from "lucide-react";
import { useToast } from "../../../components/ToastProvider.jsx";

export const StoreSettingsPage: React.FC = () => {
  const { shopId = "store-kku-01" } = useParams<{ shopId: string }>();
  const toast = useToast();

  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [storeName, setStoreName] = useState("ร้านคุณกานต์ กะเพราถาด");
  const [description, setDescription] = useState("กะเพราแท้รสจัดจ้าน หมูกรอบทอดใหม่ทุกเช้า เสิร์ฟบนถาดร้อนๆ");
  const [prepTimeDefault, setPrepTimeDefault] = useState(5);
  const [slotCapacity, setSlotCapacity] = useState(15);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setOpenCloseTime] = useState("16:00");
  const [pickupInstructions, setPickupInstructions] = useState("รับอาหารที่ช่องรับออเดอร์ออนไลน์ ฝั่งซ้ายของหน้าร้าน");
  const [allergenStatement, setAllergenStatement] = useState("อาหารจานด่วนใช้น้ำมันพืช ทางร้านมีเมนูแยกสำหรับผู้แพ้อาหารทะเล กรุณาแจ้งในหมายเหตุ");
  const [announcement, setAnnouncement] = useState("วันนี้มีเมนูพิเศษ: กะเพราเป็ดย่างน้ำมันหอย จำนวนจำกัด 30 จาน!");

  // Approval-sensitive fields (read-only without campus approval request)
  const lockedFields = {
    ownerName: "นาย กานต์ วิทยาศิริกุล",
    studentVendorStatus: "ไม่ใช่ร้านค้านักศึกษา (General Merchant)",
    campusZone: "โรงอาหารคอมเพล็กซ์ โซน A ล็อค 04 (KKU Complex)",
    settlementAccount: "ธนาคารไทยพาณิชย์ ••••-••••-8219 (นาย กานต์)",
    foodSafetyCert: "ผ่านการรับรองสุขาภิบาลอาหาร มข. (หมดอายุ 31 ธ.ค. 2026)",
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("บันทึกการตั้งค่าร้านค้าเรียบร้อยแล้ว");
    }, 600);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-kanit">
            ตั้งค่าข้อมูลร้านค้า (Store Settings)
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            ร้านค้า: <span className="text-orange-400 font-mono font-medium">{shopId}</span> • จัดการข้อมูลหน้าร้าน รอบเวลา และคำแนะนำการรับอาหาร
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-md shadow-orange-950/40 disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{isSaving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: General Store Profile */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-white font-kanit flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Store className="w-4 h-4 text-orange-400" />
            <span>ข้อมูลพื้นฐานของร้านค้า (Public Profile)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-300">ชื่อร้านค้าที่แสดง</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-300">คำอธิบายร้านค้า</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-300">ประกาศหน้าร้าน (Public Announcement)</label>
              <input
                type="text"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="ข้อความแจ้งลูกค้า เช่น วันนี้เปิดถึงบ่ายสอง..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-300 text-xs focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Operational Times & Slot Capacity */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-white font-kanit flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Clock className="w-4 h-4 text-orange-400" />
            <span>เวลาทำการ & ความจุสล็อตคิว (Capacity Management)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">เวลาเปิดร้าน</label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">เวลาปิดร้าน</label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setOpenCloseTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                เวลาปรุงเฉลี่ยตั้งต้น (นาที/ออเดอร์)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={prepTimeDefault}
                onChange={(e) => setPrepTimeDefault(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                ขีดจำกัดออเดอร์ต่อรอบเวลา (Slot Limit)
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={slotCapacity}
                onChange={(e) => setSlotCapacity(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
              />
              <p className="text-[11px] text-zinc-500">
                ระบบจะปิดรับออเดอร์ในรอบเวลานั้นอัตโนมัติหากเกินขีดจำกัด
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Pickup & Food Safety Instructions */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-white font-kanit flex items-center gap-2 border-b border-zinc-800 pb-3">
            <MapPin className="w-4 h-4 text-orange-400" />
            <span>จุดรับอาหาร & นโยบายสารก่อภูมิแพ้</span>
          </h3>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                คำแนะนำจุดรับอาหารสำหรับลูกค้า
              </label>
              <input
                type="text"
                value={pickupInstructions}
                onChange={(e) => setPickupInstructions(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                คำชี้แจงการจัดการสารก่อภูมิแพ้ประจำร้าน
              </label>
              <textarea
                rows={2}
                value={allergenStatement}
                onChange={(e) => setAllergenStatement(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Locked Fields Requiring Campus Approval */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold text-zinc-200 font-kanit flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>ข้อมูลสำคัญที่ต้องผ่านการอนุมัติจากส่วนกลาง (Campus Approval Required)</span>
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              ควบคุมโดยมหาลัย
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            การแก้ไขข้อมูลเหล่านี้ต้องยื่นคำร้องต่อผู้ดูแลโรงอาหารส่วนกลาง เพื่อความถูกต้องทางกฎหมายและบัญชีการเงิน
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1">
              <span className="text-zinc-500 font-medium">เจ้าของร้าน / ผู้ถือสัญญา:</span>
              <p className="font-semibold text-white">{lockedFields.ownerName}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1">
              <span className="text-zinc-500 font-medium">สถานะประเภทร้านค้า:</span>
              <p className="font-semibold text-white">{lockedFields.studentVendorStatus}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1">
              <span className="text-zinc-500 font-medium">โซนและล็อคที่ตั้งร้าน:</span>
              <p className="font-semibold text-white">{lockedFields.campusZone}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1">
              <span className="text-zinc-500 font-medium">บัญชีรับเงินโอนค่าอาหาร (Settlement):</span>
              <p className="font-mono text-zinc-300">{lockedFields.settlementAccount}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1 sm:col-span-2">
              <span className="text-zinc-500 font-medium">ใบรับรองสุขาภิบาลอาหาร:</span>
              <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>{lockedFields.foodSafetyCert}</span>
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StoreSettingsPage;
