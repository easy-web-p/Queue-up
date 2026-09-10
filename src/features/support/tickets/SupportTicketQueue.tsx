import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export const SupportTicketQueue: React.FC = () => {
  const navigate = useNavigate();

  const tickets = [
    {
      id: "TCK-4011",
      category: "Allergen or safety incident",
      categoryName: "รายงานสารก่อภูมิแพ้",
      priority: "CRITICAL",
      status: "OPEN",
      userAlias: "ผู้ปกครอง (ด.ช. ภัทรพล)",
      orderRef: "ORD-9012",
      subject: "พบส่วนผสมถั่วลิสงในก๋วยเตี๋ยว ทั้งที่ตั้งค่าแพ้ถั่วในระบบ",
      createdAt: "10 นาทีที่แล้ว",
    },
    {
      id: "TCK-4009",
      category: "Payment pending",
      categoryName: "สลิปโอนเงินรอยืนยัน",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      userAlias: "นักศึกษา (น***@kku.ac.th)",
      orderRef: "ORD-8941",
      subject: "โอนผ่าน PromptPay แต่สถานะคิวไม่เปลี่ยนเป็นชำระแล้ว",
      createdAt: "35 นาทีที่แล้ว",
    },
    {
      id: "TCK-4005",
      category: "Queue status problem",
      categoryName: "ปัญหาการเรียกคิว",
      priority: "LOW",
      status: "RESOLVED",
      userAlias: "นักศึกษา รหัส 64xxx",
      orderRef: "ORD-8870",
      subject: "เสียงเตือนกระดิ่งไม่ดังในโทรศัพท์",
      createdAt: "2 ชั่วโมงที่แล้ว",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-lg sm:text-xl text-white font-kanit">
            คิวคำขอความช่วยเหลือ (Support Ticket Queue)
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            ระบบดูแลผู้ใช้แบบแยกสิทธิ์ ข้อมูลส่วนบุคคลถูกปิดบัง (Masked PII) เพื่อความปลอดภัย
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
            1 เคสด่วนมาก (SLA)
          </span>
        </div>
      </div>

      {/* Ticket List */}
      <div className="space-y-3">
        {tickets.map((t) => (
          <div
            key={t.id}
            onClick={() => navigate(`/support/tickets/${t.id}`)}
            className={`p-4 rounded-2xl bg-slate-900/90 border hover:border-blue-500/60 transition-all cursor-pointer shadow-sm group ${
              t.priority === "CRITICAL" ? "border-rose-500/40" : "border-slate-800"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-blue-400 font-jetbrains">{t.id}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      t.priority === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                        : t.priority === "MEDIUM"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {t.priority}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    หมวด: <strong className="text-slate-200">{t.categoryName}</strong>
                  </span>
                </div>

                <h3 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                  {t.subject}
                </h3>

                <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                  <span>ผู้แจ้ง: {t.userAlias}</span>
                  <span>•</span>
                  <span>ออเดอร์อ้างอิง: <strong className="text-slate-300">{t.orderRef}</strong></span>
                  <span>•</span>
                  <span>{t.createdAt}</span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all shrink-0 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupportTicketQueue;
