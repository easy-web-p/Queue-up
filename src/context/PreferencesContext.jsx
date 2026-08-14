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
    return getCookie("queueup_theme") || localStorage.getItem("queueup_theme") || "light";
  });
  const [language, setLanguage] = useState(() => {
    return getCookie("queueup_language") || localStorage.getItem("queueup_language") || "th";
  });

  useEffect(() => {
    const updateTheme = () => {
      let effectiveTheme = theme;
      if (theme === "auto") {
        const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        effectiveTheme = isSystemDark ? "dark" : "light";
      }

      document.documentElement.dataset.theme = effectiveTheme;
      document.documentElement.setAttribute("data-theme", effectiveTheme);
      document.documentElement.lang = language;

      if (effectiveTheme === "dark") {
        document.body.classList.add("dark-mode");
        document.body.classList.remove("light-mode");
        document.body.style.backgroundColor = "#0F1115";
        document.body.style.color = "#FFFFFF";
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
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => updateTheme();
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      }
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
