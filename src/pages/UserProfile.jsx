import { useState, useEffect, useMemo, useCallback } from "react";
import { pressableProps } from "../utils/pressable.js";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setUser, clearUser } from "../store/authSlice.js";
import { db, doc, setDoc, getDoc } from "../firebase/config.js";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import ChatModal from "../components/ChatModal.jsx";
import ClientQueueTicket from "../components/ClientQueueTicket.jsx";
import { ClientLoyaltyDrawer } from "../components/ClientLoyaltyDrawer.jsx";
import Footer from "../components/Footer.jsx";
import { getUserBehaviorInsights } from "../services/aiBehaviorEngine.js";
import { calculateUserTrustScore } from "../services/aiUserVerificationEngine.js";
import { useToast } from "../components/ToastProvider.jsx";
import {
  deleteMyAccount,
  reauthenticateForDeletion,
  accountUsesPassword,
} from "../services/accountService";
import { errorMessage } from "../utils/errorMessage";
import { cancelOrderWithRefund } from "../services/orderCancelService";
import { CUSTOMER_CANCELLABLE_STATUSES as CUSTOMER_CANCELLABLE } from "../../functions/refundRules.js";
import { fetchLoyaltyBalance, redeemLoyaltyReward } from "../services/loyaltyService";
import { deriveAccountCode } from "../utils/accountCode.ts";
import { useDialog } from "../hooks/useDialog.js";
import "./UserProfile.css";
import "./UserPurchase.css";

