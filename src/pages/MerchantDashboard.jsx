import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { switchRole, clearUser } from "../store/authSlice.js";
import { db, doc, getDoc, setDoc } from "../firebase/config.js";
import { SHARED_PRODUCTS } from "../data/mockProducts.js";
import ChatModal from "../components/ChatModal.jsx";
import BookingCalendar from "../components/BookingCalendar.jsx";
import SellerAssistantModal from "../components/SellerAssistantModal.jsx";
import {
  generateAIMarketingRecommendations,
  getActiveMerchantCoupons,
  deployAICoupon,
  toggleCouponState,
} from "../services/aiMarketingService.js";
import { getSecurityHealthReport } from "../services/aiSecurityShield.js";
import { recordAuditLog } from "../services/storeIsolationEngine.js";
import Footer from "../components/Footer.jsx";
import "./MerchantDashboard.css";

const MOCK_MERCHANT_ORDERS = [
  {
    id: "240809QUEUE01",
    customerName: "เด็กชายพิสิษฐ์ แก้วกุลพิสิษฐ์ (ม.1/6)",
    phone: "081-234-5678",
    status: "TO_RECEIVE",
    statusText: "พร้อมรับที่เคาน์เตอร์ 1 (คิว A05)",
    time: "11:40 น.",
    items: [
      { name: "ชุดข้าวผัดกุ้งกะทะร้อน + ไข่ดาวสด", variant: "เผ็ดน้อย, ไม่ใส่ผักหอม", qty: 1, price: 65 },
    ],
    totalPrice: 65,
  },
  {
    id: "240809QUEUE02",
    customerName: "สมชาย สายกิน (ม.3/2)",
    phone: "089-876-5432",
    status: "PREPARING",
    statusText: "กำลังปรุงคิวอาหาร",
    time: "11:45 น.",
    items: [
      { name: "สเต็กหมูพริกไทยดำ + เฟรนช์ฟรายส์กรอบ", variant: "ซอสพริกไทยดำเข้มข้น", qty: 1, price: 120 },
    ],
    totalPrice: 120,
  },
  {
    id: "240809QUEUE03",
    customerName: "วรรณวิสา สดใส (ม.5/1)",
    phone: "086-555-4321",
    status: "PENDING",
    statusText: "รอร้านรับออเดอร์เข้าครัว",
    time: "11:50 น.",
    items: [
      { name: "ไก่ทอดซอสเกาหลี ชุบแป้งกรอบ", variant: "เผ็ดมาก", qty: 2, price: 138 },
    ],
    totalPrice: 138,
  },
];

function MerchantDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // Merchant Tab States: 'queue' | 'planner' | 'menu' | 'profile' | 'staff' | 'marketing'
  const [activeTab, setActiveTab] = useState("queue");
  const [queueFilter, setQueueFilter] = useState("ALL");

  const cleanDisplayName = (rawName, email) => {
    if (!rawName || rawName.trim() === "" || rawName.toLowerCase().includes("anime manga")) {
      if (email && email.includes("@")) {
        return `ร้านค้าของคุณ ${email.split("@")[0]}`;
      }
      return "ร้านอาหาร QueueUp Canteen";
    }
    if (rawName.startsWith("ร้านค้าของ") || rawName.startsWith("ร้าน")) {
      return rawName;
    }
    return `ร้านค้าของ ${rawName}`;
  };

  const cleanOwnerName = (rawName, email) => {
    if (!rawName || rawName.trim() === "" || rawName.toLowerCase().includes("anime manga")) {
      if (email && email.includes("@")) {
        return email.split("@")[0];
      }
      return "เจ้าของร้าน QueueUp";
    }
    return rawName;
  };

  // Read Store Profile & storeId from LocalStorage & User Auth Context (Full Onboarding Tracing)
  const getInitialStoreData = () => {
    try {
      const userKey = user && user.uid ? `queueup_merchant_store_${user.uid}` : null;
      const stored = (userKey && localStorage.getItem(userKey)) || localStorage.getItem("queueup_merchant_store");
      if (stored) {
        const m = JSON.parse(stored);
        return {
          storeId: m.storeId || (user && user.uid ? `store_${user.uid.substring(0, 10)}` : "store_canteen01"),
          name: cleanDisplayName(m.merchantStoreName || m.storeName || (user && user.merchantStoreName), user?.email),
          phone: m.phone || m.businessPhone || (user && user.phone) || "081-234-5678",
          location: m.canteenLocation ? (m.counterNo ? `${m.canteenLocation} (${m.counterNo})` : m.canteenLocation) : (user && user.canteenLocation) || "โรงอาหาร 1 (อาคารเรียน 2)",
          promptpayName: cleanOwnerName(m.promptpayName || (user && user.promptpayName) || (user ? user.name : ""), user?.email),
          promptpayNo: m.promptpayNo || (user && user.promptpayNo) || "081-234-5678",
        };
      }
    } catch {
      // ignore
    }
    return {
      storeId: user && user.uid ? `store_${user.uid.substring(0, 10)}` : "store_canteen01",
      name: cleanDisplayName(user && user.merchantStoreName, user?.email),
      phone: (user && user.phone) || "081-234-5678",
      location: (user && user.canteenLocation) || "โรงอาหาร 1 (อาคารเรียน 2)",
      promptpayName: cleanOwnerName((user && user.promptpayName) || (user ? user.name : ""), user?.email),
      promptpayNo: (user && user.promptpayNo) || "081-234-5678",
    };
  };

  const initialStore = getInitialStoreData();
  const [currentStoreId] = useState(initialStore.storeId);

  const [merchantOrders, setMerchantOrders] = useState(() => {
    // 1. Read store-specific merchant orders first
    const storeSpecific = localStorage.getItem(`queueup_merchant_orders_${initialStore.storeId}`);
    if (storeSpecific) {
      try {
        return JSON.parse(storeSpecific);
      } catch {
        // ignore
      }
    }

    // 2. Read global customer orders and filter strictly by storeId
    const globalUserOrders = localStorage.getItem("queueup_user_orders");
    if (globalUserOrders) {
      try {
        const parsed = JSON.parse(globalUserOrders);
        const filtered = parsed.filter((o) => o.storeId === initialStore.storeId);
        if (filtered.length > 0) return filtered;
      } catch {
        // ignore
      }
    }

    // 3. Demo orders apply ONLY to the default canteen ("store_canteen01")
    if (initialStore.storeId === "store_canteen01") {
      return MOCK_MERCHANT_ORDERS.map((o) => ({ ...o, storeId: "store_canteen01" }));
    }

    // NEW merchant stores will have [] (0 orders from other stores!)
    return [];
  });

  const [menuItems, setMenuItems] = useState(() => {
    const savedMenu = localStorage.getItem(`queueup_merchant_menu_${initialStore.storeId}`);
    if (savedMenu) {
      try {
        return JSON.parse(savedMenu);
      } catch {
        // ignore
      }
    }
    if (initialStore.storeId === "store_canteen01") {
      return SHARED_PRODUCTS.map((p) => ({ ...p, isAvailable: true }));
    }
    return SHARED_PRODUCTS.filter((p) => p.storeId === initialStore.storeId).map((p) => ({
      ...p,
      isAvailable: true,
    }));
  });

  const [storeName, setStoreName] = useState(initialStore.name);
  const [storePhone, setStorePhone] = useState(initialStore.phone);
  const [canteenLocation, setCanteenLocation] = useState(initialStore.location);
  const [storeHours, setStoreHours] = useState("07:00 - 15:00 น.");

  const [privateBankName, setPrivateBankName] = useState("PromptPay (พร้อมเพย์)");
  const [privateAccountNo, setPrivateAccountNo] = useState(initialStore.promptpayNo);
  const [privateAccountOwner, setPrivateAccountOwner] = useState(initialStore.promptpayName);
  const [isSavedFinance, setIsSavedFinance] = useState(false);
  const [isSavedProfile, setIsSavedProfile] = useState(false);

  const [staffList, setStaffList] = useState([
    { uid: "STF01", name: "นางสาวมยุรี ใจดี", role: "พนักงานรับออเดอร์/แคชเชียร์", phone: "082-111-2233" },
    { uid: "STF02", name: "นายประสิทธิ์ ขยันทำงาน", role: "พ่อครัว/ผู้ช่วยเตรียมอาหาร", phone: "083-444-5566" },
  ]);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("พนักงานรับออเดอร์/แคชเชียร์");
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatCustomerName, setChatCustomerName] = useState("");
  const [chatOrderContext, setChatOrderContext] = useState(null);

  const [isSellerAssistantOpen, setIsSellerAssistantOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const handleLogout = () => {
    dispatch(clearUser());
    navigate("/login", { replace: true });
  };

  const [aiMarketingCoupons] = useState(() => generateAIMarketingRecommendations());
  const [activeCouponsList, setActiveCouponsList] = useState(() => getActiveMerchantCoupons(initialStore.storeId));
  const [securityReport] = useState(() => getSecurityHealthReport());
  const [marketingSuccessMsg, setMarketingSuccessMsg] = useState("");

  const handleDeployCoupon = (coupon) => {
    const success = deployAICoupon(coupon, currentStoreId);
    if (success) {
      setActiveCouponsList(getActiveMerchantCoupons(currentStoreId));
      setMarketingSuccessMsg(`เปิดใช้งานคูปอง "${coupon.code}" เรียบร้อยแล้ว! ลูกค้าสามารถใช้ส่วนลดได้ทันที`);
      setTimeout(() => setMarketingSuccessMsg(""), 4000);
    }
  };

  const handleToggleCoupon = (code) => {
    const updated = toggleCouponState(code, currentStoreId);
    setActiveCouponsList(updated);
  };

  // Track Registration Status cleanly
  const [isRegistered, setIsRegistered] = useState(() => {
    if (!user) return false;
    const userKey = `queueup_merchant_store_${user.uid}`;
    return !!(user.isMerchantRegistered || user.merchantId || localStorage.getItem(userKey));
  });

  useEffect(() => {
    if (!user) {
      navigate("/portal/th-onboarding", { replace: true });
      return;
    }

    // Direct redirect if not registered
    const userKey = `queueup_merchant_store_${user.uid}`;
    const hasLocalStore = localStorage.getItem(userKey);

    if (!user.isMerchantRegistered && !user.merchantId && !hasLocalStore) {
      getDoc(doc(db, "users", user.uid)).then((uSnap) => {
        if (uSnap.exists()) {
          const uData = uSnap.data();
          if (uData.isMerchantRegistered || uData.merchantId) {
            setIsRegistered(true);
            if (uData.merchantStoreName) setStoreName(cleanDisplayName(uData.merchantStoreName, user.email));
            if (uData.phone) setStorePhone(uData.phone);
            if (uData.canteenLocation) setCanteenLocation(uData.canteenLocation);
          } else {
            navigate("/portal/th-onboarding", { replace: true });
          }
        } else {
          navigate("/portal/th-onboarding", { replace: true });
        }
      });
    }

    const merchantId = user.merchantId;
    const storeId = user.storeId;

    if (merchantId) {
      getDoc(doc(db, "merchantProfiles", merchantId)).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsRegistered(true);
          if (data.merchantStoreName || data.storeName) setStoreName(cleanDisplayName(data.merchantStoreName || data.storeName, user.email));
          if (data.businessPhone) setStorePhone(data.businessPhone);
          if (data.canteenLocation) setCanteenLocation(data.canteenLocation);
        }
      });

      getDoc(doc(db, "merchantProfiles", merchantId, "private", "finance")).then((finSnap) => {
        if (finSnap.exists()) {
          const finData = finSnap.data();
          if (finData.bankName) setPrivateBankName(finData.bankName);
          if (finData.accountNumber) setPrivateAccountNo(finData.accountNumber);
          if (finData.accountOwner) setPrivateAccountOwner(cleanOwnerName(finData.accountOwner, user.email));
        }
      });
    }

    if (storeId) {
      getDoc(doc(db, "shops", storeId)).then((storeSnap) => {
        if (storeSnap.exists()) {
          const sData = storeSnap.data();
          setIsRegistered(true);
          if (sData.storeName) setStoreName(cleanDisplayName(sData.storeName, user.email));
          if (sData.phone) setStorePhone(sData.phone);
          if (sData.canteenLocation) setCanteenLocation(sData.canteenLocation);
          if (sData.storeHours) setStoreHours(sData.storeHours);
        }
      });
    }
  }, [user, navigate]);

  const handleUpdateOrderStatus = (orderId, newStatus, newText) => {
    setMerchantOrders((prev) => {
      const updated = prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, statusText: newText } : o));
      try {
        localStorage.setItem(`queueup_merchant_orders_${currentStoreId}`, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleToggleProductStatus = (productId) => {
    setMenuItems((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isAvailable: !p.isAvailable } : p))
    );
  };

  const handleSaveStoreProfile = async (e) => {
    if (e) e.preventDefault();

    if (!user || !user.uid) return;

    const merchantId = user.merchantId || "MCH-" + user.uid.substring(0, 8);
    const storeId = user.storeId || "STORE-DEMO01";

    const publicStoreData = {
      isMerchantRegistered: true,
      role: "merchant",
      isMerchantVerified: true,
      merchantStoreName: storeName,
      storeName,
      phone: storePhone,
      businessPhone: storePhone,
      canteenLocation,
      storeHours,
      updatedAt: new Date().toISOString(),
    };

    try {
      // 1. users/{uid}
      await setDoc(doc(db, "users", user.uid), publicStoreData, { merge: true });

      // 2. merchantProfiles/{merchantId}
      await setDoc(doc(db, "merchantProfiles", merchantId), publicStoreData, { merge: true });

      // 3. shops/{storeId}
      await setDoc(doc(db, "shops", storeId), publicStoreData, { merge: true });

      // 4. Audit Log
      await recordAuditLog(db, {
        action: "UPDATE_STORE_PROFILE",
        actorUid: user.uid,
        merchantId,
        metadata: { storeName, canteenLocation, storePhone },
      });

      setIsSavedProfile(true);
      setTimeout(() => setIsSavedProfile(false), 3000);
    } catch (err) {
      console.error("Save store profile error:", err);
    }
  };

  const handleSavePrivateFinance = async (e) => {
    e.preventDefault();
    if (!user || !user.uid) return;

    const merchantId = user.merchantId || "MCH-" + user.uid.substring(0, 8);
    try {
      await setDoc(
        doc(db, "merchantProfiles", merchantId, "private", "finance"),
        {
          ownerUid: user.uid,
          bankName: privateBankName,
          accountNumber: privateAccountNo,
          accountOwner: privateAccountOwner,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Audit Log
      await recordAuditLog(db, {
        action: "CHANGE_FINANCE",
        actorUid: user.uid,
        merchantId,
        metadata: {
          accountOwner: privateAccountOwner,
          bankName: privateBankName,
        },
      });

      setIsSavedFinance(true);
      setTimeout(() => setIsSavedFinance(false), 3000);
    } catch (err) {
      console.error("Save private finance error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลการเงินลับ");
    }
  };

  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;

    const newStaff = {
      uid: `STF0${staffList.length + 1}`,
      name: newStaffName,
      role: newStaffRole,
      phone: "089-XXX-XXXX",
    };

    setStaffList([...staffList, newStaff]);
    setNewStaffName("");
    setIsAddStaffOpen(false);
  };

  const handleSwitchToStudentView = () => {
    dispatch(switchRole("customer"));
    navigate("/home");
  };

  const filteredQueueOrders = merchantOrders.filter((o) => {
    if (queueFilter === "ALL") return true;
    return o.status === queueFilter;
  });

  if (!isRegistered) {
    return null;
  }

  return (
    <div className="merchant-dashboard-container">
      <div className="merchant-dashboard-header-bg">
        <div className="merchant-dashboard-header-wrapper">
          <div className="merchant-header-left">
            <div className="merchant-avatar-box">
              <i className="bi bi-shop fs-2 text-danger" />
            </div>
            <div>
              <div className="d-flex align-items-center flex-wrap gap-2">
                <h2 className="merchant-title mb-0">{storeName}</h2>
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                  <i className="bi bi-patch-check-fill me-1" />
                  ร้านค้ายืนยันแล้ว
                </span>
                <span className="badge bg-secondary-subtle text-slate-300 border border-secondary px-2 py-1 small">
                  ID ร้าน: {currentStoreId}
                </span>
              </div>
              <p className="merchant-subtitle mb-0 mt-1">
                <i className="bi bi-geo-alt-fill text-danger me-1" /> {canteenLocation} •{" "}
                <i className="bi bi-telephone-fill text-primary me-1" /> {storePhone}
              </p>
            </div>
          </div>

          <div className="merchant-header-right d-flex align-items-center gap-3">
            <button className="btn btn-outline-light font-weight-bold" onClick={handleSwitchToStudentView}>
              <i className="bi bi-person-bounding-box me-1" /> สลับมุมมองผู้ใช้นักเรียน
            </button>

            {/* User Account Profile Dropdown (Matching Screenshot Reference) */}
            <div className="position-relative">
              <button
                className="btn btn-light d-flex align-items-center gap-2 font-weight-bold rounded-pill px-3 shadow-sm border-0"
                onClick={() => setIsUserDropdownOpen((prev) => !prev)}
              >
                <div
                  className="rounded-circle bg-secondary-subtle d-flex align-items-center justify-content-center"
                  style={{ width: "32px", height: "32px" }}
                >
                  <i className="bi bi-person-fill text-secondary fs-5" />
                </div>
                <span className="text-dark small">{cleanOwnerName(user?.name, user?.email)}</span>
                <i className={`bi bi-chevron-${isUserDropdownOpen ? "up" : "down"} text-muted small`} />
              </button>

              {isUserDropdownOpen && (
                <div
                  className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg p-3 text-dark text-center border"
                  style={{ width: "230px", zIndex: 9999 }}
                >
                  <div
                    className="rounded-circle bg-light d-flex align-items-center justify-content-center mx-auto mb-2 border"
                    style={{ width: "68px", height: "68px" }}
                  >
                    <i className="bi bi-person-fill text-secondary display-6" />
                  </div>
                  <div className="fw-bold text-dark fs-6 mb-2">{cleanOwnerName(user?.name, user?.email)}</div>
                  <hr className="my-2" />
                  <button
                    className="btn btn-outline-danger w-100 font-weight-bold d-flex align-items-center justify-content-center gap-2 py-2 rounded-3"
                    onClick={handleLogout}
                  >
                    <i className="bi bi-box-arrow-right fs-5" /> ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="merchant-dashboard-body">
        <div className="merchant-tabs-nav">
          <button
            className={`merchant-tab-btn ${activeTab === "queue" ? "active" : ""}`}
            onClick={() => setActiveTab("queue")}
          >
            <i className="bi bi-receipt-cutoff fs-5 text-danger" />
            <span>บอร์ดคิวสั่งอาหารเรียลไทม์</span>
          </button>

          <button
            className={`merchant-tab-btn ${activeTab === "planner" ? "active" : ""}`}
            onClick={() => setActiveTab("planner")}
          >
            <i className="bi bi-calendar3 fs-5 text-success" />
            <span>แผนเตรียมวัตถุดิบ & ตารางจอง</span>
          </button>

          <button
            className={`merchant-tab-btn ${activeTab === "menu" ? "active" : ""}`}
            onClick={() => setActiveTab("menu")}
          >
            <i className="bi bi-egg-fried fs-5 text-warning" />
            <span>เมนูอาหาร & สถานะสต็อก</span>
          </button>

          <button
            className={`merchant-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <i className="bi bi-gear-wide-connected fs-5" />
            <span>ตั้งค่าร้านค้า & การเงินลับ</span>
          </button>

          <button
            className={`merchant-tab-btn ${activeTab === "staff" ? "active" : ""}`}
            onClick={() => setActiveTab("staff")}
          >
            <i className="bi bi-people-fill fs-5" />
            <span>จัดการพนักงานประจำร้าน</span>
          </button>

          <button
            className={`merchant-tab-btn ${activeTab === "marketing" ? "active" : ""}`}
            onClick={() => setActiveTab("marketing")}
          >
            <i className="bi bi-robot fs-5 text-primary" />
            <span>AI การตลาด & คูปองส่วนลด</span>
          </button>
        </div>

        {/* TAB 1: LIVE ORDER QUEUE BOARD */}
        {activeTab === "queue" && (
          <div className="merchant-panel-box">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h3 className="merchant-panel-title mb-0">
                <i className="bi bi-receipt-cutoff text-danger me-2" />
                บอร์ดจัดการคิวอาหารและออเดอร์เรียลไทม์
              </h3>
              <button
                className="btn btn-sm btn-outline-danger font-weight-bold"
                onClick={() => setMerchantOrders(MOCK_MERCHANT_ORDERS)}
              >
                <i className="bi bi-arrow-clockwise me-1" /> รีเฟรชรายการคิว
              </button>
            </div>

            <div className="merchant-queue-subtabs">
              {[
                { id: "ALL", label: "ทั้งหมด" },
                { id: "PENDING", label: "ออเดอร์ใหม่ / รอยืนยัน" },
                { id: "PREPARING", label: "กำลังปรุงคิวอาหาร" },
                { id: "READY", label: "พร้อมรับที่เคาน์เตอร์" },
                { id: "COMPLETED", label: "เสร็จสิ้นแล้ว" },
              ].map((sub) => (
                <button
                  key={sub.id}
                  className={`merchant-subtab-chip ${queueFilter === sub.id ? "active" : ""}`}
                  onClick={() => setQueueFilter(sub.id)}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {filteredQueueOrders.length > 0 ? (
              filteredQueueOrders.map((order) => (
                <div key={order.id} className="merchant-order-card">
                  <div className="merchant-order-card-header">
                    <div>
                      <span className="merchant-order-id me-3">ID: {order.id}</span>
                      <span className="text-muted small">
                        <i className="bi bi-clock me-1" /> {order.time}
                      </span>
                    </div>
                    <span className={`merchant-order-badge-status ${order.status.toLowerCase()}`}>
                      {order.statusText}
                    </span>
                  </div>

                  <div className="mb-2 d-flex align-items-center justify-content-between">
                    <div>
                      <div className="fw-bold text-dark fs-6">
                        <i className="bi bi-person-fill text-primary me-1" /> {order.customerName}
                      </div>
                      <div className="small text-muted">โทร: {order.phone}</div>
                    </div>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {
                        setChatCustomerName(order.customerName);
                        setChatOrderContext({
                          orderId: order.id,
                          itemTitle: order.items[0]?.name,
                          queueNo: order.statusText,
                          price: order.totalPrice,
                        });
                        setIsChatOpen(true);
                      }}
                    >
                      <i className="bi bi-chat-dots-fill me-1" /> แชทคุยกับลูกค้า
                    </button>
                  </div>

                  <div className="merchant-order-items-list">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="merchant-order-item-row">
                        <img src="/logo.png" alt={item.name} className="merchant-order-item-img" />
                        <div>
                          <div className="merchant-order-item-title">
                            {item.name} <span className="text-danger fw-bold">x{item.qty}</span>
                          </div>
                          <div className="merchant-order-item-opt">ตัวเลือก: {item.variant}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="merchant-order-card-footer">
                    <div>
                      <span className="small text-muted me-2">ราคารวมคำสั่งซื้อ:</span>
                      <span className="merchant-order-total-price">฿{(Number(order.totalPrice) || 0).toFixed(2)}</span>
                    </div>

                    <div className="merchant-order-actions-row">
                      {order.status === "PENDING" && (
                        <button
                          className="merchant-btn-next-step"
                          onClick={() =>
                            handleUpdateOrderStatus(
                              order.id,
                              "PREPARING",
                              "กำลังปรุงคิวอาหาร (ประมาณ 10 นาที)"
                            )
                          }
                        >
                          <i className="bi bi-check-circle-fill me-1" /> ยืนยันรับออเดอร์เข้าครัว
                        </button>
                      )}

                      {order.status === "PREPARING" && (
                        <button
                          className="merchant-btn-next-step"
                          style={{ background: "#2563eb" }}
                          onClick={() =>
                            handleUpdateOrderStatus(
                              order.id,
                              "READY",
                              "พร้อมรับที่เคาน์เตอร์ 1 (คิว A05)"
                            )
                          }
                        >
                          <i className="bi bi-bell-fill me-1" /> แจ้งคิวพร้อมรับอาหาร (คิว A05)
                        </button>
                      )}

                      {order.status === "READY" && (
                        <button
                          className="merchant-btn-next-step"
                          style={{ background: "#16a34a" }}
                          onClick={() =>
                            handleUpdateOrderStatus(order.id, "COMPLETED", "ส่งมอบเรียบร้อยแล้ว")
                          }
                        >
                          <i className="bi bi-bag-check-fill me-1" /> ส่งมอบอาหารเรียบร้อยแล้ว
                        </button>
                      )}

                      {order.status !== "COMPLETED" && (
                        <button
                          className="merchant-btn-cancel-step"
                          onClick={() =>
                            handleUpdateOrderStatus(order.id, "CANCELLED", "ยกเลิกคำสั่งซื้อ")
                          }
                        >
                          ยกเลิกคำสั่งซื้อ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-inbox fs-1 d-block mb-2 text-slate-300" />
                ยังไม่มีรายการคิวอาหารในสถานะนี้
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BOOKING & PREP PLANNER */}
        {activeTab === "planner" && (
          <div className="merchant-panel-box">
            <BookingCalendar viewMode="merchant" storeId={currentStoreId} orders={merchantOrders} />
          </div>
        )}

        {/* TAB 3: MENU MANAGEMENT */}
        {activeTab === "menu" && (
          <div className="merchant-panel-box">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h3 className="merchant-panel-title mb-0">
                <i className="bi bi-egg-fried text-warning me-2" />
                จัดการรายการเมนูอาหาร & สถานะสต็อกประจำร้าน
              </h3>
              <button
                className="btn btn-danger font-weight-bold px-3 py-2"
                onClick={() => alert("ระบบเพิ่มเมนูอาหารใหม่พร้อมใช้งานแล้ว!")}
              >
                <i className="bi bi-plus-circle-fill me-1" /> เพิ่มเมนูอาหารใหม่
              </button>
            </div>

            <div className="merchant-menu-grid">
              {menuItems.map((item) => (
                <div key={item.id} className="merchant-menu-card">
                  <div className="merchant-menu-card-img-wrapper">
                    <img
                      src={item.image || "/crispy_fried_chicken.jpg"}
                      alt={item.name}
                      className="merchant-menu-card-img"
                    />
                    <span className={`merchant-menu-stock-badge ${item.isAvailable ? "in-stock" : "out-of-stock"}`}>
                      {item.isAvailable ? "พร้อมขาย" : "หมดชั่วคราว"}
                    </span>
                  </div>
                  <div className="merchant-menu-card-content">
                    <h5 className="merchant-menu-card-title">{item.name}</h5>
                    <div className="text-danger font-weight-bold fs-5 mb-2">฿{item.price}</div>
                    <div className="d-flex align-items-center justify-content-between">
                      <button
                        className={`btn btn-sm ${item.isAvailable ? "btn-outline-secondary" : "btn-success"}`}
                        onClick={() => handleToggleProductStatus(item.id)}
                      >
                        {item.isAvailable ? "ทำเป็นเมนูหมด" : "เปิดขายเมนูนี้"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: STORE PROFILE & PRIVATE FINANCE */}
        {activeTab === "profile" && (
          <div className="merchant-panel-box">
            <h3 className="merchant-panel-title mb-4">
              <i className="bi bi-gear-wide-connected text-primary me-2" />
              ตั้งค่าข้อมูลร้านค้า & ข้อมูลบัญชีรับเงินโอน
            </h3>

            <div className="row g-4">
              <div className="col-md-6">
                <form onSubmit={handleSaveStoreProfile} className="p-3 bg-light rounded-3 border">
                  <h5 className="fw-bold mb-3">ข้อมูลร้านค้าที่แสดงสาธารณะ</h5>
                  <div className="mb-3">
                    <label className="form-label font-weight-bold">ชื่อร้านค้า:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label font-weight-bold">พิกัดโรงอาหาร:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={canteenLocation}
                      onChange={(e) => setCanteenLocation(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label font-weight-bold">เบอร์โทรศัพท์ร้านค้า:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={storePhone}
                      onChange={(e) => setStorePhone(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label font-weight-bold">เวลาทำการ:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={storeHours}
                      onChange={(e) => setStoreHours(e.target.value)}
                    />
                  </div>

                  {isSavedProfile && (
                    <div className="alert alert-success py-2 px-3 small mb-3">
                      <i className="bi bi-check-circle-fill me-1" /> บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว!
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary w-100 font-weight-bold">
                    <i className="bi bi-save-fill me-1" /> บันทึกข้อมูลร้านค้า
                  </button>
                </form>
              </div>

              <div className="col-md-6">
                <form onSubmit={handleSavePrivateFinance} className="p-3 bg-dark text-white rounded-3 border border-secondary">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h5 className="fw-bold text-warning mb-0">
                      <i className="bi bi-shield-lock-fill me-2" />
                      ข้อมูลการเงินรับโอน
                    </h5>
                    <span className="badge bg-secondary">ความปลอดภัยขั้นสูง</span>
                  </div>

                  <p className="small text-slate-300 mb-3">
                    ข้อมูลส่วนนี้ปลอดภัยด้วยระบบสิทธิ์การเข้าถึง Private Subcollection
                  </p>

                  <div className="mb-3">
                    <label className="form-label text-slate-200">ธนาคาร / PromptPay:</label>
                    <input
                      type="text"
                      className="form-control bg-secondary text-white border-dark"
                      value={privateBankName}
                      onChange={(e) => setPrivateBankName(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-slate-200">เลขที่บัญชี / เบอร์พร้อมเพย์:</label>
                    <input
                      type="text"
                      className="form-control bg-secondary text-white border-dark"
                      value={privateAccountNo}
                      onChange={(e) => setPrivateAccountNo(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-slate-200">ชื่อเจ้าของบัญชี:</label>
                    <input
                      type="text"
                      className="form-control bg-secondary text-white border-dark"
                      value={privateAccountOwner}
                      onChange={(e) => setPrivateAccountOwner(e.target.value)}
                    />
                  </div>

                  {isSavedFinance && (
                    <div className="alert alert-success py-2 px-3 small mb-3">
                      <i className="bi bi-check-circle-fill me-1" /> บันทึกข้อมูลการเงินลับเรียบร้อยแล้ว!
                    </div>
                  )}

                  <button type="submit" className="btn btn-warning w-100 font-weight-bold text-dark">
                    <i className="bi bi-save-fill me-1" /> บันทึกข้อมูลการเงินลับ
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: STAFF MANAGEMENT */}
        {activeTab === "staff" && (
          <div className="merchant-panel-box">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h3 className="merchant-panel-title mb-0">
                <i className="bi bi-people-fill text-primary me-2" />
                จัดการสิทธิ์พนักงานประจำร้าน
              </h3>
              <button
                className="btn btn-primary font-weight-bold"
                onClick={() => setIsAddStaffOpen(!isAddStaffOpen)}
              >
                <i className="bi bi-person-plus-fill me-1" /> เพิ่มพนักงานประจำร้าน
              </button>
            </div>

            {isAddStaffOpen && (
              <form onSubmit={handleAddStaff} className="p-3 bg-light border rounded-3 mb-4">
                <h6 className="fw-bold mb-3">เพิ่มข้อมูลพนักงานใหม่</h6>
                <div className="row g-3">
                  <div className="col-md-5">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="ชื่อ-นามสกุล พนักงาน"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-5">
                    <select
                      className="form-select"
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value)}
                    >
                      <option value="พนักงานรับออเดอร์/แคชเชียร์">พนักงานรับออเดอร์/แคชเชียร์</option>
                      <option value="พ่อครัว/ผู้ช่วยเตรียมอาหาร">พ่อครัว/ผู้ช่วยเตรียมอาหาร</option>
                      <option value="ผู้ดูแลระบบร้านค้าประจำสาขา">ผู้ดูแลระบบร้านค้าประจำสาขา</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <button type="submit" className="btn btn-success w-100 font-weight-bold">
                      เพิ่มสิทธิ์
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>รหัสพนักงาน</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>ตำแหน่ง / สิทธิ์</th>
                    <th>เบอร์โทรศัพท์</th>
                    <th>การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((stf) => (
                    <tr key={stf.uid}>
                      <td className="fw-bold">{stf.uid}</td>
                      <td>{stf.name}</td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                          {stf.role}
                        </span>
                      </td>
                      <td>{stf.phone}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setStaffList(staffList.filter((s) => s.uid !== stf.uid))}
                        >
                          ลบสิทธิ์
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: AI MARKETING & SECURITY SHIELD */}
        {activeTab === "marketing" && (
          <div className="merchant-panel-box">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h3 className="merchant-panel-title mb-0">
                <i className="bi bi-robot text-primary me-2" />
                AI การตลาดอัตโนมัติ & ระบบความปลอดภัยของร้านค้า
              </h3>
              <span className="badge bg-success-subtle text-success p-2">
                <i className="bi bi-shield-check me-1" />
                Security Health: {securityReport.healthScore}/100
              </span>
            </div>

            {marketingSuccessMsg && (
              <div className="alert alert-success fw-bold mb-4">{marketingSuccessMsg}</div>
            )}

            <div className="row g-4">
              <div className="col-md-7">
                <div className="p-3 bg-light rounded-3 border">
                  <h5 className="fw-bold mb-3 text-dark">
                    <i className="bi bi-stars text-warning me-1" />
                    ข้อเสนอแนะคูปองส่วนลดจาก AI (AI Coupon Generator)
                  </h5>

                  <div className="d-flex flex-column gap-3">
                    {aiMarketingCoupons.map((c, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-3 border d-flex justify-content-between align-items-center">
                        <div>
                          <strong className="text-primary fs-5">{c.code}</strong> - {c.title}
                          <div className="text-muted small mt-1">{c.aiReason}</div>
                          <div className="text-success small font-weight-bold">
                            ส่วนลด {c.discountType === "PERCENT" ? `${c.discountValue}%` : `฿${c.discountValue}`} (เมื่อสั่งขั้นต่ำ ฿{c.minSpend})
                          </div>
                        </div>
                        <button
                          className="btn btn-primary btn-sm font-weight-bold px-3 ms-2"
                          onClick={() => handleDeployCoupon(c)}
                        >
                          เปิดใช้งานคูปองนี้
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-md-5">
                <div className="p-3 bg-dark text-white rounded-3 border border-secondary">
                  <h5 className="fw-bold text-warning mb-3">
                    <i className="bi bi-ticket-perforated-fill me-2" />
                    คูปองร้านค้าที่กำลังเปิดใช้งาน (Live)
                  </h5>

                  <div className="d-flex flex-column gap-2 mb-3">
                    {activeCouponsList.map((cp, idx) => (
                      <div key={idx} className="p-2 bg-secondary rounded d-flex justify-content-between align-items-center">
                        <div>
                          <strong className="text-warning">{cp.code}</strong> - {cp.title}
                          <div className="small text-slate-300">
                            {cp.isActive ? "กำลังทำงานอยู่" : "ปิดใช้งานอยู่"}
                          </div>
                        </div>
                        <button
                          className={`btn btn-sm ${cp.isActive ? "btn-outline-danger" : "btn-success"}`}
                          onClick={() => handleToggleCoupon(cp.code)}
                        >
                          {cp.isActive ? "ปิด" : "เปิด"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        customerName={chatCustomerName}
        orderContext={chatOrderContext}
      />

      {/* Seller Assistant Floating Widget Trigger */}
      <button
        className="btn btn-danger rounded-circle shadow-lg position-fixed d-flex align-items-center justify-content-center"
        style={{
          bottom: "30px",
          right: "30px",
          width: "62px",
          height: "62px",
          zIndex: 9990,
          background: "linear-gradient(135deg, #ee4d2d 0%, #ff7337 100%)",
          border: "none",
        }}
        onClick={() => setIsSellerAssistantOpen(true)}
        title="เปิด Seller Assistant ผู้ช่วยร้านค้า"
      >
        <i className="bi bi-headset fs-2 text-white" />
      </button>

      {/* Seller Assistant Modal matching reference screenshot 1 */}
      <SellerAssistantModal
        isOpen={isSellerAssistantOpen}
        onClose={() => setIsSellerAssistantOpen(false)}
        userName={cleanOwnerName(user?.name, user?.email)}
      />

      <Footer />
    </div>
  );
}

export default MerchantDashboard;
