import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { db, doc, getDoc } from "../firebase/config.js";
import PaymentModal from "../components/PaymentModal.jsx";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import ChatModal from "../components/ChatModal.jsx";
import Footer from "../components/Footer.jsx";
import { PRODUCTS_BY_ID } from "../data/mockProducts.js";
import { fetchProductByIdFromFirestore } from "../lib/firebase.js";
import "./ProductDetail.css";

const TIME_SLOTS = [
  { time: "11:30", discount: "-50%" },
  { time: "12:00", discount: "-50%" },
  { time: "12:30", discount: "-20%" },
  { time: "13:00", discount: "-10%" },
  { time: "13:30", discount: "-10%" },
  { time: "14:00", discount: "-10%" },
  { time: "14:30", discount: "-10%" },
  { time: "15:00", discount: "-10%" },
];

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // Find product or fallback to default m1
  const initialProduct = PRODUCTS_BY_ID[id] || PRODUCTS_BY_ID.m1;
  const [product, setProduct] = useState(initialProduct);

  // States
  const [selectedImg, setSelectedImg] = useState(initialProduct.mainImg || initialProduct.image);
  const [guestCount, setGuestCount] = useState("1 คน");
  const [bookingDate, setBookingDate] = useState("10 ส.ค.");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[1]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Profile completeness guard states
  const [isIncompleteProfileModalOpen, setIsIncompleteProfileModalOpen] = useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState([]);

  // Fetch product data dynamically from Firebase Firestore
  useEffect(() => {
    let isMounted = true;
    async function loadProductData() {
      const docData = await fetchProductByIdFromFirestore(id);
      if (isMounted) {
        if (docData) {
          setProduct(docData);
          setSelectedImg(docData.mainImg || docData.image);
        } else {
          const fallback = PRODUCTS_BY_ID[id] || PRODUCTS_BY_ID.m1;
          setProduct(fallback);
          setSelectedImg(fallback.mainImg || fallback.image);
        }
      }
    }
    loadProductData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Price Calculation Logic
  const discountPercent = parseInt((selectedTimeSlot?.discount || "0").replace("-", "").replace("%", "")) / 100;
  const basePrice = Number(product?.price) || 0;
  const discountedUnitPrice = Math.round(basePrice * (1 - discountPercent));
  const guestMultiplier = parseInt(guestCount) || 1;
  const totalCalculatedPrice = discountedUnitPrice * guestMultiplier;

  // Check Profile Completeness Guard
  const checkProfileCompleteness = async () => {
    let profileData = null;

    if (user && user.uid) {
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          profileData = docSnap.data();
        }
      } catch (err) {
        console.warn("Fetch user profile check error:", err);
      }
    }

    if (!profileData) {
      const saved = localStorage.getItem("queueup_user");
      if (saved) {
        try {
          profileData = JSON.parse(saved);
        } catch {}
      }
    }

    const missing = [];
    if (!profileData?.phone || profileData.phone.trim() === "") {
      missing.push("เบอร์โทรศัพท์ (สำหรับ SMS และการแจ้งเตือนคิว)");
    }
    if (!profileData?.gender || profileData.gender.trim() === "") {
      missing.push("เพศ");
    }
    if (!profileData?.birthDate || profileData.birthDate.trim() === "") {
      missing.push("วันเดือนปีเกิด");
    }

    setMissingProfileFields(missing);
    return missing.length > 0;
  };

  const handleNextBooking = async () => {
    const isProfileIncomplete = await checkProfileCompleteness();
    if (isProfileIncomplete) {
      setIsIncompleteProfileModalOpen(true);
      return;
    }
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="shopee-pd-page">
      {/* Payment Gateway Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        amount={totalCalculatedPrice}
        itemTitle={`${product.name} (${guestCount} · ${bookingDate} ${selectedTimeSlot.time})`}
        productId={product.id || id}
        quantity={guestMultiplier}
        discountPercent={discountPercent * 100}
        booking={{ date: bookingDate, time: selectedTimeSlot.time }}
      />

      {/* Header Search Bar */}
      <ShopeeSearchBar />

      <div className="shopee-pd-container">
        {/* Breadcrumb Path: QueueUp > ตำแหน่งโรงอาหาร > ชื่อร้าน > ประเภทอาหาร > ชื่อเมนู */}
        <div className="shopee-pd-breadcrumb">
          <a href="/home" onClick={(e) => { e.preventDefault(); navigate("/home"); }}>
            QueueUp
          </a>
          <span>&gt;</span>
          <a href="/search?keyword=โรงอาหาร" onClick={(e) => { e.preventDefault(); navigate("/search?keyword=โรงอาหาร"); }}>
            <i className="bi bi-geo-alt-fill text-danger me-1" /> {product.shopLocation || "โรงอาหาร 1 (อาคารเรียน 2)"}
          </a>
          <span>&gt;</span>
          <a href={`/search?keyword=${encodeURIComponent(product.shopName)}`} onClick={(e) => { e.preventDefault(); navigate(`/search?keyword=${encodeURIComponent(product.shopName)}`); }}>
            {product.shopName}
          </a>
          <span>&gt;</span>
          <a href={`/search?keyword=${encodeURIComponent(product.categoryLabel || "อาหาร")}`} onClick={(e) => { e.preventDefault(); navigate(`/search?keyword=${encodeURIComponent(product.categoryLabel || "อาหาร")}`); }}>
            <i className="bi bi-tag-fill me-1" /> {product.categoryLabel || "อาหารจานเดียว"}
          </a>
          <span>&gt;</span>
          <span className="shopee-pd-breadcrumb-active">{product.name}</span>
        </div>

        {/* Main 2-Column Split Layout */}
        <div className="queue-pd-split-layout">
          {/* ==========================================================================
              LEFT COLUMN: SELECTED FOOD IMAGE & RECOMMENDED MENU BOX
              ========================================================================== */}
          <div>
            {/* Gallery Box: ถ้ามีรูปเดียวแสดงแค่รูปเดียว ถ้ามีหลายรูปแสดงคอลัมน์ย่อยตามจำนวนรูปที่มีจริง */}
            <div className="queue-pd-left-card">
              <div className="queue-pd-main-img-box">
                <img src={selectedImg} alt={product.name} className="queue-pd-main-img" />
              </div>

              {/* Vertical Thumbnail Column (แสดงเฉพาะเมื่อสินค้ามีมากกว่า 1 รูป) */}
              {product.images && product.images.length > 1 && (
                <div className="queue-pd-vertical-thumbs">
                  {product.images.map((imgUrl, idx) => (
                    <img
                      key={idx}
                      src={imgUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      className={`queue-pd-vthumb-img ${selectedImg === imgUrl ? "active" : ""}`}
                      onClick={() => setSelectedImg(imgUrl)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Recommended Menu & Terms Card */}
            <div className="queue-pd-recommend-box">
              <div className="queue-pd-recommend-header">
                <h3 className="queue-pd-recommend-title">เมนูแนะนำ</h3>
                <span className="queue-pd-discount-badge-pink">{selectedTimeSlot.discount} ⌄</span>
              </div>
              <p className="queue-pd-recommend-desc">
                ส่วนลดพิเศษระบบ QueueUp CRM สามารถใช้ได้กับเมนูอาหารที่เป็นราคาปกติทั้งหมด
                ยกเว้นเมนูที่ระบุไว้ในเงื่อนไขพิเศษ สั่งจองคิวล่วงหน้ารับแต้มสะสมฟรีทันที!
              </p>
            </div>
          </div>

          {/* ==========================================================================
              RIGHT COLUMN: RESTAURANT INFO & BOOKING SYSTEM
              ========================================================================== */}
          <div className="queue-pd-right-card">
            {/* Restaurant Atmosphere Banner Photo */}
            <div className="queue-pd-shop-banner-box">
              <img src={product.shopBanner} alt={product.shopName} className="queue-pd-shop-banner-img" />
            </div>

            {/* Restaurant Title & Info */}
            <div>
              <div className="d-flex align-items-center justify-content-between">
                <h1 className="queue-pd-shop-title mb-0">{product.shopName}</h1>
                <button
                  className="btn btn-sm btn-outline-danger font-weight-bold"
                  onClick={() => setIsChatOpen(true)}
                >
                  <i className="bi bi-chat-dots-fill me-1" /> แชทสอบถามร้านค้า
                </button>
              </div>
              <div className="fw-bold text-primary mb-1 mt-1">{product.name}</div>
              <div className="queue-pd-shop-address">
                {product.shopAddress || "2089 อาคารเรียน 2 (โรงอาหาร 1) แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400"}
              </div>

              <div className="queue-pd-shop-tags-row">
                <span>{product.shopLocation}</span>
                <span>·</span>
                <span>฿฿</span>
                <span>·</span>
                <span>&lt; 500m</span>
              </div>

              <div className="queue-pd-shop-meta-row">
                <div className="queue-pd-shop-hours">
                  เวลาทำการ: <strong>{product.shopHours || "07:30 - 16:00 น."} ▾</strong>
                </div>
                <div className="queue-pd-shop-rating">
                  <i className="bi bi-star-fill text-warning me-1" /> {product.rating} | จองแล้ว {product.sales}
                </div>
              </div>
            </div>

            {/* Price Highlight Box */}
            <div className="d-flex align-items-baseline gap-2 bg-light p-2 rounded">
              <span className="text-muted small text-decoration-line-through">
                ฿{product.originalPrice}
              </span>
              <span className="text-danger fw-bold fs-4">฿{discountedUnitPrice}</span>
              <span className="badge bg-danger ms-1">ส่วนลด {selectedTimeSlot.discount}</span>
            </div>

            {/* Interactive Booking Controls */}
            <div className="d-flex flex-column gap-3">
              <div className="queue-pd-booking-inputs-row">
                {/* Guest / Quantity Selector */}
                <select
                  className="queue-pd-input-select"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                >
                  <option value="1 คน">👤 1 คน</option>
                  <option value="2 คน">👤 2 คน</option>
                  <option value="3 คน">👤 3 คน</option>
                  <option value="4 คน+">👤 4 คนขึ้นไป</option>
                </select>

                {/* Date Selector */}
                <select
                  className="queue-pd-input-select"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                >
                  <option value="10 ส.ค.">📅 วันนี้ (10 ส.ค.)</option>
                  <option value="11 ส.ค.">📅 พรุ่งนี้ (11 ส.ค.)</option>
                  <option value="12 ส.ค.">📅 12 ส.ค.</option>
                </select>
              </div>

              {/* Time Slot Discount Badges Carousel */}
              <div>
                <div className="text-muted small fw-bold mb-2">เลือกช่วงเวลาจองคิวพร้อมส่วนลด:</div>
                <div className="queue-pd-time-slots-grid">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot.time}
                      className={`queue-pd-time-slot-btn ${
                        selectedTimeSlot.time === slot.time ? "active" : ""
                      }`}
                      onClick={() => setSelectedTimeSlot(slot)}
                    >
                      <span>{slot.time}</span>
                      <span>{slot.discount}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary Footer & Action Button */}
            <div className="queue-pd-booking-footer">
              <div>
                <div className="queue-pd-booking-summary-text">
                  {guestCount} · {bookingDate}, {selectedTimeSlot.time} / {selectedTimeSlot.discount}
                </div>
                <div className="text-danger fw-bold fs-5">
                  ยอดรวม: ฿{totalCalculatedPrice.toFixed(2)}
                </div>
              </div>

              <button className="queue-pd-btn-next" onClick={handleNextBooking}>
                ถัดไป / ยืนยันการจองคิว
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Gateway Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        itemTitle={product.name || product.title}
        itemPrice={discountedUnitPrice}
        queueNo="A06"
      />

      {/* Floating Bottom-Right Chat Button */}
      <button
        className="queue-floating-chat-btn"
        onClick={() => setIsChatOpen(true)}
        title="เปิดแชทผู้ช่วย QueueUp"
      >
        <i className="bi bi-chat-dots-fill" />
        <span>Chat</span>
        <span className="queue-chat-badge">3</span>
      </button>

      {/* Real-Time Chat Modal Component */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* Profile Incomplete Blocking Modal */}
      {isIncompleteProfileModalOpen && (
        <div
          className="modal fade show d-block"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(10px)",
            zIndex: 100005,
          }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div
              className="modal-content text-white p-2"
              style={{
                background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)",
                border: "2px solid #f59e0b",
                borderRadius: "24px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              }}
            >
              <div className="modal-header border-bottom border-secondary pb-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-warning text-dark p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ width: "48px", height: "48px" }}>
                    <i className="bi bi-exclamation-triangle-fill fs-4" />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-warning mb-0">
                      ไม่สามารถทำการสั่งจองคิวอาหารได้
                    </h5>
                    <span className="text-slate-300 small">
                      มาตรการความปลอดภัยและแจ้งเตือนคิวโรงอาหาร
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setIsIncompleteProfileModalOpen(false)}
                />
              </div>

              <div className="modal-body p-4">
                <p className="lead-text text-slate-200 fs-6 mb-3">
                  ขออภัย ระบบไม่สามารถยืนยันคำสั่งจองคิวอาหารให้คุณได้ เนื่องจาก <b>ข้อมูลส่วนตัวของคุณยังไม่สมบูรณ์</b>
                </p>

                <div className="bg-dark p-3 rounded-3 border border-secondary mb-4">
                  <div className="fw-bold text-warning mb-2">
                    <i className="bi bi-x-circle-fill me-2 text-danger" />
                    ข้อมูลที่ยังไม่ได้กรอกในระบบ:
                  </div>
                  <ul className="mb-0 text-slate-300 small ps-3">
                    {missingProfileFields.map((field, idx) => (
                      <li key={idx} className="mb-1">{field}</li>
                    ))}
                  </ul>
                </div>

                <p className="small text-slate-400 mb-0">
                  💡 กรุณาคลิกปุ่มด้านล่างเพื่อเติมข้อมูลส่วนตัวให้สมบูรณ์ ใช้เวลาไม่เกิน 30 วินาที เพื่อรักษาสิทธิ์ในการรับคูปองส่วนลดและการแจ้งเตือนคิวอาหารของคุณ
                </p>
              </div>

              <div className="modal-footer border-top border-secondary pt-3 d-flex justify-content-between gap-2">
                <button
                  type="button"
                  className="btn btn-outline-light px-4 rounded-pill"
                  onClick={() => setIsIncompleteProfileModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="btn btn-warning text-dark font-weight-bold px-4 py-2 rounded-pill shadow-lg"
                  onClick={() => {
                    setIsIncompleteProfileModalOpen(false);
                    navigate("/user/account/profile?tab=info");
                  }}
                >
                  <i className="bi bi-pencil-square me-1" /> ไปเติมข้อมูลส่วนตัวให้สมบูรณ์
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Reusable Premium Footer */}
      <Footer />
    </div>
  );
}

export default ProductDetail;
