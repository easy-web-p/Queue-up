/**
 * QUEUEUP COOKIE MANAGER UTILITY (cookieManager.js)
 * Secure Cookie storage management adhering to PDPA standards.
 */

// Set Cookie
export const setCookie = (name, value, days = 365, path = "/") => {
  try {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    const isHttps = window.location.protocol === "https:";
    const secureFlag = isHttps ? "; Secure" : "";
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${expires}; path=${path}; SameSite=Lax${secureFlag}`;
  } catch (err) {
    console.warn("Cookie set warning:", err);
  }
};

// Get Cookie
export const getCookie = (name) => {
  try {
    const nameEQ = encodeURIComponent(name) + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
  } catch (err) {
    console.warn("Cookie get warning:", err);
  }
  return null;
};

// Delete Cookie
export const deleteCookie = (name, path = "/") => {
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; SameSite=Lax`;
};

// Check Cookie Consent Status
export const hasCookieConsent = () => {
  return getCookie("queueup_cookie_consent") !== null;
};
