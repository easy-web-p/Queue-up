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

  const initialProduct = PRODUCTS_BY_ID[id] || PRODUCTS_BY_ID.m1;
  const [product, setProduct] = useState(initialProduct);

  const [selectedImg, setSelectedImg] = useState(initialProduct.mainImg || initialProduct.image);
  const [guestCount, setGuestCount] = useState("1 คน");
  const [bookingDate, setBookingDate] = useState("17 ส.ค.");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[1]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [isIncompleteProfileModalOpen, setIsIncompleteProfileModalOpen] = useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState([]);

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

  const discountPercent = parseInt((selectedTimeSlot?.discount || "0").replace("-", "").replace("%", "")) / 100;
  const basePrice = Number(product?.price) || 0;
  const discountedUnitPrice = Math.round(basePrice * (1 - discountPercent));
  const guestMultiplier = parseInt(guestCount) || 1;
  const totalCalculatedPrice = discountedUnitPrice * guestMultiplier;

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
        } catch {
          // ignore
        }
      }
    }

    const missing = [];

    const hasPhone = Boolean(profileData?.phone || profileData?.phoneNumber);
    const hasName = Boolean(profileData?.name || profileData?.displayName || profileData?.fullName);
    const hasSchool = Boolean(profileData?.school || profileData?.university || profileData?.canteen);

    if (!hasName) missing.push("ชื่อ-นามสกุล");
    if (!hasPhone) missing.push("เบอร์โทรศัพท์สำหรับรับแจ้งเตือนคิว");
    if (!hasSchool) missing.push("สังกัดโรงเรียน/คณะ/โรงอาหาร");

    return {
      isComplete: missing.length === 0,
      missing,
    };
  };

  const handleNextBooking = async () => {
    const { isComplete, missing } = await checkProfileCompleteness();
    if (!isComplete) {
      setMissingProfileFields(missing);
      setIsIncompleteProfileModalOpen(true);
    } else {
      setIsPaymentModalOpen(true);
    }
  };

  return (
    <div className="queue-pd-container">
      <ShopeeSearchBar />

      <div className="queue-pd-wrapper">
        <div className="queue-pd-breadcrumb mb-3">
          <span className="text-muted" style={{ cursor: "pointer" }} onClick={() => navigate("/home")}>
            <i className="bi bi-house-door-fill me-1" /> หน้าหลัก
          </span>
          <span className="mx-2 text-muted">/</span>
          <span className="text-muted" style={{ cursor: "pointer" }} onClick={() => navigate("/search?keyword=ทั้งหมด")}>
            โรงอาหารกลาง
          </span>
          <span className="mx-2 text-muted">/</span>
          <span className="fw-bold text-dark">{product.name}</span>
        </div>

        <div className="queue-pd-main-grid">
          <div className="queue-pd-left-col">
            <div className="queue-pd-main-img-box">
              <img
                src={selectedImg}
                alt={product.name}
                className="queue-pd-main-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/crispy_fried_chicken.jpg";
                }}
              />
            </div>

            <div className="queue-pd-thumb-grid">
              {[product.mainImg || product.image, ...(product.gallery || [])].slice(0, 4).map((img, idx) => (
                <div
                  key={idx}
                  className={`queue-pd-thumb-box ${selectedImg === img ? "active" : ""}`}
                  onClick={() => setSelectedImg(img)}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx}`}
                    className="queue-pd-thumb-img"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/crispy_fried_chicken.jpg";
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="queue-pd-recommend-box">
              <div className="queue-pd-recommend-header">
                <h3 className="queue-pd-recommend-title">
                  <i className="bi bi-info-circle-fill me-1 text-primary" />
                  เงื่อนไขการสั่งจองและรับส่วนลด
                </h3>
                <span className="queue-pd-discount-badge-pink">{selectedTimeSlot.discount}</span>
              </div>
              <p className="queue-pd-recommend-desc">
                ส่วนลดพิเศษระบบ QueueUp CRM สามารถใช้ได้กับเมนูอาหารที่เป็นราคาปกติทั้งหมด
                สั่งจองคิวล่วงหน้ารับแต้มสะสมฟรีทันที และสามารถระบุสล็อตเวลารับอาหารที่สะดวกได้
              </p>
            </div>
          </div>

          <div className="queue-pd-right-card">
            <div className="queue-pd-shop-banner-box">
              <img
                src={product.shopBanner}
                alt={product.shopName}
                className="queue-pd-shop-banner-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/crispy_fried_chicken.jpg";
                }}
              />
            </div>

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
                  เวลาทำการ: <strong>{product.shopHours || "07:30 - 16:00 น."}</strong>
                </div>
                <div className="queue-pd-shop-rating">
                  <i className="bi bi-star-fill text-warning me-1" /> {product.rating} | จองแล้ว {product.sales}
                </div>
              </div>
            </div>

            <div className="d-flex align-items-baseline gap-2 bg-light p-2 rounded">
              <span className="text-muted small text-decoration-line-through">
                ฿{product.originalPrice}
              </span>
              <span className="text-danger fw-bold fs-4">฿{discountedUnitPrice}</span>
              <span className="badge bg-danger ms-1">ส่วนลด {selectedTimeSlot.discount}</span>
            </div>

            <div className="d-flex flex-column gap-3">
              <div className="queue-pd-booking-inputs-row">
                <select
                  className="queue-pd-input-select"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                >
                  <option value="1 คน">1 คน</option>
                  <option value="2 คน">2 คน</option>
                  <option value="3 คน">3 คน</option>
                  <option value="4 คน+">4 คนขึ้นไป</option>
                </select>

                <select
                  className="queue-pd-input-select"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                >
                  <option value="17 ส.ค.">วันนี้ (17 ส.ค.)</option>
                  <option value="18 ส.ค.">พรุ่งนี้ (18 ส.ค.)</option>
                  <option value="19 ส.ค.">19 ส.ค.</option>
                </select>
              </div>

              <div>
                <div className="text-muted small fw-bold mb-2">
                  <i className="bi bi-clock-history me-1 text-primary" />
                  เลือกช่วงเวลาจองคิวพร้อมส่วนลด:
                </div>
                <div className="queue-pd-time-slots-grid">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot.time}
                      className={`queue-pd-time-slot-btn ${
                        selectedTimeSlot.time === slot.time ? "active" : ""
                      }`}
                      onClick={() => setSelectedTimeSlot(slot)}
                    >
                      <span>{slot.time} น.</span>
                      <span>{slot.discount}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="queue-pd-booking-footer">
              <div>
                <div className="queue-pd-booking-summary-text">
                  {guestCount} · {bookingDate}, {selectedTimeSlot.time} น. / {selectedTimeSlot.discount}
                </div>
                <div className="text-danger fw-bold fs-5">
                  ยอดรวม: ฿{totalCalculatedPrice.toFixed(2)}
                </div>
              </div>

              <button className="queue-pd-btn-next" onClick={handleNextBooking}>
                <i className="bi bi-calendar-check me-1" />
                ถัดไป / ยืนยันการจองคิว
              </button>
            </div>
          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        storeId={product.storeId || "store_canteen01"}
        shopName={product.shopName || "ร้านครัวโรงเรียน QueueUp Canteen"}
        shopLocation={product.shopLocation || "โรงอาหาร 1 (อาคารเรียน 2)"}
        itemTitle={product.name || product.title}
        amount={totalCalculatedPrice}
        itemPrice={totalCalculatedPrice}
        queueNo="A06"
      />

      <button
        className="queue-floating-chat-btn"
        onClick={() => setIsChatOpen(true)}
        title="เปิดแชทผู้ช่วย QueueUp"
      >
        <i className="bi bi-chat-dots-fill" />
        <span>Chat</span>
        <span className="queue-chat-badge">3</span>
      </button>

      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

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

              <div className="modal-body py-4">
                <p className="mb-3 text-slate-200">
                  กรุณากรอกข้อมูลส่วนตัวในโปรไฟล์ให้ครบถ้วนก่อนสั่งอาหาร เพื่อให้ร้านค้าและระบบแจ้งเตือนคิวสามารถติดต่อคุณได้ตามนัดหมาย:
                </p>
                <div className="bg-dark p-3 rounded-3 border border-secondary mb-3">
                  <div className="text-warning fw-bold small mb-2">ข้อมูลที่ยังไม่สมบูรณ์:</div>
                  <ul className="mb-0 text-danger-subtle small ps-3">
                    {missingProfileFields.map((field, idx) => (
                      <li key={idx} className="mb-1">{field}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="modal-footer border-top border-secondary pt-3">
                <button
                  className="btn btn-secondary px-4 me-2"
                  onClick={() => setIsIncompleteProfileModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  className="btn btn-warning fw-bold text-dark px-4"
                  onClick={() => {
                    setIsIncompleteProfileModalOpen(false);
                    navigate("/user/account/profile");
                  }}
                >
                  <i className="bi bi-pencil-square me-1" />
                  ไปที่หน้าโปรไฟล์เพื่อกรอกข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default ProductDetail;
