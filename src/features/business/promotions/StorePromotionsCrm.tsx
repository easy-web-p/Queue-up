import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Tag,
  Plus,
  Users,
  Sparkles,
  Shield,
} from "lucide-react";
import { useToast } from "../../../components/ToastProvider.jsx";

interface Coupon {
  id: string;
  code: string;
  title: string;
  discountType: "PERCENT" | "FIXED_SATANG";
  discountValue: number;
  minSpendSatang: number;
  validUntil: string;
  usedCount: number;
  maxUses: number;
  isActive: boolean;
}

export const StorePromotionsCrm: React.FC = () => {
  const { shopId = "store-kku-01" } = useParams<{ shopId: string }>();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"coupons" | "audiences">("coupons");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Coupon Form
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDiscount, setNewDiscount] = useState(10);
  const [newMinSpend, setNewMinSpend] = useState(50);

  const [coupons, setCoupons] = useState<Coupon[]>([
    {
      id: "coup-1",
      code: "LUNCH10",
      title: "ส่วนลดช่วงก่อนเที่ยง 10%",
      discountType: "PERCENT",
      discountValue: 10,
      minSpendSatang: 5000,
      validUntil: "30 ก.ย. 2026",
      usedCount: 142,
      maxUses: 300,
      isActive: true,
    },
    {
      id: "coup-2",
      code: "REPEAT5",
      title: "ลูกค้าประจำลด ฿5",
      discountType: "FIXED_SATANG",
      discountValue: 500,
      minSpendSatang: 4500,
      validUntil: "15 ต.ค. 2026",
      usedCount: 89,
      maxUses: 200,
      isActive: true,
    },
  ]);

  // Privacy-Preserving Audiences State
  const [selectedCriteria, setSelectedCriteria] = useState("LOYAL_CUSTOMERS");
  const audienceInsights = {
    LOYAL_CUSTOMERS: {
      label: "ลูกค้าประจำที่สั่งซื้อมากกว่า 3 ครั้งใน 30 วัน",
      estimatedReach: 248,
      avgSpendBaht: 72,
      predictedConversion: "34%",
    },
    OFF_PEAK_DINERS: {
      label: "ลูกค้าที่สั่งอาหารช่วงก่อนเที่ยง (10:30 - 11:30 น.)",
      estimatedReach: 135,
      avgSpendBaht: 55,
      predictedConversion: "28%",
    },
    DORM_STUDENTS: {
      label: "นักศึกษาหอพักในที่สั่งอาหารช่วงเย็น (16:00 - 18:00 น.)",
      estimatedReach: 312,
      avgSpendBaht: 65,
      predictedConversion: "41%",
    },
  };

  const currentInsight = audienceInsights[selectedCriteria as keyof typeof audienceInsights];

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newTitle.trim()) return;

    const created: Coupon = {
      id: `coup-${Date.now()}`,
      code: newCode.trim().toUpperCase(),
      title: newTitle.trim(),
      discountType: "PERCENT",
      discountValue: newDiscount,
      minSpendSatang: newMinSpend * 100,
      validUntil: "31 ต.ค. 2026",
      usedCount: 0,
      maxUses: 100,
      isActive: true,
    };

    setCoupons((prev) => [created, ...prev]);
    setShowCreateModal(false);
    setNewCode("");
    setNewTitle("");
    toast.success(`สร้างคูปองส่วนลด ${created.code} สำเร็จ`);
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-kanit flex items-center gap-2">
            <Tag className="w-6 h-6 text-orange-400" />
            <span>โปรโมชัน & การตลาดลูกค้า (Promotions & CRM)</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            ร้านค้า: <span className="text-orange-400 font-mono font-medium">{shopId}</span> • จัดการโค้ดส่วนลดและกลุ่มเป้าหมายแบบไม่เปิดเผยตัวตน
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors shadow-md shadow-orange-950/40"
        >
          <Plus className="w-4 h-4" />
          <span>สร้างคูปองส่วนลดใหม่</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("coupons")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "coupons"
              ? "bg-orange-600 text-white shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>คูปองของร้าน ({coupons.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audiences")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "audiences"
              ? "bg-orange-600 text-white shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>กลุ่มเป้าหมายความเป็นส่วนตัวสูง (Privacy Audiences)</span>
        </button>
      </div>

      {/* Tab 1: Coupons */}
      {activeTab === "coupons" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      {coupon.code}
                    </span>
                    <h3 className="font-bold text-sm text-white mt-2">{coupon.title}</h3>
                  </div>

                  <span
                    className={`w-2 h-2 rounded-full ${
                      coupon.isActive ? "bg-emerald-400" : "bg-zinc-600"
                    }`}
                    title={coupon.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  />
                </div>

                <div className="text-xs text-zinc-400 space-y-1 pt-1 border-t border-zinc-800/80">
                  <div className="flex justify-between">
                    <span>ส่วนลด:</span>
                    <span className="text-white font-medium">
                      {coupon.discountType === "PERCENT"
                        ? `${coupon.discountValue}%`
                        : `฿${coupon.discountValue / 100}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>ยอดสั่งซื้อขั้นต่ำ:</span>
                    <span className="text-white font-medium">
                      ฿{(coupon.minSpendSatang / 100).toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>ใช้แล้ว:</span>
                    <span className="text-orange-400 font-mono font-medium">
                      {coupon.usedCount} / {coupon.maxUses} สิทธิ์
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500 pt-1">
                    <span>หมดอายุ:</span>
                    <span>{coupon.validUntil}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Privacy-Preserving Audiences */}
      {activeTab === "audiences" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200/90 leading-relaxed">
              <span className="font-bold text-blue-300">การตลาดเพื่อการรักษาความเป็นส่วนตัว: </span>
              ร้านค้าสามารถเลือกเกณฑ์พฤติกรรมรวมเพื่อส่งแคมเปญกระตุ้นยอดขายได้ แต่ระบบจะแสดงผลลัพธ์เป็น
              <strong>จำนวนคนและสถิติภาพรวม</strong> เท่านั้น โดยไม่มีการเปิดเผยรายชื่อ เบอร์โทร หรือข้อมูลส่วนตัวของนักศึกษา
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-5">
            <h3 className="font-bold text-sm text-white font-kanit">
              เลือกเงื่อนไขกลุ่มลูกค้าที่ต้องการวิเคราะห์
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(audienceInsights) as Array<keyof typeof audienceInsights>).map((key) => (
                <div
                  key={key}
                  onClick={() => setSelectedCriteria(key)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    selectedCriteria === key
                      ? "bg-orange-600/10 border-orange-500 text-white shadow-sm"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <span className="text-xs font-bold text-white mb-2">
                    {audienceInsights[key].label}
                  </span>
                  <div className="font-mono text-xl font-black text-orange-400">
                    ~{audienceInsights[key].estimatedReach} <span className="text-xs text-zinc-400">คน</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Aggregate Statistics Preview */}
            <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <span>การวิเคราะห์โดยประมาณของกลุ่มที่เลือก</span>
              </h4>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-zinc-800/60">
                  <div className="text-[11px] text-zinc-400">จำนวนกลุ่มเป้าหมาย</div>
                  <div className="font-mono font-bold text-lg text-white mt-0.5">
                    {currentInsight.estimatedReach}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-zinc-800/60">
                  <div className="text-[11px] text-zinc-400">ยอดใช้จ่ายเฉลี่ย</div>
                  <div className="font-mono font-bold text-lg text-emerald-400 mt-0.5">
                    ฿{currentInsight.avgSpendBaht}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-zinc-800/60">
                  <div className="text-[11px] text-zinc-400">คาดการณ์ตอบรับ</div>
                  <div className="font-mono font-bold text-lg text-orange-400 mt-0.5">
                    {currentInsight.predictedConversion}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toast.info("ระบบจำลอง: บรอดแคสต์ข้อเสนอไปยังกลุ่มเป้าหมายเรียบร้อย")}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors shadow-md shadow-orange-950/40"
            >
              ยิงคูปองส่วนลดพิเศษไปยังกลุ่มลูกค้านี้ (Broadcast Offer)
            </button>
          </div>
        </div>
      )}

      {/* Create Coupon Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#18181B] border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white font-kanit">สร้างคูปองส่วนลดใหม่</h3>

            <form onSubmit={handleCreateCoupon} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-300">รหัสคูปอง (Coupon Code)</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น LUNCH15"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300">ชื่อแคมเปญ</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ลดพิเศษ 10% ช่วงมื้อกลางวัน"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-300">ส่วนลด (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newDiscount}
                    onChange={(e) => setNewDiscount(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300">ยอดสั่งซื้อขั้นต่ำ (บาท)</label>
                  <input
                    type="number"
                    min={0}
                    value={newMinSpend}
                    onChange={(e) => setNewMinSpend(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors shadow"
                >
                  ยืนยันสร้างคูปอง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorePromotionsCrm;
