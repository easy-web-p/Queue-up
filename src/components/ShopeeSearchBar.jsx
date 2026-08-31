import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config.js";
import { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import { clearUser, switchRole } from "../store/authSlice.js";
import { usePreferences } from "../context/PreferencesContext.jsx";
import "./ShopeeSearchBar.css";

const MOCK_PRODUCTS = [
  "ไก่ทอดซอสเกาหลี",
  "เบอร์เกอร์ไก่กรอบชีสทะลัก",
  "ข้าวผัดกุ้งกะทะร้อน",
  "ชานมไข่มุกบราวน์ชูการ์",
  "ก๋วยเตี๋ยวเรือหมูน้ำตก",
  "ต้มยำกุ้งแม่น้ำน้ำข้น",
  "ชุดชาบูหมูสไลด์ซุปดำ",
  "ข้าวหน้าแซลมอนย่างเทริยากิ",
  "สเต็กหมูพริกไทยดำ",
  "บิงซูสตรอว์เบอร์รีนมสด",
];

function ShopeeSearchBar({ disableHistory = false, hideTrendingLinks = false }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme, setThemeMode, language, t, toggleLanguage } = usePreferences();
  const { user } = useSelector((state) => state.auth);

  // States
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [scope, setScope] = useState("shop"); // 'shop' (ในร้านนี้) | 'all' (ทั้งหมด)
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [, setIsNotificationOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = () => {
      setIsThemeOpen(false);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // Search History State
  const [searchHistory, setSearchHistory] = useState(() => {
    const saved = localStorage.getItem("shopee_search_history");
    return saved ? JSON.parse(saved) : [];
  });

  const getThemeName = (mode) => {
    if (language === "en") {
      if (mode === "light") return "Light";
      if (mode === "dark") return "Dark";
      return "Auto";
    } else {
      if (mode === "light") return "สว่าง";
      if (mode === "dark") return "มืด";
      return "ตามระบบ";
    }
  };

  const TOP_TRENDING_KEYWORDS = [
    "ไก่ทอดซอสเกาหลี",
    "เบอร์เกอร์ไก่กรอบ",
    "ข้าวผัดกุ้งกะทะร้อน",
    "ชานมไข่มุก",
    "ก๋วยเตี๋ยวเรือ",
    "ต้มยำกุ้ง",
    "ชาบูหมูสไลด์",
    "สเต็กหมูพริกไทยดำ",
  ];

  const saveToHistory = (kw) => {
    if (disableHistory || !kw.trim()) return;
    const newHistory = [kw, ...searchHistory.filter((item) => item !== kw)].slice(0, 8);
    localStorage.setItem("shopee_search_history", JSON.stringify(newHistory));
    setSearchHistory(newHistory);
  };

  // 1. Debouncing Technique (ชะลอการดึงข้อมูล 300ms เมื่อผู้ใช้กำลังพิมพ์)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Filter Logic (ค้นหาคีย์เวิร์ดด้วย useMemo เพื่อหลีกเลี่ยงการ setState ใน useEffect)
  const suggestions = useMemo(() => {
    if (debouncedQuery.trim().length > 0) {
      return MOCK_PRODUCTS.filter((item) =>
        item.toLowerCase().includes(debouncedQuery.toLowerCase())
      );
    }
    return [];
  }, [debouncedQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      saveToHistory(searchTerm.trim());
      setIsInputFocused(false);
      navigate(`/search?keyword=${encodeURIComponent(searchTerm)}`);
    }
  };

  const handleSelectKeyword = (kw) => {
    setSearchTerm(kw);
    saveToHistory(kw);
    setIsInputFocused(false);
    navigate(`/search?keyword=${encodeURIComponent(kw)}`);
  };

  const handleLogout = async () => {
    if (logout) await logout();
    dispatch(clearUser());
    localStorage.removeItem("queueup_user");
    localStorage.removeItem("queueup_secure_account_id");
    localStorage.removeItem("queueup_remember_user");
    sessionStorage.clear();
    navigate("/login", { replace: true });
  };

  // Merchant Store Verification Guard
  const handleMerchantLinkClick = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    let isRegistered = false;
    if (user.activeRole === "merchant" || user.role === "merchant" || user.isMerchantVerified || user.isMerchantRegistered) {
      isRegistered = true;
    } else {
      const savedMerchantVerified = localStorage.getItem("queueup_merchant_verified");
      if (savedMerchantVerified === "true") {
        isRegistered = true;
      } else {
        try {
          const docSnap = await getDoc(doc(db, "users", user.uid));
          if (docSnap.exists() && (docSnap.data()?.isMerchantRegistered || docSnap.data()?.role === "merchant")) {
            isRegistered = true;
          }
        } catch (err) {
          console.warn("Merchant check error:", err);
        }
      }
    }

    if (isRegistered) {
      dispatch(switchRole("merchant"));
      navigate("/merchant/dashboard");
    } else {
      navigate("/portal/th-onboarding");
    }
  };

  return (
    <header className="shopee-header-container">
      {/* 1. Top Sub-Navigation Bar */}
      <div className="shopee-top-nav">
        <div className="shopee-nav-left">
          <span
            className="shopee-nav-item"
            style={{ cursor: "pointer" }}
            onClick={handleMerchantLinkClick}
          >
            <i className="bi bi-shop me-1" /> {language === "en" ? "Seller Centre" : "ศูนย์ผู้ขาย"} {user && user.activeRole === "merchant" ? "(Merchant)" : ""}
          </span>
          <span className="shopee-nav-divider" />
          <span
            className="shopee-nav-item"
            style={{ cursor: "pointer" }}
            onClick={handleMerchantLinkClick}
          >
            <i className="bi bi-rocket-takeoff me-1" /> สมัครเป็นผู้ขาย / เปิดร้านค้า
          </span>
          <span className="shopee-nav-divider" />
          <span className="shopee-nav-item">{language === "en" ? "Download" : "ดาวน์โหลด"}</span>
          <span className="shopee-nav-divider" />
          <span className="shopee-nav-item">
            {language === "en" ? "Follow us on" : "ติดตามเราบน"} <i className="bi bi-facebook" />{" "}
            <i className="bi bi-instagram" /> <i className="bi bi-line" />
          </span>
        </div>

        <div className="shopee-nav-right">
          {/* Notifications Dropdown Popover */}
          <div className="shopee-notification-dropdown-container">
            <span
              className="shopee-nav-item"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/user/account/profile?tab=bookings");
              }}
              style={{ cursor: "pointer" }}
              title="คลิกเพื่อไปหน้าการจอง / เลื่อนเมาส์ผ่านเพื่อดูป๊อบอัพการแจ้งเตือน"
            >
              <i className="bi bi-bell" /> {language === "en" ? "Notifications" : "การแจ้งเตือน"}
              <span className="shopee-badge-icon">4</span>
            </span>

            <div className="shopee-notification-popover">
                <div className="shopee-notif-header">
                  <span>รายการแจ้งเตือนคำสั่งซื้อ & โปรโมชั่นร้านที่ติดตาม</span>
                </div>

                <div className="shopee-notif-body">
                  {/* Notif 1: Active Booking Ready */}
                  <div
                    className="shopee-notif-item unread"
                    onClick={() => {
                      setIsNotificationOpen(false);
                      navigate("/user/account/profile?tab=bookings");
                    }}
                  >
                    <div className="shopee-notif-icon-box bg-success-subtle text-success">
                      <i className="bi bi-bell-fill" />
                    </div>
                    <div className="shopee-notif-content">
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="shopee-notif-store">ร้านครัวโรงเรียน QueueUp Canteen</span>
                        <span className="badge bg-success small">คิวพร้อมรับ A05</span>
                      </div>
                      <div className="shopee-notif-food">
                        <i className="bi bi-egg-fried me-1 text-danger" /> เมนู: ชุดข้าวผัดกุ้งกะทะร้อน + ไข่ดาวสด (1 ชุด)
                      </div>
                      <div className="shopee-notif-details">
                        <span><i className="bi bi-clock me-1 text-primary" /> เวลาที่รับ: 12:15 น. (วันนี้)</span>
                        <span className="ms-2"><i className="bi bi-geo-alt-fill me-1 text-danger" /> จุดรับ: เคาน์เตอร์ 1 อาคารโรงอาหาร 1</span>
                      </div>
                      <div className="d-flex align-items-center justify-content-between mt-1">
                        <span className="shopee-notif-time">5 นาทีที่แล้ว</span>
                        <span className="text-danger fw-bold text-xs">คลิกดูรายละเอียดการจอง <i className="bi bi-arrow-right-short" /></span>
                      </div>
                    </div>
                  </div>

                  {/* Notif 2: Cooking Queue */}
                  <div
                    className="shopee-notif-item"
                    onClick={() => {
                      setIsNotificationOpen(false);
                      navigate("/user/account/profile?tab=bookings");
                    }}
                  >
                    <div className="shopee-notif-icon-box bg-warning-subtle text-warning">
                      <i className="bi bi-fire" />
                    </div>
                    <div className="shopee-notif-content">
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="shopee-notif-store">ร้านสเต็กพี่ตั้ม School Food</span>
                        <span className="badge bg-primary small">กำลังปรุงคิวอาหาร</span>
                      </div>
                      <div className="shopee-notif-food">
                        <i className="bi bi-egg-fried me-1 text-danger" /> เมนู: สเต็กหมูพริกไทยดำ + เฟรนช์ฟรายส์กรอบ (1 ชุด)
                      </div>
                      <div className="shopee-notif-details">
                        <span><i className="bi bi-clock me-1 text-primary" /> เวลาที่รับ: 12:30 น. (วันนี้)</span>
                        <span className="ms-2"><i className="bi bi-geo-alt-fill me-1 text-danger" /> จุดรับ: เคาน์เตอร์ 3 อาคารโรงอาหาร 1</span>
                      </div>
                      <div className="d-flex align-items-center justify-content-between mt-1">
                        <span className="shopee-notif-time">12 นาทีที่แล้ว</span>
                        <span className="text-primary fw-bold text-xs">คลิกดูรายละเอียดการจอง <i className="bi bi-arrow-right-short" /></span>
                      </div>
                    </div>
                  </div>

                  {/* Notif 3: Followed Store Promo 1 */}
                  <div
                    className="shopee-notif-item"
                    onClick={() => {
                      setIsNotificationOpen(false);
                      navigate("/search?keyword=ป้าแดง");
                    }}
                  >
                    <div className="shopee-notif-icon-box bg-danger-subtle text-danger">
                      <i className="bi bi-ticket-perforated-fill" />
                    </div>
                    <div className="shopee-notif-content">
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="shopee-notif-store">ร้านป้าแดง ตามสั่ง (ร้านที่ติดตาม)</span>
                        <span className="badge bg-danger small">โปรโมชั่น CRM</span>
                      </div>
                      <div className="shopee-notif-promo">
                        <i className="bi bi-gift-fill me-1 text-danger" /> แจกโค้ดส่วนลด 15% สิทธิพิเศษสมาชิก QueueUp CRM รับแต้มสะสมฟรี 50 คะแนน!
                      </div>
                      <div className="d-flex align-items-center justify-content-between mt-1">
                        <span className="shopee-notif-time">30 นาทีที่แล้ว</span>
                        <span className="text-danger fw-bold text-xs">คลิกดูโปรโมชั่นร้าน <i className="bi bi-arrow-right-short" /></span>
                      </div>
                    </div>
                  </div>

                  {/* Notif 4: Followed Store Promo 2 */}
                  <div
                    className="shopee-notif-item"
                    onClick={() => {
                      setIsNotificationOpen(false);
                      navigate("/search?keyword=ชาไข่มุก");
                    }}
                  >
                    <div className="shopee-notif-icon-box" style={{ color: "#7c3aed", background: "#f3e8ff" }}>
                      <i className="bi bi-award-fill" />
                    </div>
                    <div className="shopee-notif-content">
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="shopee-notif-store">ร้านชาไข่มุก บราวน์ชูการ์ Express (ร้านที่ติดตาม)</span>
                        <span className="badge bg-warning text-dark small">โปร 1 แถม 1</span>
                      </div>
                      <div className="shopee-notif-promo">
                        <i className="bi bi-cup-straw me-1 text-primary" /> ซื้อชานมไข่มุกขนาดใหญ่ 1 แก้ว แถมฟรี ชาไทยนมสด 1 แก้ว (ช่วงเวลา 13:00 - 14:00 น.)
                      </div>
                      <div className="d-flex align-items-center justify-content-between mt-1">
                        <span className="shopee-notif-time">1 ชั่วโมงที่แล้ว</span>
                        <span className="text-purple fw-bold text-xs" style={{ color: "#7c3aed" }}>คลิกดูโปรโมชั่นร้าน <i className="bi bi-arrow-right-short" /></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shopee-notif-footer">
                  <button
                    className="shopee-notif-view-all-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/user/account/profile?tab=bookings");
                    }}
                  >
                    ดูรายละเอียดการจองทั้งหมด
                  </button>
                </div>
              </div>
          </div>
          <span
            className="shopee-nav-item"
            onClick={() => alert("ศูนย์ช่วยเหลือ QueueUp CRM พร้อมให้บริการตลอด 24 ชั่วโมง")}
            style={{ cursor: "pointer" }}
          >
            <i className="bi bi-question-circle" /> {language === "en" ? "Help" : "ช่วยเหลือ"}
          </span>

          {/* Official Bootstrap 5 SVG Symbols Definition (Hidden) */}
          <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }}>
            <symbol id="circle-half" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 0 8 1v14zm0 1A8 8 0 1 1 8 0a8 8 0 0 1 0 16z"></path>
            </symbol>
            <symbol id="moon-stars-fill" viewBox="0 0 16 16">
              <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"></path>
              <path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.734 1.734 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.734 1.734 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.734 1.734 0 0 0 1.097-1.097l.387-1.162zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L13.863.1z"></path>
            </symbol>
            <symbol id="sun-fill" viewBox="0 0 16 16">
              <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"></path>
            </symbol>
            <symbol id="check2" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"></path>
            </symbol>
          </svg>

          {/* Official Bootstrap 5 Theme Dropdown Menu */}
          <div
            className="shopee-theme-bs5-dropdown-container me-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="btn btn-link nav-link py-1 px-2 dropdown-toggle d-flex align-items-center shopee-bs5-theme-trigger"
              id="bd-theme"
              type="button"
              aria-expanded={isThemeOpen}
              aria-label="Toggle theme"
              onClick={(e) => {
                e.stopPropagation();
                setIsThemeOpen((prev) => !prev);
              }}
              style={{ color: "#ffffff", textDecoration: "none", background: "rgba(255, 255, 255, 0.18)", borderRadius: "20px", border: "1px solid rgba(255, 255, 255, 0.4)", fontSize: "13px", cursor: "pointer", padding: "4px 8px" }}
              title={`Toggle theme (${theme})`}
            >
              <svg className="bi theme-icon-active" style={{ width: "16px", height: "16px", fill: "currentColor" }}>
                <use href={`#${theme === "dark" ? "moon-stars-fill" : theme === "auto" ? "circle-half" : "sun-fill"}`}></use>
              </svg>
            </button>

            <ul
              className={`dropdown-menu dropdown-menu-end shopee-bs5-theme-menu ${isThemeOpen ? "show d-block" : ""}`}
              aria-labelledby="bd-theme"
              style={isThemeOpen ? { display: "block", opacity: 1, visibility: "visible", transform: "translateY(0)" } : {}}
            >
              <li>
                <button
                  type="button"
                  className={`dropdown-item d-flex align-items-center ${theme === "light" ? "active fw-bold" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setThemeMode("light");
                    setIsThemeOpen(false);
                  }}
                >
                  <svg className="bi me-2 opacity-75 theme-icon" style={{ width: "16px", height: "16px", fill: "currentColor" }}><use href="#sun-fill"></use></svg>
                  {getThemeName("light")}
                  {theme === "light" && <svg className="bi ms-auto" style={{ width: "14px", height: "14px", fill: "currentColor" }}><use href="#check2"></use></svg>}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`dropdown-item d-flex align-items-center ${theme === "dark" ? "active fw-bold" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setThemeMode("dark");
                    setIsThemeOpen(false);
                  }}
                >
                  <svg className="bi me-2 opacity-75 theme-icon" style={{ width: "16px", height: "16px", fill: "currentColor" }}><use href="#moon-stars-fill"></use></svg>
                  {getThemeName("dark")}
                  {theme === "dark" && <svg className="bi ms-auto" style={{ width: "14px", height: "14px", fill: "currentColor" }}><use href="#check2"></use></svg>}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`dropdown-item d-flex align-items-center ${theme === "auto" ? "active fw-bold" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setThemeMode("auto");
                    setIsThemeOpen(false);
                  }}
                >
                  <svg className="bi me-2 opacity-75 theme-icon" style={{ width: "16px", height: "16px", fill: "currentColor" }}><use href="#circle-half"></use></svg>
                  {getThemeName("auto")}
                  {theme === "auto" && <svg className="bi ms-auto" style={{ width: "14px", height: "14px", fill: "currentColor" }}><use href="#check2"></use></svg>}
                </button>
              </li>
            </ul>
          </div>
          <span className="shopee-nav-divider" />

          {/* Interactive Hover Language Selector Popover */}
          <div className="shopee-lang-dropdown-container">
            <span className="shopee-nav-item shopee-lang-trigger" style={{ cursor: "pointer" }}>
              <i className="bi bi-globe me-1" /> {language === "en" ? "English" : "ไทย"}{" "}
              <i className="bi bi-caret-down-fill ms-1" style={{ fontSize: "10px" }} />
            </span>

            <ul className="shopee-lang-dropdown-menu">
              <li>
                <button
                  type="button"
                  className={`shopee-dropdown-item ${language === "th" ? "fw-bold text-danger" : ""}`}
                  onClick={() => toggleLanguage("th")}
                >
                  <span className="me-2">🇹🇭</span> ไทย (Thai){" "}
                  {language === "th" && <i className="bi bi-check-lg ms-auto text-danger" />}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`shopee-dropdown-item ${language === "en" ? "fw-bold text-danger" : ""}`}
                  onClick={() => toggleLanguage("en")}
                >
                  <span className="me-2">🇬🇧</span> English (US){" "}
                  {language === "en" && <i className="bi bi-check-lg ms-auto text-danger" />}
                </button>
              </li>
            </ul>
          </div>

          {/* User Profile Hover Dropdown Menu */}
          <div className="shopee-user-dropdown-container">
            <div
              className="shopee-user-trigger"
              onClick={() => navigate("/user/account/profile")}
              title={user ? user.name || user.email : "โปรไฟล์ของฉัน"}
            >
              <img
                src={(user && user.photo) || "/yeti_mascot.jpg"}
                alt="Profile"
                className="shopee-user-avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/yeti_mascot.jpg";
                }}
              />
              <span style={{ fontSize: "10px", marginLeft: "2px" }}>▾</span>
            </div>

            <ul className="shopee-user-dropdown-menu">
              <li>
                <a
                  className="shopee-dropdown-item"
                  href="/user/account/profile"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/user/account/profile");
                  }}
                >
                  <i className="bi bi-person-circle me-2" />
                  {language === "en" ? "My Account" : "บัญชีของฉัน"}
                </a>
              </li>
              <li>
                <a
                  className="shopee-dropdown-item"
                  href="/user/account/profile?tab=bookings"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/user/account/profile?tab=bookings");
                  }}
                >
                  <i className="bi bi-receipt me-2" />
                  {language === "en" ? "My Orders" : "การซื้อของฉัน"}
                </a>
              </li>
              <li>
                <button
                  type="button"
                  className="shopee-dropdown-item d-flex align-items-center justify-content-between"
                  onClick={toggleTheme}
                >
                  <span>
                    <i className={`bi ${theme === "dark" ? "bi-sun-fill text-warning" : "bi-moon-stars-fill text-primary"} me-2`} />
                    {language === "en"
                      ? (theme === "dark" ? "Light Mode" : "Dark Mode")
                      : (theme === "dark" ? "โหมดสว่าง" : "โหมดมืด")}
                  </span>
                  <span className={`badge ${theme === "dark" ? "bg-warning text-dark" : "bg-dark text-white"} text-xs ms-2`}>
                    {getThemeName(theme)}
                  </span>
                </button>
              </li>
              <li>
                <a
                  className="shopee-dropdown-item"
                  href="/user/account/profile?tab=settings"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/user/account/profile?tab=settings");
                  }}
                >
                  <i className="bi bi-gear me-2" />
                  {language === "en" ? "Settings" : "ตั้งค่า"}
                </a>
              </li>
              <li>
                <hr className="shopee-dropdown-divider" />
              </li>
              <li>
                <button
                  type="button"
                  className="shopee-dropdown-item text-danger"
                  onClick={handleLogout}
                >
                  <i className="bi bi-box-arrow-right me-2" />
                  {language === "en" ? "Logout" : "ออกจากระบบ"}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Main Header & Search Bar */}
      <div className="shopee-main-header">
        {/* QueueUp SCHOOL FOOD CRM Brand Logo */}
        <a
          href="/home"
          className="shopee-logo-brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("/home");
          }}
        >
          <div className="shopee-logo-card">
            <img src="/logo.png" alt="QueueUp Logo" className="shopee-logo-img" />
          </div>
          <div className="shopee-logo-text-group">
            <div className="shopee-logo-title">
              <span className="queue-text">Queue</span>
              <span className="up-text">Up</span>
            </div>
            <div className="shopee-logo-sub">SCHOOL FOOD CRM</div>
          </div>
        </a>

        {/* Search Bar Container */}
        <div className="shopee-search-area">
          <form className="shopee-search-box" onSubmit={handleSearchSubmit}>
            {/* Input Field */}
            <input
              type="text"
              className="shopee-search-input"
              placeholder={language === "en" ? "Search foods, shops, or ask QueueUp AI..." : "ค้นหาร้าน อาหาร หรือถาม QueueUp AI..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
              autoComplete="off"
            />

            {/* Scope Selection Dropdown ("ในร้านนี้ ▾") */}
            <div
              className="shopee-search-scope-select"
              onClick={() => setIsScopeOpen(!isScopeOpen)}
            >
              <span>{scope === "shop" ? "ในร้านนี้" : "ทั้งหมด"}</span>
              <i className="bi bi-chevron-down" />

              {isScopeOpen && (
                <div className="shopee-scope-dropdown-menu">
                  <div
                    className="shopee-scope-option"
                    onClick={() => {
                      setScope("shop");
                      setIsScopeOpen(false);
                    }}
                  >
                    ในร้านนี้
                  </div>
                  <div
                    className="shopee-scope-option"
                    onClick={() => {
                      setScope("all");
                      setIsScopeOpen(false);
                    }}
                  >
                    ทั้งหมด
                  </div>
                </div>
              )}
            </div>

            {/* Search Orange Button */}
            <button type="submit" className="shopee-search-button">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* 1. Popover เมื่อคลิกช่องค้นหาและยังไม่ได้พิมพ์คำ (QueueUp AI + Search History) */}
            {!disableHistory && isInputFocused && searchTerm.trim() === "" && (
              <div className="shopee-suggestions-box">
                {/* AI Assistant Quick Prompts */}
                <div className="shopee-history-header d-flex align-items-center justify-content-between text-primary">
                  <span><i className="bi bi-robot me-1" /> 🤖 QueueUp AI Suggestions</span>
                  <span className="badge bg-primary-subtle text-primary" style={{ fontSize: "10px" }}>AI Smart</span>
                </div>
                {[
                  { label: "✨ แนะนำเมนูให้ฉัน", query: "อาหารแนะนำยอดนิยม" },
                  { label: "🌶️ อยากกินอะไรเผ็ด ๆ", query: "อยากกินอะไรเผ็ด ๆ" },
                  { label: "💰 หาอาหารไม่เกิน 50 บาท", query: "อาหารไม่เกิน 50 บาท" },
                  { label: "⚡ หาเมนูที่ทำเร็ว", query: "หาเมนูที่ทำเร็ว" },
                  { label: "🏪 แนะนำร้านยอดนิยม", query: "ร้านยอดนิยม" },
                ].map((aiPrompt, idx) => (
                  <div
                    key={idx}
                    className="shopee-suggestion-row"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectKeyword(aiPrompt.query);
                    }}
                  >
                    <span className="fw-semibold text-dark">{aiPrompt.label}</span>
                  </div>
                ))}

                {searchHistory.length > 0 && (
                  <>
                    <div className="shopee-history-header mt-2">
                      <i className="bi bi-clock-history me-1" /> ประวัติการค้นหา
                    </div>
                    {searchHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="shopee-suggestion-row"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectKeyword(item);
                        }}
                      >
                        <i className="bi bi-search text-muted me-2" style={{ fontSize: "12px" }} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* 2. Popover คำแนะนำการค้นหา (เมื่อเริ่มพิมพ์คำ) */}
            {isInputFocused && searchTerm.trim() !== "" && (
              <div className="shopee-suggestions-box">
                <div className="shopee-history-header text-primary">
                  <i className="bi bi-sparkles me-1" /> ค้นหาด้วย QueueUp AI
                </div>
                <div
                  className="shopee-suggestion-row bg-light"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectKeyword(searchTerm);
                  }}
                >
                  <i className="bi bi-search text-danger me-2" />
                  <span>ค้นหา "<strong>{searchTerm}</strong>"</span>
                </div>
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    className="shopee-suggestion-row"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectKeyword(item);
                    }}
                  >
                    <i className="bi bi-arrow-right text-muted me-2" style={{ fontSize: "12px" }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* Dynamic Recent Search History or Top Trending Keywords underneath Search Box (ซ่อนเมื่ออยู่หน้า 404) */}
          {!hideTrendingLinks && !disableHistory && (
            <div className="shopee-trending-links">
              {(searchHistory.length > 0 ? searchHistory : TOP_TRENDING_KEYWORDS).map(
                (kw, idx) => (
                  <span
                    key={idx}
                    className={`shopee-trending-link item-priority-${idx}`}
                    onClick={() => handleSelectKeyword(kw)}
                  >
                    {kw}
                  </span>
                )
              )}
            </div>
          )}
        </div>

        {/* Shopping Cart Icon */}
        <div
          className="shopee-cart-container"
          onClick={() => navigate("/user/purchase")}
          title="ดูตะกร้า / คิวของคุณ"
        >
          <i className="bi bi-cart3 shopee-cart-icon" />
          <span className="shopee-cart-badge-count">4</span>
        </div>
      </div>
    </header>
  );
}

export default ShopeeSearchBar;
