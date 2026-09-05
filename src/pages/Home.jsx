import { useState, useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  fetchFoodCategoriesFromFirestore,
  saveCategoryToFirestore,
  fetchShopsFromFirestore,
  fetchProductsFromFirestore,
} from "../lib/firebase.js";
import FoodCard from "../components/FoodCard.jsx";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import ChatModal from "../components/ChatModal.jsx";
import Footer from "../components/Footer.jsx";
import { usePreferences } from "../context/PreferencesContext.jsx";
import { SHARED_PRODUCTS } from "../data/mockProducts.js";
import { INITIAL_PRODUCTS } from "../firebase/config.js";
import { getUserBehaviorInsights, recordUserOrderBehavior } from "../services/aiBehaviorEngine.js";
import { getActiveMerchantCoupons } from "../services/aiMarketingService.js";
import "./Home.css";

const DEFAULT_CATEGORIES = [
  { id: "all", label: "ทั้งหมด", image: "/logo.png" },
  { id: "single_dish", label: "ไก่บักเก็ต", image: "/crispy_fried_chicken.jpg" },
  { id: "western", label: "เบอร์เกอร์", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=60" },
  { id: "streetfood", label: "ไก่ป็อบ/เทนเดอร์", image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=200&auto=format&fit=crop&q=60" },
  { id: "snack", label: "ของทานเล่น", image: "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=200&auto=format&fit=crop&q=60" },
  { id: "boba_tea", label: "ชานมไข่มุก", image: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=200&auto=format&fit=crop&q=60" },
  { id: "noodle", label: "ก๋วยเตี๋ยว", image: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=200&auto=format&fit=crop&q=60" },
  { id: "thai_spicy", label: "ต้มยำ/แกงเผ็ด", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&auto=format&fit=crop&q=60" },
  { id: "shabu_hotpot", label: "ชาบู/หม้อไฟ", image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=200&auto=format&fit=crop&q=60" },
  { id: "japanese", label: "อาหารญี่ปุ่น", image: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=200&auto=format&fit=crop&q=60" },
  { id: "korean", label: "อาหารเกาหลี", image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200&auto=format&fit=crop&q=60" },
  { id: "chinese", label: "อาหารจีน", image: "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=200&auto=format&fit=crop&q=60" },
  { id: "regional", label: "อาหารพื้นบ้าน", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=200&auto=format&fit=crop&q=60" },
  { id: "coffee", label: "กาแฟสด", image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=200&auto=format&fit=crop&q=60" },
  { id: "smoothie", label: "สมูทตี้", image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=200&auto=format&fit=crop&q=60" },
  { id: "dessert", label: "ของหวาน", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200&auto=format&fit=crop&q=60" },
  { id: "healthy", label: "อาหารคลีน", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&auto=format&fit=crop&q=60" },
  { id: "promo", label: "โปร 1 แถม 1", image: "/crispy_fried_chicken.jpg" },
  { id: "drink", label: "เครื่องดื่ม", image: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=200&auto=format&fit=crop&q=60" },
];

const DEFAULT_MENU_ITEMS = INITIAL_PRODUCTS || SHARED_PRODUCTS;

function Home() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const { language } = usePreferences();

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [, setShops] = useState([]);
  const [menuItems, setMenuItems] = useState(DEFAULT_MENU_ITEMS);
  const [favorites, setFavorites] = useState([]);
  const [showNotice, setShowNotice] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // AI User Behavior & Live Merchant Coupons States
  const [aiInsights] = useState(() => getUserBehaviorInsights());
  const [liveCoupons] = useState(() => getActiveMerchantCoupons());

  // Carousel Horizontal Auto-scroll state & ref
  const carouselRef = useRef(null);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);

  useEffect(() => {
    if (isCarouselHovered) return;

    const interval = setInterval(() => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 15) {
          carouselRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          carouselRef.current.scrollBy({ left: 280, behavior: "smooth" });
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isCarouselHovered]);

  const handleManualScroll = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -280 : 280;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // First-time user welcome coupon state
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => {
    return !localStorage.getItem("queueup_claimed_welcome_coupon");
  });

  // App New Updates & Features Ticker List (Unified Single Bar)
  const [activeUpdateIndex, setActiveUpdateIndex] = useState(0);
  const appUpdatesList = useMemo(() => {
    const list = [];
    if (showWelcomeBanner) {
      list.push({
        id: "welcome-gift",
        type: "welcome",
        badge: language === "en" ? "NEW MEMBER GIFT" : "สิทธิพิเศษสมาชิกใหม่",
        title:
          language === "en"
            ? `Welcome ${user ? user.name || user.email : "Member"}! Claim your ฿50 OFF coupon "WELCOME50" for your first order!`
            : `ยินดีต้อนรับคุณ ${user ? user.name || user.email : "สมาชิก QueueUp"} เข้าสู่ QueueUp! รับคูปองส่วนลดสมาชิกใหม่ "WELCOME50" ลดทันที 50 บาท!`,
        actionType: "claim_coupon",
      });
    }

    list.push(
      {
        id: "app-v25",
        type: "feature",
        badge: language === "en" ? "APP UPDATE v2.5" : "อัปเดตใหม่ v2.5",
        title:
          language === "en"
            ? "QueueUp Canteen Pre-Order, Real-time Queue Tracking & Auto PromptPay QR!"
            : "เปิดใช้งานระบบสั่งอาหารโรงอาหารล่วงหน้า, ติดตามคิวแบบ real-time และสแกน QR PromptPay!",
        targetPath: "/search?keyword=อาหาร",
      },
      {
        id: "prog-crm",
        type: "program",
        badge: language === "en" ? "NEW PROGRAM" : "โปรแกรมใหม่",
        title:
          language === "en"
            ? "New Member Welcome Coupons & Parent Nutrition Spending Tracker!"
            : "กระเป๋าคูปองส่วนลดสมาชิกใหม่ และระบบติดตามรายจ่ายโภชนาการสำหรับผู้ปกครอง!",
        targetPath: "/user/account/profile?tab=coupons",
      },
      {
        id: "shop-pa-daeng",
        type: "store",
        badge: language === "en" ? "STORE UPDATE" : "อัปเดตจากร้านค้าที่ติดตาม",
        title:
          language === "en"
            ? "[Pa Daeng Canteen] Order ahead now & claim free 50 CRM bonus points!"
            : "[ร้านป้าแดง ตามสั่ง] เปิดให้สั่งอาหารล่วงหน้ารับแต้มสะสม CRM ฟรีได้ทันที!",
        targetPath: "/product/m1",
      }
    );

    return list;
  }, [language, user, showWelcomeBanner]);

  const currentUpdate = appUpdatesList[activeUpdateIndex] || appUpdatesList[0];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveUpdateIndex((prev) => (prev + 1) % appUpdatesList.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [appUpdatesList.length]);

  const handleClaimWelcomeCoupon = () => {
    const couponCode = "WELCOME50";
    const userName = user ? user.name || user.email : "สมาชิกใหม่";
    try {
      navigator.clipboard.writeText(couponCode);
    } catch (err) {
      console.warn("Clipboard copy fallback:", err);
    }
    localStorage.setItem("queueup_claimed_welcome_coupon", "true");

    const existingCoupons = JSON.parse(localStorage.getItem("queueup_user_coupons") || "[]");
    if (!existingCoupons.some((c) => c.code === couponCode)) {
      existingCoupons.push({
        code: couponCode,
        discount: "50 บาท",
        title: "คูปองส่วนลดสมาชิกใหม่ WELCOME50",
        expiry: "31 ธ.ค. 2026",
      });
      localStorage.setItem("queueup_user_coupons", JSON.stringify(existingCoupons));
    }
    setShowWelcomeBanner(false);

    alert(
      language === "en"
        ? `Congratulations ${userName}!\nCoupon code "${couponCode}" (฿50 OFF) saved & copied to clipboard!\nUse it on your first checkout.`
        : `ยินดีด้วยคุณ ${userName}!\nคัดลอกรหัสคูปอง "${couponCode}" (ส่วนลด 50 บาท) เรียบร้อยแล้ว!\nสามารถนำไปกรอกใช้เป็นส่วนลดในหน้าชำระเงินได้ทันที`
    );
  };

  useEffect(() => {
    fetchFoodCategoriesFromFirestore().then((dbCats) => {
      if (dbCats && dbCats.length > 0) {
        setCategories(dbCats);
      } else {
        DEFAULT_CATEGORIES.forEach((c) => saveCategoryToFirestore(c));
      }
    });

    fetchShopsFromFirestore().then((dbShops) => {
      if (dbShops && dbShops.length > 0) {
        setShops(dbShops);
      }
    });

    fetchProductsFromFirestore().then((dbProducts) => {
      if (dbProducts && dbProducts.length > 0) {
        setMenuItems(dbProducts);
      }
    });
  }, []);

  const toggleFavorite = (itemId) => {
    setFavorites((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const [catalogSort, setCatalogSort] = useState("all");

  // Top 10 Bestselling food items sorted by real order volume / sales
  const topBestsellers = useMemo(() => {
    return [...(menuItems || [])]
      .sort((a, b) => {
        const salesA = parseInt(String(a.salesCount || a.sales || "0").replace(/[^0-9]/g, ""), 10) || 0;
        const salesB = parseInt(String(b.salesCount || b.sales || "0").replace(/[^0-9]/g, ""), 10) || 0;
        return salesB - salesA;
      })
      .slice(0, 10);
  }, [menuItems]);

  const displayCatalogItems = useMemo(() => {
    let list = (menuItems || []).filter((item) => {
      return selectedCategory === "all" || item?.category === selectedCategory;
    });

    if (catalogSort === "rating") {
      list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (catalogSort === "price_low") {
      list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (catalogSort === "fast") {
      list = [...list].filter((a) => (a.price || 0) <= 60 || a.category === "noodle" || a.category === "single_dish");
    }
    return list;
  }, [menuItems, selectedCategory, catalogSort]);

  return (
    <div className="queue-home-container">
      {/* 1. Header Search Bar */}
      <ShopeeSearchBar />

      {/* 2. Single Unified Announcement Banner */}
      {showNotice && currentUpdate && (
        <div className="queue-notice-banner">
          <div className="queue-notice-content">
            <span className="queue-notice-chip">
              <i className="bi bi-bell-fill me-1" />
              {currentUpdate.badge}
            </span>
            <span
              className="queue-notice-text"
              onClick={() => {
                if (currentUpdate.actionType === "claim_coupon") {
                  handleClaimWelcomeCoupon();
                } else if (currentUpdate.targetPath) {
                  navigate(currentUpdate.targetPath);
                }
              }}
              style={{ cursor: "pointer" }}
              title="คลิกดูรายละเอียดอัปเดตนี้"
            >
              {currentUpdate.title}
            </span>
          </div>

          <div className="d-flex align-items-center gap-2 ms-auto">
            {currentUpdate.actionType === "claim_coupon" && (
              <button
                type="button"
                className="queue-claim-btn"
                onClick={handleClaimWelcomeCoupon}
              >
                <i className="bi bi-gift-fill text-warning me-1" />
                {language === "en" ? "Claim ฿50 Coupon" : "เก็บคูปอง 50 บาท"}
              </button>
            )}

            {appUpdatesList.length > 1 && (
              <div className="queue-ticker-controls">
                <button
                  type="button"
                  className="queue-ticker-arrow"
                  onClick={() =>
                    setActiveUpdateIndex(
                      (prev) => (prev - 1 + appUpdatesList.length) % appUpdatesList.length
                    )
                  }
                  title="อัปเดตก่อนหน้า"
                >
                  ‹
                </button>
                <span className="queue-ticker-count">
                  {activeUpdateIndex + 1}/{appUpdatesList.length}
                </span>
                <button
                  type="button"
                  className="queue-ticker-arrow"
                  onClick={() =>
                    setActiveUpdateIndex((prev) => (prev + 1) % appUpdatesList.length)
                  }
                  title="อัปเดตถัดไป"
                >
                  ›
                </button>
              </div>
            )}

            <button
              type="button"
              className="queue-notice-close"
              onClick={() => setShowNotice(false)}
              title="ปิดการแจ้งเตือน"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
      )}

      <div
        className="queue-home-wrapper"
        style={{ marginTop: (showNotice || showWelcomeBanner) ? "0px" : "24px" }}
      >
        {/* 3. Hero Banner Section */}
        <section className="queue-hero-banner">
          <div className="queue-hero-left">
            <span className="queue-hero-tag">
              <i className="bi bi-clock-history me-1" />
              {language === "en" ? "SMART PRE-BOOKING PLATFORM" : "แพลตฟอร์มสั่งจองอาหารล่วงตามนัด"}
            </span>
            <h1 className="queue-hero-title">
              {language === "en" ? "Pre-Order & Schedule Pickup," : "จองอาหารล่วงหน้า ระบุเวลานัด"}
              <br />
              {language === "en" ? "Zero Queues & Hot Meals Daily!" : "ไม่ต้องยืนรอคิว ได้กินอาหารร้อนๆ ตรงเวลา!"}
            </h1>
            <p className="queue-hero-sub">
              {language === "en"
                ? "Select date & time slot, order from top school canteen shops, and track status live."
                : "ระบุวันและเวลารับอาหารล่วงหน้า วางแผนมื้ออาหารในโรงเรียน มั่นใจได้อาหารเสิร์ฟร้อนทันเวลา"}
            </p>
            <div className="queue-hero-actions">
              <button
                className="queue-hero-btn-primary"
                onClick={() => navigate("/search?keyword=อาหาร")}
              >
                <i className="bi bi-calendar-check me-1" />
                {language === "en" ? "Explore & Pre-Book" : "ค้นหาร้านและสั่งจองล่วงหน้า"}
              </button>
              <div className="queue-hero-points-badge">
                <span><i className="bi bi-coin text-warning me-1" /> {language === "en" ? "CRM Points: 128" : "แต้มสะสม CRM: 128"}</span>
              </div>
            </div>
          </div>

          <img
            src="/crispy_fried_chicken.jpg"
            alt="Crispy Fried Chicken"
            className="queue-hero-right-img"
          />
        </section>

        {/* 3.5 Live Canteen Queue & Pre-Booking Calendar Status Bar */}
        <section className="queue-canteen-status-bar">
          <div className="queue-canteen-status-list">
            <div className="queue-canteen-chip">
              <span className="queue-canteen-dot online" />
              <span>
                <strong>{language === "en" ? "Canteen 1:" : "โรงอาหารกลาง 1:"}</strong>{" "}
                {language === "en" ? "Wait ~3 mins (Open)" : "คิวเฉลี่ย ~3 นาที (เปิดปกติ)"}
              </span>
            </div>
            <div className="queue-canteen-chip">
              <span className="queue-canteen-dot online" />
              <span>
                <strong>{language === "en" ? "Canteen 2:" : "โรงอาหาร 2:"}</strong>{" "}
                {language === "en" ? "Wait ~2 mins (Open)" : "คิวเฉลี่ย ~2 นาที (คล่องตัว)"}
              </span>
            </div>
            <div className="queue-canteen-chip">
              <i className="bi bi-calendar-event text-danger" />
              <span>
                <strong>{language === "en" ? "Pre-Booking Slot:" : "รอบนัดรับเที่ยงนี้:"}</strong> 11:30 - 13:00 น.
              </span>
            </div>
          </div>

          <button
            type="button"
            className="queue-canteen-action-btn"
            onClick={() => navigate("/search?keyword=ทั้งหมด")}
          >
            <i className="bi bi-compass" />
            {language === "en" ? "Explore & Order" : "เลือกเมนูและจองคิวทันที"}
          </button>
        </section>

        {/* 3.5 QueueUp for Campus Hub Section */}
        <section className="p-6 sm:p-8 rounded-3xl shadow-xl mb-6 bg-[#241C16] border border-[#FF7A1A]/30 text-white font-['IBM_Plex_Sans_Thai'] relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <span className="inline-block px-3 py-1 bg-[#FF7A1A] text-white font-['JetBrains_Mono'] font-bold text-xs rounded-full shadow-sm mb-2">
                QUEUEUP FOR CAMPUS
              </span>
              <h4 className="font-['Kanit'] font-black text-xl sm:text-2xl text-white mb-1">
                ศูนย์รวมบริการโรงอาหารอัจฉริยะในสถานศึกษา
              </h4>
              <p className="text-stone-400 text-xs sm:text-sm mb-0">
                ระบบสนับสนุนผู้ประกอบการนักเรียน กระเป๋าเงินดิจิทัล และระบบดูแลสุขภาพผู้เรียน
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Student Vendor */}
            <div
              className="p-5 rounded-2xl bg-[#16100C] border border-[#FF7A1A]/25 hover:border-[#FF7A1A] hover:shadow-lg hover:shadow-[#FF7A1A]/10 transition-all duration-300 flex flex-col justify-between cursor-pointer group hover:-translate-y-1"
              onClick={() => navigate("/student-vendor/apply")}
            >
              <div>
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform inline-block">🧑‍🎓</div>
                <h6 className="font-['Kanit'] font-bold text-white text-base mb-1">ร้านค้านักเรียน</h6>
                <p className="text-stone-400 text-xs leading-relaxed mb-0">
                  ยื่นขอเปิดร้านค้าในโรงอาหาร บ่มเพาะทักษะธุรกิจ
                </p>
              </div>
              <button
                type="button"
                className="w-full py-2.5 rounded-xl border border-[#FF7A1A] text-[#FF7A1A] group-hover:bg-[#FF7A1A] group-hover:text-white font-['Kanit'] font-bold text-xs transition-all mt-4 text-center cursor-pointer"
              >
                ยื่นขอเปิดร้าน ›
              </button>
            </div>

            {/* 2. Guardian Portal */}
            <div
              className="p-5 rounded-2xl bg-[#16100C] border border-[#FF7A1A]/25 hover:border-[#FF7A1A] hover:shadow-lg hover:shadow-[#FF7A1A]/10 transition-all duration-300 flex flex-col justify-between cursor-pointer group hover:-translate-y-1"
              onClick={() => navigate("/guardian")}
            >
              <div>
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform inline-block">🛡️</div>
                <h6 className="font-['Kanit'] font-bold text-white text-base mb-1">ผู้ปกครอง (Guardian)</h6>
                <p className="text-stone-400 text-xs leading-relaxed mb-0">
                  เติมเงิน กำหนดวงเงินรายวัน และบล็อกหมวดอาหาร
                </p>
              </div>
              <button
                type="button"
                className="w-full py-2.5 rounded-xl border border-[#FF7A1A] text-[#FF7A1A] group-hover:bg-[#FF7A1A] group-hover:text-white font-['Kanit'] font-bold text-xs transition-all mt-4 text-center cursor-pointer"
              >
                จัดการกระเป๋าเงิน ›
              </button>
            </div>

            {/* 3. Teacher/Supervisor Approvals */}
            <div
              className="p-5 rounded-2xl bg-[#16100C] border border-[#FF7A1A]/25 hover:border-[#FF7A1A] hover:shadow-lg hover:shadow-[#FF7A1A]/10 transition-all duration-300 flex flex-col justify-between cursor-pointer group hover:-translate-y-1"
              onClick={() => navigate("/admin/vendor-approvals")}
            >
              <div>
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform inline-block">👨‍🏫</div>
                <h6 className="font-['Kanit'] font-bold text-white text-base mb-1">อาจารย์ / ฝ่ายปกครอง</h6>
                <p className="text-stone-400 text-xs leading-relaxed mb-0">
                  อนุมัติร้านค้านักเรียน และตรวจสอบสุขอนามัย
                </p>
              </div>
              <button
                type="button"
                className="w-full py-2.5 rounded-xl border border-[#FF7A1A] text-[#FF7A1A] group-hover:bg-[#FF7A1A] group-hover:text-white font-['Kanit'] font-bold text-xs transition-all mt-4 text-center cursor-pointer"
              >
                แผงควบคุมอาจารย์ ›
              </button>
            </div>

            {/* 4. Live Canteen Monitor */}
            <div
              className="p-5 rounded-2xl bg-[#16100C] border border-[#FF7A1A]/25 hover:border-[#FF7A1A] hover:shadow-lg hover:shadow-[#FF7A1A]/10 transition-all duration-300 flex flex-col justify-between cursor-pointer group hover:-translate-y-1"
              onClick={() => navigate("/campus/monitor")}
            >
              <div>
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform inline-block">📺</div>
                <h6 className="font-['Kanit'] font-bold text-white text-base mb-1">จอแสดงคิวสด</h6>
                <p className="text-stone-400 text-xs leading-relaxed mb-0">
                  จอแสดงผลคิวปรุงเสร็จแบบเรียลไทม์ในโรงอาหาร
                </p>
              </div>
              <button
                type="button"
                className="w-full py-2.5 rounded-xl border border-[#FF7A1A] text-[#FF7A1A] group-hover:bg-[#FF7A1A] group-hover:text-white font-['Kanit'] font-bold text-xs transition-all mt-4 text-center cursor-pointer"
              >
                เปิดจอคิวสด ›
              </button>
            </div>

            {/* 5. Medical & Emergency */}
            <div
              className="p-5 rounded-2xl bg-[#16100C] border border-red-500/35 hover:border-red-500 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300 flex flex-col justify-between cursor-pointer group hover:-translate-y-1"
              onClick={() => navigate("/emergency")}
            >
              <div>
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform inline-block">🚨</div>
                <h6 className="font-['Kanit'] font-bold text-white text-base mb-1">พยาบาล & ฉุกเฉิน</h6>
                <p className="text-stone-400 text-xs leading-relaxed mb-0">
                  ค้นหาประวัติแพ้อาหาร โรคประจำตัว และบันทึก Audit
                </p>
              </div>
              <button
                type="button"
                className="w-full py-2.5 rounded-xl border border-red-500 text-red-400 group-hover:bg-red-500 group-hover:text-white font-['Kanit'] font-bold text-xs transition-all mt-4 text-center cursor-pointer"
              >
                ข้อมูลฉุกเฉิน ›
              </button>
            </div>
          </div>
        </section>

        {/* 4. Food Categories Carousel */}
        <section className="queue-category-section">
          <h5 className="fw-bold queue-category-title mb-3">
            <i className="bi bi-grid-fill text-primary me-2" />
            {language === "en" ? "Food Categories" : "หมวดหมู่อาหาร"}
          </h5>
          <div className="queue-category-list">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`queue-category-item ${
                  selectedCategory === cat.id ? "active" : ""
                }`}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  if (cat.id === "all") {
                    navigate("/search?keyword=ทั้งหมด");
                  } else {
                    navigate(`/search?keyword=${encodeURIComponent(cat.label)}`);
                  }
                }}
              >
                <div className="queue-category-circle">
                  <img
                    src={cat.image || "/logo.png"}
                    alt={cat.label}
                    className="queue-category-icon-img"
                  />
                </div>
                <span className="queue-category-label">
                  {language === "en" && cat.labelEn ? cat.labelEn : cat.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Top 10 Bestsellers Carousel */}
        <section className="bg-white p-4 rounded-4 shadow-sm border mb-4 queue-bestseller-section">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="fw-bold text-dark mb-0">
                <i className="bi bi-fire text-danger me-1" />{" "}
                {language === "en" ? "Top 10 Bestselling Canteen Dishes" : "10 อันดับเมนูขายดีประจำโรงอาหาร"}
              </h5>
              <p className="text-muted text-xs mb-0 mt-1">
                {language === "en"
                  ? "Auto-scrolling popular canteen meals"
                  : "เลื่อนแนวนอนอัตโนมัติ • วางเมาส์เพื่อหยุดเลื่อน"}
              </p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-danger">
                <i className="bi bi-star-fill me-1" />
                {language === "en" ? "POPULAR" : "ยอดนิยม"}
              </span>
              <button
                type="button"
                className="queue-carousel-arrow-btn"
                onClick={() => handleManualScroll("left")}
                title="เลื่อนไปทางซ้าย"
              >
                ‹
              </button>
              <button
                type="button"
                className="queue-carousel-arrow-btn"
                onClick={() => handleManualScroll("right")}
                title="เลื่อนไปทางขวา"
              >
                ›
              </button>
            </div>
          </div>

          <div
            className="queue-bestseller-carousel"
            ref={carouselRef}
            onMouseEnter={() => setIsCarouselHovered(true)}
            onMouseLeave={() => setIsCarouselHovered(false)}
          >
            {topBestsellers.map((item) => (
              <div key={item.id} className="queue-bestseller-carousel-item">
                <FoodCard
                  item={item}
                  isFavorite={favorites.includes(item.id)}
                  onToggleFavorite={toggleFavorite}
                  onClick={() => navigate(`/product/${item.id}`)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* 6. AI Smart Behavior & Live Merchant Coupons */}
        <section className="bg-white p-4 rounded-4 shadow-sm border mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="fw-bold text-dark mb-0">
              <i className="bi bi-cpu-fill text-primary me-2" />
              AI Smart Assistant & คูปองส่วนลดพิเศษประจำวัน
            </h5>
          </div>

          <div className="row g-3">
            {aiInsights && aiInsights.lastOrderedItem ? (
              <div className="col-md-6">
                <div className="p-4 rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-slate-900 dark:text-slate-100 flex items-center justify-between gap-3 shadow-xs">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500 text-white text-[11px] font-bold mb-1.5 shadow-xs">
                      <i className="bi bi-lightning-charge-fill" />
                      AI Quick Re-order (สั่งต่อใน 1 คลิก)
                    </span>
                    <h6 className="font-['Kanit'] font-bold text-sm mb-1">{aiInsights.lastOrderedItem.itemTitle}</h6>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mb-0">
                      {aiInsights.lastOrderedItem.variant ? `ตัวเลือก: ${aiInsights.lastOrderedItem.variant} • ` : ""}
                      ราคา ฿{aiInsights.lastOrderedItem.price}
                    </p>
                  </div>
                  <button
                    className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-['Kanit'] font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                    onClick={() => {
                      recordUserOrderBehavior(aiInsights.lastOrderedItem);
                      navigate(`/product/${aiInsights.lastOrderedItem.itemId || "prod-default"}`);
                    }}
                  >
                    <i className="bi bi-bag-plus me-1" />
                    สั่งซ้ำอีกครั้ง
                  </button>
                </div>
              </div>
            ) : (
              <div className="col-md-6">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 shadow-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-600 text-white text-[11px] font-bold mb-1.5">
                    <i className="bi bi-lightbulb-fill text-amber-300" />
                    AI Behavioral Learning
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0 leading-relaxed">
                    {aiInsights?.aiSuggestion || "ระบบกำลังเรียนรู้พฤติกรรมการสั่งซื้อของคุณ สั่งอาหารมื้อนี้เพื่อเปิดใช้งาน 1-Click Quick Re-order"}
                  </p>
                </div>
              </div>
            )}

            <div className="col-md-6">
              <div className="p-3 rounded-3 border bg-light">
                <span className="badge bg-success mb-1">
                  <i className="bi bi-tag-fill me-1" />
                  คูปองร้านค้าที่เปิดใช้งาน (Live)
                </span>
                {liveCoupons && liveCoupons.length > 0 ? (
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <strong className="text-primary">{liveCoupons[0].code}</strong> - {liveCoupons[0].title}
                      <div className="text-success small fw-bold">
                        ส่วนลด {liveCoupons[0].discountType === "PERCENT" ? `${liveCoupons[0].discountValue}%` : `฿${liveCoupons[0].discountValue}`} (เมื่อสั่งขั้นต่ำ ฿{liveCoupons[0].minSpend})
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-outline-success fw-bold ms-2"
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(liveCoupons[0].code);
                          alert(`คัดลอกโค้ดส่วนลด "${liveCoupons[0].code}" เรียบร้อยแล้ว!`);
                        } catch {
                          alert(`รหัสคูปอง: ${liveCoupons[0].code}`);
                        }
                      }}
                    >
                      <i className="bi bi-clipboard me-1" />
                      คัดลอกโค้ด
                    </button>
                  </div>
                ) : (
                  <p className="small mb-0 text-muted">ยังไม่มีคูปองเปิดใช้งานอยู่ขณะนี้</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 10. AI Smart Recommendation Dark Section */}
        <section className="queue-ai-section">
          <div className="queue-ai-header-row">
            <div>
              <div className="queue-ai-tag">
                <i className="bi bi-stars text-warning me-1" /> ระบบวิเคราะห์ความอร่อยใกล้คุณ (AI QueueUp Smart Search)
              </div>
              <h2 className="queue-ai-title">
                แนะนำร้านอร่อยที่สุด จากพิกัดที่ใกล้คุณที่สุด
              </h2>
            </div>
            <div className="queue-ai-location">
              <i className="bi bi-geo-alt-fill text-danger me-1" /> ตำแหน่งของคุณ: อาคารเรียน 2 (โรงอาหารกลาง)
            </div>
          </div>

          <div className="queue-ai-cards-grid">
            <div
              className="queue-ai-shop-card"
              onClick={() => navigate("/search?keyword=ป้าแดง")}
            >
              <span className="queue-ai-badge-rank">
                <i className="bi bi-trophy-fill text-warning me-1" /> อร่อยอันดับ 1 ใกล้คุณ
              </span>
              <div className="queue-ai-shop-name">ร้านป้าแดง ตามสั่ง & ไก่ทอด</div>
              <div className="queue-ai-shop-meta">
                <span><i className="bi bi-star-fill text-warning me-1" /> 4.9 / 5</span>
                <span>• เสิร์ฟไวเฉลี่ย 8 นาที</span>
              </div>
            </div>

            <div
              className="queue-ai-shop-card"
              onClick={() => navigate("/search?keyword=ก๋วยเตี๋ยว")}
            >
              <span
                className="queue-ai-badge-rank"
                style={{ background: "#059669" }}
              >
                <i className="bi bi-lightning-fill text-warning me-1" /> เสิร์ฟไวอันดับ 1
              </span>
              <div className="queue-ai-shop-name">ร้านก๋วยเตี๋ยวเรือเสือร้องไห้</div>
              <div className="queue-ai-shop-meta">
                <span><i className="bi bi-star-fill text-warning me-1" /> 4.8 / 5</span>
                <span>• เสิร์ฟไวเฉลี่ย 4 นาที</span>
              </div>
            </div>

            <div
              className="queue-ai-shop-card"
              onClick={() => navigate("/search?keyword=สเต็ก")}
            >
              <span
                className="queue-ai-badge-rank"
                style={{ background: "#7c3aed" }}
              >
                <i className="bi bi-award-fill text-warning me-1" /> ยอดนิยมสูงสุด
              </span>
              <div className="queue-ai-shop-name">ร้านสเต็กพี่ตั้ม School Food</div>
              <div className="queue-ai-shop-meta">
                <span><i className="bi bi-star-fill text-warning me-1" /> 4.9 / 5</span>
                <span>• คิวรอน้อยกว่า 12 นาที</span>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Food Catalog Grid with Interactive Filters & Sorting */}
        <section className="bg-white p-4 rounded-4 shadow-sm border mb-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
            <div>
              <h5 className="fw-bold text-dark mb-0">
                <i className="bi bi-grid-3x3-gap-fill text-primary me-2" />
                🍽️ อาหารทั้งหมดในโรงอาหาร
              </h5>
              <p className="text-muted text-xs mb-0 mt-1">
                {displayCatalogItems.length} รายการอาหาร • กรองตามหมวดหมู่และราคา
              </p>
            </div>

            {/* Filter Buttons */}
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn btn-sm ${catalogSort === "all" ? "btn-dark fw-bold" : "btn-outline-secondary"}`}
                onClick={() => setCatalogSort("all")}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                className={`btn btn-sm ${catalogSort === "rating" ? "btn-dark fw-bold" : "btn-outline-secondary"}`}
                onClick={() => setCatalogSort("rating")}
              >
                <i className="bi bi-star-fill text-warning me-1" /> คะแนนสูงสุด
              </button>
              <button
                type="button"
                className={`btn btn-sm ${catalogSort === "price_low" ? "btn-dark fw-bold" : "btn-outline-secondary"}`}
                onClick={() => setCatalogSort("price_low")}
              >
                <i className="bi bi-tag-fill me-1" /> ราคาประหยัด
              </button>
              <button
                type="button"
                className={`btn btn-sm ${catalogSort === "fast" ? "btn-dark fw-bold" : "btn-outline-secondary"}`}
                onClick={() => setCatalogSort("fast")}
              >
                <i className="bi bi-lightning-charge-fill text-warning me-1" /> เสิร์ฟไว (&lt; 8 นาที)
              </button>
            </div>
          </div>

          {/* Food Cards Grid */}
          <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3">
            {displayCatalogItems.map((item) => (
              <div key={item.id} className="col">
                <FoodCard
                  item={item}
                  isFavorite={favorites.includes(item.id)}
                  onToggleFavorite={toggleFavorite}
                  onClick={() => navigate(`/product/${item.id}`)}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

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

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Home;