import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { switchRole, clearUser } from "../store/authSlice.js";
import { db, doc, getDoc, setDoc } from "../firebase/config.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
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
  fetchStoreProducts,
  createStoreProduct,
  updateStoreProduct,
} from "../services/catalogService";
import {
  generateAIMarketingRecommendations,
  getActiveMerchantCoupons,
  deployAICoupon,
  setMerchantCouponActive,
} from "../services/aiMarketingService.js";
import { recordAuditLog } from "../services/storeIsolationEngine.js";
import Footer from "../components/Footer.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import { errorMessage } from "../utils/errorMessage";
import { cancelOrderWithRefund } from "../services/orderCancelService";
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

  // Read Store Profile & storeId from LocalStorage & User Auth Context (Zero Fake Fallback)
  const getInitialStoreData = () => {
    try {
      const userKey = user && user.uid ? `queueup_merchant_store_${user.uid}` : null;
      const stored = (userKey && localStorage.getItem(userKey)) || localStorage.getItem("queueup_merchant_store");
      if (stored) {
        const m = JSON.parse(stored);
        const storeId = m.storeId || user?.storeId || (user && user.uid ? `store_${user.uid.substring(0, 10)}` : "");
        return {
          storeId,
          name: cleanDisplayName(m.merchantStoreName || m.storeName || user?.merchantStoreName, user?.email),
          phone: m.phone || m.businessPhone || user?.phone || "",
          location: m.canteenLocation ? (m.counterNo ? `${m.canteenLocation} (${m.counterNo})` : m.canteenLocation) : user?.canteenLocation || "",
        };
      }
    } catch {
      // ignore
    }
    const storeId = user?.storeId || "";
    return {
      storeId,
      name: cleanDisplayName(user?.merchantStoreName || user?.storeName, user?.email),
      phone: user?.phone || user?.businessPhone || "",
      location: user?.canteenLocation || "",
    };
  };

  const initialStore = getInitialStoreData();
  const [currentStoreId] = useState(initialStore.storeId);

  const [merchantOrders, setMerchantOrders] = useState([]);
  const [modifierGroups, setModifierGroups] = useState([]);

  // The menu, from the products collection.
  //
  // It was seeded from localStorage or, failing that, from SHARED_PRODUCTS —
  // so a merchant managed a menu of dishes they do not sell, and every edit
  // below only called setMenuItems. Marking something out of stock changed the
  // screen and nothing else; students kept ordering it. A price edit never
  // reached a single customer.
  const [menuItems, setMenuItems] = useState([]);
  const [menuStatus, setMenuStatus] = useState('loading');

  const loadMenu = useCallback(async () => {
    if (!currentStoreId) {
      setMenuStatus('ready');
      return;
    }
    try {
      setMenuItems(await fetchStoreProducts(db, currentStoreId));
      setMenuStatus('ready');
    } catch (err) {
      console.error('[MerchantDashboard] could not load the menu:', err);
      setMenuStatus('error');
    }
  }, [currentStoreId]);

  useEffect(() => {
    if (!currentStoreId) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const rows = await fetchStoreProducts(db, currentStoreId);
        if (!cancelled) {
          setMenuItems(rows);
          setMenuStatus('ready');
        }
      } catch (err) {
        console.error('[MerchantDashboard] could not load the menu:', err);
        if (!cancelled) setMenuStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentStoreId]);

  const [maxOrdersPerSlot, setMaxOrdersPerSlot] = useState(20);
  const [storeName, setStoreName] = useState(initialStore.name);
  const [storePhone, setStorePhone] = useState(initialStore.phone);
  const [canteenLocation, setCanteenLocation] = useState(initialStore.location);
  const [storeHours, setStoreHours] = useState("07:00 - 15:00 น.");
  const [isSavedProfile, setIsSavedProfile] = useState(false);
  const [privateBankName, setPrivateBankName] = useState("");
  const [privateAccountNo, setPrivateAccountNo] = useState("");
  const [privateAccountOwner, setPrivateAccountOwner] = useState("");

  /**
   * The people who can work this stall, from shops/{storeId}/staff.
   *
   * This was two invented colleagues — นางสาวมยุรี ใจดี and นายประสิทธิ์
   * ขยันทำงาน, with phone numbers — shown to every merchant as their own staff,
   * and add and remove both only touched React state. A merchant revoked
   * someone's access, watched the row disappear, and reloaded to find them back.
   *
   * Same collection the admin console reads and writes, so the two agree.
   */
  const [staffList, setStaffList] = useState([]);
  const [staffStatus, setStaffStatus] = useState('loading');

  useEffect(() => {
    if (!currentStoreId) return undefined;
    let cancelled = false;
    async function loadStaff() {
      try {
        const snap = await getDocs(collection(db, 'shops', currentStoreId, 'staff'));
        if (cancelled) return;
        setStaffList(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setStaffStatus('ready');
      } catch (err) {
        console.error('[MerchantDashboard] could not load staff:', err);
        if (!cancelled) setStaffStatus('error');
      }
    }
    loadStaff();
    return () => {
      cancelled = true;
    };
  }, [currentStoreId]);

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");
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
  const [marketingSuccessMsg, setMarketingSuccessMsg] = useState("");
  const [deployingCode, setDeployingCode] = useState(null);

  const refreshStoreCoupons = useCallback(async () => {
    if (!currentStoreId) return;
    try {
      setActiveCouponsList(await getActiveMerchantCoupons(currentStoreId));
    } catch (err) {
      console.warn("[MerchantDashboard] could not load store coupons:", err);
    }
  }, [currentStoreId]);

  useEffect(() => {
    if (!currentStoreId) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const rows = await getActiveMerchantCoupons(currentStoreId);
        if (!cancelled) setActiveCouponsList(rows);
      } catch (err) {
        console.warn("[MerchantDashboard] could not load store coupons:", err);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentStoreId]);

  /**
   * Publish a coupon customers can actually use.
   *
   * This wrote to localStorage and then said "ลูกค้าสามารถใช้ส่วนลดได้ทันที".
   * The order transaction prices coupons from Firestore, so nobody could —
   * the promotion existed on this laptop and nowhere else.
   */
  const handleDeployCoupon = async (coupon) => {
    setDeployingCode(coupon.code);
    try {
      const res = await deployAICoupon(
        {
          code: coupon.code,
          title: coupon.title,
          description: coupon.description,
          type: coupon.discountType === "PERCENT" ? "PERCENT" : "FIXED",
          percent: coupon.discountType === "PERCENT" ? coupon.discountValue : undefined,
          // Satang, because that is what the order transaction subtracts.
          amountSatang:
            coupon.discountType === "PERCENT" ? undefined : Math.round(coupon.discountValue * 100),
          maxDiscountSatang:
            coupon.discountType === "PERCENT" ? Math.round(coupon.discountValue * 100) * 5 : undefined,
          minSpendSatang: Math.round((Number(coupon.minSpend) || 0) * 100),
        },
        currentStoreId
      );
      await refreshStoreCoupons();
      setMarketingSuccessMsg(res.message);
      setTimeout(() => setMarketingSuccessMsg(""), 6000);
    } catch (err) {
      // A refused deploy must not read as a live promotion.
      toast.error(`เปิดใช้งานคูปองไม่สำเร็จ: ${errorMessage(err)}`);
    } finally {
      setDeployingCode(null);
    }
  };

  const handleToggleCoupon = async (code) => {
    const current = activeCouponsList.find((c) => c.code === code);
    try {
      await setMerchantCouponActive(code, currentStoreId, !(current?.active ?? true));
      await refreshStoreCoupons();
    } catch (err) {
      toast.error(`แก้ไขสถานะคูปองไม่สำเร็จ: ${errorMessage(err)}`);
    }
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
          // The booking calendar's "full" threshold. Read rather than assumed,
          // so a stall that takes 40 orders a slot is not painted red at 20.
          if (Number(sData.maxOrdersPerSlot) > 0) setMaxOrdersPerSlot(Number(sData.maxOrdersPerSlot));
        }
      });
    }
  }, [user, navigate]);

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

    // Cancelling is not a status change, it is a refund.
    //
    // This used to write `status: 'CANCELLED'` straight to the order. The
    // wallet had been debited when the order was created and nothing credited
    // it back — a browser cannot, `wallets` is closed to clients — so a stall
    // that ran out of an ingredient cancelled the order and the student had
    // paid for nothing.
    if (status === 'CANCELLED') {
      const order = merchantOrders.find((o) => o.id === orderId);
      const paidFromWallet = order?.paymentMode === 'CAMPUS_WALLET';
      const ok = await toast.confirm({
        title: `ยกเลิกออเดอร์ ${order?.queueNumber || ''}`.trim(),
        message: paidFromWallet
          ? `ระบบจะคืนเงิน ฿${((Number(order?.finalAmountSatang) || 0) / 100).toFixed(2)} เข้ากระเป๋าของนักเรียนทันที`
          : 'ออเดอร์นี้ชำระที่หน้าร้าน จึงไม่มียอดคืนในระบบ',
        confirmLabel: 'ยกเลิกและคืนเงิน',
        tone: 'error',
      });
      if (!ok) return;

      try {
        const res = await cancelOrderWithRefund(orderId);
        toast.success(res.message, { duration: 12000 });
      } catch (err) {
        console.error('Failed to cancel and refund order:', err);
        toast.error(`ยกเลิกออเดอร์ไม่สำเร็จ: ${errorMessage(err)}`);
      }
      return;
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

  /**
   * Every menu edit, through the catalogue service.
   *
   * These each called `setMenuItems` and stopped. The row on screen changed and
   * Firestore did not, so a dish marked out of stock stayed on sale, a price
   * change never reached a customer, and a declared allergen never reached the
   * allergen guard — the one that exists to stop a child being served something
   * they react to.
   *
   * The local state is updated after the write succeeds, not before: a failure
   * must leave the screen showing what the database actually holds.
   */
  const applyMenuEdit = async (productId, updates, optimistic) => {
    const target = menuItems.find((p) => p.id === productId);
    if (!target) return;
    try {
      await updateStoreProduct(db, target.storeId || currentStoreId, productId, updates);
      setMenuItems((prev) => prev.map((p) => (p.id === productId ? { ...p, ...optimistic } : p)));
    } catch (err) {
      console.error('[MerchantDashboard] menu update failed:', err);
      toast.error(`บันทึกการแก้ไขเมนูไม่สำเร็จ: ${errorMessage(err)}`);
      await loadMenu();
    }
  };

  const handleToggleProductStatus = (productId) => {
    const target = menuItems.find((p) => p.id === productId);
    if (!target) return;
    const next = !target.isAvailable;
    void applyMenuEdit(productId, { isAvailable: next }, { isAvailable: next });
  };

  const handleUpdateStock = (productId, newStock) => {
    const stock = Math.max(0, Number(newStock) || 0);
    void applyMenuEdit(productId, { stock }, { stock });
  };

  const handleUpdatePrice = (productId, newPrice) => {
    const price = Number(newPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    // updateStoreProduct derives priceSatang from this one number, so the two
    // money fields cannot drift apart.
    void applyMenuEdit(productId, { price }, { price, priceSatang: Math.round(price * 100) });
  };

  const handleUpdateAllergens = (productId, allergenIds) => {
    void applyMenuEdit(productId, { allergens: allergenIds }, { allergens: allergenIds });
  };

  const handleAddNewItem = async (item) => {
    if (!currentStoreId) {
      toast.error('ไม่พบรหัสร้านค้า — ยังเพิ่มเมนูไม่ได้');
      return;
    }
    try {
      const created = await createStoreProduct(db, currentStoreId, item);
      setMenuItems((prev) => [...prev, created]);
      toast.success(`เพิ่มเมนู ${created.name} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('[MerchantDashboard] add item failed:', err);
      toast.error(`เพิ่มเมนูไม่สำเร็จ: ${errorMessage(err)}`);
    }
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

  const handleSendBroadcast = (announcementText) => {
    // No broadcast transport exists yet — recorded locally and surfaced in the tab so
    // the action is honest about what it did rather than silently doing nothing.
    console.info("[MerchantDashboard] Broadcast queued:", announcementText);
    setMarketingSuccessMsg(
      `บันทึกประกาศถึงลูกค้าประจำ ${crmCustomers.length} รายเรียบร้อยแล้ว (ยังไม่ได้เชื่อมระบบส่งข้อความจริง)`
    );
    setTimeout(() => setMarketingSuccessMsg(""), 5000);
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

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    if (!currentStoreId) {
      toast.error("ไม่พบรหัสร้านค้า — ยังเพิ่มพนักงานไม่ได้");
      return;
    }

    // Firestore's own id. `STF0${staffList.length + 1}` repeats the moment
    // anyone is removed, and a merge write on a repeated id overwrites one
    // person's access record with another's.
    const ref = doc(collection(db, "shops", currentStoreId, "staff"));
    const newStaff = {
      id: ref.id,
      name: newStaffName.trim(),
      role: newStaffRole,
      phone: newStaffPhone.trim() || "",
      status: "Active",
    };

    try {
      await setDoc(ref, newStaff, { merge: true });
      setStaffList((prev) => [...prev, newStaff]);
      setNewStaffName("");
      setNewStaffPhone("");
      setIsAddStaffOpen(false);
      toast.success(`เพิ่มพนักงาน ${newStaff.name} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error("[MerchantDashboard] add staff failed:", err);
      toast.error(`เพิ่มพนักงานไม่สำเร็จ: ${errorMessage(err)}`);
    }
  };

  const handleRemoveStaff = async (member) => {
    if (!currentStoreId) return;
    const ok = await toast.confirm({
      title: `ลบสิทธิ์ของ ${member.name}`,
      message: "พนักงานคนนี้จะไม่สามารถเข้าถึงระบบหลังร้านได้อีก",
      confirmLabel: "ลบสิทธิ์",
      tone: "error",
    });
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "shops", currentStoreId, "staff", member.id));
      setStaffList((prev) => prev.filter((s2) => s2.id !== member.id));
      toast.success(`ลบสิทธิ์ของ ${member.name} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error("[MerchantDashboard] remove staff failed:", err);
      toast.error(`ลบสิทธิ์ไม่สำเร็จ: ${errorMessage(err)}`);
    }
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
            <BookingCalendar
              viewMode="merchant"
              storeId={currentStoreId}
              orders={merchantOrders}
              maxOrdersPerSlot={maxOrdersPerSlot}
            />
          </div>
        )}

        {/* TAB 3: MENU MANAGEMENT */}
        {activeTab === "menu" && (
          <div className="merchant-panel-box">
            {/* Loading and failed are not the same as an empty menu. A merchant
                seeing no dishes needs to know whether the read failed, which the
                mock seed made impossible — there was always something there. */}
            {menuStatus === "loading" && (
              <p className="text-muted small mb-3" role="status">
                กำลังโหลดเมนูของร้าน…
              </p>
            )}
            {menuStatus === "error" && (
              <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
                <span className="small mb-0">
                  โหลดเมนูของร้านไม่สำเร็จ — การแก้ไขในหน้านี้จะยังไม่ถูกบันทึก
                </span>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => void loadMenu()}>
                  ลองใหม่
                </button>
              </div>
            )}
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
                  <div className="col-md-8">
                    {/* The phone number used to be hardcoded as "089-XXX-XXXX"
                        on every staff record. Asked for, or left empty. */}
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="เบอร์โทรศัพท์ (ไม่บังคับ)"
                      value={newStaffPhone}
                      onChange={(e) => setNewStaffPhone(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
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
                  {/* Loading, empty and failed told apart. With two invented
                      colleagues always present, none of these states existed. */}
                  {staffStatus === "loading" && (
                    <tr>
                      <td colSpan={5} className="text-muted small py-3">กำลังโหลดรายชื่อพนักงาน…</td>
                    </tr>
                  )}
                  {staffStatus === "error" && (
                    <tr>
                      <td colSpan={5} className="text-danger small py-3">
                        โหลดรายชื่อพนักงานไม่สำเร็จ — รายชื่อด้านล่างอาจไม่ครบถ้วน
                      </td>
                    </tr>
                  )}
                  {staffStatus === "ready" && staffList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted small py-3">
                        ยังไม่มีพนักงานในร้านนี้ กดปุ่มด้านบนเพื่อเพิ่ม
                      </td>
                    </tr>
                  )}
                  {staffList.map((stf) => (
                    <tr key={stf.id}>
                      <td className="fw-bold">{stf.id}</td>
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
                          onClick={() => void handleRemoveStaff(stf)}
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
                <i className="bi bi-ticket-percent text-primary me-2" />
                คูปองส่วนลดของร้าน
              </h3>
              {/* A "Security Health: {healthScore}/100" badge stood here. The
                  function it read never returns healthScore, so it rendered
                  "undefined/100" — and the numbers it does return are counted
                  from the visitor's own localStorage, which is not a measure of
                  anything. The protections are the Firestore rules and the
                  Cloud Functions. */}
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
                          disabled={deployingCode === c.code}
                          onClick={() => void handleDeployCoupon(c)}
                        >
                          {deployingCode === c.code ? "กำลังเปิดใช้งาน…" : "เปิดใช้งานคูปองนี้"}
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
                    {activeCouponsList.length === 0 && (
                      <div className="small text-slate-300">
                        ยังไม่มีคูปองของร้านนี้ กดเปิดใช้งานจากข้อเสนอแนะทางซ้าย
                      </div>
                    )}
                    {/* `active`, not `isActive`: the order transaction reads
                        `coupon.active`, and the old local copy used a different
                        field name — so a coupon shown as live here would have
                        been refused at the counter had it ever reached one. */}
                    {activeCouponsList.map((cp) => (
                      <div key={cp.code} className="p-2 bg-secondary rounded d-flex justify-content-between align-items-center">
                        <div>
                          <strong className="text-warning">{cp.code}</strong> - {cp.title}
                          <div className="small text-slate-300">
                            {cp.active ? "กำลังทำงานอยู่" : "ปิดใช้งานอยู่"}
                          </div>
                        </div>
                        <button
                          className={`btn btn-sm ${cp.active ? "btn-outline-danger" : "btn-success"}`}
                          onClick={() => void handleToggleCoupon(cp.code)}
                        >
                          {cp.active ? "ปิด" : "เปิด"}
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
