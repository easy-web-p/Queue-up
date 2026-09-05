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
    <div className="daily-board-wrapper bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 transition-all">
      {/* Merchant Announcement Header */}
      <div className="daily-board-header flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="daily-board-icon w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-xl shadow-md shadow-sky-500/20">
            <i className="bi bi-broadcast" />
          </div>
          <div>
            <h5 className="daily-board-title font-bold text-lg text-slate-900 dark:text-white mb-0">ข่าวสารและเมนูประจำวันจากร้านค้า</h5>
            <p className="daily-board-subtitle text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
              รับทราบอัปเดตเมนูพิเศษ กำหนดการวัตถุดิบ และโปรโมชันจองล่วงหน้า
            </p>
          </div>
        </div>
      </div>

      {/* Announcements Ticker Feed */}
      <div className="announcement-cards-row grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {MOCK_ANNOUNCEMENTS.map((item) => (
          <div key={item.id} className="announcement-card bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="announcement-badge inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#ee4d2d] dark:text-orange-400 mb-2 w-fit">
                <i className={`bi ${item.icon} me-1`} />
                {item.tag}
              </div>
              <div className="announcement-shop text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                <i className="bi bi-shop me-1 text-[#ee4d2d]" />
                {item.shopName}
              </div>
              <p className="announcement-text text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug mb-3">{item.title}</p>
            </div>
            <div className="announcement-time text-[11px] text-slate-400 flex items-center gap-1">
              <i className="bi bi-clock me-1" />
              {item.time}
            </div>
          </div>
        ))}
      </div>

      {/* Daily Specials Calendar Schedule */}
      <div className="daily-specials-section mt-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h6 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base mb-0 flex items-center gap-2">
            <i className="bi bi-journal-bookmark-fill text-[#ee4d2d]" />
            ตารางเมนูพิเศษประจำวันในสัปดาห์นี้
          </h6>
          <div className="day-picker-chips flex items-center gap-1.5 flex-wrap">
            {daysList.map((d) => (
              <button
                key={d.id}
                className={`day-chip px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedDay === d.id
                    ? "active bg-[#ee4d2d] text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
                onClick={() => setSelectedDay(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="daily-specials-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MOCK_DAILY_SPECIALS[selectedDay]?.map((menu, idx) => (
            <div key={idx} className="daily-special-card bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-sm hover:border-[#ee4d2d]/40 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <span className="daily-shop-tag text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    <i className="bi bi-store me-1 text-slate-400" />
                    {menu.shop}
                  </span>
                  <h6 className="font-bold mb-1 text-slate-900 dark:text-white text-sm sm:text-base">{menu.name}</h6>
                  <span className="text-[#ee4d2d] font-black text-lg">฿{menu.price}</span>
                </div>
                <button className="btn btn-sm btn-primary fw-bold rounded-full px-3 py-1 text-xs bg-[#ee4d2d] hover:bg-[#ff7337] border-0 text-white shadow-sm flex items-center gap-1 cursor-pointer">
                  <i className="bi bi-calendar-plus" />
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
