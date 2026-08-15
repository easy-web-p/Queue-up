import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setUser, clearUser } from "../store/authSlice.js";
import { db, doc, setDoc, getDoc, deleteDoc } from "../firebase/config.js";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import PaymentModal from "../components/PaymentModal.jsx";
import ChatModal from "../components/ChatModal.jsx";
import Footer from "../components/Footer.jsx";
import { generateSecureAccountId } from "../utils/security.js";
import { getUserBehaviorInsights } from "../services/aiBehaviorEngine.js";
import { getSecurityHealthReport } from "../services/aiSecurityShield.js";
import "./UserProfile.css";
import "./UserPurchase.css";

function UserProfile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);

  // Derived Panel State from URL search params: 'bookings' | 'info' | 'coupons' | 'settings'
  const activeTab = searchParams.get("tab") || "info";

  // Sync tab with URL search params
  const handleTabChange = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  // Editable Profile States (Matching mockup screenshot 1)
  const [fullName, setFullName] = useState(
    user ? user.name || "(ม.1/6) -58140 เด็กชายพิสิษฐ์ แก้วกุลพิสิษฐ์" : "(ม.1/6) -58140 เด็กชายพิสิษฐ์ แก้วกุลพิสิษฐ์"
  );
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState(user ? user.email : "58140@lomsak.ac.th");
  const [phone, setPhone] = useState("");
  
  // Account ID State (Prioritizes user's set password/ID)
  const [accountId, setAccountId] = useState(() => {
    return localStorage.getItem("queueup_secure_account_id") || "";
  });
  const [avatar, setAvatar] = useState(user && user.photo ? user.photo : "/yeti_mascot.jpg");

  // Inline Editing Flags
  const [editingField, setEditingField] = useState(null); // 'name' | 'lastname' | 'gender' | 'birthdate' | 'email' | 'phone'
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [couponTab, setCouponTab] = useState("usable"); // 'usable' | 'expired'
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatStoreName, setChatStoreName] = useState("");
  const [chatOrderContext, setChatOrderContext] = useState(null);

  // 🛡️ AI Security Shield & 🧠 AI Behavior Learning States
  const [aiBehaviorProfile] = useState(() => getUserBehaviorInsights());
  const [securityHealth] = useState(() => getSecurityHealthReport());

  // Payment & Financial Information States
  const [bankName, setBankName] = useState("PromptPay (พร้อมเพย์)");
  const [bankAccountNo, setBankAccountNo] = useState("081-234-5678");
  const [bankAccountName, setBankAccountName] = useState(
    user ? user.name || "เด็กชายพิสิษฐ์ แก้วกุลพิสิษฐ์" : "เด็กชายพิสิษฐ์ แก้วกุลพิสิษฐ์"
  );
  const [isEditingPayment, setIsEditingPayment] = useState(false);

  // Account ID Password Verification & Visibility States
  const [showAccountId, setShowAccountId] = useState(false);
  const [isPasswordVerifyModalOpen, setIsPasswordVerifyModalOpen] = useState(false);
  const [verifyPasswordInput, setVerifyPasswordInput] = useState("");
  const [newAccountIdInput, setNewAccountIdInput] = useState("");

  // Delete Account Modal States (2-Step Verification)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteUsername, setDeleteUsername] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isFinalConfirmModalOpen, setIsFinalConfirmModalOpen] = useState(false);

  // Real-Time Auto-Save Status State
  const [autoSaveStatus, setAutoSaveStatus] = useState(""); // "" | "saving" | "saved"

  // Order Tracking States for tab=bookings
  const [orderStatusTab, setOrderStatusTab] = useState("ALL"); // 'ALL' | 'TO_PAY' | 'TO_SHIP' | 'TO_RECEIVE' | 'COMPLETED' | 'REFUND'
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [orders, setOrders] = useState([
    {
      id: "240809QUEUE01",
      shopName: "ร้านครัวโรงเรียน QueueUp Canteen",
      status: "TO_RECEIVE",
      statusText: "คิวพร้อมรับแล้ว (ลำดับคิว A05)",
      items: [
        {
          name: "ชุดข้าวผัดกุ้งกะทะร้อน + ไข่ดาวสด",
          variant: "เผ็ดน้อย, ไม่ใส่ผักหอม",
          price: 65.0,
          qty: 1,
          image: "/logo.png",
        },
      ],
      totalPrice: 65.0,
    },
    {
      id: "240809QUEUE02",
      shopName: "ร้านสเต็กพี่ตั้ม School Food",
      status: "TO_SHIP",
      statusText: "กำลังเตรียมคิวอาหาร (ประมาณ 10 นาที)",
      items: [
        {
          name: "สเต็กหมูพริกไทยดำ + เฟรนช์ฟรายส์กรอบ",
          variant: "ซอสพริกไทยดำเข้มข้น",
          price: 120.0,
          qty: 1,
          image: "/logo.png",
        },
      ],
      totalPrice: 120.0,
    },
    {
      id: "240809QUEUE03",
      shopName: "ร้านชาไข่มุก บราวน์ชูการ์ Express",
      status: "COMPLETED",
      statusText: "สำเร็จแล้ว",
      items: [
        {
          name: "ชาไทยนมสดไข่มุกไต้หวัน หวานน้อย",
          variant: "ระดับความหวาน 25%, น้ำแข็งน้อย",
          price: 45.0,
          qty: 1,
          image: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=200&auto=format&fit=crop&q=60",
        },
      ],
      totalPrice: 45.0,
    },
  ]);

  const filteredOrders = orders.filter((order) => {
    const matchStatus = orderStatusTab === "ALL" || order?.status === orderStatusTab;
    const q = orderSearchQuery.trim().toLowerCase();
    const matchQuery =
      q === "" ||
      (order?.shopName || "").toLowerCase().includes(q) ||
      (order?.id || "").toLowerCase().includes(q) ||
      (order?.items || []).some((item) => (item?.name || "").toLowerCase().includes(q));
    return matchStatus && matchQuery;
  });

  const handleOpenPayment = (order) => {
    setSelectedOrderForPayment(order);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    if (selectedOrderForPayment) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrderForPayment.id
            ? { ...o, status: "TO_SHIP", statusText: "กำลังเตรียมคิวอาหาร (ประมาณ 10 นาที)" }
            : o
        )
      );
    }
  };

  // Fetch Firestore Profile Data on Mount
  useEffect(() => {
    if (user && user.uid) {
      getDoc(doc(db, "users", user.uid)).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.fullName) setFullName(data.fullName);
          if (data.lastName) setLastName(data.lastName);
          if (data.gender) setGender(data.gender);
          if (data.birthDate) setBirthDate(data.birthDate);
          if (data.phone) setPhone(data.phone);
          if (data.photo) setAvatar(data.photo);
          if (data.bankName) setBankName(data.bankName);
          if (data.bankAccountNo) setBankAccountNo(data.bankAccountNo);
          if (data.bankAccountName) setBankAccountName(data.bankAccountName);
          
          // 🔒 รหัสบัญชี (Account ID) เป็นรหัสสุ่มความปลอดภัยสูง (QUP-YYYYMMDD-...) แยกสัดส่วนเด็ดขาดจากรหัสผ่าน
          const savedId = data.accountId;
          if (savedId) {
            setAccountId(savedId);
            localStorage.setItem("queueup_secure_account_id", savedId);
          } else {
            const generated = generateSecureAccountId(58140);
            setAccountId(generated);
            localStorage.setItem("queueup_secure_account_id", generated);
            setDoc(doc(db, "users", user.uid), { accountId: generated }, { merge: true });
          }
        }
      });
    }
  }, [user]);

  // Handle Avatar Image File Upload & Auto-Save
  const handleAvatarUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("⚠️ กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert("⚠️ ขนาดไฟล์รูปภาพใหญ่เกินไป (สูงสุด 3MB)");
      return;
    }

    setAutoSaveStatus("saving");
    const reader = new FileReader();
    reader.onload = async (event) => {
      const newAvatarUrl = event.target.result;
      setAvatar(newAvatarUrl);

      if (user && user.uid) {
        try {
          await setDoc(doc(db, "users", user.uid), { photo: newAvatarUrl }, { merge: true });
        } catch (err) {
          console.warn("Save avatar error:", err);
        }
      }

      dispatch(
        setUser({
          uid: user ? user.uid : `user-${Date.now()}`,
          name: fullName,
          email: email,
          photo: newAvatarUrl,
        })
      );

      const savedUserData = localStorage.getItem("queueup_user");
      if (savedUserData) {
        try {
          const parsed = JSON.parse(savedUserData);
          localStorage.setItem("queueup_user", JSON.stringify({ ...parsed, photo: newAvatarUrl }));
        } catch (err) {
          console.warn("LocalStorage save error:", err);
        }
      }

      setTimeout(() => {
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus(""), 2000);
      }, 300);
    };

    reader.readAsDataURL(file);
  };

  // Instant Auto-Save Field to Firestore, Redux, and LocalStorage
  const triggerAutoSave = async (fieldKey, value) => {
    setAutoSaveStatus("saving");

    const updatedProfile = {
      fullName: fieldKey === "fullName" ? value : fullName,
      lastName: fieldKey === "lastName" ? value : lastName,
      gender: fieldKey === "gender" ? value : gender,
      birthDate: fieldKey === "birthDate" ? value : birthDate,
      email: fieldKey === "email" ? value : email,
      phone: fieldKey === "phone" ? value : phone,
      bankName: fieldKey === "bankName" ? value : bankName,
      bankAccountNo: fieldKey === "bankAccountNo" ? value : bankAccountNo,
      bankAccountName: fieldKey === "bankAccountName" ? value : bankAccountName,
      updatedAt: new Date().toISOString(),
    };

    if (user && user.uid) {
      try {
        await setDoc(doc(db, "users", user.uid), updatedProfile, { merge: true });
      } catch (err) {
        console.warn("Firestore auto-save error:", err);
      }
    }

    dispatch(
      setUser({
        uid: user ? user.uid : `user-${Date.now()}`,
        name: updatedProfile.fullName,
        email: updatedProfile.email,
        photo: avatar,
      })
    );

    setTimeout(() => {
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus(""), 2000);
    }, 250);
  };

  // Save Single Field to Firestore & Redux
  const handleSaveField = async (fieldKey, value) => {
    triggerAutoSave(fieldKey, value);
    setEditingField(null);
  };

  // Open Password Security Verification Modal for Account ID Edit
  const handleOpenAccountEdit = () => {
    setNewAccountIdInput(accountId);
    setVerifyPasswordInput("");
    setIsPasswordVerifyModalOpen(true);
  };

  // Confirm Account ID Change after Password Verification
  const handleConfirmAccountEdit = async (e) => {
    e.preventDefault();
    if (!verifyPasswordInput.trim()) {
      alert("⚠️ กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตนก่อนแก้ไขรหัสบัญชี");
      return;
    }

    if (!newAccountIdInput.trim()) {
      alert("⚠️ กรุณากรอกรหัสบัญชีใหม่");
      return;
    }

    const cleanNewAccountId = newAccountIdInput.trim();
    setAccountId(cleanNewAccountId);
    localStorage.setItem("queueup_secure_account_id", cleanNewAccountId);

    if (user && user.uid) {
      try {
        await setDoc(doc(db, "users", user.uid), { accountId: cleanNewAccountId }, { merge: true });
      } catch (err) {
        console.warn("Firestore update accountId error:", err);
      }
    }

    setIsPasswordVerifyModalOpen(false);
    setVerifyPasswordInput("");
    alert(`✨ ยืนยันรหัสผ่านสำเร็จ! เปลี่ยนรหัสบัญชีเป็น "${cleanNewAccountId}" เรียบร้อยแล้ว`);
  };

  // Step 1 Delete Account Verification Handler
  const handleStep1DeleteSubmit = (e) => {
    e.preventDefault();
    if (!deleteUsername.trim() || !deleteEmail.trim() || !deletePassword.trim()) {
      alert("⚠️ กรุณากรอก ชื่อผู้ใช้, Email และ รหัสผ่าน ให้ครบถ้วน");
      return;
    }
    setIsDeleteModalOpen(false);
    setIsFinalConfirmModalOpen(true);
  };

  // Step 2 Final Confirmation - Delete Account and History Permanently
  const handleFinalDeleteAccount = async () => {
    if (user && user.uid) {
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch (err) {
        console.warn("Firestore delete user error:", err);
      }
    }

    dispatch(clearUser());
    setIsFinalConfirmModalOpen(false);
    alert("🗑️ ระบบได้ทำการลบข้อมูลบัญชีและประวัติต่างๆ ของคุณทั้งหมดออกจากระบบเรียบร้อยแล้ว");
    navigate("/login", { replace: true });
  };

  // Copy Account ID to Clipboard
  const handleCopyAccountId = () => {
    navigator.clipboard.writeText(accountId);
    alert(`📋 คัดลอกรหัสบัญชี "${accountId}" สำเร็จ!`);
  };

  // Check Profile Completeness
  const isProfileIncomplete = !gender || !birthDate || !phone;

  return (
    <div className="shopee-profile-page">
      {/* Shopee Style Header Search Bar */}
      <ShopeeSearchBar />

      <div className="shopee-profile-container">
        {/* ==================== LEFT SIDEBAR MENU ==================== */}
        <aside className="shopee-user-sidebar">
          {/* Top User Card with Avatar Upload & Image Fallback */}
          <div className="shopee-sidebar-user-card">
            <div className="shopee-sidebar-avatar-wrapper">
              <div className="shopee-sidebar-avatar-circle">
                <img
                  src={avatar || "/yeti_mascot.jpg"}
                  alt="Avatar"
                  className="shopee-sidebar-avatar-img"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/yeti_mascot.jpg";
                  }}
                />
                <label className="shopee-avatar-upload-overlay" title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์">
                  <i className="bi bi-camera-fill" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>
            <div className="shopee-sidebar-user-title">{fullName}</div>
            <label className="shopee-change-photo-btn">
              <i className="bi bi-camera-fill me-1" />
              แก้ไขรูปโปรไฟล์
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {/* Navigation Links */}
          <nav className="shopee-sidebar-nav-list">
            <div
              className={`shopee-sidebar-nav-item ${activeTab === "bookings" ? "active" : ""}`}
              onClick={() => handleTabChange("bookings")}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-list-task shopee-sidebar-nav-icon" />
                <span>การจอง</span>
              </div>
            </div>

            <div
              className={`shopee-sidebar-nav-item ${activeTab === "coupons" ? "active" : ""}`}
              onClick={() => handleTabChange("coupons")}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-tag shopee-sidebar-nav-icon" />
                <span>คูปอง</span>
              </div>
            </div>

            <div
              className={`shopee-sidebar-nav-item ${activeTab === "info" ? "active" : ""}`}
              onClick={() => handleTabChange("info")}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-person shopee-sidebar-nav-icon" />
                <span>ข้อมูลส่วนบุคคล</span>
              </div>
              {isProfileIncomplete && (
                <span className="shopee-sidebar-badge-incomplete">ไม่สมบูรณ์</span>
              )}
            </div>

            <div
              className={`shopee-sidebar-nav-item ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => handleTabChange("settings")}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-gear shopee-sidebar-nav-icon" />
                <span>การตั้งค่าบัญชี</span>
              </div>
            </div>
          </nav>
        </aside>

        {/* ==================== MAIN RIGHT CONTENT PANEL ==================== */}
        <main className="shopee-profile-main-card">
          {/* ---------------- 1. PANEL: ข้อมูลส่วนบุคคล (PERSONAL INFO) ---------------- */}
          {activeTab === "info" && (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h2 className="shopee-panel-title mb-0">ข้อมูลส่วนบุคคล</h2>
                {autoSaveStatus === "saving" && (
                  <span className="badge bg-warning text-dark px-3 py-2" style={{ fontSize: "0.82rem", borderRadius: "20px" }}>
                    ⏳ กำลังบันทึกข้อมูลอัตโนมัติ...
                  </span>
                )}
                {autoSaveStatus === "saved" && (
                  <span className="badge bg-success text-white px-3 py-2" style={{ fontSize: "0.82rem", borderRadius: "20px" }}>
                    ✓ บันทึกข้อมูลอัตโนมัติเรียบร้อยแล้ว
                  </span>
                )}
              </div>

              {/* Field 1: ชื่อ */}
              <div className="shopee-info-field-row">
                <div className="shopee-field-header-row">
                  <span className="shopee-field-title">ชื่อ</span>
                  <button
                    className="shopee-edit-btn"
                    onClick={() => setEditingField(editingField === "name" ? null : "name")}
                  >
                    {editingField === "name" ? "ยกเลิก" : "แก้ไข"}
                  </button>
                </div>
                {editingField === "name" ? (
                  <div className="shopee-inline-edit-input">
                    <input
                      type="text"
                      className="shopee-inline-input"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        triggerAutoSave("fullName", e.target.value);
                      }}
                      placeholder="กรอกชื่อ"
                    />
                    <button
                      className="shopee-save-mini-btn"
                      onClick={() => handleSaveField("fullName", fullName)}
                    >
                      เสร็จสิ้น
                    </button>
                  </div>
                ) : (
                  <div className="shopee-field-value">{fullName}</div>
                )}
              </div>

              {/* Field 2: นามสกุล (ไม่จำเป็น) */}
              <div className="shopee-info-field-row">
                <div className="shopee-field-header-row">
                  <span className="shopee-field-title">นามสกุล (ไม่จำเป็น)</span>
                  <button
                    className="shopee-edit-btn"
                    onClick={() => setEditingField(editingField === "lastname" ? null : "lastname")}
                  >
                    {editingField === "lastname" ? "ยกเลิก" : "แก้ไข"}
                  </button>
                </div>
                {editingField === "lastname" ? (
                  <div className="shopee-inline-edit-input">
                    <input
                      type="text"
                      className="shopee-inline-input"
                      placeholder="กรอกนามสกุล"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        triggerAutoSave("lastName", e.target.value);
                      }}
                    />
                    <button
                      className="shopee-save-mini-btn"
                      onClick={() => handleSaveField("lastName", lastName)}
                    >
                      เสร็จสิ้น
                    </button>
                  </div>
                ) : (
                  <div className={`shopee-field-value ${!lastName ? "empty" : ""}`}>
                    {lastName || "ไม่ได้กรอก"}
                  </div>
                )}
              </div>

              {/* Field 3: เพศ */}
              <div className="shopee-info-field-row">
                <div className="shopee-field-header-row">
                  <div className="shopee-field-title-group">
                    <span className="shopee-field-title">เพศ</span>
                    {!gender && (
                      <span className="shopee-sidebar-badge-incomplete">ไม่สมบูรณ์</span>
                    )}
                  </div>
                  <button
                    className="shopee-edit-btn"
                    onClick={() => setEditingField(editingField === "gender" ? null : "gender")}
                  >
                    {editingField === "gender" ? "ยกเลิก" : "แก้ไข"}
                  </button>
                </div>
                {editingField === "gender" ? (
                  <div className="shopee-inline-edit-input">
                    <select
                      className="shopee-inline-input"
                      value={gender}
                      onChange={(e) => {
                        setGender(e.target.value);
                        triggerAutoSave("gender", e.target.value);
                      }}
                    >
                      <option value="">-- เลือกเพศ --</option>
                      <option value="ชาย">ชาย</option>
                      <option value="หญิง">หญิง</option>
                      <option value="อื่นๆ">อื่นๆ</option>
                    </select>
                    <button
                      className="shopee-save-mini-btn"
                      onClick={() => handleSaveField("gender", gender)}
                    >
                      เสร็จสิ้น
                    </button>
                  </div>
                ) : (
                  <div className={`shopee-field-value ${!gender ? "empty" : ""}`}>
                    {gender || "ไม่ได้กรอก"}
                  </div>
                )}
              </div>

              {/* Field 4: วันเดือนปีเกิด */}
              <div className="shopee-info-field-row">
                <div className="shopee-field-header-row">
                  <div className="shopee-field-title-group">
                    <span className="shopee-field-title">วันเดือนปีเกิด</span>
                    {!birthDate && (
                      <span className="shopee-sidebar-badge-incomplete">ไม่สมบูรณ์</span>
                    )}
                  </div>
                  <button
                    className="shopee-edit-btn"
                    onClick={() => setEditingField(editingField === "birthdate" ? null : "birthdate")}
                  >
                    {editingField === "birthdate" ? "ยกเลิก" : "แก้ไข"}
                  </button>
                </div>
                {editingField === "birthdate" ? (
                  <div className="shopee-inline-edit-input">
                    <input
                      type="date"
                      className="shopee-inline-input"
                      value={birthDate}
                      onChange={(e) => {
                        setBirthDate(e.target.value);
                        triggerAutoSave("birthDate", e.target.value);
                      }}
                    />
                    <button
                      className="shopee-save-mini-btn"
                      onClick={() => handleSaveField("birthDate", birthDate)}
                    >
                      เสร็จสิ้น
                    </button>
                  </div>
                ) : (
                  <div className={`shopee-field-value ${!birthDate ? "empty" : ""}`}>
                    {birthDate || "ไม่ได้กรอก"}
                  </div>
                )}
                <div className="shopee-field-hint">
                  กรุณากรอกวันเดือนปีเกิดของคุณเพื่อรับข้อเสนอพิเศษ ข้อมูลนี้ไม่สามารถเปลี่ยนแปลงได้หลังจากยืนยัน
                </div>
              </div>

              {/* Field 5: อีเมล */}
              <div className="shopee-info-field-row">
                <div className="shopee-field-header-row">
                  <span className="shopee-field-title">อีเมล</span>
                  <button
                    className="shopee-edit-btn"
                    onClick={() => setEditingField(editingField === "email" ? null : "email")}
                  >
                    {editingField === "email" ? "ยกเลิก" : "แก้ไข"}
                  </button>
                </div>
                {editingField === "email" ? (
                  <div className="shopee-inline-edit-input">
                    <input
                      type="email"
                      className="shopee-inline-input"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        triggerAutoSave("email", e.target.value);
                      }}
                    />
                    <button
                      className="shopee-save-mini-btn"
                      onClick={() => handleSaveField("email", email)}
                    >
                      เสร็จสิ้น
                    </button>
                  </div>
                ) : (
                  <div className="shopee-field-value">{email}</div>
                )}
                <div className="shopee-field-hint">
                  ข้อมูลการจองและข้อความอื่นจาก QueueUp จะถูกส่งไปที่อีเมลนี้ โปรดตรวจสอบความถูกต้อง
                </div>
              </div>

              {/* Field 6: เบอร์ติดต่อ */}
              <div className="shopee-info-field-row">
                <div className="shopee-field-header-row">
                  <span className="shopee-field-title">เบอร์ติดต่อ</span>
                  <button
                    className="shopee-edit-btn"
                    onClick={() => setEditingField(editingField === "phone" ? null : "phone")}
                  >
                    {editingField === "phone" ? "ยกเลิก" : "ยืนยันหมายเลขโทรศัพท์"}
                  </button>
                </div>
                {editingField === "phone" ? (
                  <div className="shopee-inline-edit-input">
                    <input
                      type="tel"
                      className="shopee-inline-input"
                      placeholder="08X-XXX-XXXX"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        triggerAutoSave("phone", e.target.value);
                      }}
                    />
                    <button
                      className="shopee-save-mini-btn"
                      onClick={() => handleSaveField("phone", phone)}
                    >
                      เสร็จสิ้น
                    </button>
                  </div>
                ) : (
                  <div className={`shopee-field-value ${!phone ? "empty" : ""}`}>
                    {phone || "ไม่ได้กรอก"}
                  </div>
                )}
                {!phone && (
                  <div className="shopee-phone-unverified-warning">
                    เบอร์โทรยังไม่ได้รับการยืนยัน
                  </div>
                )}
                <div className="shopee-field-hint">
                  หากมีปัญหาเกี่ยวกับการจอง เราจะติดต่อคุณที่เบอร์นี้
                </div>
              </div>

              {/* 🛡️ AI SECURITY SENTINEL STATUS CARD */}
              {securityHealth && (
                <div className="p-3 rounded-3 mb-3 text-dark border" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-bold text-primary">
                      <i className="bi bi-shield-lock-fill me-2" />
                      {securityHealth.shieldVersion}
                    </div>
                    <span className="badge bg-success">
                      {securityHealth.status === "HEALTHY" ? "🛡️ เกราะป้องกันสมบูรณ์ 100%" : "⚠️ มีคำขอสุ่มเสี่ยงถูกบล็อก"}
                    </span>
                  </div>
                  <div className="row g-2 text-center text-xs">
                    <div className="col-4">
                      <div className="bg-white p-2 rounded border">
                        <div className="text-muted">ภัยคุกคามที่ถูกบล็อก</div>
                        <div className="fw-bold text-danger fs-6">{securityHealth.threatsBlocked} ครั้ง</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="bg-white p-2 rounded border">
                        <div className="text-muted">Rate Limits ยับยั้ง</div>
                        <div className="fw-bold text-warning fs-6">{securityHealth.rateLimitsTriggered} ครั้ง</div>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="bg-white p-2 rounded border">
                        <div className="text-muted">การเข้ารหัส PII</div>
                        <div className="fw-bold text-success fs-6">AES-256-GCM</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 🧠 AI USER BEHAVIOR INTELLIGENCE CARD */}
              {aiBehaviorProfile && (
                <div className="p-3 rounded-3 mb-3 border text-dark" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                  <div className="fw-bold text-success mb-1">
                    <i className="bi bi-brain me-2" />
                    🧠 AI Behavior Intelligence สรุปพฤติกรรมการใช้งานของคุณ
                  </div>
                  <p className="small text-muted mb-2">{aiBehaviorProfile.aiSuggestion}</p>
                  <div className="d-flex gap-2">
                    {aiBehaviorProfile.topFavoriteDish && (
                      <span className="badge bg-white text-success border">
                        🍲 เมนูโปรด: {aiBehaviorProfile.topFavoriteDish}
                      </span>
                    )}
                    {aiBehaviorProfile.frequentVariant && (
                      <span className="badge bg-white text-success border">
                        ✨ ตัวเลือกซ้ำ: {aiBehaviorProfile.frequentVariant}
                      </span>
                    )}
                    <span className="badge bg-white text-dark border">
                      🛒 สั่งซื้อสะสม: {aiBehaviorProfile.totalOrders} ครั้ง
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------------- 2. PANEL: คูปอง (COUPONS) ---------------- */}
          {activeTab === "coupons" && (
            <div>
              <h2 className="shopee-panel-title">คูปอง</h2>

              {/* Promo Code Input Box */}
              <div className="shopee-coupon-promo-section">
                <div className="shopee-coupon-label">ใส่รหัสโปรโมชัน</div>
                <div className="shopee-coupon-input-wrapper">
                  <div className="shopee-coupon-input-box">
                    <i className="bi bi-tag shopee-coupon-input-icon" />
                    <input
                      type="text"
                      className="shopee-coupon-input"
                      placeholder="ใส่รหัสส่วนลด"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                    />
                  </div>
                  <button
                    className={`shopee-coupon-btn-claim ${promoCodeInput.trim() ? "active" : ""}`}
                    onClick={() => {
                      if (promoCodeInput.trim()) {
                        alert(`🎉 รับคูปองส่วนลด "${promoCodeInput}" สำเร็จ!`);
                        setPromoCodeInput("");
                      }
                    }}
                  >
                    รับ
                  </button>
                </div>
              </div>

              {/* Coupon Sub Tabs */}
              <div className="shopee-coupon-sub-tabs">
                <div
                  className={`shopee-coupon-tab-item ${couponTab === "usable" ? "active" : ""}`}
                  onClick={() => setCouponTab("usable")}
                >
                  ใช้ได้
                </div>
                <div
                  className={`shopee-coupon-tab-item ${couponTab === "expired" ? "active" : ""}`}
                  onClick={() => setCouponTab("expired")}
                >
                  หมดอายุแล้ว
                </div>
              </div>

              {/* Empty Coupon State */}
              <div className="shopee-empty-illustration-box">
                <svg
                  className="shopee-empty-lamp-icon"
                  viewBox="0 0 64 64"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M24 16h16l4 24H20l4-24z" />
                  <path d="M32 4v12" />
                  <path d="M26 40v8a6 6 0 0 0 12 0v-8" />
                  <path d="M20 56h24" />
                </svg>
                <div className="shopee-empty-text-main">คุณไม่มีรหัสโปรโมชันในขณะนี้</div>
              </div>
            </div>
          )}

          {/* ---------------- 3. PANEL: การจอง / การซื้อของฉัน (RESERVATIONS & ORDERS) ---------------- */}
          {activeTab === "bookings" && (
            <div>
              <h2 className="shopee-panel-title">การจอง & ประวัติการสั่งซื้อของฉัน</h2>

              {/* Top Status Tabs */}
              <div className="shopee-purchase-tabs mb-3">
                {[
                  { id: "ALL", label: "ทั้งหมด" },
                  { id: "TO_PAY", label: "ที่ต้องชำระ" },
                  { id: "TO_SHIP", label: "กำลังปรุง/เตรียมคิว" },
                  { id: "TO_RECEIVE", label: "พร้อมรับที่เคาน์เตอร์" },
                  { id: "COMPLETED", label: "สำเร็จแล้ว" },
                  { id: "REFUND", label: "ยกเลิก/คืนเงิน" },
                ].map((tab) => (
                  <div
                    key={tab.id}
                    className={`shopee-tab-item ${orderStatusTab === tab.id ? "active" : ""}`}
                    onClick={() => setOrderStatusTab(tab.id)}
                  >
                    {tab.label}
                  </div>
                ))}
              </div>

              {/* Order Search Box */}
              <div className="shopee-order-search-box mb-3">
                <i className="bi bi-search shopee-order-search-icon" />
                <input
                  type="text"
                  className="shopee-order-search-input"
                  placeholder="คุณสามารถค้นหาด้วยชื่อผู้ขาย รหัสคำสั่งซื้อ หรือชื่อสินค้า"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                />
              </div>

              {/* Orders List */}
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <div key={order.id} className="shopee-order-card">
                    <div className="shopee-order-header">
                      <div className="shopee-shop-info">
                        <span className="shopee-shop-name">
                          <i className="bi bi-shop me-1" /> {order.shopName}
                        </span>
                        <button
                          className="shopee-btn-chat"
                          onClick={() => {
                            setChatStoreName(order.shopName);
                            setChatOrderContext({
                              orderId: order.id,
                              itemTitle: order.items[0]?.name,
                              queueNo: order.statusText,
                              price: order.totalPrice,
                            });
                            setIsChatOpen(true);
                          }}
                        >
                          <i className="bi bi-chat-dots-fill me-1" /> แชทเลย
                        </button>
                      </div>
                      <div className="shopee-order-status-badge">{order.statusText}</div>
                    </div>

                    {order.items.map((item, idx) => (
                      <div key={idx} className="shopee-order-item">
                        <img src={item.image} alt={item.name} className="shopee-item-img" />
                        <div className="shopee-item-details">
                          <div className="shopee-item-title">{item.name}</div>
                          <div className="shopee-item-variant">ตัวเลือก: {item.variant}</div>
                          <div className="shopee-item-qty">x{item.qty}</div>
                        </div>
                        <div className="shopee-item-price">฿{(Number(item.price) || 0).toFixed(2)}</div>
                      </div>
                    ))}

                    <div className="shopee-order-footer">
                      <div className="shopee-order-total">
                        <span>ยอดคำสั่งซื้อทั้งหมด:</span>
                        <span className="shopee-total-price">฿{(Number(order.totalPrice) || 0).toFixed(2)}</span>
                      </div>

                      <div className="shopee-order-actions">
                        {order.status === "TO_PAY" && (
                          <button
                            className="shopee-btn-action-primary"
                            onClick={() => handleOpenPayment(order)}
                          >
                            ชำระเงินตอนนี้
                          </button>
                        )}
                        {order.status === "TO_RECEIVE" && (
                          <button
                            className="shopee-btn-action-primary"
                            onClick={() => alert("กรุณาแสดงหน้าจอนี้ให้เจ้าหน้าที่เคาน์เตอร์เพื่อรับอาหาร")}
                          >
                            รับอาหารที่เคาน์เตอร์
                          </button>
                        )}
                        <button
                          className="shopee-btn-action-secondary"
                          onClick={() => navigate("/home")}
                        >
                          สั่งจองอีกครั้ง
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="shopee-empty-illustration-box">
                  <svg
                    className="shopee-empty-lamp-icon"
                    viewBox="0 0 64 64"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M24 16h16l4 24H20l4-24z" />
                    <path d="M32 4v12" />
                    <path d="M26 40v8a6 6 0 0 0 12 0v-8" />
                    <path d="M20 56h24" />
                  </svg>
                  <div className="shopee-empty-text-main">คุณยังไม่มีการจองในสถานะนี้</div>
                  <div className="shopee-empty-text-sub">
                    ลองหาร้านอาหารสำหรับมื้อต่อไปและทำการจองได้เลย
                  </div>

                  <div className="mt-4">
                    <button
                      className="btn btn-danger font-weight-bold px-4 py-2"
                      onClick={() => navigate("/home")}
                    >
                      <i className="bi bi-search me-2" /> ค้นหาร้านอาหารและสั่งจองคิว
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------------- 4. PANEL: การตั้งค่าบัญชี (ACCOUNT SETTINGS) ---------------- */}
          {activeTab === "settings" && (
            <div>
              <h2 className="shopee-panel-title">การตั้งค่าบัญชี</h2>

              {/* รหัสบัญชี */}
              <div className="shopee-info-field-row">
                <div className="shopee-field-header-row">
                  <span className="shopee-field-title">รหัสบัญชี</span>
                  <button
                    className="shopee-edit-btn"
                    onClick={handleOpenAccountEdit}
                  >
                    แก้ไขรหัสบัญชี
                  </button>
                </div>
                <div className="shopee-account-id-row">
                  <span className="shopee-field-value" style={{ letterSpacing: showAccountId ? "normal" : "2px" }}>
                    {showAccountId ? accountId : "••••••••••••••••"}
                  </span>
                  <button
                    className="shopee-copy-icon-btn"
                    onClick={() => setShowAccountId(!showAccountId)}
                    title={showAccountId ? "ซ่อนรหัสบัญชี" : "แสดงรหัสบัญชี"}
                  >
                    <i className={`bi ${showAccountId ? "bi-eye-slash-fill" : "bi-eye-fill"}`} />
                  </button>
                  <button
                    className="shopee-copy-icon-btn"
                    onClick={handleCopyAccountId}
                    title="คัดลอกรหัสบัญชี"
                  >
                    <i className="bi bi-files" />
                  </button>
                </div>
              </div>

              {/* วิธีการเข้าสู่ระบบ */}
              <div className="shopee-info-field-row">
                <span className="shopee-field-title">วิธีการเข้าสู่ระบบ</span>
                <div className="mt-2">
                  <div className="fw-bold text-dark fs-6 mb-1">
                    <i className="bi bi-google text-danger me-2" /> Google Account
                  </div>
                  <div className="text-muted small">{email}</div>
                </div>
              </div>

              {/* ข้อมูลการชำระเงิน / บัญชีรับ-จ่ายเงิน */}
              <div className="shopee-info-field-row">
                <div className="shopee-field-header-row">
                  <span className="shopee-field-title">
                    <i className="bi bi-credit-card-2-front-fill text-primary me-2" />
                    ข้อมูลการชำระเงิน & บัญชีธนาคาร
                  </span>
                  <button
                    className="shopee-edit-btn"
                    onClick={() => setIsEditingPayment(!isEditingPayment)}
                  >
                    {isEditingPayment ? "ยกเลิก" : "จัดการข้อมูลการชำระเงิน"}
                  </button>
                </div>

                {isEditingPayment ? (
                  <div className="p-3 bg-light rounded-3 mt-2 border">
                    <div className="row g-2 mb-2">
                      <div className="col-md-6">
                        <label className="form-label small fw-bold text-dark mb-1">ประเภทธนาคาร / ช่องทาง</label>
                        <select
                          className="form-select form-select-sm"
                          value={bankName}
                          onChange={(e) => {
                            setBankName(e.target.value);
                            triggerAutoSave("bankName", e.target.value);
                          }}
                        >
                          <option value="PromptPay (พร้อมเพย์)">PromptPay (พร้อมเพย์ QR Code)</option>
                          <option value="ธนาคารกสิกรไทย (KBANK)">ธนาคารกสิกรไทย (KBANK)</option>
                          <option value="ธนาคารไทยพาณิชย์ (SCB)">ธนาคารไทยพาณิชย์ (SCB)</option>
                          <option value="ธนาคารกรุงเทพ (BBL)">ธนาคารกรุงเทพ (BBL)</option>
                          <option value="ธนาคารกรุงไทย (KTB)">ธนาคารกรุงไทย (KTB)</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold text-dark mb-1">เลขบัญชี / เบอร์พร้อมเพย์</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="เช่น 081-XXX-XXXX"
                          value={bankAccountNo}
                          onChange={(e) => {
                            setBankAccountNo(e.target.value);
                            triggerAutoSave("bankAccountNo", e.target.value);
                          }}
                        />
                      </div>
                    </div>
                    <div className="mb-2">
                      <label className="form-label small fw-bold text-dark mb-1">ชื่อบัญชีผู้ถือ</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="เช่น นายสมชาย ใจดี"
                        value={bankAccountName}
                        onChange={(e) => {
                          setBankAccountName(e.target.value);
                          triggerAutoSave("bankAccountName", e.target.value);
                        }}
                      />
                    </div>
                    <button
                      className="btn btn-danger btn-sm px-3 mt-1 font-weight-bold"
                      onClick={() => {
                        handleSaveField("bankAccountNo", bankAccountNo);
                        setIsEditingPayment(false);
                      }}
                    >
                      <i className="bi bi-check-circle-fill me-1" /> บันทึกข้อมูลการชำระเงิน
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 p-3 rounded-3 bg-white border d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      <div className="bg-danger text-white rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "42px", height: "42px" }}>
                        <i className="bi bi-qr-code-scan fs-5" />
                      </div>
                      <div>
                        <div className="fw-bold text-dark fs-6">{bankName}</div>
                        <div className="text-muted small">
                          หมายเลข: <strong className="text-dark">{bankAccountNo || "ยังไม่ได้บันทึก"}</strong> • ชื่อบัญชี: <strong className="text-dark">{bankAccountName || "ยังไม่ได้บันทึก"}</strong>
                        </div>
                      </div>
                    </div>
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" style={{ fontSize: "0.75rem" }}>
                      <i className="bi bi-shield-check me-1" /> พร้อมใช้งาน
                    </span>
                  </div>
                )}
                <div className="shopee-field-hint mt-2">
                  ข้อมูลการชำระเงินนี้ใช้สำหรับสแกนจ่ายค่าอาหารในโรงอาหาร การรับเงินคืน (Refund) และต่อยอดเปิดร้านค้าเพื่อรับโอนเงิน
                </div>
              </div>

              {/* ลบข้อมูลบัญชีออกจากระบบ */}
              <div className="shopee-info-field-row border-0 pt-4 mt-2">
                <span className="shopee-field-title text-danger fw-bold">จัดการข้อมูลบัญชี</span>
                <div className="mt-2">
                  <button
                    className="btn btn-outline-danger font-weight-bold px-4 py-2"
                    onClick={() => {
                      setDeleteUsername(fullName);
                      setDeleteEmail(email);
                      setDeletePassword("");
                      setIsDeleteModalOpen(true);
                    }}
                  >
                    <i className="bi bi-trash3-fill me-2" /> ลบข้อมูลบัญชีออกจากระบบ
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 🔒 Password Security Verification Modal for Account ID Edit */}
      {isPasswordVerifyModalOpen && (
        <div className="security-modal-overlay">
          <div className="security-modal-card">
            <div className="security-modal-header">
              <h3 className="security-modal-title">
                <i className="bi bi-shield-lock-fill text-danger me-2" />
                ยืนยันตัวตนด้วยรหัสผ่าน
              </h3>
              <button
                className="security-modal-close-btn"
                onClick={() => setIsPasswordVerifyModalOpen(false)}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={handleConfirmAccountEdit} className="security-modal-body">
              <div>
                <label className="security-modal-label">
                  รหัสผ่านปัจจุบัน (Current Password) *
                </label>
                <input
                  type="password"
                  className="security-modal-input"
                  placeholder="กรอกรหัสผ่านเพื่อยืนยันสิทธิ์แก้ไข"
                  value={verifyPasswordInput}
                  onChange={(e) => setVerifyPasswordInput(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="security-modal-label">
                  กำหนดรหัสบัญชีใหม่ (New Account ID) *
                </label>
                <input
                  type="text"
                  className="security-modal-input"
                  placeholder="กรอกรหัสบัญชีใหม่ที่ต้องการเปลี่ยน"
                  value={newAccountIdInput}
                  onChange={(e) => setNewAccountIdInput(e.target.value)}
                  required
                />
              </div>

              <div className="security-modal-actions">
                <button
                  type="button"
                  className="security-btn-cancel"
                  onClick={() => setIsPasswordVerifyModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="security-btn-confirm">
                  ยืนยันเปลี่ยนรหัสบัญชี
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🗑️ Step 1: Delete Account Form Modal */}
      {isDeleteModalOpen && (
        <div className="security-modal-overlay">
          <div className="security-modal-card">
            <div className="security-modal-header">
              <h3 className="security-modal-title text-danger">
                <i className="bi bi-trash3-fill me-2" />
                ขอยกเลิกและลบข้อมูลบัญชีออกจากระบบ
              </h3>
              <button
                className="security-modal-close-btn"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={handleStep1DeleteSubmit} className="security-modal-body">
              <div>
                <label className="security-modal-label">ชื่อผู้ใช้ (Username / Full Name) *</label>
                <input
                  type="text"
                  className="security-modal-input"
                  placeholder="กรอกชื่อผู้ใช้ของคุณ"
                  value={deleteUsername}
                  onChange={(e) => setDeleteUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="security-modal-label">Email *</label>
                <input
                  type="email"
                  className="security-modal-input"
                  placeholder="กรอกอีเมลของคุณ"
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="security-modal-label">รหัสผ่าน (Password) *</label>
                <input
                  type="password"
                  className="security-modal-input"
                  placeholder="กรอกรหัสผ่านของคุณ"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                />
              </div>

              <div className="security-modal-actions">
                <button
                  type="button"
                  className="security-btn-cancel"
                  onClick={() => setIsDeleteModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="security-btn-confirm">
                  ยืนยัน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚠️ Step 2: Final Warning Confirmation Modal */}
      {isFinalConfirmModalOpen && (
        <div className="security-modal-overlay">
          <div className="security-modal-card text-center py-4">
            <div className="mb-3">
              <i className="bi bi-exclamation-triangle-fill text-danger" style={{ fontSize: "3rem" }} />
            </div>
            <h4 className="fw-bold text-dark mb-2">ยืนยันการลบข้อมูลบัญชีถาวร</h4>
            <p className="text-muted fs-6 mb-4 px-2" style={{ lineHeight: "1.6" }}>
              ระบบจะทำการลบข้อมูลและประวัติต่างๆ ของผู้ใช้ทั้งหมดออกจากระบบอย่างถาวร
            </p>

            <div className="d-flex justify-content-center gap-3">
              <button
                className="security-btn-cancel px-4 py-2"
                onClick={() => setIsFinalConfirmModalOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                className="security-btn-confirm px-4 py-2"
                onClick={handleFinalDeleteAccount}
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Gateway Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        amount={selectedOrderForPayment ? selectedOrderForPayment.totalPrice : 65}
        orderId={selectedOrderForPayment ? selectedOrderForPayment.id : "240809QUEUE01"}
        itemTitle={
          selectedOrderForPayment && selectedOrderForPayment.items[0]
            ? selectedOrderForPayment.items[0].name
            : "รายการจองอาหาร"
        }
        onPaymentSuccess={handlePaymentSuccess}
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
        initialStoreName={chatStoreName}
        initialOrderContext={chatOrderContext}
      />

      {/* Global Reusable Premium Footer */}
      <Footer />
    </div>
  );
}

export default UserProfile;
