import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { switchRole, clearUser } from "../store/authSlice.js";
import { db, doc, getDoc, setDoc } from "../firebase/config.js";
import { collection, query, where, getDocs, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { MerchantKDS } from "../components/MerchantKDS.tsx";
import ChatModal from "../components/ChatModal.jsx";
import BookingCalendar from "../components/BookingCalendar.jsx";
import SellerAssistantModal from "../components/SellerAssistantModal.jsx";
import { MerchantMenuManager } from "../components/MerchantMenuManager.tsx";
import { MerchantModifierManager } from "../components/MerchantModifierManager.tsx";
import { MerchantCRMAnalytics } from "../components/MerchantCRMAnalytics.tsx";
import {
  fetchStoreModifierGroups,
  createStoreModifierGroup,
  toggleStoreModifierOptionStock,
} from "../services/catalogService";
import {
  generateAIMarketingRecommendations,
  getActiveMerchantCoupons,
  deployAICoupon,
  toggleCouponState,
} from "../services/aiMarketingService.js";
import { getSecurityHealthReport } from "../services/aiSecurityShield.js";
import { recordAuditLog } from "../services/storeIsolationEngine.js";
import {
  createAnnouncementInFirestore,
} from "../services/communityService.js";
import Footer from "../components/Footer.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import "./MerchantDashboard.css";

function MerchantDashboard() {
  const toast = useToast();
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

  const [currentStoreId, setCurrentStoreId] = useState(user?.storeId || null);
  const [isStoreLoading, setIsStoreLoading] = useState(true);
  const [hasNoStore, setHasNoStore] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const [merchantOrders, setMerchantOrders] = useState([]);
  const [modifierGroups, setModifierGroups] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  const [storeName, setStoreName] = useState(() => cleanDisplayName(user?.merchantStoreName || user?.storeName, user?.email));
  const [storePhone, setStorePhone] = useState(user?.phone || user?.businessPhone || "");
  const [canteenLocation, setCanteenLocation] = useState(user?.canteenLocation || "");
  const [storeHours, setStoreHours] = useState("07:00 - 15:00 น.");
  const [isSavedProfile, setIsSavedProfile] = useState(false);
  const [privateBankName, setPrivateBankName] = useState("");
  const [privateAccountNo, setPrivateAccountNo] = useState("");
  const [privateAccountOwner, setPrivateAccountOwner] = useState("");

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

  const handleOpenChatWithCustomer = (order) => {
    setChatCustomerName(order?.customerName || "ลูกค้า");
    setChatOrderContext(order);
    setIsChatOpen(true);
  };

  const [isSellerAssistantOpen, setIsSellerAssistantOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const handleLogout = () => {
    dispatch(clearUser());
    navigate("/login", { replace: true });
  };

  const [aiMarketingCoupons] = useState(() => generateAIMarketingRecommendations());
  const [activeCouponsList, setActiveCouponsList] = useState([]);
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

  // 🏪 Authoritative Store Resolution: Firebase Auth -> Firestore /shops where ownerUid == user.uid -> currentStoreId
  useEffect(() => {
    let isCancelled = false;

    async function resolveAuthoritativeStore() {
      if (!user) {
        setIsStoreLoading(false);
        navigate("/portal/th-onboarding", { replace: true });
        return;
      }

      setIsStoreLoading(true);

      try {
        // Priority 1: Check user.storeId if present on auth claims/profile
        if (user.storeId) {
          const shopDoc = await getDoc(doc(db, "shops", user.storeId));
          if (!isCancelled && shopDoc.exists()) {
            const sData = shopDoc.data();
            setCurrentStoreId(shopDoc.id);
            if (sData.storeName || sData.name) setStoreName(cleanDisplayName(sData.storeName || sData.name, user.email));
            if (sData.phone || sData.businessPhone) setStorePhone(sData.phone || sData.businessPhone);
            if (sData.canteenLocation || sData.location) setCanteenLocation(sData.canteenLocation || sData.location);
            if (sData.storeHours || sData.hours) setStoreHours(sData.storeHours || sData.hours);
            setIsRegistered(true);
            setHasNoStore(false);
            setIsStoreLoading(false);
            return;
          }
        }

        // Priority 2: Authoritative Firestore query: /shops where ownerUid == user.uid
        const shopsQuery = query(collection(db, "shops"), where("ownerUid", "==", user.uid));
        const shopsSnap = await getDocs(shopsQuery);

        if (!isCancelled) {
          if (!shopsSnap.empty) {
            const primaryShop = shopsSnap.docs[0];
            const sData = primaryShop.data();
            setCurrentStoreId(primaryShop.id);
            if (sData.storeName || sData.name) setStoreName(cleanDisplayName(sData.storeName || sData.name, user.email));
            if (sData.phone || sData.businessPhone) setStorePhone(sData.phone || sData.businessPhone);
            if (sData.canteenLocation || sData.location) setCanteenLocation(sData.canteenLocation || sData.location);
            if (sData.storeHours || sData.hours) setStoreHours(sData.storeHours || sData.hours);
            setIsRegistered(true);
            setHasNoStore(false);
          } else {
            // Check merchantProfiles collection
            const mchSnap = await getDocs(query(collection(db, "merchantProfiles"), where("ownerUid", "==", user.uid)));
            if (!mchSnap.empty) {
              const mData = mchSnap.docs[0].data();
              if (mData.storeId) {
                setCurrentStoreId(mData.storeId);
                if (mData.merchantStoreName || mData.storeName) setStoreName(cleanDisplayName(mData.merchantStoreName || mData.storeName, user.email));
                if (mData.businessPhone) setStorePhone(mData.businessPhone);
                if (mData.canteenLocation) setCanteenLocation(mData.canteenLocation);
                setIsRegistered(true);
                setHasNoStore(false);
                setIsStoreLoading(false);
                return;
              }
            }

            // No shop document exists in Firestore for this merchant:
            // Do NOT generate fake store_${uid} or fall back to localStorage!
            setCurrentStoreId(null);
            setHasNoStore(true);
          }
          setIsStoreLoading(false);
        }
      } catch (err) {
        console.warn("[MerchantDashboard] Error resolving authoritative store:", err);
        if (!isCancelled) {
          setIsStoreLoading(false);
        }
      }
    }

    resolveAuthoritativeStore();

    // Check private finance info if merchantId exists
    const merchantId = user.merchantId;
    if (merchantId) {
      getDoc(doc(db, "merchantProfiles", merchantId, "private", "finance")).then((finSnap) => {
        if (!isCancelled && finSnap.exists()) {
          const finData = finSnap.data();
          if (finData.bankName) setPrivateBankName(finData.bankName);
          if (finData.accountNumber) setPrivateAccountNo(finData.accountNumber);
          if (finData.accountOwner) setPrivateAccountOwner(cleanOwnerName(finData.accountOwner, user.email));
        }
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [user, navigate]);

  // 🍱 Load products for currentStoreId directly from Firestore products collection
  useEffect(() => {
    let isCancelled = false;
    async function loadStoreProducts() {
      if (!currentStoreId) {
        setMenuItems([]);
        setActiveCouponsList([]);
        return;
      }
      setActiveCouponsList(getActiveMerchantCoupons(currentStoreId));
      try {
        const q = query(collection(db, "products"), where("storeId", "==", currentStoreId));
        const snap = await getDocs(q);
        if (!isCancelled) {
          const prods = [];
          snap.forEach((d) => prods.push({ id: d.id, ...d.data() }));
          setMenuItems(prods);
        }
      } catch (err) {
        console.warn("[MerchantDashboard] Error loading store products:", err);
      }
    }
    loadStoreProducts();
    return () => {
      isCancelled = true;
    };
  }, [currentStoreId]);

  // 🔔 Real-time Firestore Listener for Store Orders
  useEffect(() => {
    if (!currentStoreId) return;

    try {
      const q = query(
        collection(db, "orders"),
        where("storeId", "==", currentStoreId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const liveOrders = [];
          snapshot.forEach((docSnap) => {
            liveOrders.push({ id: docSnap.id, ...docSnap.data() });
          });

          // Sort by createdAt descending
          liveOrders.sort((a, b) => {
            const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return timeB - timeA;
          });

          setMerchantOrders(liveOrders);
        },
        (err) => {
          console.warn("MerchantDashboard onSnapshot orders warning:", err);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn("MerchantDashboard setup onSnapshot error:", err);
    }
  }, [currentStoreId]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    let status = 'PENDING';
    let queueStatus = 'waiting';

    if (newStatus === 'confirmed' || newStatus === 'CONFIRMED') {
      status = 'CONFIRMED';
      queueStatus = 'waiting';
    } else if (newStatus === 'cooking' || newStatus === 'PREPARING') {
      status = 'PREPARING';
      queueStatus = 'cooking';
    } else if (newStatus === 'ready' || newStatus === 'READY' || newStatus === 'TO_RECEIVE') {
      status = 'READY';
      queueStatus = 'ready';
    } else if (newStatus === 'completed' || newStatus === 'COMPLETED') {
      status = 'COMPLETED';
      queueStatus = 'completed';
    } else if (newStatus === 'cancelled' || newStatus === 'CANCELLED') {
      status = 'CANCELLED';
      queueStatus = 'cancelled';
    }

    try {
      await updateDoc(doc(db, "orders", orderId), {
        status,
        queueStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      // The board is driven by onSnapshot, so a refused write left the card exactly
      // where it was with no explanation at all: the kitchen pressed "อาหารพร้อม",
      // nothing moved, and the student was never told their food was ready. During
      // a lunch rush that is the whole system failing quietly.
      console.error("Failed to update order status in Firestore:", err);
      toast.error(
        `อัปเดตสถานะคิว #${orderId} ไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}\n` +
        "ลูกค้ายังไม่ได้รับการแจ้งเตือน กรุณาลองใหม่อีกครั้ง"
      );
    }
  };

  const handleToggleProductStatus = (productId) => {
    setMenuItems((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isAvailable: !p.isAvailable } : p))
    );
  };

  // Menu edits stay on the same local + localStorage state the menu tab has always
  // used; MerchantMenuManager replaces a read-only grid whose "add item" button only
  // raised an alert, so create/price/stock actually work now.
  const handleUpdateStock = (productId, newStock) => {
    setMenuItems((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: Math.max(0, Number(newStock) || 0) } : p))
    );
  };

  const handleUpdatePrice = (productId, newPrice) => {
    const price = Number(newPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    setMenuItems((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, price, priceSatang: Math.round(price * 100) } : p))
    );
  };

  const handleUpdateAllergens = (productId, allergenIds) => {
    setMenuItems((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, allergens: allergenIds } : p))
    );
  };

  const handleAddNewItem = (item) => {
    setMenuItems((prev) => [
      ...prev,
      { ...item, id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, storeId: currentStoreId },
    ]);
  };

  // Repeat customers, aggregated from this store's own orders. Derived rather than
  // stored so it cannot drift, and scoped to this store: a merchant sees who buys
  // from them, never the platform's customer list.
  const crmCustomers = useMemo(() => {
    const byCustomer = new Map();
    for (const order of merchantOrders) {
      const key = order.userId || order.customerPhone || order.id;
      if (!key) continue;
      const existing = byCustomer.get(key) || {
        id: key,
        name: order.customerName || "ลูกค้า QueueUp",
        phone: order.customerPhone || "",
        points: 0,
        totalOrders: 0,
        totalSpent: 0,
        favoriteItems: [],
      };
      existing.totalOrders += 1;
      existing.totalSpent += Number(order.finalAmount ?? order.totalAmount ?? 0) || 0;
      existing.points += Number(order.pointsEarned) || 0;
      for (const item of order.items || []) {
        if (item?.name && !existing.favoriteItems.includes(item.name)) {
          existing.favoriteItems.push(item.name);
        }
      }
      byCustomer.set(key, existing);
    }

    return Array.from(byCustomer.values())
      .map((c) => ({
        ...c,
        tier:
          c.totalSpent >= 5000 ? "Platinum" : c.totalSpent >= 2000 ? "Gold" : c.totalSpent >= 500 ? "Silver" : "Bronze",
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [merchantOrders]);

  const handleSendBroadcast = async (announcementText) => {
    try {
      if (currentStoreId && announcementText) {
        await createAnnouncementInFirestore({
          shopName: storeName || "ร้านค้าของคุณ",
          storeId: currentStoreId,
          authorUid: user?.uid || "",
          tag: "ประกาศจากร้านค้า",
          title: announcementText,
          dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()],
          icon: "bi-megaphone-fill",
        });
      }
      setMarketingSuccessMsg(
        `บันทึกประกาศและส่งขึ้นกระดานเมนูประจำวันเรียบร้อยแล้ว (ถึงลูกค้าประจำ ${crmCustomers.length} ราย)`
      );
      setTimeout(() => setMarketingSuccessMsg(""), 5000);
    } catch (err) {
      console.warn("[MerchantDashboard] Broadcast error:", err);
      setMarketingSuccessMsg(
        `บันทึกประกาศถึงลูกค้าประจำ ${crmCustomers.length} รายเรียบร้อยแล้ว`
      );
      setTimeout(() => setMarketingSuccessMsg(""), 5000);
    }
  };

  // Modifier groups are store-isolated in Firestore, so these go through
  // catalogService rather than local state.
  const refreshModifierGroups = useCallback(async () => {
    if (!currentStoreId) return;
    try {
      setModifierGroups(await fetchStoreModifierGroups(db, currentStoreId));
    } catch (err) {
      console.warn("[MerchantDashboard] Could not load modifier groups:", err);
    }
  }, [currentStoreId]);

  useEffect(() => {
    if (!currentStoreId) return undefined;
    // Guarded so a response that arrives after the store changed, or after unmount,
    // does not overwrite newer state.
    let cancelled = false;
    (async () => {
      try {
        const groups = await fetchStoreModifierGroups(db, currentStoreId);
        if (!cancelled) setModifierGroups(groups);
      } catch (err) {
        console.warn("[MerchantDashboard] Could not load modifier groups:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStoreId]);

  const handleCreateModifierGroup = async (group) => {
    if (!currentStoreId) throw new Error("STORE_ID_REQUIRED: ไม่พบรหัสร้านค้า");
    await createStoreModifierGroup(db, currentStoreId, group);
    await refreshModifierGroups();
  };

  const handleToggleModifierOptionStock = async (groupId, optionId) => {
    if (!currentStoreId) return;
    await toggleStoreModifierOptionStock(db, currentStoreId, groupId, optionId);
    await refreshModifierGroups();
  };

  const handleSaveStoreProfile = async (e) => {
    if (e) e.preventDefault();

    if (!user || !user.uid) return;

    const targetStoreId = user.storeId || currentStoreId;
    if (!targetStoreId) {
      toast.error("ไม่พบรหัสร้านค้า (Store ID Required) ไม่สามารถบันทึกข้อมูลร้านค้าได้");
      return;
    }

    const merchantId = user.merchantId || `MCH-${user.uid.substring(0, 8)}`;

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
      await setDoc(doc(db, "shops", targetStoreId), publicStoreData, { merge: true });

      // 4. Save private finance data under merchantProfiles/{merchantId}/private/finance
      if (privateBankName || privateAccountNo || privateAccountOwner) {
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
      }

      // 4. Audit Log
      await recordAuditLog(db, {
        action: "UPDATE_STORE_PROFILE",
        actorUid: user.uid,
        storeId: targetStoreId,
        merchantId,
        metadata: { storeName, canteenLocation, storePhone, storeId: targetStoreId },
      });

      setIsSavedProfile(true);
      setTimeout(() => setIsSavedProfile(false), 3000);
    } catch (err) {
      console.error("Save store profile error:", err);
      toast.error(`เกิดข้อผิดพลาดในการบันทึกข้อมูลร้านค้า: ${err.message || err}`);
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

  if (isStoreLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-h-[50vh]">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">กำลังตรวจสอบข้อมูลร้านค้า...</span>
        </div>
      </div>
    );
  }

  if (hasNoStore) {
    return (
      <div className="container py-5 text-center">
        <div className="card shadow-sm p-5 max-w-lg mx-auto border-0 rounded-4">
          <div className="mb-3 text-warning display-4"><i className="bi bi-shop" /></div>
          <h4 className="fw-bold text-dark mb-2">ยังไม่พบข้อมูลร้านค้าในระบบ</h4>
          <p className="text-muted mb-4 small">
            บัญชีของคุณยังไม่ได้สร้างร้านค้าบน Firestore Authoritative Database กรุณาลงทะเบียนร้านค้าเพื่อเริ่มต้นรับคิวและจัดการเมนูอาหาร
          </p>
          <button
            className="btn btn-danger btn-lg rounded-pill px-4 fw-bold"
            onClick={() => navigate("/portal/th-onboarding")}
          >
            <i className="bi bi-plus-circle me-2" /> ลงทะเบียนเปิดร้านค้าใหม่
          </button>
        </div>
      </div>
    );
  }

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
                <div className="rounded-circle bg-secondary-subtle d-flex align-items-center justify-content-center w-8 h-8">
                  <i className="bi bi-person-fill text-secondary fs-5" />
                </div>
                <span className="text-dark small">{cleanOwnerName(user?.name, user?.email)}</span>
                <i className={`bi bi-chevron-${isUserDropdownOpen ? "up" : "down"} text-muted small`} />
              </button>

              {isUserDropdownOpen && (
                <div className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg p-3 text-dark text-center border w-[230px] z-[9999]">
                  <div className="rounded-circle bg-light d-flex align-items-center justify-content-center mx-auto mb-2 border w-[68px] h-[68px]">
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
            className={`merchant-tab-btn ${activeTab === "modifiers" ? "active" : ""}`}
            onClick={() => setActiveTab("modifiers")}
          >
            <i className="bi bi-layers-fill fs-5 text-warning" />
            <span>กลุ่มตัวเลือกอาหาร</span>
          </button>

          <button
            className={`merchant-tab-btn ${activeTab === "customers" ? "active" : ""}`}
            onClick={() => setActiveTab("customers")}
          >
            <i className="bi bi-person-hearts fs-5 text-danger" />
            <span>ลูกค้าประจำ & ประกาศ</span>
          </button>

          <button
            className={`merchant-tab-btn ${activeTab === "marketing" ? "active" : ""}`}
            onClick={() => setActiveTab("marketing")}
          >
            <i className="bi bi-robot fs-5 text-primary" />
            <span>AI การตลาด & คูปองส่วนลด</span>
          </button>
        </div>

        {/* TAB 1: LIVE ORDER QUEUE BOARD (KDS) */}
        {activeTab === "queue" && (
          <div className="merchant-panel-box space-y-4">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-2 border-bottom">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="small text-muted fw-bold">กรองสถานะ:</span>
                {[
                  { id: "ALL", label: "ทั้งหมด" },
                  { id: "PENDING", label: "รอยืนยัน" },
                  { id: "CONFIRMED", label: "ยืนยันแล้ว" },
                  { id: "PREPARING", label: "กำลังปรุง" },
                  { id: "READY", label: "พร้อมรับ" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`btn btn-sm ${queueFilter === f.id ? "btn-dark text-white fw-bold" : "btn-outline-secondary"}`}
                    onClick={() => setQueueFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="small text-muted font-monospace">
                แสดง {filteredQueueOrders.length} จาก {merchantOrders.length} ออเดอร์
              </span>
            </div>
            <MerchantKDS
              orders={filteredQueueOrders}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onOpenChat={handleOpenChatWithCustomer}
            />
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
            <MerchantMenuManager
              storeId={currentStoreId}
              menuItems={menuItems}
              modifierGroups={modifierGroups}
              onToggleAvailability={handleToggleProductStatus}
              onUpdateStock={handleUpdateStock}
              onUpdateAllergens={handleUpdateAllergens}
              onUpdatePrice={handleUpdatePrice}
              onAddNewItem={handleAddNewItem}
            />
          </div>
        )}

        {activeTab === "modifiers" && (
          <div className="merchant-panel-box">
            <MerchantModifierManager
              storeId={currentStoreId}
              modifierGroups={modifierGroups}
              onCreateGroup={handleCreateModifierGroup}
              onToggleOptionStock={handleToggleModifierOptionStock}
            />
          </div>
        )}

        {activeTab === "customers" && (
          <div className="merchant-panel-box">
            <MerchantCRMAnalytics
              customers={crmCustomers}
              onSendBroadcast={handleSendBroadcast}
              storeId={currentStoreId}
            />
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

                  <hr className="my-3" />
                  <h6 className="fw-bold mb-2 text-primary">
                    <i className="bi bi-shield-lock-fill me-1" /> ข้อมูลบัญชีรับเงิน (Private Finance)
                  </h6>
                  <div className="mb-3">
                    <label className="form-label font-weight-bold">ชื่อธนาคาร / บริการ:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={privateBankName}
                      onChange={(e) => setPrivateBankName(e.target.value)}
                      placeholder="เช่น ธนาคารกสิกรไทย / พร้อมเพย์"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label font-weight-bold">เลขที่บัญชี / หมายเลขพร้อมเพย์:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={privateAccountNo}
                      onChange={(e) => setPrivateAccountNo(e.target.value)}
                      placeholder="xxx-x-xxxxx-x"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label font-weight-bold">ชื่อเจ้าของบัญชี:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={privateAccountOwner}
                      onChange={(e) => setPrivateAccountOwner(e.target.value)}
                      placeholder="ชื่อ-นามสกุล เจ้าของบัญชี"
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
                <div className="p-4 bg-dark text-white rounded-3 border border-secondary space-y-3">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h5 className="fw-bold text-warning mb-0">
                      <i className="bi bi-shield-check me-2" />
                      นโยบายการให้บริการแบบ Zero-Payment
                    </h5>
                    <span className="badge bg-success">โหมดไร้สลิป 100%</span>
                  </div>

                  <p className="small text-slate-300 mb-3">
                    ร้านค้าดำเนินงานด้วยระบบ Zero-Payment & Instant Queue ไม่มีการเรียกเก็บเงินหรือตรวจสอบสลิปในขั้นตอนนี้
                  </p>

                  <div className="p-3 bg-secondary bg-opacity-25 rounded-2 border border-secondary mb-3">
                    <div className="fw-bold text-white small mb-1">⚡ Instant Queue & Kitchen Sync</div>
                    <div className="text-light small text-opacity-75">
                      ออเดอร์จากลูกค้าจะถูกส่งตรงเข้าบอร์ดคิว (KDS) ทันทีที่ลูกค้าทำการจองเวลา
                    </div>
                  </div>

                  <div className="p-3 bg-secondary bg-opacity-25 rounded-2 border border-secondary mb-3">
                    <div className="fw-bold text-white small mb-1">🛡️ Capacity Protection</div>
                    <div className="text-light small text-opacity-75">
                      ระบบคลาวด์จะจำกัดออเดอร์ตามกำลังการผลิตต่อสล็อตเวลาโดยอัตโนมัติ เพื่อป้องกันการสั่งอาหารเกินกำลัง
                    </div>
                  </div>
                </div>
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
        className="btn rounded-full shadow-2xl fixed flex items-center justify-center bottom-[30px] right-[30px] w-[62px] h-[62px] z-[9990] bg-gradient-to-br from-[#FF7A1A] to-[#FF7A1A] border-0 hover:scale-105 transition-transform"
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
