import { useState } from "react";
import "./BookingCalendar.css";

const MOCK_USER_BOOKINGS = [
  {
    id: "BK-8091",
    shopName: "ร้านป้าแดง ตามสั่ง & ไก่ทอด",
    canteenName: "โรงอาหารกลาง อาคาร 2",
    date: "2026-08-17",
    timeSlot: "11:45 - 12:00 น.",
    items: [
      { name: "ข้าวไก่แซ่บกรอบพิเศษ", qty: 1, price: 55 },
      { name: "ชาไทยเย็นหวานน้อย", qty: 1, price: 30 },
    ],
    totalPrice: 85,
    status: "READY", // PENDING, COOKING, READY, COMPLETED
    queueNo: "A042",
  },
  {
    id: "BK-8095",
    shopName: "ร้านก๋วยเตี๋ยวเรือเสือร้องไห้",
    canteenName: "โรงอาหารกลาง อาคาร 2",
    date: "2026-08-17",
    timeSlot: "12:15 - 12:30 น.",
    items: [{ name: "ก๋วยเตี๋ยวเรือเนื้อหมกเส้นเล็ก", qty: 1, price: 60 }],
    totalPrice: 60,
    status: "COOKING",
    queueNo: "B018",
  },
  {
    id: "BK-8102",
    shopName: "ร้านสเต็กพี่ตั้ม School Food",
    canteenName: "โรงอาหารคณะวิศวกรรมศาสตร์",
    date: "2026-08-18",
    timeSlot: "12:00 - 12:15 น.",
    items: [{ name: "สเต็กไก่พริกไทยดำ + เฟรนช์ฟรายส์", qty: 1, price: 79 }],
    totalPrice: 79,
    status: "PENDING",
    queueNo: "S009",
  },
];

