/* eslint-disable react-refresh/only-export-components */
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

/**
 * คำนวณธีมในโหมด Auto ตามเวลาและไทม์โซนเครื่องของผู้ใช้ (Local Time / Timezone)
 * - ช่วงเวลากลางคืน (18:00 น. - 06:00 น.): ปรับเป็นโหมดมืด (Dark Mode)
 * - ช่วงเวลากลางวัน (06:00 น. - 18:00 น.): ปรับเป็นโหมดสว่าง (Light Mode)
 * - หากระบบ OS ตั้งค่าโหมดมืดไว้: สลับเป็นโหมดมืด (Dark Mode)
 */
export const getAutoThemeByTimeAndSystem = () => {
  const currentHour = new Date().getHours();
  const isNightTime = currentHour >= 18 || currentHour < 6;
  const isSystemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return isSystemDark || isNightTime ? "dark" : "light";
};

export function PreferencesProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return getCookie("queueup_theme") || localStorage.getItem("queueup_theme") || "light";
  });
  const [language, setLanguage] = useState(() => {
    return getCookie("queueup_language") || localStorage.getItem("queueup_language") || "th";
  });

  useEffect(() => {
    const updateTheme = () => {
      let effectiveTheme = theme;
      if (theme === "auto") {
        effectiveTheme = getAutoThemeByTimeAndSystem();
      }

      document.documentElement.dataset.theme = effectiveTheme;
      document.documentElement.setAttribute("data-theme", effectiveTheme);
      document.documentElement.lang = language;

      if (effectiveTheme === "dark") {
        document.body.classList.add("dark-mode");
        document.body.classList.remove("light-mode");
        document.body.style.backgroundColor = "#16100C";
        document.body.style.color = "#F3ECE3";
      } else {
        document.body.classList.remove("dark-mode");
        document.body.classList.add("light-mode");
        document.body.style.backgroundColor = "#f8fafc";
        document.body.style.color = "#0f172a";
      }
    };

    updateTheme();

    localStorage.setItem("queueup_theme", theme);
    localStorage.setItem("queueup_language", language);
    setCookie("queueup_theme", theme, 365);
    setCookie("queueup_language", language, 365);

    if (theme === "auto") {
      // 1. ตรวจจับการเปลี่ยนแปลงของระบบปฏิบัติการ (OS prefers-color-scheme)
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => updateTheme();
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
      }

      // 2. ตั้งเวลาตรวจเช็คเวลาของเครื่องผู้ใช้ (Local Time) ทุกๆ 60 วินาที
      const timeInterval = setInterval(updateTheme, 60000);

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handleChange);
        }
        clearInterval(timeInterval);
      };
    }
  }, [theme, language]);

  const value = useMemo(() => ({
    theme,
    language,
    t: (key) => (words[language] ? words[language][key] || key : key),
    toggleTheme: () => setTheme((v) => (v === "dark" ? "light" : "dark")),
    setThemeMode: (newTheme) => {
      if (newTheme === "light" || newTheme === "dark" || newTheme === "auto") {
        setTheme(newTheme);
      }
    },
    toggleLanguage: (target) =>
      setLanguage((v) => {
        if (target === "th" || target === "en") return target;
        return v === "th" ? "en" : "th";
      }),
  }), [theme, language]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("Missing PreferencesProvider");
  return value;
}
