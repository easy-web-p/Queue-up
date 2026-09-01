import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { db, doc, getDoc } from "../firebase/config.js";
import PaymentModal from "../components/PaymentModal.jsx";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import ChatModal from "../components/ChatModal.jsx";
import Footer from "../components/Footer.jsx";
import { PRODUCTS_BY_ID, SHARED_PRODUCTS, SHARED_SHOPS } from "../data/mockProducts.js";
import {
  fetchProductByIdFromFirestore,
  fetchStoreByIdFromFirestore,
  checkUserFavoriteInFirestore,
  toggleUserFavoriteInFirestore,
  saveOrderToFirestore,
} from "../lib/firebase.js";
import "./ProductDetail.css";

// 7. TIME SLOT DATA ARCHITECTURE (Pickup Time Slot Reservation)
const TIME_SLOTS = [
  { time: "11:30", discount: "-50%", capacity: 20, currentOrders: 6, status: "AVAILABLE" },
  { time: "12:00", discount: "-50%", capacity: 20, currentOrders: 18, status: "LIMITED" },
  { time: "12:30", discount: "-20%", capacity: 20, currentOrders: 20, status: "FULL" },
  { time: "13:00", discount: "-10%", capacity: 20, currentOrders: 4, status: "AVAILABLE" },
  { time: "13:30", discount: "-10%", capacity: 20, currentOrders: 2, status: "AVAILABLE" },
  { time: "14:00", discount: "-10%", capacity: 20, currentOrders: 0, status: "AVAILABLE" },
  { time: "14:30", discount: "-10%", capacity: 20, currentOrders: 0, status: "AVAILABLE" },
  { time: "15:00", discount: "-10%", capacity: 20, currentOrders: 0, status: "AVAILABLE" },
];

// 5. MODIFIERS DATA SCHEMA ARCHITECTURE
const DEFAULT_MODIFIERS = [
  {
    id: "spicy",
    name: "ระดับความเผ็ด",
    type: "single",
    required: true,
    options: [
      { id: "none", name: "ไม่เผ็ด", price: 0 },
      { id: "medium", name: "เผ็ดปกติ", price: 0 },
      { id: "hot", name: "เผ็ดมาก", price: 0 },
    ],
  },
  {
    id: "topping",
    name: "เพิ่ม Topping พิเศษ",
    type: "multiple",
    required: false,
    options: [
      { id: "fried-egg", name: "ไข่ดาว (+10฿)", price: 10 },
      { id: "extra-rice", name: "เพิ่มข้าว (+5฿)", price: 5 },
    ],
  },
];

function resolveProductByParam(rawParam) {
  if (!rawParam) return PRODUCTS_BY_ID.m1;

  const decoded = decodeURIComponent(rawParam).trim();

  // 1. Direct match by ID (e.g. m1, m2)
  if (PRODUCTS_BY_ID[decoded]) return PRODUCTS_BY_ID[decoded];
  if (PRODUCTS_BY_ID[rawParam]) return PRODUCTS_BY_ID[rawParam];

  // 2. Match by exact product name or title or encoded name
  const foundByName = SHARED_PRODUCTS.find((p) => {
    if (!p) return false;
    const pName = (p.name || "").trim();
    const pTitle = (p.title || "").trim();
    return (
      pName === decoded ||
      pTitle === decoded ||
      encodeURIComponent(pName) === rawParam ||
      encodeURIComponent(pTitle) === rawParam ||
      pName.includes(decoded) ||
      decoded.includes(pName)
    );
  });

  return foundByName || PRODUCTS_BY_ID.m1;
}