export default function BookingCalendar({ viewMode = "user", storeId = "", orders = [] }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState(viewMode);

  // Compute dynamic capacity slots based on storeId and real orders
  const getCapacitySlots = () => {
    const timeSlots = [
      "11:00 - 11:15 น.",
      "11:15 - 11:30 น.",
      "11:30 - 11:45 น.",
      "11:45 - 12:00 น.",
      "12:00 - 12:15 น.",
      "12:15 - 12:30 น.",
      "12:30 - 12:45 น.",
      "12:45 - 13:00 น.",
    ];

    const relevantOrders = storeId
      ? orders.filter((o) => !o.storeId || o.storeId === storeId)
      : orders;

    // For specific store (new store or real orders), count orders per time slot
    return timeSlots.map((slot) => {
      const count = relevantOrders.filter((o) => o.time === slot || o.timeSlot === slot).length;
      const capacity = 20;
      let status = "low";
      if (count >= capacity) status = "full";
      else if (count >= 15) status = "high";
      else if (count >= 8) status = "medium";

      return {
        time: slot,
        count,
        capacity,
        status,
      };
    });
  };

  const hourlyPrepData = getCapacitySlots();

  const getStatusBadge = (status) => {
    switch (status) {
      case "READY":
        return (
          <span className="booking-status-badge status-ready inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <i className="bi bi-check-circle-fill" />
            พร้อมรับตามนัด
          </span>
        );
      case "COOKING":
        return (
          <span className="booking-status-badge status-cooking inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
            <i className="bi bi-fire" />
            ร้านกำลังเตรียมปรุง
          </span>
        );
      case "PENDING":
        return (
          <span className="booking-status-badge status-pending inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <i className="bi bi-clock-history" />
            รับออเดอร์แล้ว (รอนัดหมาย)
          </span>
        );
      default:
        return (
          <span className="booking-status-badge status-completed inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <i className="bi bi-journal-check" />
            เสร็จสิ้น
          </span>
        );
    }
  };

  return (
    <div className="booking-calendar-wrapper bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 font-sans">
      {/* Header Control */}
      <div className="booking-calendar-header flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="booking-title-group flex items-center gap-3.5">
          <div className="booking-icon-box w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center text-xl shadow-md shadow-orange-500/20">
            <i className="bi bi-calendar3" />
          </div>
          <div>
            <h5 className="booking-title text-base sm:text-lg font-black text-slate-900 dark:text-white m-0">ปฏิทินตารางการจองและเวลารับอาหาร</h5>
            <p className="booking-subtitle text-xs text-slate-500 dark:text-slate-400 m-0">
              วางแผนสั่งจองอาหารล่วงหน้า และติดตามกำหนดการเสิร์ฟแบบเรียลไทม์
            </p>
          </div>
        </div>

        <div className="booking-view-toggle flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1 border border-slate-200/60 dark:border-slate-700/60">
          <button
            className={`booking-toggle-btn px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
              activeTab === "user"
                ? "active bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                : "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            onClick={() => setActiveTab("user")}
          >
            <i className="bi bi-person-badge" />
            ตารางจองของฉัน
          </button>
          <button
            className={`booking-toggle-btn px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
              activeTab === "merchant"
                ? "active bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                : "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            onClick={() => setActiveTab("merchant")}
          >
            <i className="bi bi-shop" />
            แผนความหนาแน่นร้านค้า
          </button>
        </div>
      </div>

      {/* Date Bar Picker */}
      <div className="booking-date-bar flex items-center gap-3 my-4 flex-wrap">
        <label className="booking-date-label text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <i className="bi bi-calendar-event text-orange-500" /> เลือกวันที่:
        </label>
        <div className="booking-date-chips flex gap-2 flex-wrap">
          {["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"].map((d) => (
            <button
              key={d}
              className={`booking-date-chip px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                selectedDate === d
                  ? "selected bg-[#ee4d2d] text-white border-[#ee4d2d] shadow-sm shadow-orange-500/30"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-500/50"
              }`}
              onClick={() => setSelectedDate(d)}
            >
              {d === "2026-08-17"
                ? "วันนี้ (17 ส.ค.)"
                : d === "2026-08-18"
                ? "พรุ่งนี้ (18 ส.ค.)"
                : d}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on Active Tab */}
      {activeTab === "user" ? (
        <div className="booking-cards-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK_USER_BOOKINGS.filter((b) => b.date === selectedDate).map((booking) => (
            <div key={booking.id} className="booking-card bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div className="booking-card-head flex items-start justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
                <div>
                  <span className="booking-id inline-block text-[11px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 px-2 py-0.5 rounded-md mb-1">เลขคิว {booking.queueNo}</span>
                  <div className="booking-shop-name font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <i className="bi bi-shop text-orange-500" />
                    {booking.shopName}
                  </div>
                  <div className="booking-canteen-location text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <i className="bi bi-geo-alt" />
                    {booking.canteenName}
                  </div>
                </div>
                {getStatusBadge(booking.status)}
              </div>

              <div className="booking-card-body py-3 space-y-2">
                <div className="booking-time-highlight flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-800 dark:text-amber-300 text-xs border border-amber-200/60 dark:border-amber-900/40">
                  <i className="bi bi-clock-fill text-amber-500" />
                  <span>เวลานัดรับอาหาร: <strong>{booking.timeSlot}</strong></span>
                </div>

                <div className="booking-items-list space-y-1">
                  {booking.items.map((item, idx) => (
                    <div key={idx} className="booking-item-row flex justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>{item.name} x{item.qty}</span>
                      <strong className="text-slate-900 dark:text-white">฿{item.price * item.qty}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="booking-card-foot flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-slate-700/80 mt-auto">
                <span className="text-xs text-slate-500 dark:text-slate-400">ราคารวมทั้งสิ้น: <strong className="text-orange-600 dark:text-orange-400 text-base font-black">฿{booking.totalPrice}</strong></span>
                <button className="booking-action-btn px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border-0">
                  <i className="bi bi-qr-code-scan" />
                  แสดงสลิปการจอง
                </button>
              </div>
            </div>
          ))}

          {MOCK_USER_BOOKINGS.filter((b) => b.date === selectedDate).length === 0 && (
            <div className="booking-empty-state col-span-full py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <i className="bi bi-calendar-x text-4xl text-slate-300 dark:text-slate-600 mb-2 block" />
              <h6 className="font-bold text-slate-700 dark:text-slate-300 text-sm">ยังไม่มีตารางสั่งจองอาหารในวันที่เลือก</h6>
              <p className="text-slate-400 text-xs mt-1">เลือกร้านค้าและสั่งจองอาหารล่วงหน้าสำหรับมื้อนี้ได้เลย</p>
            </div>
          )}
        </div>
      ) : (
        /* Merchant Density & Capacity Matrix */
        <div className="merchant-prep-matrix bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="merchant-prep-header">
            <h6 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <i className="bi bi-bar-chart-steps text-orange-500" />
              ความหนาแน่นออเดอร์ตามช่วงเวลานัดรับ (Hourly Capacity Planner)
            </h6>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0">
              ช่วยร้านค้าคาดการณ์ปริมาณการทำอาหารและเตรียมวัตถุดิบป้องกันคิวยาวหน้าร้าน
            </p>
          </div>

          <div className="prep-time-grid grid grid-cols-2 sm:grid-cols-4 gap-3">
            {hourlyPrepData.map((slot, idx) => (
              <div key={idx} className={`prep-time-card status-${slot.status} bg-white dark:bg-slate-900 rounded-xl border p-3 shadow-xs space-y-1.5 ${
                slot.status === "full"
                  ? "border-red-500/50 bg-red-50/30 dark:bg-red-950/20"
                  : slot.status === "high"
                  ? "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20"
                  : slot.status === "medium"
                  ? "border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20"
                  : "border-slate-200 dark:border-slate-800"
              }`}>
                <div className="prep-time-label text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <i className="bi bi-clock text-slate-400" />
                  {slot.time}
                </div>
                <div className="prep-time-count text-xs text-slate-600 dark:text-slate-400">
                  <strong className="text-sm font-black text-slate-900 dark:text-white">{slot.count}</strong> / {slot.capacity} ออเดอร์
                </div>
                <div className="prep-progress-bar w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`prep-progress-fill h-full rounded-full transition-all duration-300 ${
                      slot.status === "full"
                        ? "bg-red-500"
                        : slot.status === "high"
                        ? "bg-amber-500"
                        : slot.status === "medium"
                        ? "bg-blue-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${(slot.count / slot.capacity) * 100}%` }}
                  />
                </div>
                <span className={`prep-status-text text-[11px] font-bold block ${
                  slot.status === "full"
                    ? "text-red-600 dark:text-red-400"
                    : slot.status === "high"
                    ? "text-amber-600 dark:text-amber-400"
                    : slot.status === "medium"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {slot.status === "full"
                    ? "เต็มสล็อต (งดรับเพิ่ม)"
                    : slot.status === "high"
                    ? "หนาแน่นสูง"
                    : slot.status === "medium"
                    ? "ปานกลาง"
                    : "ว่างพร้อมรับ"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
