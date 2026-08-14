import { useState, useEffect } from "react";
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

function ShopeeSearchBar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme, language, t, toggleLanguage } = usePreferences();
  const { user } = useSelector((state) => state.auth);

  // States
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [scope, setScope] = useState("shop"); // 'shop' (ในร้านนี้) | 'all' (ทั้งหมด)
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Search History State
  const [searchHistory, setSearchHistory] = useState(() => {
    const saved = localStorage.getItem("shopee_search_history");
    return saved ? JSON.parse(saved) : [];
  });

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
    if (!kw.trim()) return;
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

  // 2. Filter Logic (ค้นหาคีย์เวิร์ดเมื่อ debouncedQuery เปลี่ยนแปลง)
  useEffect(() => {
    if (debouncedQuery.trim().length > 0) {
      const filtered = MOCK_PRODUCTS.filter((item) =>
        item.toLowerCase().includes(debouncedQuery.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
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

  return (
    <header className="shopee-header-container">
      {/* 1. Top Sub-Navigation Bar */}
      <div className="shopee-top-nav">
        <div className="shopee-nav-left">
          <span
            className="shopee-nav-item"
            style={{ cursor: "pointer" }}
            onClick={() => {
              dispatch(switchRole("merchant"));
              navigate("/merchant/dashboard");
            }}
          >
            <i className="bi bi-shop me-1" /> {language === "en" ? "Seller Centre" : "ศูนย์ผู้ขาย"} {user && user.activeRole === "merchant" ? "(Merchant)" : ""}
          </span>
          <span className="shopee-nav-divider" />
          <span
            className="shopee-nav-item"
            style={{ cursor: "pointer" }}
            onClick={() => {
              dispatch(switchRole("merchant"));
              navigate("/merchant/dashboard");
            }}
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

          {/* Bootstrap 5 Premium Theme Toggle Button */}
          <button
            type="button"
            className={`shopee-bs5-theme-btn ${theme === "dark" ? "theme-dark" : "theme-light"}`}
            onClick={toggleTheme}
            title={theme === "dark" ? "คลิกเพื่อสลับเป็นโหมดสว่าง (Light Mode)" : "คลิกเพื่อสลับเป็นโหมดกลางคืน (Dark Mode)"}
          >
            <i className={`bi ${theme === "dark" ? "bi-sun-fill text-warning me-1" : "bi-moon-stars-fill text-info me-1"}`} />
            <span>{theme === "dark" ? (language === "en" ? "Light Mode" : "โหมดกลางวัน") : (language === "en" ? "Dark Mode" : "โหมดกลางคืน")}</span>
          </button>
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
            >
              {user && user.photo ? (
                <img
                  src={user.photo}
                  alt={user.name || "User"}
                  className="shopee-user-avatar"
                />
              ) : (
                <span style={{ fontSize: "14px" }}>👤</span>
              )}
              <span className="shopee-user-name">
                {user ? user.name || user.email : "anime manga"}
              </span>
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
                    {theme === "dark" ? "ปรับเป็นโหมดขาว (Light)" : "ปรับเป็นโหมดดำ (Dark)"}
                  </span>
                  <span className={`badge ${theme === "dark" ? "bg-warning text-dark" : "bg-dark text-white"} text-xs ms-2`}>
                    {theme === "dark" ? "ขาว" : "ดำ"}
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
              placeholder={t("search")}
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

            {/* 1. Popover เมื่อคลิกช่องค้นหาและยังไม่ได้พิมพ์คำ */}
            {isInputFocused && searchTerm.trim() === "" && (
              <div className="shopee-suggestions-box">
                {searchHistory.length > 0 ? (
                  <>
                    <div className="shopee-history-header">ประวัติการค้นหา</div>
                    {searchHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="shopee-suggestion-row"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectKeyword(item);
                        }}
                      >
                        <span>{item}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="shopee-history-header">
                      <i className="bi bi-fire text-danger me-1" /> ค้นหายอดนิยม
                    </div>
                    {TOP_TRENDING_KEYWORDS.map((item, idx) => (
                      <div
                        key={idx}
                        className="shopee-suggestion-row"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectKeyword(item);
                        }}
                      >
                        <i className="bi bi-fire text-danger me-2" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* 2. Popover คำแนะนำการค้นหา (เมื่อเริ่มพิมพ์คำ) */}
            {isInputFocused && searchTerm.trim() !== "" && suggestions.length > 0 && (
              <div className="shopee-suggestions-box">
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    className="shopee-suggestion-row"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectKeyword(item);
                    }}
                  >
                    <i className="bi bi-search text-muted" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* Dynamic Recent Search History or Top Trending Keywords underneath Search Box */}
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
