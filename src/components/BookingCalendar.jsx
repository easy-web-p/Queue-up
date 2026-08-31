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

const MOCK_HOURLY_PREP = [
  { time: "11:00 - 11:15 น.", count: 5, capacity: 20, status: "low" },
  { time: "11:15 - 11:30 น.", count: 12, capacity: 20, status: "medium" },
  { time: "11:30 - 11:45 น.", count: 18, capacity: 20, status: "high" },
  { time: "11:45 - 12:00 น.", count: 20, capacity: 20, status: "full" },
  { time: "12:00 - 12:15 น.", count: 20, capacity: 20, status: "full" },
  { time: "12:15 - 12:30 น.", count: 16, capacity: 20, status: "high" },
  { time: "12:30 - 12:45 น.", count: 9, capacity: 20, status: "medium" },
  { time: "12:45 - 13:00 น.", count: 4, capacity: 20, status: "low" },
];

export default function BookingCalendar({ viewMode = "user", storeId = "store_canteen01", orders = [] }) {
  const [selectedDate, setSelectedDate] = useState("2026-08-17");
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

    // For default demo canteen "store_canteen01" or "STORE-DEMO01", show demo prep data if no orders
    if ((storeId === "store_canteen01" || storeId === "STORE-DEMO01") && orders.length === 0) {
      return MOCK_HOURLY_PREP;
    }

    // For specific store (new store or real orders), count orders per time slot
    return timeSlots.map((slot) => {
      const count = orders.filter((o) => o.time === slot || o.timeSlot === slot).length;
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
          <span className="booking-status-badge status-ready">
            <i className="bi bi-check-circle-fill me-1" />
            พร้อมรับตามนัด
          </span>
        );
      case "COOKING":
        return (
          <span className="booking-status-badge status-cooking">
            <i className="bi bi-fire me-1" />
            ร้านกำลังเตรียมปรุง
          </span>
        );
      case "PENDING":
        return (
          <span className="booking-status-badge status-pending">
            <i className="bi bi-clock-history me-1" />
            รับออเดอร์แล้ว (รอนัดหมาย)
          </span>
        );
      default:
        return (
          <span className="booking-status-badge status-completed">
            <i className="bi bi-journal-check me-1" />
            เสร็จสิ้น
          </span>
        );
    }
  };

  return (
    <div className="booking-calendar-wrapper">
      {/* Header Control */}
      <div className="booking-calendar-header">
        <div className="booking-title-group">
          <div className="booking-icon-box">
            <i className="bi bi-calendar3" />
          </div>
          <div>
            <h5 className="booking-title">ปฏิทินตารางการจองและเวลารับอาหาร</h5>
            <p className="booking-subtitle">
              วางแผนสั่งจองอาหารล่วงหน้า และติดตามกำหนดการเสิร์ฟแบบเรียลไทม์
            </p>
          </div>
        </div>

        <div className="booking-view-toggle">
          <button
            className={`booking-toggle-btn ${activeTab === "user" ? "active" : ""}`}
            onClick={() => setActiveTab("user")}
          >
            <i className="bi bi-person-badge me-1" />
            ตารางจองของฉัน
          </button>
          <button
            className={`booking-toggle-btn ${activeTab === "merchant" ? "active" : ""}`}
            onClick={() => setActiveTab("merchant")}
          >
            <i className="bi bi-shop me-1" />
            แผนความหนาแน่นร้านค้า
          </button>
        </div>
      </div>

      {/* Date Bar Picker */}
      <div className="booking-date-bar">
        <label className="booking-date-label">
          <i className="bi bi-calendar-event me-1" /> เลือกวันที่:
        </label>
        <div className="booking-date-chips">
          {["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"].map((d) => (
            <button
              key={d}
              className={`booking-date-chip ${selectedDate === d ? "selected" : ""}`}
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
        <div className="booking-cards-grid">
          {MOCK_USER_BOOKINGS.filter((b) => b.date === selectedDate).map((booking) => (
            <div key={booking.id} className="booking-card">
              <div className="booking-card-head">
                <div>
                  <span className="booking-id">เลขคิว {booking.queueNo}</span>
                  <div className="booking-shop-name">
                    <i className="bi bi-shop me-1 text-primary" />
                    {booking.shopName}
                  </div>
                  <div className="booking-canteen-location">
                    <i className="bi bi-geo-alt me-1" />
                    {booking.canteenName}
                  </div>
                </div>
                {getStatusBadge(booking.status)}
              </div>

              <div className="booking-card-body">
                <div className="booking-time-highlight">
                  <i className="bi bi-clock-fill me-2 text-warning" />
                  <span>เวลานัดรับอาหาร: <strong>{booking.timeSlot}</strong></span>
                </div>

                <div className="booking-items-list">
                  {booking.items.map((item, idx) => (
                    <div key={idx} className="booking-item-row">
                      <span>{item.name} x{item.qty}</span>
                      <strong className="text-dark">฿{item.price * item.qty}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="booking-card-foot">
                <span>ราคารวมทั้งสิ้น: <strong className="text-primary fs-5">฿{booking.totalPrice}</strong></span>
                <button className="booking-action-btn">
                  <i className="bi bi-qr-code-scan me-1" />
                  แสดงสลิปการจอง
                </button>
              </div>
            </div>
          ))}

          {MOCK_USER_BOOKINGS.filter((b) => b.date === selectedDate).length === 0 && (
            <div className="booking-empty-state">
              <i className="bi bi-calendar-x display-4 text-muted mb-2" />
              <h6>ยังไม่มีตารางสั่งจองอาหารในวันที่เลือก</h6>
              <p className="text-muted small mb-0">เลือกร้านค้าและสั่งจองอาหารล่วงหน้าสำหรับมื้อนี้ได้เลย</p>
            </div>
          )}
        </div>
      ) : (
        /* Merchant Density & Capacity Matrix */
        <div className="merchant-prep-matrix">
          <div className="merchant-prep-header">
            <h6 className="fw-bold mb-1">
              <i className="bi bi-bar-chart-steps me-2 text-primary" />
              ความหนาแน่นออเดอร์ตามช่วงเวลานัดรับ (Hourly Capacity Planner)
            </h6>
            <p className="text-muted small mb-0">
              ช่วยร้านค้าคาดการณ์ปริมาณการทำอาหารและเตรียมวัตถุดิบป้องกันคิวยาวหน้าร้าน
            </p>
          </div>

          <div className="prep-time-grid">
            {hourlyPrepData.map((slot, idx) => (
              <div key={idx} className={`prep-time-card status-${slot.status}`}>
                <div className="prep-time-label">
                  <i className="bi bi-clock me-1" />
                  {slot.time}
                </div>
                <div className="prep-time-count">
                  <strong>{slot.count}</strong> / {slot.capacity} ออเดอร์
                </div>
                <div className="prep-progress-bar">
                  <div
                    className="prep-progress-fill"
                    style={{ width: `${(slot.count / slot.capacity) * 100}%` }}
                  />
                </div>
                <span className="prep-status-text">
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
