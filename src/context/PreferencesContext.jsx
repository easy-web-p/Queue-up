import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setCookie, getCookie } from "../utils/cookieManager.js";

const PreferencesContext = createContext(null);
const words = {
  th: {
    search: "ค้นหาเมนูหรือร้านค้าในโรงอาหาร",
    all: "ทั้งหมด",
    shop: "ในร้านนี้",
    dark: "โหมดมืด",
    light: "โหมดสว่าง",
    notifications: "การแจ้งเตือน",
    help: "ช่วยเหลือ",
    sellerCentre: "สมัครเป็นผู้ขาย / เปิดร้านค้า",
    download: "ดาวน์โหลด",
    followUs: "ติดตามเราบน",
    myBookings: "รายการจองอาหาร",
    profile: "โปรไฟล์ส่วนตัว",
    logout: "ออกจากระบบ",
    bestseller: "เมนูอาหารขายดีประจำโรงอาหาร",
    categories: "หมวดหมู่เมนูอาหาร",
  },
  en: {
    search: "Search food and stores in canteen",
    all: "All",
    shop: "This store",
    dark: "Dark mode",
    light: "Light mode",
    notifications: "Notifications",
    help: "Help",
    sellerCentre: "Seller Centre / Open Store",
    download: "Download",
    followUs: "Follow us on",
    myBookings: "My Food Bookings",
    profile: "My Profile",
    logout: "Logout",
    bestseller: "Bestselling Canteen Dishes",
    categories: "Food Categories",
  },
};

export function PreferencesProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return getCookie("queueup_theme") || localStorage.getItem("queueup_theme") || "dark";
  });
  const [language, setLanguage] = useState(() => {
    return getCookie("queueup_language") || localStorage.getItem("queueup_language") || "th";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.lang = language;

    if (theme === "dark") {
      document.body.classList.add("dark-mode");
      document.body.style.backgroundColor = "#0b1020";
      document.body.style.color = "#e7edf8";
    } else {
      document.body.classList.remove("dark-mode");
      document.body.style.backgroundColor = "#f8fafc";
      document.body.style.color = "#0f172a";
    }

    localStorage.setItem("queueup_theme", theme);
    localStorage.setItem("queueup_language", language);
    setCookie("queueup_theme", theme, 365);
    setCookie("queueup_language", language, 365);
  }, [theme, language]);

  const value = useMemo(() => ({
    theme,
    language,
    t: (key) => (words[language] ? words[language][key] || key : key),
    toggleTheme: () => setTheme((v) => (v === "dark" ? "light" : "dark")),
    toggleLanguage: (target) =>
      setLanguage((v) => {
        if (target === "th" || target === "en") return target;
        return v === "th" ? "en" : "th";
      }),
  }), [theme, language]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

// This hook is exported alongside its provider intentionally for a compact UI-preferences module.
// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("Missing PreferencesProvider");
  return value;
}
