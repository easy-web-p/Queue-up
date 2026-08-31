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
    <div className="seller-assistant-backdrop" onClick={onClose}>
      <div className="seller-assistant-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="seller-assistant-header">
          <div className="d-flex align-items-center gap-2">
            <span className="seller-assistant-title">Seller Assistant</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="seller-btn-icon" title="ขยาย" onClick={() => alert("ระบบกำลังทำงานแบบเต็มหน้าจอ")}>
              <i className="bi bi-arrows-angle-expand" />
            </button>
            <button className="seller-btn-icon" onClick={onClose} aria-label="ปิด">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="seller-assistant-notice">
          <i className="bi bi-megaphone-fill text-warning me-1" />
          <span>ประกาศ 1/1 &gt;</span>
        </div>

        {/* Body Content */}
        <div className="seller-assistant-body">
          {/* Greeting */}
          <div className="seller-greeting-box">
            <h5 className="seller-greeting-title">
              สวัสดีค่ะคุณผู้ขาย 😊 <span className="text-danger fw-bold">{userName}</span>
            </h5>
            <p className="seller-greeting-sub">คุณสามารถเลือกหัวข้อที่ต้องการสอบถามจากรายการด้านล่างนี้ได้เลยค่ะ</p>
          </div>

          {/* Navigation Tabs */}
          <div className="seller-tabs">
            <button
              className={`seller-tab-btn ${activeTab === "recommended" ? "active" : ""}`}
              onClick={() => setActiveTab("recommended")}
            >
              Recommended
            </button>
            <button
              className={`seller-tab-btn ${activeTab === "promo" ? "active" : ""}`}
              onClick={() => setActiveTab("promo")}
            >
              เครื่องมือส่งเสริมการขาย
            </button>
            <button
              className={`seller-tab-btn ${activeTab === "refund" ? "active" : ""}`}
              onClick={() => setActiveTab("refund")}
            >
              การคืน / ยกเลิก
            </button>
          </div>

          {/* Tab Content Cards */}
          <div className="seller-accordion-list">
            <button
              className="seller-accordion-item"
              onClick={() => handleQuickQuestion("ติดตามสถานะสินค้า (สำหรับผู้ขาย)")}
            >
              <span>🚚 ติดตามสถานะสินค้า (สำหรับผู้ขาย)</span>
              <i className="bi bi-chevron-right" />
            </button>

            <button
              className="seller-accordion-item"
              onClick={() => handleQuickQuestion("เปลี่ยนชื่อร้านค้าได้อย่างไร?")}
            >
              <span>เปลี่ยนชื่อร้านค้าได้อย่างไร?</span>
              <i className="bi bi-chevron-right" />
            </button>

            <button
              className="seller-accordion-item"
              onClick={() => handleQuickQuestion("ดาวน์โหลดรายรับของฉัน")}
            >
              <span>ดาวน์โหลดรายรับของฉัน</span>
              <i className="bi bi-chevron-right" />
            </button>

            <button
              className="seller-accordion-item"
              onClick={() => handleQuickQuestion("วิธีตั้งค่าการใช้งานผ่อนชำระผ่านบัตรเครดิตสำหรับร้านค้า")}
            >
              <span>วิธีตั้งค่าการใช้งานผ่อนชำระผ่านบัตรเครดิตสำหรับร้านค้า</span>
              <i className="bi bi-chevron-right" />
            </button>
          </div>

          {/* Quick Pill Action Badges */}
          <div className="seller-pill-row">
            <button className="seller-pill-btn" onClick={() => handleQuickQuestion("ยืนยันตัวตนสำหรับผู้ขาย")}>
              ยืนยันตัวตนสำหรับผู้ขาย
            </button>
            <button className="seller-pill-btn" onClick={() => handleQuickQuestion("ตั้งค่าช่องทางการชำระเงิน")}>
              ตั้งค่าช่องทางการชำระเงิน
            </button>
          </div>

          {/* Chat Conversation History */}
          {chatLogs.length > 0 && (
            <div className="seller-chat-history">
              {chatLogs.map((log, index) => (
                <div
                  key={index}
                  className={`seller-chat-bubble ${log.sender === "user" ? "seller-chat-user" : "seller-chat-bot"}`}
                >
                  {log.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Chat Footer */}
        <div className="seller-assistant-footer">
          <form onSubmit={handleSendMsg} className="seller-chat-form">
            <div className="seller-input-wrapper">
              <input
                type="text"
                className="seller-chat-input"
                placeholder="พิมพ์เพื่อคุยกับ Shogi เช่น ตามของ~"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
              />
              <button type="submit" className="seller-send-btn" title="ส่งข้อความ">
                <i className="bi bi-send-fill" />
              </button>
            </div>
          </form>

          <div className="seller-footer-quick-actions">
            <button
              className="seller-quick-tag"
              onClick={() => handleQuickQuestion("เช็คคำสั่งซื้อทั้งหมด")}
            >
              <i className="bi bi-card-checklist me-1" /> คำสั่งซื้อ
            </button>
            <button
              className="seller-quick-tag"
              onClick={() => handleQuickQuestion("เปิดเครื่องมือการตลาด AI")}
            >
              <i className="bi bi-grid me-1" /> เครื่องมือ
            </button>
          </div>

          <div className="seller-footer-credit">
            สร้างโดย AI และอยู่ภายใต้<span className="text-decoration-underline ms-1">เงื่อนไขการให้บริการ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
