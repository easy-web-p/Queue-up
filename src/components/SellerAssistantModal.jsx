import { useState } from "react";
import "./SellerAssistantModal.css";

export default function SellerAssistantModal({ isOpen, onClose, userName = "ผู้ขาย" }) {
  const [activeTab, setActiveTab] = useState("recommended");
  const [inputMsg, setInputMsg] = useState("");
  const [chatLogs, setChatLogs] = useState([]);

  if (!isOpen) return null;

  const handleSendMsg = (e) => {
    if (e) e.preventDefault();
    if (!inputMsg.trim()) return;

    const userText = inputMsg.trim();
    const newLogs = [...chatLogs, { sender: "user", text: userText }];
    setChatLogs(newLogs);
    setInputMsg("");

    setTimeout(() => {
      let reply = "ระบบผู้ช่วยผู้ขาย QueueUp (Shogi) ได้รับข้อความแล้วค่ะ มีคำถามเพิ่มเติมเกี่ยวกับการตั้งค่าร้านค้าหรือการจัดคิวอาหารสามารถสอบถามได้เลยค่ะ 💖";
      if (userText.includes("เปลี่ยนชื่อ")) {
        reply = "คุณสามารถเปลี่ยนชื่อร้านค้าได้ในแท็บ 'ตั้งค่าวางแผนร้านค้า & การเงินลับ' ใน Merchant Dashboard ได้ทันทีค่ะ!";
      } else if (userText.includes("รายรับ") || userText.includes("โอนเงิน")) {
        reply = "ยอดรายรับของคุณจะถูกโอนเข้าบัญชี PromptPay ที่ตั้งค่าไว้โดยตรงแบบ Real-time หลังยืนยันออเดอร์ค่ะ";
      } else if (userText.includes("ติดตาม") || userText.includes("ออเดอร์")) {
        reply = "คุณสามารถติดตามออเดอร์และจัดการคิวได้ที่แท็บ 'บอร์ดคิวสั่งอาหารเรียลไทม์' ค่ะ";
      }

      setChatLogs((prev) => [...prev, { sender: "bot", text: reply }]);
    }, 800);
  };

  const handleQuickQuestion = (qText) => {
    setInputMsg(qText);
  };

  return (
    <div className="seller-assistant-backdrop fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-end sm:p-6 transition-all" onClick={onClose}>
      <div className="seller-assistant-card w-full sm:w-[420px] max-h-[90vh] sm:h-[640px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all font-sans" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="seller-assistant-header bg-gradient-to-r from-[#ee4d2d] to-[#ff7337] text-white p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="seller-assistant-title font-bold text-base flex items-center gap-2">
              <i className="bi bi-robot text-lg" />
              Seller Assistant (Shogi AI)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="seller-btn-icon text-white/90 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-all cursor-pointer border-0 bg-transparent" title="ขยาย" onClick={() => alert("ระบบกำลังทำงานแบบเต็มหน้าจอ")}>
              <i className="bi bi-arrows-angle-expand" />
            </button>
            <button className="seller-btn-icon text-white/90 hover:text-white p-1.5 rounded-lg hover:bg-white/20 transition-all cursor-pointer border-0 bg-transparent" onClick={onClose} aria-label="ปิด">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="seller-assistant-notice bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs px-4 py-2 flex items-center justify-between border-b border-amber-100 dark:border-amber-900/40 font-medium">
          <span className="flex items-center gap-1.5">
            <i className="bi bi-megaphone-fill text-amber-500" />
            อัปเดตระบบ AI จัดสรรคิวประจำวัน (เวอร์ชัน 2.4 พร้อมใช้งาน)
          </span>
          <span className="text-[10px] text-amber-500">1/1 &gt;</span>
        </div>

        {/* Body Content */}
        <div className="seller-assistant-body p-4 flex-1 overflow-y-auto space-y-4">
          {/* Greeting */}
          <div className="seller-greeting-box bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <h5 className="seller-greeting-title text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
              สวัสดีค่ะคุณผู้ขาย 😊 <span className="text-[#ee4d2d] font-black">{userName}</span>
            </h5>
            <p className="seller-greeting-sub text-xs text-slate-500 dark:text-slate-400 mb-0">คุณสามารถเลือกหัวข้อที่ต้องการสอบถามจากรายการด้านล่างนี้ได้เลยค่ะ</p>
          </div>

          {/* Navigation Tabs */}
          <div className="seller-tabs flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
            <button
              className={`seller-tab-btn px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-0 ${activeTab === "recommended" ? "active bg-[#ee4d2d] text-white shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
              onClick={() => setActiveTab("recommended")}
            >
              Recommended
            </button>
            <button
              className={`seller-tab-btn px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-0 ${activeTab === "promo" ? "active bg-[#ee4d2d] text-white shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
              onClick={() => setActiveTab("promo")}
            >
              เครื่องมือส่งเสริมการขาย
            </button>
            <button
              className={`seller-tab-btn px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-0 ${activeTab === "refund" ? "active bg-[#ee4d2d] text-white shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
              onClick={() => setActiveTab("refund")}
            >
              การคืน / ยกเลิก
            </button>
          </div>

          {/* Tab Content Cards */}
          <div className="seller-accordion-list space-y-2">
            <button
              className="seller-accordion-item w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-orange-50 dark:hover:bg-orange-950/30 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all cursor-pointer"
              onClick={() => handleQuickQuestion("ติดตามสถานะสินค้า (สำหรับผู้ขาย)")}
            >
              <span>🚚 ติดตามสถานะสินค้า (สำหรับผู้ขาย)</span>
              <i className="bi bi-chevron-right text-slate-400 text-[10px]" />
            </button>

            <button
              className="seller-accordion-item w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-orange-50 dark:hover:bg-orange-950/30 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all cursor-pointer"
              onClick={() => handleQuickQuestion("เปลี่ยนชื่อร้านค้าได้อย่างไร?")}
            >
              <span>🏪 เปลี่ยนชื่อร้านค้าได้อย่างไร?</span>
              <i className="bi bi-chevron-right text-slate-400 text-[10px]" />
            </button>

            <button
              className="seller-accordion-item w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-orange-50 dark:hover:bg-orange-950/30 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all cursor-pointer"
              onClick={() => handleQuickQuestion("ดาวน์โหลดรายรับของฉัน")}
            >
              <span>📊 ดาวน์โหลดรายรับของฉัน</span>
              <i className="bi bi-chevron-right text-slate-400 text-[10px]" />
            </button>

            <button
              className="seller-accordion-item w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-orange-50 dark:hover:bg-orange-950/30 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all cursor-pointer"
              onClick={() => handleQuickQuestion("วิธีตั้งค่าการใช้งานผ่อนชำระผ่านบัตรเครดิตสำหรับร้านค้า")}
            >
              <span>💳 วิธีตั้งค่าการชำระเงินดิจิทัล & บัญชีธนาคาร</span>
              <i className="bi bi-chevron-right text-slate-400 text-[10px]" />
            </button>
          </div>

          {/* Quick Pill Action Badges */}
          <div className="seller-pill-row flex items-center gap-2 flex-wrap pt-1">
            <button className="seller-pill-btn text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-[#ee4d2d]/10 hover:text-[#ee4d2d] border border-slate-200 dark:border-slate-700 font-medium transition-all cursor-pointer text-slate-700 dark:text-slate-300" onClick={() => handleQuickQuestion("ยืนยันตัวตนสำหรับผู้ขาย")}>
              ยืนยันตัวตนสำหรับผู้ขาย
            </button>
            <button className="seller-pill-btn text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-[#ee4d2d]/10 hover:text-[#ee4d2d] border border-slate-200 dark:border-slate-700 font-medium transition-all cursor-pointer text-slate-700 dark:text-slate-300" onClick={() => handleQuickQuestion("ตั้งค่าช่องทางการชำระเงิน")}>
              ตั้งค่าช่องทางการชำระเงิน
            </button>
          </div>

          {/* Chat Conversation History */}
          {chatLogs.length > 0 && (
            <div className="seller-chat-history space-y-2 pt-2">
              {chatLogs.map((log, index) => (
                <div
                  key={index}
                  className={`seller-chat-bubble text-xs p-3 max-w-[85%] leading-relaxed ${
                    log.sender === "user"
                      ? "seller-chat-user bg-[#ee4d2d] text-white ml-auto rounded-2xl rounded-br-none"
                      : "seller-chat-bot bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-auto rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {log.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Chat Footer */}
        <div className="seller-assistant-footer p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <form onSubmit={handleSendMsg} className="seller-chat-form mb-2">
            <div className="seller-input-wrapper flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full px-3 py-1.5 shadow-sm focus-within:border-[#ee4d2d]">
              <input
                type="text"
                className="seller-chat-input flex-1 bg-transparent border-0 text-xs text-slate-900 dark:text-white focus:outline-none"
                placeholder="พิมพ์เพื่อคุยกับ Shogi เช่น ตามของ~"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
              />
              <button type="submit" className="seller-send-btn bg-[#ee4d2d] text-white w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-sm hover:opacity-90 transition-all cursor-pointer border-0" title="ส่งข้อความ">
                <i className="bi bi-send-fill" />
              </button>
            </div>
          </form>

          <div className="seller-footer-quick-actions flex items-center gap-2 mb-1">
            <button
              className="seller-quick-tag text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-[#ee4d2d] flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              onClick={() => handleQuickQuestion("เช็คคำสั่งซื้อทั้งหมด")}
            >
              <i className="bi bi-card-checklist" /> คำสั่งซื้อ
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              className="seller-quick-tag text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-[#ee4d2d] flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              onClick={() => handleQuickQuestion("เปิดเครื่องมือการตลาด AI")}
            >
              <i className="bi bi-grid" /> เครื่องมือ
            </button>
          </div>

          <div className="seller-footer-credit text-[10px] text-slate-400">
            สร้างโดย AI และอยู่ภายใต้<span className="underline ml-1">เงื่อนไขการให้บริการ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