function UserProfile() {
  const toast = useToast();
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
  
  // The account code is derived from the uid, not stored and not editable.
  // It used to be read from localStorage, which made it a different string on
  // every device — and on the email-login path a different string on every
  // login, because it was regenerated whenever the profile lacked the field.
  const accountId = deriveAccountCode(user?.uid);
  const [avatar, setAvatar] = useState(() => user?.photo || user?.photoURL || "/yeti_mascot.jpg");

  // Inline Editing Flags
  const [editingField, setEditingField] = useState(null); // 'name' | 'lastname' | 'gender' | 'birthdate' | 'email' | 'phone'
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [couponTab, setCouponTab] = useState("usable"); // 'usable' | 'expired'
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatStoreName, setChatStoreName] = useState("");
  // The shop the conversation is with. ChatModal needs an id, not just a
  // name: the chat document is keyed on it, and the security rules read it
  // to let the shop see its own customers' messages.
  const [chatStoreId, setChatStoreId] = useState("");
  const [chatOrderContext, setChatOrderContext] = useState(null);

  // 🔔 Real-time Booking & Purchase History State (Connected to Firestore /orders)
  const [orders, setOrders] = useState([]);
  const [isLoyaltyOpen, setIsLoyaltyOpen] = useState(false);

  // 🏆 Loyalty points, from the server.
  //
  // This was `useState(1250)` — 1,250 points every account opened with and had
  // never earned, displayed beside a membership tier computed from them. The
  // balance is earned (from COMPLETED orders, whose pointsEarned the order
  // transaction writes) minus redeemed, both from documents no browser can
  // write.
  const [loyalty, setLoyalty] = useState(null);
  const [isLoyaltyLoading, setIsLoyaltyLoading] = useState(false);
  const [redeemingRewardId, setRedeemingRewardId] = useState(null);

  const userPoints = loyalty?.balance ?? 0;

  const loyaltyProfile = useMemo(
    () => ({
      points: userPoints,
      ordersCount: orders.filter((o) => o.status === "COMPLETED").length,
    }),
    [userPoints, orders]
  );

  const refreshLoyalty = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoyaltyLoading(true);
    try {
      setLoyalty(await fetchLoyaltyBalance());
    } catch (err) {
      // Zero rather than an invented number. A balance the screen made up is
      // how this got here in the first place.
      console.warn("[UserProfile] could not load loyalty balance:", err);
      setLoyalty(null);
    } finally {
      setIsLoyaltyLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    async function loadLoyalty() {
      try {
        const data = await fetchLoyaltyBalance();
        if (!cancelled) setLoyalty(data);
      } catch (err) {
        console.warn("[UserProfile] could not load loyalty balance:", err);
      }
    }
    loadLoyalty();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleRedeemReward = async (reward) => {
    setRedeemingRewardId(reward.id);
    try {
      // The server checks the balance and writes the redemption and the coupon
      // in one transaction. What was here subtracted from React state and told
      // the student to take a coupon to the counter that was never created.
      const result = await redeemLoyaltyReward(reward.id);
      await refreshLoyalty();
      toast.success(result.message, { duration: 15000 });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRedeemingRewardId(null);
    }
  };
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  /**
   * Cancel an order and get the money back.
   *
   * Through the server, because a wallet-paid order's refund is a wallet write
   * and `wallets` is closed to browsers — which is why cancelling used to take
   * the food away and keep the money.
   */
  const handleCancelOrder = async (order) => {
    const paidFromWallet = order.paymentMode === "CAMPUS_WALLET";
    const ok = await toast.confirm({
      title: `ยกเลิกคำสั่งซื้อ ${order.queueNumber || ""}`.trim(),
      message: paidFromWallet
        ? "ระบบจะยกเลิกคำสั่งซื้อและคืนเงินเข้ากระเป๋านักเรียนทันที"
        : "คำสั่งซื้อนี้ชำระที่หน้าร้าน จึงไม่มียอดคืนในระบบ",
      confirmLabel: "ยกเลิกคำสั่งซื้อ",
      tone: "error",
    });
    if (!ok) return;

    setCancellingOrderId(order.id);
    try {
      const res = await cancelOrderWithRefund(order.id);
      toast.success(res.message, { duration: 12000 });
    } catch (err) {
      // The kitchen may have started between the page loading and the tap. That
      // refusal has to show: reported as success, someone walks off believing
      // lunch is cancelled while a stall is still cooking it.
      toast.error(errorMessage(err), { duration: 12000 });
    } finally {
      setCancellingOrderId(null);
    }
  };

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

  // Delete Account Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFinalConfirmModalOpen, setIsFinalConfirmModalOpen] = useState(false);

  // The two deletion dialogs. Neither had a role, a label, Escape, or a focus
  // trap — so Tab walked straight out of the back of the dialog and into the
  // profile page behind it, which is the very account being deleted, still
  // focusable and now invisible under a dim layer.
  //
  // Neither closes on a backdrop click: a stray tap beside a confirmation is
  // not an answer to it, in either direction.
  const {
    dialogRef: deleteDialogRef,
    dialogProps: deleteDialogProps,
    backdropProps: deleteBackdropProps,
  } = useDialog({
    isOpen: isDeleteModalOpen,
    onClose: () => setIsDeleteModalOpen(false),
    labelledBy: "delete-account-title",
    closeOnBackdrop: false,
  });
  const {
    dialogRef: finalConfirmDialogRef,
    dialogProps: finalConfirmDialogProps,
    backdropProps: finalConfirmBackdropProps,
  } = useDialog({
    isOpen: isFinalConfirmModalOpen,
    onClose: () => setIsFinalConfirmModalOpen(false),
    labelledBy: "delete-confirm-title",
    closeOnBackdrop: false,
    // The last step before the account goes. An alertdialog is announced with
    // more insistence than a dialog, which is the right amount here.
    role: "alertdialog",
  });
  const [deletePassword, setDeletePassword] = useState("");
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // 🛡️ AI Security Shield & 🧠 AI Behavior Learning States
  const [aiBehaviorProfile] = useState(() => getUserBehaviorInsights());


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
        color: "#E6680D",
        bg: "rgba(230, 104, 13, 0.15)",
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
      toast.warning("กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.warning("ขนาดไฟล์รูปภาพใหญ่เกินไป (สูงสุด 5MB)");
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

    const payload = {
      updatedAt: new Date().toISOString(),
    };

    if (fieldKey === "fullName") {
      setFullName(value);
      payload.fullName = value;
      payload.displayName = value;
      payload.name = value;
    } else if (fieldKey === "lastName") {
      setLastName(value);
      payload.lastName = value;
    } else if (fieldKey === "gender") {
      setGender(value);
      payload.gender = value;
    } else if (fieldKey === "birthDate") {
      setBirthDate(value);
      payload.birthDate = value;
    } else if (fieldKey === "phone") {
      setPhone(value);
      payload.phone = value;
    } else if (fieldKey === "avatar") {
      setAvatar(value);
      payload.photo = value;
      payload.photoURL = value;
      payload.avatar = value;
    }

    if (user && user.uid) {
      try {
        await setDoc(doc(db, "users", user.uid), payload, { merge: true });
      } catch (err) {
        console.warn("Firestore auto-save error:", err);
      }
    }

    dispatch(
      setUser({
        uid: user ? user.uid : `user-${Date.now()}`,
        name: fieldKey === "fullName" ? value : (fullName || user?.name || "ผู้ใช้งาน"),
        displayName: fieldKey === "fullName" ? value : (fullName || user?.displayName || "ผู้ใช้งาน"),
        email: user?.email || email,
        photo: fieldKey === "avatar" ? value : avatar,
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

  // Step 1: prove it is really them, right now.
  //
  // This form used to check that the three boxes were non-empty and then throw
  // the values away — a password field guarding the one irreversible action in
  // the app, authenticating nothing. Anyone at an unlocked screen could type
  // four characters and erase the account. Firebase calls this reauthentication
  // and wants it for exactly this; deleting through the Admin SDK skips the
  // check, so it has to happen here and has to actually happen.
  const handleStep1DeleteSubmit = async (e) => {
    e.preventDefault();
    const needsPassword = accountUsesPassword();
    if (needsPassword && !deletePassword.trim()) {
      toast.warning("กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตน");
      return;
    }

    setIsReauthenticating(true);
    try {
      await reauthenticateForDeletion(deletePassword);
      setDeletePassword("");
      setIsDeleteModalOpen(false);
      setIsFinalConfirmModalOpen(true);
    } catch (err) {
      // Stops here. A failed identity check that let the flow continue would
      // make the whole step decorative.
      toast.error(`ยืนยันตัวตนไม่สำเร็จ: ${errorMessage(err)}`);
    } finally {
      setIsReauthenticating(false);
    }
  };

  // Step 2: the deletion itself, on the server.
  //
  // The browser cannot delete a Firebase Auth account, cannot reach the
  // collections holding this person's records, and does not get to decide which
  // of its own records to keep. What was here deleted `users/{uid}`, swallowed
  // any failure with console.warn, and reported success either way — while the
  // Auth account, the wallet, the orders, the guardian links and the child's
  // allergy record all stayed exactly where they were.
  const handleFinalDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const result = await deleteMyAccount();
      setIsFinalConfirmModalOpen(false);
      dispatch(clearUser());
      toast.success(result.message, { duration: 15000 });
      navigate("/login", { replace: true });
    } catch (err) {
      // The server refuses while there is money in the wallet, an order a stall
      // is still cooking, or this is the last admin account. That message is the
      // whole point of the call and must reach the person — reported as success
      // it would have them walk away believing their data was gone.
      toast.error(errorMessage(err), { duration: 15000 });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Copy Account ID to Clipboard
  const handleCopyAccountId = () => {
    navigator.clipboard.writeText(accountId);
    toast.success(`คัดลอกรหัสบัญชี "${accountId}" สำเร็จ`);
  };

  // Check Profile Completeness
  const isProfileIncomplete = !gender || !birthDate || !phone;

  return (
    <div className="shopee-profile-page">
      {/* Shopee Style Header Search Bar */}
      <ShopeeSearchBar />

      {/* Loyalty points drawer */}
      <ClientLoyaltyDrawer
        isOpen={isLoyaltyOpen}
        onClose={() => setIsLoyaltyOpen(false)}
        profile={loyaltyProfile}
        rewards={loyalty?.rewards || []}
        issued={loyalty?.issued || []}
        isLoading={isLoyaltyLoading}
        redeemingId={redeemingRewardId}
        onRedeemReward={handleRedeemReward}
      />

      <div className="shopee-profile-container">
        {/* The page's own heading. It had none, so the panel titles were the
            shallowest headings and every panel read as a top-level section of
            nothing. Hidden, because the avatar card beside it already says
            whose account this is. */}
        <h1 className="sr-only">บัญชีของฉัน</h1>

        {/* ==================== LEFT SIDEBAR MENU ==================== */}
        <aside className="shopee-user-sidebar">
          {/* Top User Card with Avatar Upload & Image Fallback */}
          <div className="shopee-sidebar-user-card">
            <div className="shopee-sidebar-avatar-wrapper">
              <div className="shopee-sidebar-avatar-circle">
                <img loading="lazy" decoding="async"
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
              {...pressableProps(() => handleTabChange("membership"))}
              title="คลิกเพื่อดูสิทธิพิเศษประจำระดับสมาชิก"
            >
              <i className={`bi ${membershipInfo.icon}`} />
              <span>{membershipInfo.name}</span>
            </div>
            <div className="small text-muted mt-1 text-[11px]">
              🪙 <b>{userPoints.toLocaleString()}</b> Points
            </div>
            <button
              type="button"
              onClick={() => setIsLoyaltyOpen(true)}
              className="mt-2 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-[11px] font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 w-full"
            >
              🎁 แลกของรางวัล CRM
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="shopee-sidebar-nav-list">
            <div
              className={`shopee-sidebar-nav-item ${activeTab === "bookings" ? "active" : ""}`}
              {...pressableProps(() => handleTabChange("bookings"), { pressed: activeTab === "bookings" })}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-list-task shopee-sidebar-nav-icon" />
                <span>การจอง</span>
              </div>
            </div>

            <div
              className={`shopee-sidebar-nav-item ${activeTab === "coupons" ? "active" : ""}`}
              {...pressableProps(() => handleTabChange("coupons"), { pressed: activeTab === "coupons" })}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-tag shopee-sidebar-nav-icon" />
                <span>คูปอง</span>
              </div>
            </div>

            <div
              className={`shopee-sidebar-nav-item ${activeTab === "membership" ? "active" : ""}`}
              {...pressableProps(() => handleTabChange("membership"), { pressed: activeTab === "membership" })}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-trophy shopee-sidebar-nav-icon" />
                <span>แต้มสะสม & สมาชิก</span>
              </div>
            </div>

            <div
              className={`shopee-sidebar-nav-item ${activeTab === "info" ? "active" : ""}`}
              {...pressableProps(() => handleTabChange("info"), { pressed: activeTab === "info" })}
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
              {...pressableProps(() => handleTabChange("settings"), { pressed: activeTab === "settings" })}
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

            {/* The student's own wallet. Every campus-wallet order debits it,
                and before this there was nowhere at all to look at it. */}
            <div
              className="shopee-sidebar-nav-item cursor-pointer"
              {...pressableProps(() => navigate("/wallet"))}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-wallet2 text-success shopee-sidebar-nav-icon" />
                <span>กระเป๋าเงินนักเรียนของฉัน</span>
              </div>
              <i className="bi bi-chevron-right small text-secondary ms-auto" />
            </div>

            <div
              className="shopee-sidebar-nav-item cursor-pointer"
              {...pressableProps(() => navigate("/guardian"))}
            >
              <div className="shopee-sidebar-nav-left">
                <i className="bi bi-shield-heart text-danger shopee-sidebar-nav-icon" />
                <span>แดชบอร์ดผู้ปกครอง</span>
              </div>
              <i className="bi bi-chevron-right small text-secondary ms-auto" />
            </div>

            <div
              className="shopee-sidebar-nav-item cursor-pointer"
              {...pressableProps(() => navigate("/student-vendor/apply"))}
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
                {...pressableProps(() => navigate("/student-vendor/earnings"))}
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
                  {...pressableProps(() => navigate("/admin/vendor-approvals"))}
                >
                  <div className="shopee-sidebar-nav-left">
                    <i className="bi bi-person-check text-info shopee-sidebar-nav-icon" />
                    <span>อนุมัติร้านค้า (ฝ่ายปกครอง)</span>
                  </div>
                  <i className="bi bi-chevron-right small text-secondary ms-auto" />
                </div>

                <div
                  className="shopee-sidebar-nav-item cursor-pointer"
                  {...pressableProps(() => navigate("/emergency"))}
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
              {...pressableProps(() => navigate("/campus/monitor"))}
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
                      // This used to end with "สิทธิ์การใช้งานของคุณ" and a list
                      // of approvals — none of which any rule or function read.
                      // What the score actually reflects is how much of this
                      // account has been verified, so that is what it now says.
                      toast.info(
                        `🛡️ รายงานคะแนนความน่าเชื่อถือ (Trust Score Breakdown):\n\n` +
                          (userTrustReport.breakdown.length > 0
                            ? userTrustReport.breakdown.map((b) => `• ${b.label}`).join("\n")
                            : "• ยังไม่มีรายการยืนยันตัวตน") +
                          `\n\nคะแนนนี้สะท้อนระดับการยืนยันตัวตนของบัญชี เช่น อีเมล เบอร์โทรศัพท์ และประวัติการสั่งซื้อจริง` +
                          `\nยืนยันข้อมูลเพิ่มเติมเพื่อเพิ่มคะแนนและระดับบัญชีของคุณ`,
                        { duration: 15000 }
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
                    <input autoComplete="given-name" aria-label="กรอกชื่อ"
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
                    <input autoComplete="family-name" aria-label="กรอกนามสกุล"
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
                    <select aria-label="เพศ"
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
                    <input aria-label="วันเกิด"
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
                    <input autoComplete="email" aria-label="อีเมล"
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
                    <input autoComplete="tel" aria-label="08X"
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

              {/* A "QueueUp AI Security Sentinel v2.5" card stood here,
                  reporting "🛡️ เกราะป้องกันสมบูรณ์ 100%", a count of threats
                  blocked, and "การเข้ารหัส PII: AES-256-GCM". Every number came
                  from this visitor's own localStorage — which an attacker owns
                  by definition — and nothing in the app encrypts anything with
                  AES. The protections that do exist are the Firestore rules and
                  the Cloud Functions, and neither is something a profile page
                  can measure. */}
              <div className="p-3 rounded-3 mb-3 text-dark border bg-slate-50 border-slate-200">
                <div className="fw-bold text-primary mb-2">
                  <i className="bi bi-shield-lock-fill me-2" />
                  ความปลอดภัยของข้อมูลคุณ
                </div>
                <ul className="small text-muted mb-0 ps-3">
                  <li>เข้าสู่ระบบผ่าน Firebase Authentication — แอปไม่เก็บรหัสผ่านของคุณ</li>
                  <li>สิทธิ์การอ่านข้อมูลบังคับด้วย Firestore Security Rules ฝั่งเซิร์ฟเวอร์</li>
                  <li>ยอดเงินในกระเป๋าเปลี่ยนได้เฉพาะใน Cloud Functions เท่านั้น</li>
                  <li>
                    คุณลบบัญชีและข้อมูลส่วนบุคคลได้เองที่ปุ่มด้านล่าง —{" "}
                    <span
                      className="text-primary text-decoration-underline cursor-pointer"
                      {...pressableProps(() => navigate("/pdpa"))}
                    >
                      อ่านรายละเอียดในนโยบาย PDPA
                    </span>
                  </li>
                </ul>
              </div>

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
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <h2 className="shopee-panel-title mb-0">คูปอง</h2>
                <button
                  type="button"
                  onClick={() => setIsLoyaltyOpen(true)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  🎁 แลกคูปองด้วยแต้ม CRM ({userPoints.toLocaleString()} แต้ม)
                </button>
              </div>

              {/* Promo Code Input Box */}
              <div className="shopee-coupon-promo-section">
                <div className="shopee-coupon-label">ใส่รหัสโปรโมชัน</div>
                <div className="shopee-coupon-input-wrapper">
                  <div className="shopee-coupon-input-box">
                    <i className="bi bi-tag shopee-coupon-input-icon" />
                    <input aria-label="ใส่รหัสส่วนลด"
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
                        toast.success(`รับคูปองส่วนลด "${promoCodeInput}" สำเร็จ`);
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
                  {...pressableProps(() => setCouponTab("usable"), { pressed: couponTab === "usable" })}
                >
                  ใช้ได้
                </div>
                <div
                  className={`shopee-coupon-tab-item ${couponTab === "expired" ? "active" : ""}`}
                  {...pressableProps(() => setCouponTab("expired"), { pressed: couponTab === "expired" })}
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
                    {/* A points total is data, not a heading. As the page's
                        only level-1 heading it made heading navigation
                        announce the whole profile as "🪙 0 แต้ม". */}
                    <div className="fw-bold display-6 mb-0 text-warning mt-1">
                      🪙 {userPoints.toLocaleString()} <span className="fs-5 text-slate-300">แต้ม</span>
                    </div>
                    <div className="small text-slate-300 mt-2">
                      <i className="bi bi-info-circle me-1" />
                      {membershipInfo.nextInfo}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-warning text-dark font-weight-bold px-4 py-2 rounded-pill shadow-sm cursor-pointer"
                    onClick={() => setIsLoyaltyOpen(true)}
                  >
                    <i className="bi bi-gift-fill me-1" /> 🎁 ดูของรางวัล & แลกแต้ม CRM ({userPoints.toLocaleString()} แต้ม)
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
              <h3 className="fs-5 fw-bold mb-3 text-slate-800">สิทธิพิเศษประจำระดับสมาชิก (Membership Tier Privileges)</h3>
              <div className="row g-3 mb-4">
                <div className="col-md-3 col-6">
                  <div className={`p-3 rounded-4 border text-center h-100 ${membershipInfo.name === "Bronze Member" ? "border-warning bg-amber-50" : "border-slate-200 bg-white"}`}>
                    <div className="fs-2 mb-1">🥉</div>
                    <h4 className="fs-6 fw-bold mb-1 text-amber-600">Bronze Member</h4>
                    <div className="small text-muted mb-2">0 - 499 แต้ม</div>
                    <span className="badge bg-warning text-dark rounded-pill small">ส่วนลด 5%</span>
                  </div>
                </div>

                <div className="col-md-3 col-6">
                  <div className={`p-3 rounded-4 border text-center h-100 ${membershipInfo.name === "Silver Member" ? "border-secondary bg-slate-100" : "border-slate-200 bg-white"}`}>
                    <div className="fs-2 mb-1">🥈</div>
                    <h4 className="fs-6 fw-bold mb-1 text-slate-500">Silver Member</h4>
                    <div className="small text-muted mb-2">500 - 1,499 แต้ม</div>
                    <span className="badge bg-secondary text-white rounded-pill small">ส่วนลด 10% + จองคิวด่วน</span>
                  </div>
                </div>

                <div className="col-md-3 col-6">
                  <div className={`p-3 rounded-4 border text-center h-100 ${membershipInfo.name === "Gold Member" ? "border-warning bg-warning-50" : "border-slate-200 bg-white"}`}>
                    <div className="fs-2 mb-1">🥇</div>
                    <h4 className="fs-6 fw-bold mb-1 text-yellow-500">Gold Member</h4>
                    <div className="small text-muted mb-2">1,500 - 3,499 แต้ม</div>
                    <span className="badge bg-warning text-dark rounded-pill small">ส่วนลด 15% + สปีดคิว</span>
                  </div>
                </div>

                <div className="col-md-3 col-6">
                  <div className={`p-3 rounded-4 border text-center h-100 ${membershipInfo.name === "Platinum Member" ? "border-purple bg-purple-50" : "border-slate-200 bg-white"}`}>
                    <div className="fs-2 mb-1">💎</div>
                    <h4 className="fs-6 fw-bold mb-1 text-purple-500">Platinum Member</h4>
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
                      setChatStoreId(ord.storeId || ord.shopId || "");
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
                    {...pressableProps(() => setOrderStatusTab(tab.id), { pressed: orderStatusTab === tab.id })}
                  >
                    {tab.label}
                  </div>
                ))}
              </div>

              {/* Order Search Box */}
              <div className="shopee-order-search-box mb-3">
                <i className="bi bi-search shopee-order-search-icon" />
                <input aria-label="ค้นหาคำสั่งซื้อ" autoComplete="off"
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
                            setChatStoreId(order.storeId || order.shopId || "");
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
                        <img loading="lazy" decoding="async"
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
                            onClick={() => toast.info("กรุณาแสดงหน้าจอนี้ให้เจ้าหน้าที่เคาน์เตอร์เพื่อรับอาหาร")}
                          >
                            รับอาหารที่เคาน์เตอร์
                          </button>
                        )}
                        {/* The PDPA page has promised "ยกเลิกได้ก่อนที่ร้านค้าจะกด
                            รับออเดอร์/เริ่มปรุงอาหาร" the whole time, and no screen
                            in the app had a cancel button at all. */}
                        {CUSTOMER_CANCELLABLE.includes(String(order.status || "").toUpperCase()) && (
                          <button
                            className="shopee-btn-action-secondary text-danger"
                            disabled={cancellingOrderId === order.id}
                            onClick={() => void handleCancelOrder(order)}
                          >
                            {cancellingOrderId === order.id ? "กำลังยกเลิก..." : "ยกเลิกคำสั่งซื้อ"}
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

              {/* รหัสบัญชี — a reference to read out to staff, not a secret.
                  It used to sit behind `••••••••••••••••` and an eye toggle,
                  with a copy button beside them that handed over the whole
                  value anyway. Nothing authenticates with it and nothing looks
                  anything up by it, so masking it only taught people it was
                  worth protecting. */}
              <div className="shopee-info-field-row">
                <div className="shopee-field-header-row">
                  <span className="shopee-field-title">รหัสบัญชี</span>
                </div>
                <div className="shopee-account-id-row">
                  <span className="shopee-field-value tracking-normal">
                    {accountId || "—"}
                  </span>
                  {accountId && (
                    <button
                      className="shopee-copy-icon-btn"
                      onClick={handleCopyAccountId}
                      title="คัดลอกรหัสบัญชี"
                      aria-label="คัดลอกรหัสบัญชี"
                    >
                      <i className="bi bi-files" />
                    </button>
                  )}
                </div>
                <div className="text-muted small mt-1">
                  ใช้แจ้งเจ้าหน้าที่โรงอาหารเวลามีปัญหากับคำสั่งซื้อ
                  รหัสนี้ผูกกับบัญชีของคุณถาวรและเปลี่ยนเองไม่ได้ — ไม่ใช่รหัสผ่าน
                  และไม่ต้องปิดเป็นความลับ
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
      {/* 🗑️ Step 1: Delete Account Form Modal */}
      {isDeleteModalOpen && (
        <div className="security-modal-overlay" {...deleteBackdropProps}>
          <div
            ref={deleteDialogRef}
            {...deleteDialogProps}
            className="security-modal-card"
          >
            <div className="security-modal-header">
              <h3 id="delete-account-title" className="security-modal-title text-danger">
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
              {/* The username and email boxes that used to be here were never
                  checked against anything. Firebase authenticates the account
                  that is already signed in, so asking someone to retype their
                  own name proved nothing and implied a check that never ran. */}
              <p className="text-muted fs-6 mb-3">
                ยืนยันว่าเป็นเจ้าของบัญชี{" "}
                <strong className="text-dark">{user?.email || user?.displayName}</strong> จริง
                ก่อนดำเนินการต่อ
              </p>

              {accountUsesPassword() ? (
                <div>
                  <label className="security-modal-label">รหัสผ่าน (Password) *</label>
                  <input aria-label="รหัสผ่าน (Password)"
                    type="password"
                    className="security-modal-input"
                    placeholder="กรอกรหัสผ่านของคุณ"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              ) : (
                <p className="text-muted fs-6 mb-0">
                  บัญชีนี้เข้าสู่ระบบด้วย Google — กด &ldquo;ยืนยันตัวตน&rdquo;
                  แล้วเลือกบัญชีของคุณอีกครั้งเพื่อยืนยัน
                </p>
              )}

              <div className="security-modal-actions">
                <button
                  type="button"
                  className="security-btn-cancel"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isReauthenticating}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="security-btn-confirm"
                  disabled={isReauthenticating}
                >
                  {isReauthenticating ? "กำลังยืนยันตัวตน..." : "ยืนยันตัวตน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚠️ Step 2: Final Warning Confirmation Modal */}
      {isFinalConfirmModalOpen && (
        <div className="security-modal-overlay" {...finalConfirmBackdropProps}>
          <div
            ref={finalConfirmDialogRef}
            {...finalConfirmDialogProps}
            className="security-modal-card text-center py-4"
          >
            <div className="mb-3">
              <i className="bi bi-exclamation-triangle-fill text-danger text-5xl" />
            </div>
            <h4 id="delete-confirm-title" className="fw-bold text-dark mb-2">ยืนยันการลบข้อมูลบัญชีถาวร</h4>
            {/* Spelled out rather than "ลบทุกอย่างถาวร". Some of this is kept,
                and a promise of total erasure that the system does not keep is
                worse than a shorter one it does. */}
            <div className="text-start mx-auto mb-4 px-2" style={{ maxWidth: "26rem" }}>
              <p className="text-muted fs-6 mb-2">
                <strong className="text-danger">ลบถาวร:</strong> บัญชีเข้าสู่ระบบ โปรไฟล์
                ข้อมูลการแพ้อาหารและสุขภาพ การผูกบัญชีผู้ปกครอง แชท รีวิว
                และประวัติการใช้คูปอง
              </p>
              <p className="text-muted fs-6 mb-2">
                <strong className="text-dark">เก็บไว้แบบไม่ระบุตัวตน:</strong> ประวัติคำสั่งซื้อ
                (ร้านค้าต้องใช้สรุปยอดขาย จึงลบชื่อและข้อมูลติดต่อออกแทนการลบทั้งรายการ)
              </p>
              <p className="text-muted fs-6 mb-0">
                <strong className="text-dark">เก็บไว้ตามกฎหมาย:</strong> บันทึกความปลอดภัย
                และบันทึกรายการเงินในระบบ
              </p>
            </div>

            <div className="d-flex justify-content-center gap-3">
              <button
                className="security-btn-cancel px-4 py-2"
                onClick={() => setIsFinalConfirmModalOpen(false)}
                disabled={isDeletingAccount}
              >
                ยกเลิก
              </button>
              <button
                className="security-btn-confirm px-4 py-2"
                onClick={handleFinalDeleteAccount}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? "กำลังลบบัญชี..." : "ลบบัญชีถาวร"}
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
        {/* No badge. This read "3" on every page for every visitor;
            nothing in the chat records what has been read, so there is no
            number to show. The button opens a chat — that is all it does. */}
      </button>

      {/* Real-Time Chat Modal Component */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        storeId={chatStoreId}
        storeName={chatStoreName}
        initialOrderContext={chatOrderContext}
      />

      {/* Global Reusable Premium Footer */}
      <Footer />
    </div>
  );
}

export default UserProfile;
