import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Shield,
  Lock,
  Unlock,
  Key,
  DollarSign,
  Send,
  Store,
} from "lucide-react";
import { maskPhone, maskEmail } from "../../identity/roles/roles";
import { useToast } from "../../../components/ToastProvider.jsx";

export const SupportTicketDetail: React.FC = () => {
  const toast = useToast();
  const { ticketId = "TCK-4011" } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  const [isJitElevated, setIsJitElevated] = useState(false);
  const [showJitModal, setShowJitModal] = useState(false);
  const [jitReason, setJitReason] = useState("INVESTIGATE_SAFETY_INCIDENT");

  const [messageText, setMessageText] = useState("");
  const [messageVisibility, setMessageVisibility] = useState<
    "CUSTOMER_VISIBLE" | "STORE_VISIBLE" | "SUPPORT_INTERNAL"
  >("CUSTOMER_VISIBLE");

  const [messages, setMessages] = useState([
    {
      id: "msg-1",
      sender: "ผู้ปกครอง (ด.ช. ภัทรพล)",
      text: "สั่งก๋วยเตี๋ยวเรือ แต่ในชามมีถั่วลิสงโรยมาด้วย น้องมีประวัติแพ้ถั่วลิสงรุนแรง ตอนนี้ต้องพาไปห้องพยาบาลครับ",
      time: "10 นาทีที่แล้ว",
      visibility: "CUSTOMER_VISIBLE",
    },
    {
      id: "msg-2",
      sender: "ระบบตรวจสอบความปลอดภัย (System)",
      text: "[AI Security Event] ตรวจพบคีย์เวิร์ด 'แพ้ถั่ว' และ 'ห้องพยาบาล' — ระบบปรับระดับตั๋วเป็น CRITICAL อัตโนมัติ",
      time: "9 นาทีที่แล้ว",
      visibility: "SUPPORT_INTERNAL",
    },
  ]);

  const rawPhone = "0891234821";
  const rawEmail = "natthaphon@school.ac.th";

  const handleElevateAccess = (e: React.FormEvent) => {
    e.preventDefault();
    setIsJitElevated(true);
    setShowJitModal(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: "เจ้าหน้าที่สนับสนุน (Support Agent)",
        text: messageText.trim(),
        time: "เมื่อสักครู่",
        visibility: messageVisibility,
      },
    ]);
    setMessageText("");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/support/queue")}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
            aria-label="กลับหน้ารวมตั๋ว"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg text-white font-kanit">
                ตั๋วเลขที่: {ticketId}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                CRITICAL SLA
              </span>
            </div>
            <p className="text-xs text-slate-400">หมวดหมู่: รายงานสารก่อภูมิแพ้ / ความปลอดภัย</p>
          </div>
        </div>

        {/* JIT Access Status Banner */}
        <div className="flex items-center gap-2">
          {isJitElevated ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold animate-pulse">
              <Unlock className="w-4 h-4 text-amber-400" />
              <span>โหมดสิทธิ์ชั่วคราว (JIT Active 14:59 น.)</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowJitModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow"
            >
              <Key className="w-4 h-4" />
              <span>ขอปลดล็อกข้อมูลชั่วคราว (JIT)</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left Column: Masked User Profile & Order Context */}
        <div className="space-y-4">
          {/* Masked User Profile */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                ข้อมูลผู้ใช้ (Masked PII)
              </span>
              <span className="text-[10px] text-slate-500">Least-Privilege</span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div>
                <span className="text-slate-500 block text-[11px]">รหัสอ้างอิงภายใน</span>
                <span className="font-mono text-white">USR-8492</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">เบอร์โทรติดต่อ</span>
                <span className="font-mono text-white">
                  {isJitElevated ? rawPhone : maskPhone(rawPhone)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">อีเมล</span>
                <span className="font-mono text-white">
                  {isJitElevated ? rawEmail : maskEmail(rawEmail)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">ประวัติแพ้อาหาร (Health Record)</span>
                {isJitElevated ? (
                  <span className="text-rose-400 font-semibold">
                    แพ้รุนแรง: ถั่วลิสง (Anaphylaxis risk)
                  </span>
                ) : (
                  <span className="text-slate-500 italic flex items-center gap-1">
                    <Lock className="w-3 h-3" /> ข้อมูลสุขภาพถูกซ่อน (ต้องใช้ JIT Access)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ticket-Linked Order Snapshot */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Store className="w-4 h-4 text-orange-400" />
                ออเดอร์ที่เกี่ยวข้อง: ORD-9012
              </span>
              <span className="text-[10px] text-slate-500">คิว Q007</span>
            </div>

            <div className="space-y-1 text-xs text-slate-300">
              <div className="font-semibold text-white">ก๋วยเตี๋ยวเรืออยุธยา ป้าสมศรี</div>
              <div>• ก๋วยเตี๋ยวเรือน้ำตกหมู (฿50)</div>
              <div className="text-[11px] text-slate-400 pt-1">
                ยอดเงิน: <strong>฿50.00</strong> (ชำระผ่าน Campus Wallet)
              </div>
            </div>

            <button
              onClick={() => toast.info("ส่งคำขอเสนอเงินคืน (Refund Proposal) ไปยังผู้เชี่ยวชาญการเงิน")}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-amber-500/30 transition-colors"
            >
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span>เสนอขอคืนเงิน (Propose Refund)</span>
            </button>
          </div>
        </div>

        {/* Right Column: Scoped Conversation Thread */}
        <div className="md:col-span-2 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden min-h-[450px]">
          {/* Thread messages */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  msg.visibility === "SUPPORT_INTERNAL"
                    ? "bg-slate-800/80 border-slate-700 text-slate-300"
                    : msg.sender.includes("เจ้าหน้าที่")
                    ? "bg-blue-900/30 border-blue-500/40 text-blue-100 ml-6"
                    : "bg-slate-850 border-slate-750 text-slate-200 mr-6"
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-white">{msg.sender}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        msg.visibility === "SUPPORT_INTERNAL"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-blue-500/20 text-blue-300"
                      }`}
                    >
                      {msg.visibility}
                    </span>
                    <span className="text-slate-500">{msg.time}</span>
                  </div>
                </div>
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 space-y-2 bg-slate-950/60">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">ระดับการมองเห็น:</span>
              <select
                value={messageVisibility}
                onChange={(e) =>
                  setMessageVisibility(
                    e.target.value as "CUSTOMER_VISIBLE" | "STORE_VISIBLE" | "SUPPORT_INTERNAL"
                  )
                }
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
              >
                <option value="CUSTOMER_VISIBLE">ลูกค้ามองเห็น (Customer Visible)</option>
                <option value="STORE_VISIBLE">ร้านค้ามองเห็น (Store Visible)</option>
                <option value="SUPPORT_INTERNAL">บันทึกภายในเท่านั้น (Support Internal)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="พิมพ์ข้อความตอบกลับหรือบันทึกภายใน..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                aria-label="ส่งข้อความ"
                title="ส่งข้อความ"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* JIT Access Request Modal */}
      {showJitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base font-kanit">ขอสิทธิ์ชั่วคราว (Just-in-Time Access)</h3>
                <p className="text-xs text-slate-400">
                  ระบบจะบันทึก Audit Event ทุกฟิลด์ที่ถูกเปิดเผยเพื่อความโปร่งใส
                </p>
              </div>
            </div>

            <form onSubmit={handleElevateAccess} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">วัตถุประสงค์ในการขอเข้าถึง:</label>
                <select
                  value={jitReason}
                  onChange={(e) => setJitReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  <option value="INVESTIGATE_SAFETY_INCIDENT">
                    ตรวจสอบเหตุการณ์สารก่อภูมิแพ้ฉุกเฉิน (Safety/Allergen)
                  </option>
                  <option value="REFUND_VERIFICATION">
                    ตรวจสอบการเงินและยืนยันการคืนเงิน (Refund Verification)
                  </option>
                  <option value="CUSTOMER_DISPUTE">แก้ปัญหาข้อพิพาทออเดอร์ (Dispute)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700 text-slate-300 space-y-1">
                <div className="font-semibold text-amber-300">ฟิลด์ที่จะถูกเปิดเผย (15 นาที):</div>
                <div>• เบอร์โทรศัพท์ลูกค้า (Unmasked Phone)</div>
                <div>• ประวัติสารก่อภูมิแพ้ที่ลงทะเบียนไว้ (Allergen Health Record)</div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJitModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  ยืนยันขอสิทธิ์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportTicketDetail;