function resolveStoreByStoreId(storeId) {
  if (!storeId) return SHARED_SHOPS[0];
  const found = SHARED_SHOPS.find((s) => s.id === storeId);
  return (
    found || {
      id: storeId,
      name: "ร้านครัวโรงเรียน QueueUp Canteen",
      location: "โรงอาหาร 1 (อาคารเรียน 2)",
      hours: "07:30 - 16:00 น.",
      rating: 4.9,
      reviewsCount: 320,
      isOpen: true,
      status: "open",
    }
  );
}

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const initialProduct = resolveProductByParam(id);
  const [product, setProduct] = useState(initialProduct);

  const initialStore = resolveStoreByStoreId(initialProduct.storeId);
  const [store, setStore] = useState(initialStore);

  const [selectedImg, setSelectedImg] = useState(initialProduct.mainImg || initialProduct.image);
  const [guestCount, setGuestCount] = useState("1 จาน");
  const [bookingDate, setBookingDate] = useState("17 ส.ค.");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[1]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // 5. Modifier Choices State
  const [spicyLevel, setSpicyLevel] = useState("medium");
  const [selectedToppings, setSelectedToppings] = useState(["fried-egg"]);
  const [customerNote, setCustomerNote] = useState("");

  const [isIncompleteProfileModalOpen, setIsIncompleteProfileModalOpen] = useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState([]);

  // Load Product & Store from Firestore database service layer
  useEffect(() => {
    let isMounted = true;
    async function loadProductAndStoreData() {
      const decoded = decodeURIComponent(id || "").trim();
      let docData = await fetchProductByIdFromFirestore(id);
      if (!docData && decoded !== id) {
        docData = await fetchProductByIdFromFirestore(decoded);
      }

      if (isMounted) {
        const resolvedProd = docData || resolveProductByParam(id);
        setProduct(resolvedProd);
        setSelectedImg(resolvedProd.mainImg || resolvedProd.image);

        // Load Store Data from Database / Service Layer
        const storeData = await fetchStoreByIdFromFirestore(resolvedProd.storeId);
        setStore(storeData || resolveStoreByStoreId(resolvedProd.storeId));

        // Check Favorite Status if user logged in
        if (user && user.uid && resolvedProd.id) {
          const favStatus = await checkUserFavoriteInFirestore(user.uid, resolvedProd.id);
          if (isMounted) setIsFavorite(favStatus);
        }
      }
    }
    loadProductAndStoreData();
    return () => {
      isMounted = false;
    };
  }, [id, user]);

  // 4. Favorite Toggle Handler
  const handleToggleFavorite = async () => {
    if (!user || !user.uid) {
      setIsFavorite(!isFavorite);
      return;
    }
    const newStatus = await toggleUserFavoriteInFirestore(user.uid, product.id);
    setIsFavorite(newStatus);
  };

  // 5. Toppings & Dynamic Price Calculation Formula: unitPrice = (basePrice + toppingPrice) * (1 - discountPercent)
  const toppingTotalPrice = useMemo(() => {
    return selectedToppings.reduce((sum, topId) => {
      const optionObj = DEFAULT_MODIFIERS[1].options.find((opt) => opt.id === topId);
      return sum + (optionObj?.price || 0);
    }, 0);
  }, [selectedToppings]);

  const discountPercent = parseInt((selectedTimeSlot?.discount || "0").replace("-", "").replace("%", "")) / 100;
  const basePrice = Number(product?.price) || 0;
  const discountedUnitPrice = Math.max(0, Math.round((basePrice + toppingTotalPrice) * (1 - discountPercent)));
  
  // 6. Quantity (จำนวนจาน) & Subtotal Calculation
  const quantityNumber = parseInt(guestCount) || 1;
  const totalCalculatedPrice = discountedUnitPrice * quantityNumber;

  // 15. Store Menu Recommendations
  const recommendedProducts = useMemo(() => {
    const storeId = product?.storeId || "store_canteen01";
    return SHARED_PRODUCTS.filter(
      (p) => p.storeId === storeId && p.id !== product.id
    ).slice(0, 4);
  }, [product]);

  // 11. Profile Completeness Check
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

  // 8. ORDER VALIDATION BEFORE CHECKOUT
  const handleNextBooking = async () => {
    // 1. Store Open Guard
    if (store?.isOpen === false || store?.status === "closed") {
      alert("⚠️ ขออภัย ร้านค้าปิดบริการชั่วคราว ไม่สามารถทำการสั่งซื้อคิวอาหารได้ในขณะนี้");
      return;
    }

    // 2. Product Availability & Stock Guard
    if (product?.availability === false || product?.stockStatus === "out_of_stock") {
      alert("⚠️ ขออภัย เมนูอาหารนี้หมดชั่วคราว ไม่สามารถทำการสั่งซื้อได้ในขณะนี้");
      return;
    }

    // 3. Time Slot Full Guard
    if (selectedTimeSlot?.status === "FULL" || selectedTimeSlot?.status === "CLOSED") {
      alert("⚠️ ขออภัย คิวรับอาหารช่วงเวลานี้เต็มแล้ว กรุณาเลือกช่วงเวลาอื่น");
      return;
    }

    // 4. Profile Completeness Check
    const { isComplete, missing } = await checkProfileCompleteness();
    if (!isComplete) {
      setMissingProfileFields(missing);
      setIsIncompleteProfileModalOpen(true);
    } else {
      setIsPaymentModalOpen(true);
    }
  };

  // 12. Payment Success Handler -> Save Order & Queue Snapshot
  const handlePaymentSuccess = async () => {
    const orderPayload = {
      orderId: `ORD-${Date.now()}`,
      userId: user?.uid || "guest_user",
      storeId: product.storeId || "store_canteen01",
      shopName: store?.name || product.shopName,
      items: [
        {
          productId: product.id || "m1",
          productName: product.name,
          image: selectedImg,
          basePrice,
          selectedModifiers: [
            { id: "spicy", value: spicyLevel },
            { id: "topping", value: selectedToppings },
            { id: "note", value: customerNote },
          ],
          quantity: quantityNumber,
          unitPrice: discountedUnitPrice,
          subtotal: totalCalculatedPrice,
        },
      ],
      pickupSlot: {
        date: bookingDate,
        time: selectedTimeSlot.time,
        discount: selectedTimeSlot.discount,
      },
      subtotal: totalCalculatedPrice,
      total: totalCalculatedPrice,
      paymentMethod: "PROMPTPAY_QR",
      paymentStatus: "PAID",
      orderStatus: "PREPARING",
      queueNumber: "A06",
    };

    await saveOrderToFirestore(orderPayload);
    setIsPaymentModalOpen(false);
    navigate("/user/account/profile?tab=bookings");
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
          {/* 3. IMAGE GALLERY & RECOMMENDATION COLUMN */}
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
              {[product.mainImg || product.image, ...(product.gallery || product.images || [])].slice(0, 4).map((img, idx) => (
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

          {/* 2. STORE DATA & PRODUCT DETAILS COLUMN */}
          <div className="queue-pd-right-card">
            <div className="queue-pd-shop-banner-box">
              <img
                src={product.shopBanner || store.banner}
                alt={store.name || product.shopName}
                className="queue-pd-shop-banner-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/crispy_fried_chicken.jpg";
                }}
              />
            </div>

            <div>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <h1 className="queue-pd-shop-title mb-0">{store.name || product.shopName}</h1>
                  {/* 4. FAVORITE BUTTON INTEGRATION */}
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none ms-1"
                    onClick={handleToggleFavorite}
                    title="บันทึกเป็นเมนูโปรด"
                  >
                    <i className={`bi ${isFavorite ? "bi-heart-fill text-danger" : "bi-heart text-muted"} fs-5`} />
                  </button>
                </div>
                <button
                  className="btn btn-sm btn-outline-danger font-weight-bold"
                  onClick={() => setIsChatOpen(true)}
                >
                  <i className="bi bi-chat-dots-fill me-1" /> แชทสอบถามร้านค้า
                </button>
              </div>

              <div className="fw-bold text-primary mb-1 mt-1">{product.name}</div>
              <div className="queue-pd-shop-address">
                {product.shopAddress || store.location || "2089 อาคารเรียน 2 (โรงอาหาร 1) แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400"}
              </div>

              <div className="queue-pd-shop-tags-row">
                <span>{product.shopLocation || store.location}</span>
                <span>·</span>
                <span>฿฿</span>
                <span>·</span>
                <span>&lt; 500m</span>
                <span>·</span>
                {/* 2. Store Status Badge */}
                <span className={`badge ${store?.isOpen !== false && store?.status !== "closed" ? "bg-success" : "bg-danger"}`}>
                  {store?.isOpen !== false && store?.status !== "closed" ? "เปิดบริการปกติ" : "ปิดบริการชั่วคราว"}
                </span>
              </div>

              <div className="queue-pd-shop-meta-row">
                <div className="queue-pd-shop-hours">
                  เวลาทำการ: <strong>{product.shopHours || store.hours || "07:30 - 16:00 น."}</strong>
                </div>
                <div className="queue-pd-shop-rating">
                  <i className="bi bi-star-fill text-warning me-1" /> {product.rating || store.rating || 4.9} | จองแล้ว {product.sales || "1.2k ครั้ง"}
                </div>
              </div>
            </div>

            {/* Price Row */}
            <div className="d-flex align-items-baseline gap-2 bg-light p-2 rounded">
              <span className="text-muted small text-decoration-line-through">
                ฿{product.originalPrice || basePrice + 30}
              </span>
              <span className="text-danger fw-bold fs-4">฿{discountedUnitPrice}</span>
              <span className="badge bg-danger ms-1">ส่วนลด {selectedTimeSlot.discount}</span>
            </div>

            {/* 5. MODIFIERS & OPTIONS FORM */}
            <div className="d-flex flex-column gap-3">
              <div className="bg-light p-2 rounded-3 border">
                <div className="text-dark small fw-bold mb-1">
                  <i className="bi bi-fire me-1 text-danger" /> ระดับความเผ็ด:
                </div>
                <div className="d-flex gap-2 mb-2">
                  {DEFAULT_MODIFIERS[0].options.map((opt) => (
                    <label key={opt.id} className="small text-muted cursor-pointer d-flex align-items-center gap-1">
                      <input
                        type="radio"
                        name="spicyLevel"
                        value={opt.id}
                        checked={spicyLevel === opt.id}
                        onChange={(e) => setSpicyLevel(e.target.value)}
                      />
                      {opt.name}
                    </label>
                  ))}
                </div>

                <div className="text-dark small fw-bold mb-1 border-top pt-1">
                  <i className="bi bi-plus-circle me-1 text-success" /> เพิ่ม Topping พิเศษ:
                </div>
                <div className="d-flex gap-3 mb-2">
                  {DEFAULT_MODIFIERS[1].options.map((opt) => (
                    <label key={opt.id} className="small text-muted cursor-pointer d-flex align-items-center gap-1">
                      <input
                        type="checkbox"
                        checked={selectedToppings.includes(opt.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedToppings([...selectedToppings, opt.id]);
                          } else {
                            setSelectedToppings(selectedToppings.filter((t) => t !== opt.id));
                          }
                        }}
                      />
                      {opt.name}
                    </label>
                  ))}
                </div>

                <input
                  type="text"
                  className="form-control form-control-sm text-xs mt-1"
                  placeholder="หมายเหตุเพิ่มเติมถึงร้านค้า (เช่น ไม่ใส่ผัก, เผ็ดน้อย)"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                />
              </div>

              {/* 6. QUANTITY & BOOKING DATE SELECTORS */}
              <div className="queue-pd-booking-inputs-row">
                <select
                  className="queue-pd-input-select"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                >
                  <option value="1 จาน">1 จาน</option>
                  <option value="2 จาน">2 จาน</option>
                  <option value="3 จาน">3 จาน</option>
                  <option value="4 จานขึ้นไป">4 จานขึ้นไป</option>
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

              {/* 7. TIME SLOTS GRID (Capacity & Slot Reservation) */}
              <div>
                <div className="text-muted small fw-bold mb-2 d-flex align-items-center justify-content-between">
                  <span>
                    <i className="bi bi-clock-history me-1 text-primary" />
                    เลือกช่วงเวลาจองคิวรับอาหาร:
                  </span>
                  <span className="badge bg-info-subtle text-info text-xs">{selectedTimeSlot.status}</span>
                </div>
                <div className="queue-pd-time-slots-grid">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot.time}
                      disabled={slot.status === "FULL" || slot.status === "CLOSED"}
                      className={`queue-pd-time-slot-btn ${
                        selectedTimeSlot.time === slot.time ? "active" : ""
                      } ${slot.status === "FULL" ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => setSelectedTimeSlot(slot)}
                    >
                      <span>{slot.time} น.</span>
                      <span>{slot.status === "FULL" ? "คิวเต็ม" : slot.discount}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* BOOKING FOOTER & SUBMIT */}
            <div className="queue-pd-booking-footer">
              <div>
                <div className="queue-pd-booking-summary-text">
                  {guestCount} · {bookingDate}, {selectedTimeSlot.time} น. / {selectedTimeSlot.discount}
                </div>
                <div className="text-danger fw-bold fs-5">
                  ยอดรวม: ฿{totalCalculatedPrice.toFixed(2)}
                </div>
              </div>

              <button
                className="queue-pd-btn-next"
                onClick={handleNextBooking}
                disabled={store?.isOpen === false || store?.status === "closed" || product?.availability === false}
              >
                <i className="bi bi-calendar-check me-1" />
                ถัดไป / ยืนยันการจองคิว
              </button>
            </div>

            {/* 15. RECOMMENDED MENU FROM SAME STORE */}
            {recommendedProducts.length > 0 && (
              <div className="mt-3 pt-3 border-top">
                <div className="text-dark fw-bold small mb-2">
                  <i className="bi bi-shop me-1 text-primary" /> เมนูอื่นจากร้านนี้ ({store.name || product.shopName})
                </div>
                <div className="row g-2">
                  {recommendedProducts.map((rec) => (
                    <div key={rec.id} className="col-6 col-md-3">
                      <div
                        className="bg-light p-2 rounded-3 border text-center cursor-pointer h-100"
                        onClick={() => navigate(`/product/${rec.id}`)}
                      >
                        <img
                          src={rec.image || rec.mainImg}
                          alt={rec.name}
                          className="w-100 rounded-2 mb-1"
                          style={{ height: "60px", objectFit: "cover" }}
                        />
                        <div className="small fw-bold text-dark text-truncate">{rec.name}</div>
                        <div className="text-danger small fw-bold">฿{rec.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 12. PAYMENT MODAL */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
        storeId={product.storeId || "store_canteen01"}
        shopName={store?.name || product.shopName || "ร้านครัวโรงเรียน QueueUp Canteen"}
        shopLocation={store?.location || product.shopLocation || "โรงอาหาร 1 (อาคารเรียน 2)"}
        itemTitle={product.name || product.title}
        amount={totalCalculatedPrice}
        itemPrice={totalCalculatedPrice}
        queueNo="A06"
      />

      {/* 17. CHAT ASSISTANT FLOATING BUTTON */}
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
        storeId={product.storeId}
        productId={product.id}
      />

      {/* 11. PROFILE COMPLETENESS MODAL */}
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
                  <div
                    className="bg-warning text-dark p-3 rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: "48px", height: "48px" }}
                  >
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
