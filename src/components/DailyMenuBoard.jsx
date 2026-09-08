import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import {
  fetchAnnouncementsFromFirestore,
  createAnnouncementInFirestore,
} from "../services/communityService.js";
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
  const { user } = useAuth();
  const toast = useToast();

  const [selectedDay, setSelectedDay] = useState("Mon");
  const [announcements, setAnnouncements] = useState(MOCK_ANNOUNCEMENTS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState("");
  const [newTag, setNewTag] = useState("ประกาศประจำวัน");
  const [newDay, setNewDay] = useState("Mon");
  const [newPrice, setNewPrice] = useState("");

  const daysList = [
    { id: "Mon", label: "วันจันทร์" },
    { id: "Tue", label: "วันอังคาร" },
    { id: "Wed", label: "วันพุธ" },
    { id: "Thu", label: "วันพฤหัสบดี" },
    { id: "Fri", label: "วันศุกร์" },
  ];

  useEffect(() => {
    let isCancelled = false;
    async function loadAnnouncements() {
      try {
        const remote = await fetchAnnouncementsFromFirestore();
        if (!isCancelled && remote && remote.length > 0) {
          setAnnouncements([...remote, ...MOCK_ANNOUNCEMENTS]);
        }
      } catch (err) {
        console.warn("Could not load announcements from Firestore:", err);
      }
    }
    loadAnnouncements();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.warning("กรุณาเข้าสู่ระบบก่อนโพสต์ประกาศ");
      return;
    }
    if (!newTitle.trim()) {
      toast.warning("กรุณากรอกข้อความประกาศ");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createAnnouncementInFirestore({
        title: newTitle.trim(),
        tag: newTag,
        dayOfWeek: newDay,
        price: newPrice ? Number(newPrice) : null,
        shopName: user.displayName || user.name || "ร้านค้าโรงเรียน",
        authorUid: user.uid,
        time: "เมื่อสักครู่",
        icon: newTag === "โปรโมชันจองล่วงหน้า" ? "bi-tag-fill" : "bi-megaphone-fill",
      });

      setAnnouncements((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setNewTitle("");
      setNewPrice("");
      toast.success("โพสต์ประกาศข่าวสารขึ้นกระดานเรียบร้อยแล้ว!");
    } catch (err) {
      console.error("Create announcement error:", err);
      toast.error("ไม่สามารถโพสต์ประกาศได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Combine specials for the selected day from mock + firestore
  const specialsForSelectedDay = [
    ...(MOCK_DAILY_SPECIALS[selectedDay] || []),
    ...announcements
      .filter((a) => a.dayOfWeek === selectedDay && a.price)
      .map((a) => ({
        name: a.title,
        price: a.price,
        shop: a.shopName,
        status: a.status || "พร้อมจอง",
      })),
  ];

  return (
    <div className="daily-board-wrapper bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 transition-all">
      {/* Merchant Announcement Header */}
      <div className="daily-board-header flex flex-wrap items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="daily-board-icon w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-xl shadow-md shadow-sky-500/20">
            <i className="bi bi-broadcast" aria-hidden="true" />
          </div>
          <div>
            <h5 className="daily-board-title font-bold text-lg text-slate-900 dark:text-white mb-0">ข่าวสารและเมนูประจำวันจากร้านค้า</h5>
            <p className="daily-board-subtitle text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
              รับทราบอัปเดตเมนูพิเศษ กำหนดการวัตถุดิบ และโปรโมชันจองล่วงหน้า
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (!user) {
              toast.warning("กรุณาเข้าสู่ระบบก่อนโพสต์ประกาศ");
              return;
            }
            setIsModalOpen(true);
          }}
          className="btn btn-sm rounded-full px-4 py-2 text-xs font-bold bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md hover:opacity-90 flex items-center gap-2 cursor-pointer transition-all border-0"
        >
          <i className="bi bi-megaphone-fill" aria-hidden="true" />
          <span>โพสต์ประกาศ / เมนูพิเศษ</span>
        </button>
      </div>

      {/* Announcements Ticker Feed */}
      <div className="announcement-cards-row grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {announcements.slice(0, 6).map((item) => (
          <div key={item.id} className="announcement-card bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="announcement-badge inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A] dark:text-orange-400 mb-2 w-fit">
                <i className={`bi ${item.icon || "bi-megaphone-fill"} me-1`} aria-hidden="true" />
                {item.tag || "ประกาศ"}
              </div>
              <div className="announcement-shop text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                <i className="bi bi-shop me-1 text-[#FF7A1A]" aria-hidden="true" />
                {item.shopName}
              </div>
              <p className="announcement-text text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug mb-3">{item.title}</p>
            </div>
            <div className="announcement-time text-[11px] text-slate-400 flex items-center gap-1">
              <i className="bi bi-clock me-1" aria-hidden="true" />
              {item.time || "วันนี้"}
            </div>
          </div>
        ))}
      </div>

      {/* Daily Specials Calendar Schedule */}
      <div className="daily-specials-section mt-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h6 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base mb-0 flex items-center gap-2">
            <i className="bi bi-journal-bookmark-fill text-[#FF7A1A]" aria-hidden="true" />
            ตารางเมนูพิเศษประจำวันในสัปดาห์นี้
          </h6>
          <div className="day-picker-chips flex items-center gap-1.5 flex-wrap">
            {daysList.map((d) => (
              <button
                key={d.id}
                className={`day-chip px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedDay === d.id
                    ? "active bg-[#FF7A1A] text-white shadow-sm"
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
          {specialsForSelectedDay.map((menu, idx) => (
            <div key={idx} className="daily-special-card bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-sm hover:border-[#FF7A1A]/40 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <span className="daily-shop-tag text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    <i className="bi bi-store me-1 text-slate-400" aria-hidden="true" />
                    {menu.shop}
                  </span>
                  <h6 className="font-bold mb-1 text-slate-900 dark:text-white text-sm sm:text-base">{menu.name}</h6>
                  <span className="text-[#FF7A1A] font-black text-lg">฿{menu.price}</span>
                </div>
                <button
                  className="btn btn-sm btn-primary fw-bold rounded-full px-3 py-1 text-xs bg-[#FF7A1A] hover:bg-[#FF7A1A] border-0 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                  onClick={() => toast.info(`เปิดให้จองล่วงหน้าสำหรับ ${menu.name} แล้ว`)}
                >
                  <i className="bi bi-calendar-plus" aria-hidden="true" />
                  จองล่วงหน้า
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Announcement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h5 className="font-bold text-slate-900 dark:text-white text-base mb-0 flex items-center gap-2">
                <i className="bi bi-megaphone-fill text-sky-500" aria-hidden="true" />
                โพสต์ประกาศกระดานข่าว & เมนูพิเศษ
              </h5>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full text-lg cursor-pointer"
                aria-label="ปิด"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ประเภทประกาศ
                </label>
                <select
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="ประกาศประจำวัน">📢 ประกาศประจำวัน</option>
                  <option value="อัปเดตวัตถุดิบ">🥬 อัปเดตวัตถุดิบสดใหม่</option>
                  <option value="โปรโมชันจองล่วงหน้า">🏷️ โปรโมชันจองล่วงหน้า</option>
                  <option value="เมนูพิเศษประจำวัน">🍲 เมนูพิเศษประจำวัน</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ข้อความประกาศ / ชื่อเมนูพิเศษ
                </label>
                <textarea
                  required
                  rows={3}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="เช่น วันนี้มีต้มยำกุ้งน้ำข้นสดใหม่ จำกัดเพียง 30 ชุดเท่านั้น!"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    วันประจำสัปดาห์
                  </label>
                  <select
                    value={newDay}
                    onChange={(e) => setNewDay(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="Mon">วันจันทร์</option>
                    <option value="Tue">วันอังคาร</option>
                    <option value="Wed">วันพุธ</option>
                    <option value="Thu">วันพฤหัสบดี</option>
                    <option value="Fri">วันศุกร์</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ราคา (ถ้ามีเมนูพิเศษ)
                  </label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="เช่น 60"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "กำลังบันทึก..." : "โพสต์ประกาศ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
