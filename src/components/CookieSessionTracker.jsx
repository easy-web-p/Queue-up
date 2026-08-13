import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { setCookie, getCookie } from "../utils/cookieManager.js";

/**
 * GLOBAL COOKIE SESSION TRACKER (CookieSessionTracker.jsx)
 * Persists user state, active page, language, and role into HTTP cookies on EVERY page view.
 */
export default function CookieSessionTracker() {
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    // 1. Store last visited page path in cookie
    const currentPath = location.pathname + location.search;
    setCookie("queueup_last_page", currentPath, 30);
    setCookie("queueup_last_visit_time", new Date().toISOString(), 30);

    // 2. Store logged in user identity in cookie if authenticated
    if (user) {
      if (user.email) setCookie("queueup_user_email", user.email, 30);
      if (user.role) setCookie("queueup_user_role", user.role, 30);
      if (user.uid) setCookie("queueup_user_uid", user.uid, 30);
    }

    // 3. Ensure default language preference cookie
    if (!getCookie("queueup_user_lang")) {
      setCookie("queueup_user_lang", "th", 365);
    }
  }, [location, user]);

  return null; // Silent background tracker
}
