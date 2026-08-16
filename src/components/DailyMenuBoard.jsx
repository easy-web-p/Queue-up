import { useState } from "react";
import "./DailyMenuBoard.css";

const MOCK_ANNOUNCEMENTS = [
  {
    id: "ann-1",
    shopName: "ร้านป้าแดง ตามสั่ง & ไก่ทอด",
    tag: "ประกาศประจำวัน",
    title: "วันนี้มีเมนูพิเศษ ต้มยำกุ้งน้ำข้นสดใหม่ จำกัดเพียง 30 ชุดเท่านั้น!",
    time: "10 นาทีที่แล้ว",
    icon: "bi-megaphone-fill",
  },
  {
    id: "ann-2",
    shopName: "ร้านก๋วยเตี๋ยวเรือเสือร้องไห้",
    tag: "อัปเดตวัตถุดิบ",
    title: "ตับหมูสดใหม่และลูกชิ้นปลาคัดพิเศษ พร้อมเสิร์ฟในมื้อเที่ยงนี้ครับ",
    time: "25 นาทีที่แล้ว",
    icon: "bi-info-circle-fill",
  },
  {
    id: "ann-3",
    shopName: "ร้านสเต็กพี่ตั้ม School Food",
    tag: "โปรโมชันจองล่วงหน้า",
    title: "เปิดรับสั่งจองเซตสเต็กไก่พริกไทยดำ + ชามะนาว สำหรับมื้อเที่ยงพรุ่งนี้",
    time: "1 ชั่วโมงที่แล้ว",
    icon: "bi-tag-fill",
  },
];

const MOCK_DAILY_SPECIALS = {
  Mon: [
    { name: "ข้าวผัดกระเพรากุ้งสดไข่ดาว", price: 60, shop: "ร้านป้าแดง ตามสั่ง", status: "พร้อมจอง" },
    { name: "ก๋วยเตี๋ยวต้มยำหมูมะนาว", price: 50, shop: "ร้านก๋วยเตี๋ยวเรือเสือ", status: "พร้อมจอง" },
  ],
  Tue: [
    { name: "ข้าวไก่กรอบซอสน้ำปลา", price: 55, shop: "ร้านป้าแดง ตามสั่ง", status: "พร้อมจอง" },
    { name: "สเต็กหมูพริกไทยดำ", price: 79, shop: "ร้านสเต็กพี่ตั้ม", status: "พร้อมจอง" },
  ],
  Wed: [
    { name: "ข้าวหมูกรอบคั่วพริกเกลือ", price: 65, shop: "ร้านป้าแดง ตามสั่ง", status: "พร้อมจอง" },
    { name: "ราเมนซุปกระดูกหมูเข้มข้น", price: 75, shop: "ร้านก๋วยเตี๋ยวเรือเสือ", status: "พร้อมจอง" },
  ],
  Thu: [
    { name: "ข้าวหน้าเนื้อสไลด์ไข่ดอง", price: 79, shop: "ร้านสเต็กพี่ตั้ม", status: "พร้อมจอง" },
    { name: "แกงเขียวหวานไก่โรตี", price: 55, shop: "ร้านป้าแดง ตามสั่ง", status: "พร้อมจอง" },
  ],
  Fri: [
    { name: "ชุดเบอร์เกอร์ปลา + เฟรนช์ฟรายส์", price: 89, shop: "ร้านสเต็กพี่ตั้ม", status: "พร้อมจอง" },
    { name: "บะหมี่เกี๊ยวหมูกรอบน้ำใส", price: 55, shop: "ร้านก๋วยเตี๋ยวเรือเสือ", status: "พร้อมจอง" },
  ],
};

export default function DailyMenuBoard() {
  const [selectedDay, setSelectedDay] = useState("Mon");

  const daysList = [
    { id: "Mon", label: "วันจันทร์" },
    { id: "Tue", label: "วันอังคาร" },
    { id: "Wed", label: "วันพุธ" },
    { id: "Thu", label: "วันพฤหัสบดี" },
    { id: "Fri", label: "วันศุกร์" },
  ];

  return (
    <div className="daily-board-wrapper">
      {/* Merchant Announcement Header */}
      <div className="daily-board-header">
        <div className="d-flex align-items-center gap-3">
          <div className="daily-board-icon">
            <i className="bi bi-broadcast" />
          </div>
          <div>
            <h5 className="daily-board-title">ข่าวสารและเมนูประจำวันจากร้านค้า</h5>
            <p className="daily-board-subtitle">
              รับทราบอัปเดตเมนูพิเศษ กำหนดการวัตถุดิบ และโปรโมชันจองล่วงหน้า
            </p>
          </div>
        </div>
      </div>

      {/* Announcements Ticker Feed */}
      <div className="announcement-cards-row">
        {MOCK_ANNOUNCEMENTS.map((item) => (
          <div key={item.id} className="announcement-card">
            <div className="announcement-badge">
              <i className={`bi ${item.icon} me-1`} />
              {item.tag}
            </div>
            <div className="announcement-shop">
              <i className="bi bi-shop me-1 text-primary" />
              {item.shopName}
            </div>
            <p className="announcement-text">{item.title}</p>
            <div className="announcement-time">
              <i className="bi bi-clock me-1" />
              {item.time}
            </div>
          </div>
        ))}
      </div>

      {/* Daily Specials Calendar Schedule */}
      <div className="daily-specials-section">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h6 className="fw-bold text-dark mb-0">
            <i className="bi bi-journal-bookmark-fill text-primary me-2" />
            ตารางเมนูพิเศษประจำวันในสัปดาห์นี้
          </h6>
          <div className="day-picker-chips">
            {daysList.map((d) => (
              <button
                key={d.id}
                className={`day-chip ${selectedDay === d.id ? "active" : ""}`}
                onClick={() => setSelectedDay(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="daily-specials-grid">
          {MOCK_DAILY_SPECIALS[selectedDay]?.map((menu, idx) => (
            <div key={idx} className="daily-special-card">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="daily-shop-tag">
                    <i className="bi bi-store me-1" />
                    {menu.shop}
                  </span>
                  <h6 className="fw-bold mb-1 text-dark">{menu.name}</h6>
                  <span className="text-primary fw-bold fs-5">฿{menu.price}</span>
                </div>
                <button className="btn btn-sm btn-primary fw-bold rounded-pill px-3">
                  <i className="bi bi-calendar-plus me-1" />
                  จองล่วงหน้า
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
