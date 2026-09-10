import React, { useState } from "react";
import {
  Key,
  Shield,
  Clock,
  Unlock,
} from "lucide-react";
import { useToast } from "../../../components/ToastProvider.jsx";
import { SupportAccessGrant } from "../../identity/roles/roles";

export const SupportAccessRequests: React.FC = () => {
  const toast = useToast();

  const [filter, setFilter] = useState<"ACTIVE" | "EXPIRED" | "ALL">("ALL");
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Modal Form State
  const [ticketRef, setTicketRef] = useState("TCK-4011");
  const [purposeCode, setPurposeCode] = useState("INVESTIGATE_SAFETY_INCIDENT");
  const [requestedDurationMinutes, setRequestedDurationMinutes] = useState(15);
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "user_phone",
    "user_email",
  ]);

  const [grants, setGrants] = useState<SupportAccessGrant[]>([
    {
      grantId: "grant-891",
      ticketId: "TCK-4011",
      agentId: "agent-kku-04 (วราพร)",
      userId: "usr-student-8902",
      purposeCode: "INVESTIGATE_SAFETY_INCIDENT",
      approvedFields: ["user_phone", "user_email", "emergency_contact"],
      approvedBy: "Supervisor (คุณศิริพร) + Auto-Policy",
      grantedAt: "10 ก.ย. 2026 14:50:00 น.",
      expiresAt: "10 ก.ย. 2026 15:05:00 น.",
    },
    {
      grantId: "grant-885",
      ticketId: "TCK-3982",
      agentId: "agent-kku-02 (ธนกฤต)",
      userId: "usr-student-7714",
      purposeCode: "DISPUTE_REFUND_SETTLEMENT",
      approvedFields: ["user_phone", "payment_transaction_ref"],
      approvedBy: "Finance Specialist (คุณวิชัย)",
      grantedAt: "09 ก.ย. 2026 11:20:00 น.",
      expiresAt: "09 ก.ย. 2026 11:35:00 น.",
      revokedAt: "09 ก.ย. 2026 11:32:00 น.",
    },
  ]);

  const handleCreateGrant = (e: React.FormEvent) => {
    e.preventDefault();
    const newGrant: SupportAccessGrant = {
      grantId: `grant-${Math.floor(100 + Math.random() * 900)}`,
      ticketId: ticketRef,
      agentId: "agent-kku-current (เจ้าหน้าที่ปฏิบัติการ)",
      userId: "usr-student-target",
      purposeCode,
      approvedFields: selectedFields,
      approvedBy: "Auto-Approved via Policy Rule #A12",
      grantedAt: "เมื่อสักครู่",
      expiresAt: `อีก ${requestedDurationMinutes} นาที`,
    };

    setGrants((prev) => [newGrant, ...prev]);
    setShowRequestModal(false);
    toast.success(`อนุมัติสิทธิ์ชั่วคราว (JIT) รหัส ${newGrant.grantId} เรียบร้อย`);
  };

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-kanit flex items-center gap-2">
            <Key className="w-6 h-6 text-blue-400" />
            <span>การขอสิทธิ์เข้าถึงข้อมูลชั่วคราว (Just-In-Time Access)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            ระบบควบคุมการเปิดเผยข้อมูลส่วนบุคคลเฉพาะกิจ มีการจำกัดเวลาและบันทึกประวัติการเข้าอ่านทุกฟิลด์
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRequestModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-md shadow-blue-950/40"
        >
          <Unlock className="w-4 h-4" />
          <span>ขอสิทธิ์เปิดเผยข้อมูล (JIT Request)</span>
        </button>
      </div>

      {/* Security Architecture Principle */}
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-200/90 leading-relaxed space-y-1">
          <div className="font-bold text-blue-300">หลักการ Just-In-Time (JIT) & Break-Glass Security:</div>
          <div>
            เจ้าหน้าที่ฝ่ายสนับสนุนไม่ได้รับสิทธิ์เข้าถึงเบอร์โทรศัพท์และอีเมลลูกค้าโดยทั่วไป
            หากจำเป็นต้องสืบสวนเหตุการณ์แพ้อาหารหรือการโอนเงินผิดพลาด จะต้องยื่นคำขอพร้อมระบุ
            <strong>วัตถุประสงค์ (Purpose)</strong> และ <strong>เลขที่ตั๋ว (Ticket ID)</strong>
            สิทธิ์จะหมดอายุอัตโนมัติภายใน 15-30 นาที
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit text-xs font-bold">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            filter === "ALL"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          ทั้งหมด ({grants.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("ACTIVE")}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            filter === "ACTIVE"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-white"
          }`}
        >
          กำลังใช้งาน ({grants.filter((g) => !g.revokedAt).length})
        </button>
      </div>

      {/* Grants List */}
      <div className="space-y-3">
        {grants.map((grant) => {
          const isExpired = Boolean(grant.revokedAt);

          return (
            <div
              key={grant.grantId}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {grant.grantId}
                  </span>
                  <span className="text-xs font-semibold text-white">
                    อ้างอิงตั๋ว: <span className="font-mono text-orange-400">{grant.ticketId}</span>
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-xs text-slate-300">{grant.purposeCode}</span>
                </div>

                <div className="flex items-center gap-2">
                  {isExpired ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      หมดอายุแล้ว (Expired)
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                      <Clock className="w-3 h-3" />
                      <span>สิทธิ์ใช้งานอยู่ (Active)</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">ผู้ขอสิทธิ์:</span>
                  <p className="font-medium text-slate-200 mt-0.5">{grant.agentId}</p>
                </div>
                <div>
                  <span className="text-slate-500">ผู้อนุมัติ:</span>
                  <p className="font-medium text-emerald-400 mt-0.5">{grant.approvedBy}</p>
                </div>
                <div>
                  <span className="text-slate-500">ระยะเวลา:</span>
                  <p className="font-mono text-slate-300 mt-0.5">
                    {grant.grantedAt} ➔ {grant.expiresAt}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2 text-xs">
                <span className="text-slate-500">ฟิลด์ที่ได้รับอนุมัติให้เปิดเผย:</span>
                <div className="flex flex-wrap gap-1.5">
                  {grant.approvedFields.map((f, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-blue-300 border border-slate-700 font-mono text-[11px]"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white font-kanit flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-400" />
              <span>ยื่นขอสิทธิ์เปิดเผยข้อมูลชั่วคราว (JIT Elevation)</span>
            </h3>

            <form onSubmit={handleCreateGrant} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium">หมายเลขตั๋วที่เกี่ยวข้อง (Ticket ID)</label>
                <input
                  type="text"
                  required
                  value={ticketRef}
                  onChange={(e) => setTicketRef(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">วัตถุประสงค์ในการขอเข้าถึงข้อมูล (Purpose)</label>
                <select
                  value={purposeCode}
                  onChange={(e) => setPurposeCode(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="INVESTIGATE_SAFETY_INCIDENT">สืบสวนเหตุการณ์สารก่อภูมิแพ้ / ความปลอดภัย</option>
                  <option value="DISPUTE_REFUND_SETTLEMENT">ตรวจสอบสลิปการโอนและข้อพิพาทการคืนเงิน</option>
                  <option value="CONTACT_LOST_ORDER">ติดต่อลูกค้ารับอาหารตกค้างในเวลาเร่งด่วน</option>
                  <option value="GUARDIAN_VERIFICATION">ตรวจสอบความถูกต้องคำขอผูกบัญชีผู้ปกครอง</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium">ข้อมูลที่จำเป็นต้องเปิดเผย</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {[
                    { id: "user_phone", label: "เบอร์โทรศัพท์ลูกค้า (Unmask Phone)" },
                    { id: "user_email", label: "อีเมลสถาบัน (Unmask Email)" },
                    { id: "emergency_contact", label: "เบอร์ติดต่อฉุกเฉิน / ผู้ปกครอง" },
                    { id: "order_full_history", label: "ประวัติออเดอร์ในรอบ 24 ชม." },
                  ].map((field) => (
                    <label
                      key={field.id}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                        selectedFields.includes(field.id)
                          ? "bg-blue-600/20 border-blue-500 text-white"
                          : "bg-slate-800/80 border-slate-700 text-slate-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field.id)}
                        onChange={() => toggleField(field.id)}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0"
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium">ระยะเวลาที่ต้องการ (นาที)</label>
                <div className="flex gap-2 mt-1.5">
                  {[15, 30, 60].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setRequestedDurationMinutes(min)}
                      className={`flex-1 py-2 rounded-xl font-bold border transition-colors ${
                        requestedDurationMinutes === min
                          ? "bg-blue-600 text-white border-blue-500"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {min} นาที
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow"
                >
                  ยืนยันการขอสิทธิ์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportAccessRequests;
