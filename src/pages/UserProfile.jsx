import { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setUser, clearUser } from "../store/authSlice.js";
import { db, doc, setDoc, getDoc, deleteDoc } from "../firebase/config.js";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import ChatModal from "../components/ChatModal.jsx";
import ClientQueueTicket from "../components/ClientQueueTicket.jsx";
import Footer from "../components/Footer.jsx";
import { getUserBehaviorInsights } from "../services/aiBehaviorEngine.js";
import { getSecurityHealthReport } from "../services/aiSecurityShield.js";
import { calculateUserTrustScore } from "../services/aiUserVerificationEngine.js";
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

  // Editable Profile States (Loaded dynamically from authenticated user session)
  const [fullName, setFullName] = useState(() => user ? user.name || user.displayName || "" : "");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState(() => user ? user.email || "" : "");
  const [phone, setPhone] = useState("");
  
  // Account ID State (Prioritizes user's set password/ID)
  const [accountId, setAccountId] = useState(() => {
    return localStorage.getItem("queueup_secure_account_id") || "";
  });
  const [avatar, setAvatar] = useState(() => user?.photo || user?.photoURL || "/yeti_mascot.jpg");

  // Inline Editing Flags
  const [editingField, setEditingField] = useState(null); // 'name' | 'lastname' | 'gender' | 'birthdate' | 'email' | 'phone'
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [couponTab, setCouponTab] = useState("usable"); // 'usable' | 'expired'
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatStoreName, setChatStoreName] = useState("");
  const [chatOrderContext, setChatOrderContext] = useState(null);

  // 🔔 Real-time Booking & Purchase History State (Connected to Firestore /orders)
  const [orders, setOrders] = useState([]);
  const [orderStatusTab, setOrderStatusTab] = useState("ALL");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");

  // 🎫 Active Live Queue Ticket Selector
  const activeLiveOrder = useMemo(() => {
    return orders.find((ord) => {
      if (!ord) return false;
      const s = (ord.status || "").toUpperCase();
      const qs = (ord.queueStatus || "").toLowerCase();
      return (
        s !== "COMPLETED" &&
        s !== "CANCELLED" &&
        qs !== "completed" &&
        qs !== "cancelled"
      );
    });
  }, [orders]);

  // Auto Save Status Ticker State
  const [autoSaveStatus, setAutoSaveStatus] = useState("บันทึกอัตโนมัติเรียบร้อย");

  // Account ID Password Verification Modal State
  const [isPasswordVerifyModalOpen, setIsPasswordVerifyModalOpen] = useState(false);
  const [newAccountIdInput, setNewAccountIdInput] = useState("");
  const [verifyPasswordInput, setVerifyPasswordInput] = useState("");
  const [showAccountId, setShowAccountId] = useState(false);

  // Delete Account Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFinalConfirmModalOpen, setIsFinalConfirmModalOpen] = useState(false);
  const [deleteUsername, setDeleteUsername] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  // 🛡️ AI Security Shield & 🧠 AI Behavior Learning States
  const [aiBehaviorProfile] = useState(() => getUserBehaviorInsights());
  const [securityHealth] = useState(() => getSecurityHealthReport());

  // 🏆 Loyalty & Membership Tier System (Bronze, Silver, Gold, Platinum)
  const [userPoints, setUserPoints] = useState(1250);

  const getMembershipTierInfo = (pts) => {
    if (pts >= 3500) {
      return {
        name: "Platinum Member",
        icon: "bi-gem",
        color: "#a855f7",
        bg: "rgba(168, 85, 247, 0.15)",
        nextInfo: "ระดับสมาชิกสูงสุด (สิทธิพิเศษ School Executive Privileges)",
        progress: 100,
        discount: "ส่วนลด 20% + ส่งอาหารฟรีทุกออเดอร์",
      };
    } else if (pts >= 1500) {
      return {
        name: "Gold Member",
        icon: "bi-trophy-fill",
        color: "#f59e0b",
        bg: "rgba(245, 158, 11, 0.15)",
        nextInfo: `สะสมอีก ${(3500 - pts).toLocaleString()} แต้ม เพื่อเลื่อนเป็น Platinum Member`,
        progress: Math.min(100, Math.round(((pts - 1500) / 2000) * 100)),
        discount: "ส่วนลด 15% + คิวสปีดรันความเร็วสูง",
      };
    } else if (pts >= 500) {
      return {
        name: "Silver Member",
        icon: "bi-award-fill",
        color: "#94a3b8",
        bg: "rgba(148, 163, 184, 0.15)",
        nextInfo: `สะสมอีก ${(1500 - pts).toLocaleString()} แต้ม เพื่อเลื่อนเป็น Gold Member`,
        progress: Math.min(100, Math.round(((pts - 500) / 1000) * 100)),
        discount: "ส่วนลด 10% + สิทธิ์จองคิวด่วน",
      };
    } else {
      return {
        name: "Bronze Member",
        icon: "bi-award",
        color: "#d97706",
        bg: "rgba(217, 119, 6, 0.15)",
        nextInfo: `สะสมอีก ${(500 - pts).toLocaleString()} แต้ม เพื่อเลื่อนเป็น Silver Member`,
        progress: Math.min(100, Math.round((pts / 500) * 100)),
        discount: "ส่วนลดสะสมคูปอง 5%",
      };
    }
  };

  const membershipInfo = getMembershipTierInfo(userPoints);

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

  // 🛡️ Multi-Layer Verification & Trust Score Engine
  const userTrustReport = calculateUserTrustScore(
    {
      fullName,
      email,
      phone,
      gender,
      birthDate,
      photo: avatar,
      role: user?.role || "customer",
    },
    orders || []
  );

  // 🔄 Real-Time Firestore Order Listener (onSnapshot for Instant Status Updates)
  useEffect(() => {
    if (!user || !user.uid) return;

    try {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const liveOrders = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const qNum = data.queueNumber || "Q---";
            let statusText = "รอรับออเดอร์";
            const qStatus = data.queueStatus || data.status?.toLowerCase() || "waiting";

            if (qStatus === "waiting" || data.status === "PENDING") {
              statusText = `คิวรอรับออเดอร์ (${qNum})`;
            } else if (qStatus === "confirmed" || data.status === "CONFIRMED") {
              statusText = `ร้านค้ารับออเดอร์แล้ว (${qNum})`;
            } else if (qStatus === "cooking" || data.status === "PREPARING") {
              statusText = `กำลังปรุงอาหาร (${qNum})`;
            } else if (qStatus === "ready" || data.status === "READY") {
              statusText = `พร้อมรับอาหารที่เคาน์เตอร์ (${qNum})`;
            } else if (qStatus === "completed" || data.status === "COMPLETED") {
              statusText = "รับอาหารสำเร็จเรียบร้อยแล้ว";
            } else if (qStatus === "cancelled" || data.status === "CANCELLED") {
              statusText = "ยกเลิกออเดอร์แล้ว";
            }

            return {
              id: docSnap.id,
              ...data,
              queueNo: qNum,
              statusText,
              shopName: data.storeName || data.shopName || (data.storeId ? `ร้านค้า (${data.storeId})` : "ร้านค้า"),
              totalPrice: data.totalAmount || data.finalAmount || 0,
              items: (data.items || []).map((it) => ({
                id: it.productId || it.id,
                name: it.name || it.menuItem?.name || "รายการอาหาร",
                price: it.unitPrice || it.menuItem?.price || 0,
                quantity: it.quantity || 1,
                variant: it.customNotes || (it.selectedModifiers || []).map((m) => m.name || m.optionId).join(", "),
                image: it.image || it.menuItem?.image || "/logo.png",
              })),
            };
          });

          // Sort by createdAt descending
          liveOrders.sort((a, b) => {
            const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return timeB - timeA;
          });

          setOrders(liveOrders);
        },
        (err) => {
          console.warn("UserProfile onSnapshot orders warning:", err);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn("UserProfile setup onSnapshot error:", err);
    }
  }, [user]);

  // Fetch Firestore Profile Data on Mount
  useEffect(() => {
    if (user && user.uid) {
      getDoc(doc(db, "users", user.uid)).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.fullName || data.displayName) setFullName(data.fullName || data.displayName);
          if (data.lastName) setLastName(data.lastName);
          if (data.gender) setGender(data.gender);
          if (data.birthDate) setBirthDate(data.birthDate);
          if (data.phone) setPhone(data.phone);
          if (data.photo || data.photoURL) setAvatar(data.photo || data.photoURL);
          
          // 🔒 รหัสบัญชี (Account ID)
          const savedId = data.accountId;
          if (savedId) {
            setAccountId(savedId);
            localStorage.setItem("queueup_secure_account_id", savedId);
          }
        }
      }).catch((err) => {
        console.warn("Error fetching user profile doc:", err);
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

    if (file.size > 5 * 1024 * 1024) {
      alert("⚠️ ขนาดไฟล์รูปภาพใหญ่เกินไป (สูงสุด 5MB)");
      return;
    }

    setAutoSaveStatus("saving");
    const reader = new FileReader();
    reader.onload = async (event) => {
      const newAvatarUrl = event.target.result;
      setAvatar(newAvatarUrl);

      const updatedUser = {
        ...(user || {}),
        photo: newAvatarUrl,
        photoURL: newAvatarUrl,
        name: fullName || user?.name || user?.displayName || "ผู้ใช้งาน",
        displayName: fullName || user?.displayName || user?.name || "ผู้ใช้งาน",
        email: email || user?.email || "",
      };

      if (user && user.uid) {
        try {
          await setDoc(
            doc(db, "users", user.uid),
            {
              photo: newAvatarUrl,
              photoURL: newAvatarUrl,
              fullName: fullName || user?.name || "",
              displayName: fullName || user?.displayName || "",
            },
            { merge: true }
          );
        } catch (err) {
          console.warn("Save avatar Firestore error:", err);
        }
      }

      dispatch(setUser(updatedUser));
      try {
        localStorage.setItem("queueup_user", JSON.stringify(updatedUser));
      } catch (err) {
        console.warn("LocalStorage save error:", err);
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
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div className="shopee-sidebar-user-title">{fullName}</div>
            
            {/* Membership Tier Badge */}
            <div
              className="mt-2 px-3 py-1 rounded-pill d-inline-flex align-items-center gap-1 cursor-pointer text-[11px] font-extrabold"
              style={{
                backgroundColor: membershipInfo.bg,
                color: membershipInfo.color,
                border: `1px solid ${membershipInfo.color}50`,
              }}
              onClick={() => handleTabChange("membership")}
              title="คลิกเพื่อดูสิทธิพิเศษประจำระดับสมาชิก"
            >
              <i className={`bi ${membershipInfo.icon}`} />
              <span>{membershipInfo.name}</span>
            </div>
            <div className="small text-muted mt-1 text-[11px]">
              🪙 <b>{userPoints.toLocaleString()}</b> Points
            </div>
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
              className={`shopee-sidebar-nav-item ${activeTab === "membership" ? "active" : ""}`}
              onClick={() => handleTabChange("membership")}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-trophy shopee-sidebar-nav-icon" />
                <span>แต้มสะสม & สมาชิก</span>
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

            <div className="pt-3 pb-1 px-3">
              <span className="text-secondary text-uppercase fw-bold text-[10px] tracking-[0.5px]">
                บริการสถานศึกษา (Campus)
              </span>
            </div>

            <div
              className="shopee-sidebar-nav-item cursor-pointer"
              onClick={() => navigate("/guardian")}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-shield-heart text-danger shopee-sidebar-nav-icon" />
                <span>แดชบอร์ดผู้ปกครอง</span>
              </div>
              <i className="bi bi-chevron-right small text-secondary ms-auto" />
            </div>

            <div
              className="shopee-sidebar-nav-item cursor-pointer"
              onClick={() => navigate("/student-vendor/apply")}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-mortarboard text-warning shopee-sidebar-nav-icon" />
                <span>ร้านค้านักเรียน</span>
              </div>
              <i className="bi bi-chevron-right small text-secondary ms-auto" />
            </div>

            {(user?.role === "student_vendor" || user?.role === "merchant" || user?.role === "admin") && (
              <div
                className="shopee-sidebar-nav-item cursor-pointer"
                onClick={() => navigate("/student-vendor/earnings")}
              >
                <div className="shopee-sidebar-nav-left">
                  <i className="bi bi-wallet2 text-success shopee-sidebar-nav-icon" />
                  <span>รายได้ร้านค้านักเรียน</span>
                </div>
                <i className="bi bi-chevron-right small text-secondary ms-auto" />
              </div>
            )}

            {(user?.role === "staff_supervisor" || user?.role === "admin") && (
              <>
                <div
                  className="shopee-sidebar-nav-item cursor-pointer"
                  onClick={() => navigate("/admin/vendor-approvals")}
                >
                  <div className="shopee-sidebar-nav-left">
                    <i className="bi bi-person-check text-info shopee-sidebar-nav-icon" />
                    <span>อนุมัติร้านค้า (ฝ่ายปกครอง)</span>
                  </div>
                  <i className="bi bi-chevron-right small text-secondary ms-auto" />
                </div>

                <div
                  className="shopee-sidebar-nav-item cursor-pointer"
                  onClick={() => navigate("/emergency")}
                >
                  <div className="shopee-sidebar-nav-left">
                    <i className="bi bi-heart-pulse text-danger shopee-sidebar-nav-icon" />
                    <span>ข้อมูลพยาบาลฉุกเฉิน</span>
                  </div>
                  <i className="bi bi-chevron-right small text-secondary ms-auto" />
                </div>
              </>
            )}

            <div
              className="shopee-sidebar-nav-item cursor-pointer"
              onClick={() => navigate("/campus/monitor")}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-tv text-primary shopee-sidebar-nav-icon" />
                <span>จอแสดงคิวโรงอาหารสด</span>
              </div>
              <i className="bi bi-chevron-right small text-secondary ms-auto" />
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
                  <span className="badge bg-warning text-dark px-3 py-2 text-[0.82rem] rounded-full">
                    ⏳ กำลังบันทึกข้อมูลอัตโนมัติ...
                  </span>
                )}
                {autoSaveStatus === "saved" && (
                  <span className="badge bg-success text-white px-3 py-2 text-[0.82rem] rounded-full">
                    ✓ บันทึกข้อมูลอัตโนมัติเรียบร้อยแล้ว
                  </span>
                )}
              </div>

              {/* Trust Score & Multi-Layer Verification Banner */}
              <div
                className="p-3 rounded-4 mb-4 text-white d-flex align-items-center justify-content-between flex-wrap gap-3"
                style={{
                  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  border: `1.5px solid ${userTrustReport.badgeColor}`,
                  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)",
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="p-3 rounded-circle d-flex align-items-center justify-content-center"
                    style={{ backgroundColor: userTrustReport.badgeColor + "25", color: userTrustReport.badgeColor }}
                  >
                    <i className="bi bi-shield-check fs-3" />
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold text-white fs-6">
                        {userTrustReport.levelName}
                      </span>
                      <span
                        className="badge rounded-pill small px-2 py-1"
                        style={{ backgroundColor: userTrustReport.badgeColor, color: "#fff" }}
                      >
                        {userTrustReport.trustCategory}
                      </span>
                    </div>
                    <div className="small text-slate-300 mt-1">
                      คะแนนความน่าเชื่อถือบัญชี (Trust Score): <b>{userTrustReport.trustScore} / 100</b> — {userTrustReport.statusText}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline-warning rounded-pill px-3"
                    onClick={() => {
                      alert(
                        `🛡️ รายงานคะแนนความน่าเชื่อถือ (Trust Score Breakdown):\n\n` +
                          userTrustReport.breakdown.map((b) => `• ${b.label}`).join("\n") +
                          `\n\nสิทธิ์การใช้งานของคุณ:\n• สั่งจองอาหาร: ${userTrustReport.privileges.canOrder ? "อนุมัติ ✅" : "ไม่อนุมัติ ❌"}\n• เขียนรีวิวร้านค้า: ${userTrustReport.privileges.canReview ? "อนุมัติ ✅" : "ต้องใช้ Level 2+ ⚠️"}\n• รายงานร้านค้า: ${userTrustReport.privileges.canReportStore ? "อนุมัติ ✅" : "ต้องใช้ Trust Score 70+ ⚠️"}`
                      );
                    }}
                  >
                    <i className="bi bi-bar-chart-line me-1" /> ดูรายละเอียดคะแนน
                  </button>
                </div>
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
                <div className="p-3 rounded-3 mb-3 text-dark border bg-slate-50 border-slate-200">
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
                <div className="p-3 rounded-3 mb-3 border text-dark bg-emerald-50 border-emerald-200">
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

          {/* ---------------- 2.5 PANEL: แต้มสะสม & ระดับสมาชิก (LOYALTY & MEMBERSHIP TIER) ---------------- */}
          {activeTab === "membership" && (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                <div>
                  <h2 className="shopee-panel-title mb-1">แต้มสะสม & ระดับสมาชิก (Loyalty & Membership)</h2>
                  <p className="text-muted small mb-0">
                    สะสม QueueUp Points จากการสั่งอาหารเพื่อเลื่อนระดับสมาชิกและรับสิทธิพิเศษมากมาย
                  </p>
                </div>
                <div
                  className="px-3 py-2 rounded-pill d-flex align-items-center gap-2"
                  style={{
                    backgroundColor: membershipInfo.bg,
                    border: `1.5px solid ${membershipInfo.color}`,
                    color: membershipInfo.color,
                    fontWeight: "800",
                    fontSize: "0.92rem",
                  }}
                >
                  <i className={`bi ${membershipInfo.icon} fs-5`} />
                  <span>{membershipInfo.name}</span>
                </div>
              </div>

              {/* Points Banner Card */}
              <div className="p-4 rounded-4 mb-4 text-white position-relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-400/40 shadow-lg">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                  <div>
                    <span className="text-warning small fw-bold text-uppercase tracking-wider">
                      คลังแต้มสะสมของคุณ (QueueUp Points Balance)
                    </span>
                    <h1 className="fw-bold display-6 mb-0 text-warning mt-1">
                      🪙 {userPoints.toLocaleString()} <span className="fs-5 text-slate-300">แต้ม</span>
                    </h1>
                    <div className="small text-slate-300 mt-2">
                      <i className="bi bi-info-circle me-1" />
                      {membershipInfo.nextInfo}
                    </div>
                  </div>
                  <button
                    className="btn btn-warning text-dark font-weight-bold px-4 py-2 rounded-pill shadow-sm"
                    onClick={() => {
                      alert("🎉 คุณแลกคูปองส่วนลดอาหาร 20 บาท ด้วย 200 แต้มสำเร็จ!");
                      setUserPoints((prev) => Math.max(0, prev - 200));
                    }}
                  >
                    <i className="bi bi-gift-fill me-1" /> แลกแต้มเป็นคูปองอาหาร (200 แต้ม)
                  </button>
                </div>

                {/* Progress bar to next tier */}
                <div className="mt-4 pt-3 border-top border-secondary">
                  <div className="d-flex justify-content-between small text-slate-300 mb-1">
                    <span>ระดับปัจจุบัน: <b>{membershipInfo.name}</b></span>
                    <span>{membershipInfo.progress}% ถึงระดับถัดไป</span>
                  </div>
                  <div className="progress h-2.5 bg-slate-700 rounded-[10px]">
                    <div
                      className="progress-bar bg-warning progress-bar-striped progress-bar-animated rounded-[10px]"
                      role="progressbar"
                      style={{ width: `${membershipInfo.progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tier Comparison Grid */}
              <h5 className="fw-bold mb-3 text-slate-800">สิทธิพิเศษประจำระดับสมาชิก (Membership Tier Privileges)</h5>
              <div className="row g-3 mb-4">
                <div className="col-md-3 col-6">
                  <div className={`p-3 rounded-4 border text-center h-100 ${membershipInfo.name === "Bronze Member" ? "border-warning bg-amber-50" : "border-slate-200 bg-white"}`}>
                    <div className="fs-2 mb-1">🥉</div>
                    <h6 className="fw-bold mb-1 text-amber-600">Bronze Member</h6>
                    <div className="small text-muted mb-2">0 - 499 แต้ม</div>
                    <span className="badge bg-warning text-dark rounded-pill small">ส่วนลด 5%</span>
                  </div>
                </div>

                <div className="col-md-3 col-6">
                  <div className={`p-3 rounded-4 border text-center h-100 ${membershipInfo.name === "Silver Member" ? "border-secondary bg-slate-100" : "border-slate-200 bg-white"}`}>
                    <div className="fs-2 mb-1">🥈</div>
                    <h6 className="fw-bold mb-1 text-slate-500">Silver Member</h6>
                    <div className="small text-muted mb-2">500 - 1,499 แต้ม</div>
                    <span className="badge bg-secondary text-white rounded-pill small">ส่วนลด 10% + จองคิวด่วน</span>
                  </div>
                </div>

                <div className="col-md-3 col-6">
                  <div className={`p-3 rounded-4 border text-center h-100 ${membershipInfo.name === "Gold Member" ? "border-warning bg-warning-50" : "border-slate-200 bg-white"}`}>
                    <div className="fs-2 mb-1">🥇</div>
                    <h6 className="fw-bold mb-1 text-yellow-500">Gold Member</h6>
                    <div className="small text-muted mb-2">1,500 - 3,499 แต้ม</div>
                    <span className="badge bg-warning text-dark rounded-pill small">ส่วนลด 15% + สปีดคิว</span>
                  </div>
                </div>

                <div className="col-md-3 col-6">
                  <div className={`p-3 rounded-4 border text-center h-100 ${membershipInfo.name === "Platinum Member" ? "border-purple bg-purple-50" : "border-slate-200 bg-white"}`}>
                    <div className="fs-2 mb-1">💎</div>
                    <h6 className="fw-bold mb-1 text-purple-500">Platinum Member</h6>
                    <div className="small text-muted mb-2">3,500+ แต้ม</div>
                    <span className="badge bg-purple text-white rounded-pill small">VIP School Executive 20%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- 3. PANEL: การจอง / การซื้อของฉัน (RESERVATIONS & ORDERS) ---------------- */}
          {activeTab === "bookings" && (
            <div>
              <h2 className="shopee-panel-title">การจอง & ประวัติการสั่งซื้อของฉัน</h2>

              {/* 🎫 Active Live Queue Ticket */}
              {activeLiveOrder && (
                <div className="mb-4">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-xs font-bold text-uppercase tracking-wider text-muted">
                      ⚡ คิวสดที่กำลังดำเนินการ (Active Live Queue)
                    </span>
                    <span className="badge bg-danger text-white text-xs px-2.5 py-1 rounded-pill">
                      Live Real-Time
                    </span>
                  </div>
                  <ClientQueueTicket
                    activeOrder={activeLiveOrder}
                    onOpenChat={(ord) => {
                      setChatStoreName(ord.shopName || ord.storeName || "ร้านค้า");
                      setChatOrderContext({
                        orderId: ord.id,
                        itemTitle: ord.items?.[0]?.name,
                        queueNo: ord.statusText || ord.queueNumber,
                        price: ord.totalPrice || ord.totalAmount,
                      });
                      setIsChatOpen(true);
                    }}
                  />
                </div>
              )}

              {/* Top Status Tabs */}
              <div className="shopee-purchase-tabs mb-3">
                {[
                  { id: "ALL", label: "ทั้งหมด" },
                  { id: "PENDING", label: "คิวรอปรุง/กำลังปรุง" },
                  { id: "TO_RECEIVE", label: "พร้อมรับที่เคาน์เตอร์" },
                  { id: "COMPLETED", label: "สำเร็จแล้ว" },
                  { id: "CANCELLED", label: "ยกเลิกแล้ว" },
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
                        <img
                          src={item.image}
                          alt={item.name}
                          className="shopee-item-img"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/crispy_fried_chicken.jpg";
                          }}
                        />
                        <div className="shopee-item-details">
                          <div className="shopee-item-title">{item.name}</div>
                          <div className="shopee-item-variant">ตัวเลือก: {item.variant}</div>
                          <div className="shopee-item-qty">x{item.qty}</div>
                        </div>
                        <div className="shopee-item-price">฿{(Number(item.price) || 0).toFixed(2)}</div>
                      </div>
                    ))}

                    <div className="shopee-order-footer">
                      <div className="d-flex flex-column gap-1">
                        <div className="d-flex align-items-center gap-2 flex-wrap text-xs text-muted">
                          {order.pickupTime && (
                            <span className="badge bg-light text-dark border">
                              <i className="bi bi-clock me-1 text-danger" />
                              รับ {order.pickupTime} น. ({order.pickupDate || "วันนี้"})
                            </span>
                          )}
                          <span className={`badge ${order.paymentMode === 'CAMPUS_WALLET' ? 'bg-success-subtle text-success border border-success' : 'bg-warning-subtle text-warning-emphasis border border-warning'}`}>
                            {order.paymentMode === 'CAMPUS_WALLET' ? '💳 ชำระผ่านกระเป๋านักเรียน' : '⚡ Zero-Payment (หน้าร้าน)'}
                          </span>
                        </div>
                        <div className="shopee-order-total mt-1">
                          <span>ยอดคำสั่งซื้อทั้งหมด:</span>
                          <span className="shopee-total-price">฿{(Number(order.totalPrice) || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="shopee-order-actions">
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
                  <span className={`shopee-field-value ${showAccountId ? "tracking-normal" : "tracking-[2px]"}`}>
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

              {/* ช่องทางรับการแจ้งเตือนคิวและติดต่อร้านค้า (Zero-Payment Queue Alerts) */}
              <div className="shopee-info-field-row">
                <div className="shopee-field-header-row">
                  <span className="shopee-field-title">
                    <i className="bi bi-bell-fill text-success me-2" />
                    ช่องทางรับการแจ้งเตือนคิว & ข้อมูลติดต่อ
                  </span>
                </div>

                <div className="mt-2 p-3 rounded-3 bg-white border d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <div className="bg-success text-white rounded-circle p-2 d-flex align-items-center justify-content-center w-[42px] h-[42px]">
                      <i className="bi bi-bell-fill fs-5" />
                    </div>
                    <div>
                      <div className="fw-bold text-dark fs-6">Zero-Payment Live Queue Tracking</div>
                      <div className="text-muted small">
                        เบอร์ติดต่อสำหรับแจ้งเตือน: <strong className="text-dark">{phone || "กรุณาระบุในข้อมูลส่วนบุคคล"}</strong> • ชื่อผู้รับอาหาร: <strong className="text-dark">{fullName || "ผู้ใช้งาน"}</strong>
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 text-xs">
                    <i className="bi bi-shield-check me-1" /> เชื่อมต่อระบบคิวสด
                  </span>
                </div>
                <div className="shopee-field-hint mt-2">
                  ระบบ Zero-Payment จะใช้หมายเลขโทรศัพท์นี้ในการออกบัตรคิวและส่งสัญญาณแจ้งเตือนเมื่ออาหารปรุงเสร็จ
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
              <i className="bi bi-exclamation-triangle-fill text-danger text-5xl" />
            </div>
            <h4 className="fw-bold text-dark mb-2">ยืนยันการลบข้อมูลบัญชีถาวร</h4>
            <p className="text-muted fs-6 mb-4 px-2 leading-relaxed">
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
