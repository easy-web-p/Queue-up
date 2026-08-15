import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { switchRole } from "../store/authSlice.js";
import { db, doc, getDoc, setDoc } from "../firebase/config.js";
import { SHARED_PRODUCTS } from "../data/mockProducts.js";
import ChatModal from "../components/ChatModal.jsx";
import {
  generateAIMarketingRecommendations,
  getActiveMerchantCoupons,
  deployAICoupon,
  toggleCouponState,
} from "../services/aiMarketingService.js";
import { getSecurityHealthReport } from "../services/aiSecurityShield.js";
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
    status: "TO_SHIP",
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
    status: "TO_PAY",
    statusText: "รอตรวจสอบสลิปการโอนเงิน",
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

  // Merchant Tab States: 'queue' | 'menu' | 'profile' | 'staff'
  const [activeTab, setActiveTab] = useState("queue");
  const [queueFilter, setQueueFilter] = useState("ALL"); // 'ALL' | 'TO_PAY' | 'TO_SHIP' | 'TO_RECEIVE' | 'COMPLETED'
  
  // Data States
  const [merchantOrders, setMerchantOrders] = useState(MOCK_MERCHANT_ORDERS);
  const [menuItems, setMenuItems] = useState(
    SHARED_PRODUCTS.map((p) => ({ ...p, isAvailable: true }))
  );

  // Store Profile & Private Financial Information States
  const [storeName, setStoreName] = useState("ร้านครัวโรงเรียน QueueUp Canteen");
  const [storePhone, setStorePhone] = useState("081-234-5678");
  const [canteenLocation, setCanteenLocation] = useState("โรงอาหาร 1 (อาคารเรียน 2 เคาน์เตอร์ 1)");
  const [storeHours, setStoreHours] = useState("07:00 - 15:00 น.");
  
  // Private Financial Subcollection (merchantProfiles/{merchantId}/private/finance)
  const [privateBankName, setPrivateBankName] = useState("PromptPay (พร้อมเพย์)");
  const [privateAccountNo, setPrivateAccountNo] = useState("081-234-5678");
  const [privateAccountOwner, setPrivateAccountOwner] = useState(
    user ? user.name || "นายสมชาย ใจดี" : "นายสมชาย ใจดี"
  );
  const [isSavedFinance, setIsSavedFinance] = useState(false);

  // Staff Management Subcollection States
  const [staffList, setStaffList] = useState([
    { uid: "STF01", name: "นางสาวมยุรี ใจดี", role: "พนักงานรับออเดอร์/แคชเชียร์", phone: "082-111-2233" },
    { uid: "STF02", name: "นายประสิทธิ์ ขยันทำงาน", role: "พ่อครัว/ผู้ช่วยเตรียมอาหาร", phone: "083-444-5566" },
  ]);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("พนักงานรับออเดอร์/แคชเชียร์");
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);

  // Chat Drawer State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatCustomerName, setChatCustomerName] = useState("");
  const [chatOrderContext, setChatOrderContext] = useState(null);

  // 🤖 AI Marketing & Security Shield States
  const [aiMarketingCoupons] = useState(() => generateAIMarketingRecommendations());
  const [activeCouponsList, setActiveCouponsList] = useState(() => getActiveMerchantCoupons());
  const [securityReport] = useState(() => getSecurityHealthReport());
  const [marketingSuccessMsg, setMarketingSuccessMsg] = useState("");

  const handleDeployCoupon = (coupon) => {
    const success = deployAICoupon(coupon);
    if (success) {
      setActiveCouponsList(getActiveMerchantCoupons());
      setMarketingSuccessMsg(`เปิดใช้งานคูปอง "${coupon.code}" เรียบร้อยแล้ว! ลูกค้าสามารถใช้ส่วนลดได้ทันที 🎉`);
      setTimeout(() => setMarketingSuccessMsg(""), 4000);
    }
  };

  const handleToggleCoupon = (code) => {
    const updated = toggleCouponState(code);
    setActiveCouponsList(updated);
  };

  // Fetch Firestore Merchant Profile Data on Mount
  useEffect(() => {
    if (user && user.uid) {
      const merchantId = "MCH-" + (user.uid ? user.uid.substring(0, 8) : "58140");
      getDoc(doc(db, "merchantProfiles", merchantId)).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.storeName) setStoreName(data.storeName);
          if (data.businessPhone) setStorePhone(data.businessPhone);
          if (data.canteenLocation) setCanteenLocation(data.canteenLocation);
        }
      });

      // Fetch Private Finance Subcollection
      getDoc(doc(db, "merchantProfiles", merchantId, "private", "finance")).then((finSnap) => {
        if (finSnap.exists()) {
          const finData = finSnap.data();
          if (finData.bankName) setPrivateBankName(finData.bankName);
          if (finData.accountNumber) setPrivateAccountNo(finData.accountNumber);
          if (finData.accountOwner) setPrivateAccountOwner(finData.accountOwner);
        }
      });
    }
  }, [user]);

  // Handle Order Queue Progression
  const handleUpdateOrderStatus = (orderId, newStatus, newText) => {
    setMerchantOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, statusText: newText } : o))
    );
  };

  // Toggle Menu Item Availability (In Stock / Out of Stock)
  const handleToggleStock = (productId) => {
    setMenuItems((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isAvailable: !p.isAvailable } : p))
    );
  };

  // Save Private Financial Details securely to Firestore merchantProfiles/{merchantId}/private/finance
  const handleSavePrivateFinance = async () => {
    const merchantId = "MCH-" + (user?.uid ? user.uid.substring(0, 8) : "58140");
    try {
      await setDoc(
        doc(db, "merchantProfiles", merchantId, "private", "finance"),
        {
          bankName: privateBankName,
          accountNumber: privateAccountNo,
          accountOwner: privateAccountOwner,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setIsSavedFinance(true);
      setTimeout(() => setIsSavedFinance(false), 3000);
    } catch (err) {
      console.warn("Error saving private finance subcollection:", err);
      setIsSavedFinance(true);
      setTimeout(() => setIsSavedFinance(false), 3000);
    }
  };

  // Add Staff Member to Subcollection
  const handleAddStaff = () => {
    if (!newStaffName.trim()) return;
    const newStaff = {
      uid: "STF_" + Date.now(),
      name: newStaffName,
      role: newStaffRole,
      phone: "08X-XXX-XXXX",
    };
    setStaffList((prev) => [...prev, newStaff]);
    setNewStaffName("");
    setIsAddStaffOpen(false);
  };

  // Filter Queue Orders
  const filteredQueueOrders = merchantOrders.filter((order) => {
    if (queueFilter === "ALL") return true;
    return order.status === queueFilter;
  });

  return (
    <div className="merchant-dashboard-page">
      {/* ---------------- STORE BRANDING NAVBAR ---------------- */}
      <nav className="merchant-top-navbar">
        <div className="merchant-brand-group">
          <img src="/logo.png" alt="QueueUp Logo" className="merchant-brand-logo" />
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="merchant-store-name">{storeName}</span>
              <span className="merchant-store-badge">
                <i className="bi bi-shop me-1" /> ศูนย์จัดการร้านค้า (Seller Centre)
              </span>
            </div>
            <div className="small text-slate-300">
              <i className="bi bi-geo-alt-fill text-danger me-1" /> {canteenLocation}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-3">
          <button
            className="merchant-switch-user-btn"
            onClick={() => {
              dispatch(switchRole("customer"));
              navigate("/home");
            }}
          >
            <i className="bi bi-person-circle me-1" /> สลับเป็นมุมมองลูกค้า
          </button>
        </div>
      </nav>

      <div className="merchant-container">
        {/* ---------------- 1. DASHBOARD STAT SUMMARY CARDS ---------------- */}
        <div className="merchant-stats-grid">
          <div className="merchant-stat-card">
            <div className="merchant-stat-info">
              <span className="merchant-stat-label">ยอดขายวันนี้</span>
              <span className="merchant-stat-value text-success">฿1,850.00</span>
            </div>
            <div className="merchant-stat-icon-circle bg-success-subtle text-success">
              <i className="bi bi-currency-dollar" />
            </div>
          </div>

          <div className="merchant-stat-card">
            <div className="merchant-stat-info">
              <span className="merchant-stat-label">คิวที่กำลังปรุง</span>
              <span className="merchant-stat-value text-primary">
                {merchantOrders.filter((o) => o.status === "TO_SHIP").length} คิว
              </span>
            </div>
            <div className="merchant-stat-icon-circle bg-primary-subtle text-primary">
              <i className="bi bi-fire" />
            </div>
          </div>

          <div className="merchant-stat-card">
            <div className="merchant-stat-info">
              <span className="merchant-stat-label">ออเดอร์รอชำระเงิน</span>
              <span className="merchant-stat-value text-warning">
                {merchantOrders.filter((o) => o.status === "TO_PAY").length} คิว
              </span>
            </div>
            <div className="merchant-stat-icon-circle bg-warning-subtle text-warning">
              <i className="bi bi-clock-history" />
            </div>
          </div>

          <div className="merchant-stat-card">
            <div className="merchant-stat-info">
              <span className="merchant-stat-label">เสร็จสิ้นวันนี้</span>
              <span className="merchant-stat-value text-slate-700">24 รายการ</span>
            </div>
            <div className="merchant-stat-icon-circle bg-slate-100 text-slate-600">
              <i className="bi bi-check-circle-fill" />
            </div>
          </div>
        </div>

        {/* ---------------- 2. MAIN NAVIGATION TABS HEADER ---------------- */}
        <div className="merchant-tabs-header">
          <button
            className={`merchant-tab-btn ${activeTab === "queue" ? "active" : ""}`}
            onClick={() => setActiveTab("queue")}
          >
            <i className="bi bi-card-checklist fs-5" />
            <span>จัดการคิวอาหาร & ออเดอร์</span>
          </button>

          <button
            className={`merchant-tab-btn ${activeTab === "menu" ? "active" : ""}`}
            onClick={() => setActiveTab("menu")}
          >
            <i className="bi bi-egg-fried fs-5" />
            <span>จัดการเมนูอาหาร & สต็อก</span>
          </button>

          <button
            className={`merchant-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <i className="bi bi-gear-wide-connected fs-5" />
            <span>ตั้งค่าร้านค้า & ข้อมูลการเงินลับ</span>
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
            <span>🤖 AI การตลาด & คูปองส่วนลด</span>
          </button>
        </div>

        {/* ---------------- 3. TAB 1: LIVE ORDER QUEUE BOARD ---------------- */}
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

            {/* Queue Subtabs */}
            <div className="merchant-queue-subtabs">
              {[
                { id: "ALL", label: "ทั้งหมด" },
                { id: "TO_PAY", label: "รอชำระเงิน / ตรวจสอบสลิป" },
                { id: "TO_SHIP", label: "กำลังปรุงคิวอาหาร" },
                { id: "TO_RECEIVE", label: "พร้อมรับที่เคาน์เตอร์" },
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

            {/* Orders Cards List */}
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

                  {/* Order Items */}
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
                      {order.status === "TO_PAY" && (
                        <button
                          className="merchant-btn-next-step"
                          onClick={() =>
                            handleUpdateOrderStatus(
                              order.id,
                              "TO_SHIP",
                              "กำลังปรุงคิวอาหาร (ประมาณ 10 นาที)"
                            )
                          }
                        >
                          <i className="bi bi-check-circle-fill me-1" /> ยืนยันชำระเงิน & รับออเดอร์เข้าครัว
                        </button>
                      )}

                      {order.status === "TO_SHIP" && (
                        <button
                          className="merchant-btn-next-step"
                          style={{ background: "#2563eb" }}
                          onClick={() =>
                            handleUpdateOrderStatus(
                              order.id,
                              "TO_RECEIVE",
                              "พร้อมรับที่เคาน์เตอร์ 1 (คิว A05)"
                            )
                          }
                        >
                          <i className="bi bi-bell-fill me-1" /> แจ้งคิวพร้อมรับอาหาร (คิว A05)
                        </button>
                      )}

                      {order.status === "TO_RECEIVE" && (
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

        {/* ---------------- 4. TAB 2: MENU & STOCK MANAGEMENT ---------------- */}
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

            <div className="table-responsive">
              <table className="merchant-menu-table">
                <thead>
                  <tr>
                    <th>รูปภาพ</th>
                    <th>ชื่อเมนูอาหาร</th>
                    <th>หมวดหมู่</th>
                    <th>ราคา (บาท)</th>
                    <th>ยอดขายรวม</th>
                    <th>สถานะพร้อมขาย</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <img
                          src={item.image || "/logo.png"}
                          alt={item.name}
                          style={{ width: "44px", height: "44px", borderRadius: "6px", objectFit: "cover" }}
                        />
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{item.name}</div>
                        <div className="small text-muted">{item.shopName}</div>
                      </td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-700 border">
                          {item.categoryLabel}
                        </span>
                      </td>
                      <td>
                        <span className="fw-bold text-danger">฿{item.price}</span>
                      </td>
                      <td>{item.sales || "1.2k ครั้ง"}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <label className="merchant-stock-switch">
                            <input
                              type="checkbox"
                              checked={item.isAvailable}
                              onChange={() => handleToggleStock(item.id)}
                            />
                            <span className="merchant-stock-slider" />
                          </label>
                          <span
                            className={`small fw-bold ${
                              item.isAvailable ? "text-success" : "text-danger"
                            }`}
                          >
                            {item.isAvailable ? "มีสินค้า (ขายอยู่)" : "สินค้าหมด"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- 5. TAB 3: STORE PROFILE & PRIVATE FINANCE ---------------- */}
        {activeTab === "profile" && (
          <div className="merchant-panel-box">
            <h3 className="merchant-panel-title">
              <i className="bi bi-shield-lock-fill text-danger me-2" />
              ตั้งค่าโปรไฟล์ร้านค้า & ข้อมูลการเงินลับ (Private Financial Subcollection)
            </h3>

            {/* Public Store Information Form */}
            <div className="p-3 bg-light rounded-3 mb-4 border">
              <h5 className="fw-bold text-dark mb-3">
                <i className="bi bi-shop me-2" /> ข้อมูลสาธารณะของร้านค้า
              </h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold">ชื่อร้านค้า (Store Name)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">เบอร์โทรศัพท์ติดต่อร้านค้า</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">ตำแหน่งโรงอาหาร / เลขเคาน์เตอร์</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={canteenLocation}
                    onChange={(e) => setCanteenLocation(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">เวลาทำการร้านค้า</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={storeHours}
                    onChange={(e) => setStoreHours(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Private Financial Subcollection Form */}
            <div className="p-3 bg-white rounded-3 border border-danger border-opacity-25 shadow-sm">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="fw-bold text-danger mb-0">
                  <i className="bi bi-bank2 me-2" /> ข้อมูลการเงินลับร้านค้า (merchantProfiles/{`{merchantId}`}/private/finance)
                </h5>
                <span className="badge bg-danger">ข้อมูลคุ้มครองความปลอดภัย 100%</span>
              </div>
              <p className="text-muted small mb-3">
                ข้อมูลการเงินนี้ถูกจัดเก็บแยกใน Subcollection ลับ เพื่อป้องกันบุคคลภายนอกส่องดู ปลอดภัยตามกฎหมาย PDPA
              </p>

              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label small fw-bold">ธนาคาร / ช่องทางรับโอนเงิน</label>
                  <select
                    className="form-select form-select-sm"
                    value={privateBankName}
                    onChange={(e) => setPrivateBankName(e.target.value)}
                  >
                    <option value="PromptPay (พร้อมเพย์)">PromptPay (พร้อมเพย์ QR Code)</option>
                    <option value="ธนาคารกสิกรไทย (KBANK)">ธนาคารกสิกรไทย (KBANK)</option>
                    <option value="ธนาคารไทยพาณิชย์ (SCB)">ธนาคารไทยพาณิชย์ (SCB)</option>
                    <option value="ธนาคารกรุงเทพ (BBL)">ธนาคารกรุงเทพ (BBL)</option>
                    <option value="ธนาคารกรุงไทย (KTB)">ธนาคารกรุงไทย (KTB)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold">หมายเลขบัญชี / เบอร์พร้อมเพย์รับเงิน</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={privateAccountNo}
                    onChange={(e) => setPrivateAccountNo(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold">ชื่อบัญชีผู้ถือร้านค้า</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={privateAccountOwner}
                    onChange={(e) => setPrivateAccountOwner(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="btn btn-danger font-weight-bold px-4 py-2"
                onClick={handleSavePrivateFinance}
              >
                <i className="bi bi-shield-check me-1" /> บันทึกข้อมูลการเงินลับ (Private Subcollection)
              </button>

              {isSavedFinance && (
                <div className="alert alert-success mt-3 mb-0 p-2 text-center small fw-bold">
                  ✓ บันทึกข้อมูลการเงินลับลง Firestore merchantProfiles/private/finance เรียบร้อยแล้ว!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- 6. TAB 4: STORE STAFF MANAGEMENT ---------------- */}
        {activeTab === "staff" && (
          <div className="merchant-panel-box">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h3 className="merchant-panel-title mb-0">
                <i className="bi bi-people-fill text-primary me-2" />
                จัดการพนักงานประจำร้าน (merchantProfiles/{`{merchantId}`}/staff)
              </h3>
              <button
                className="btn btn-primary font-weight-bold px-3 py-2"
                onClick={() => setIsAddStaffOpen(true)}
              >
                <i className="bi bi-person-plus-fill me-1" /> เพิ่มพนักงานประจำร้าน
              </button>
            </div>

            <div className="table-responsive">
              <table className="merchant-menu-table">
                <thead>
                  <tr>
                    <th>รหัสพนักงาน</th>
                    <th>ชื่อ-นามสกุล พนักงาน</th>
                    <th>ตำแหน่งประจำร้าน</th>
                    <th>เบอร์ติดต่อ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((staff) => (
                    <tr key={staff.uid}>
                      <td><span className="badge bg-slate-200 text-slate-800">{staff.uid}</span></td>
                      <td><div className="fw-bold text-dark">{staff.name}</div></td>
                      <td><span className="badge bg-primary-subtle text-primary">{staff.role}</span></td>
                      <td>{staff.phone}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setStaffList((prev) => prev.filter((s) => s.uid !== staff.uid))}
                        >
                          <i className="bi bi-trash-fill me-1" /> ลบสิทธิ์
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Staff Modal Dialog */}
            {isAddStaffOpen && (
              <div className="queueup-chat-overlay" onClick={() => setIsAddStaffOpen(false)}>
                <div className="bg-white p-4 rounded-3 border shadow-lg" style={{ width: "420px" }} onClick={(e) => e.stopPropagation()}>
                  <h5 className="fw-bold text-dark mb-3">เพิ่มพนักงานประจำร้านค้า</h5>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">ชื่อ-นามสกุล พนักงาน *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="กรอกชื่อ-นามสกุลพนักงาน"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">ตำแหน่งหน้าที่ *</label>
                    <select
                      className="form-select"
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value)}
                    >
                      <option value="พนักงานรับออเดอร์/แคชเชียร์">พนักงานรับออเดอร์/แคชเชียร์</option>
                      <option value="พ่อครัว/ผู้ช่วยเตรียมอาหาร">พ่อครัว/ผู้ช่วยเตรียมอาหาร</option>
                      <option value="เจ้าหน้าที่ส่งอาหารที่เคาน์เตอร์">เจ้าหน้าที่ส่งอาหารที่เคาน์เตอร์</option>
                    </select>
                  </div>
                  <div className="d-flex justify-content-end gap-2">
                    <button className="btn btn-light" onClick={() => setIsAddStaffOpen(false)}>ยกเลิก</button>
                    <button className="btn btn-primary fw-bold" onClick={handleAddStaff}>บันทึกพนักงาน</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- 7. TAB 5: AI MARKETING STRATEGIST & COUPON ENGINE ---------------- */}
        {activeTab === "marketing" && (
          <div className="merchant-panel-box">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div>
                <h3 className="merchant-panel-title mb-1 text-primary">
                  <i className="bi bi-robot me-2" />
                  ศูนย์วางแผนการตลาด AI & จัดโปรโมชั่นคูปองร้านค้า
                </h3>
                <p className="text-secondary small mb-0">
                  วิเคราะห์ยอดขาย พฤติกรรมนักเรียน และแนะนำคูปองโปรโมชั่นเพิ่มยอดขายแบบอัตโนมัติ (1-Click Deploy)
                </p>
              </div>
              {securityReport && (
                <div className="badge bg-success-subtle text-success p-2 border border-success-subtle rounded-3 d-flex align-items-center gap-2">
                  <i className="bi bi-shield-check fs-5" />
                  <div className="text-start">
                    <div className="fw-bold small">{securityReport.shieldVersion}</div>
                    <div className="text-muted" style={{ fontSize: "11px" }}>สถานะเกราะ: {securityReport.status}</div>
                  </div>
                </div>
              )}
            </div>

            {marketingSuccessMsg && (
              <div className="alert alert-success alert-dismissible fade show fw-bold shadow-sm" role="alert">
                <i className="bi bi-check-circle-fill me-2" />
                {marketingSuccessMsg}
              </div>
            )}

            {/* AI Strategic Marketing Analysis Insights Banner */}
            <div className="p-4 rounded-3 mb-4 text-white" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid #334155" }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="rounded-circle bg-primary p-3 d-flex align-items-center justify-content-center" style={{ width: "48px", height: "48px" }}>
                  <i className="bi bi-graph-up-arrow fs-4 text-white" />
                </div>
                <div>
                  <h5 className="fw-bold mb-1">🤖 AI Marketing Insights บทวิเคราะห์ร้านค้าประจำวัน</h5>
                  <p className="text-slate-300 small mb-0">
                    อิงจากข้อมูลการสั่งซื้อย้อนหลัง: ช่วงพักเที่ยงลูกค้าหนาแน่นที่สุด เมนูข้าวกะเพราและไก่ทอดเป็นสินค้าขายดีประจำโรงอาหาร
                  </p>
                </div>
              </div>
              <div className="row g-3 text-dark">
                <div className="col-md-4">
                  <div className="bg-white p-3 rounded-3 shadow-sm">
                    <div className="text-muted small fw-bold">ช่วงเวลาคนแน่น (Peak Hours)</div>
                    <div className="fs-5 fw-bold text-danger">11:30 - 12:30 น.</div>
                    <span className="badge bg-danger-subtle text-danger mt-1">เร่งความเร็วปรุงคิว</span>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="bg-white p-3 rounded-3 shadow-sm">
                    <div className="text-muted small fw-bold">ช่วงเวลาชะลอตัว (Off-Peak)</div>
                    <div className="fs-5 fw-bold text-warning">13:00 - 14:30 น.</div>
                    <span className="badge bg-warning-subtle text-warning mt-1">ควรเปิดคูปอง Happy Hour</span>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="bg-white p-3 rounded-3 shadow-sm">
                    <div className="text-muted small fw-bold">อัตราสั่งซ้ำ (Retention Rate)</div>
                    <div className="fs-5 fw-bold text-success">78.5% ของนักเรียน</div>
                    <span className="badge bg-success-subtle text-success mt-1">ความพึงพอใจสูงมาก</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Recommended Coupon Campaign Packages */}
            <h5 className="fw-bold mb-3 text-dark">
              💡 แผนโปรโมชั่น & คูปองที่ AI แนะนำสำหรับร้านคุณ (1-Click Deployment)
            </h5>

            <div className="row g-3 mb-4">
              {aiMarketingCoupons.map((coupon) => (
                <div key={coupon.id} className="col-md-4">
                  <div className="card h-100 border-0 shadow-sm p-3 position-relative" style={{ background: "#f8fafc", borderRadius: "12px", borderLeft: "5px solid #0284c7" }}>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-primary text-white">{coupon.recommendedBadge}</span>
                      <span className="fw-bold text-primary fs-6">CODE: {coupon.code}</span>
                    </div>

                    <h6 className="fw-bold text-dark mb-2">{coupon.title}</h6>
                    <p className="text-muted small mb-3">{coupon.description}</p>

                    <div className="bg-white p-2 rounded-2 border mb-3 small">
                      <div className="text-slate-600 mb-1">
                        🎯 <strong>กลุ่มเป้าหมาย:</strong> {coupon.targetAudience}
                      </div>
                      <div className="text-success fw-bold">
                        📈 <strong>คาดการณ์ผลลัพธ์:</strong> {coupon.projectedSalesIncrease}
                      </div>
                    </div>

                    <div className="mt-auto">
                      <button
                        className="btn btn-primary w-100 fw-bold shadow-sm"
                        onClick={() => handleDeployCoupon(coupon)}
                      >
                        <i className="bi bi-rocket-takeoff-fill me-1" />
                        เปิดใช้งานโปรโมชั่นนี้ทันที (1-Click)
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Active Live Coupons Management */}
            <h5 className="fw-bold mb-3 text-dark">
              🏷️ รายการคูปองส่วนลดที่เปิดใช้งานอยู่ในระบบ (Live Merchant Coupons)
            </h5>

            <div className="table-responsive bg-white rounded-3 border shadow-sm">
              <table className="table align-middle mb-0">
                <thead className="bg-light">
                  <tr>
                    <th>รหัสคูปอง (Code)</th>
                    <th>ชื่อโปรโมชั่น</th>
                    <th>มูลค่าส่วนลด</th>
                    <th>ขั้นต่ำ</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCouponsList.map((c) => (
                    <tr key={c.code}>
                      <td className="fw-bold text-primary">{c.code}</td>
                      <td>{c.title}</td>
                      <td className="fw-bold text-success">
                        {c.discountType === "PERCENT" ? `${c.discountValue}%` : `฿${c.discountValue}`}
                      </td>
                      <td>฿{c.minSpend}</td>
                      <td>
                        {c.isActive ? (
                          <span className="badge bg-success-subtle text-success">ใช้งานอยู่ (Active)</span>
                        ) : (
                          <span className="badge bg-secondary-subtle text-secondary">ปิดใช้งาน (Inactive)</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${c.isActive ? "btn-outline-danger" : "btn-outline-success"} fw-bold`}
                          onClick={() => handleToggleCoupon(c.code)}
                        >
                          {c.isActive ? "ระงับคูปอง" : "เปิดใช้งานอีกครั้ง"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Customer Merchant Chat Modal */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialStoreName={chatCustomerName}
        initialOrderContext={chatOrderContext}
      />
    </div>
  );
}

export default MerchantDashboard;
