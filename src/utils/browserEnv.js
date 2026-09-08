/**
 * ============================================================================
 * 📱 BROWSER ENVIRONMENT & IN-APP WEBVIEW DETECTION UTILITIES
 * ============================================================================
 *
 * In-App Browsers (e.g. Instagram, Facebook, LINE, TikTok, Twitter/X) run inside
 * an embedded iOS WKWebView or Android WebView.
 *
 * These webviews cause two critical issues for Google OAuth:
 * 1. Storage Partitioning / Sandboxing: The embedded webview restricts or wipes
 *    session/local storage across origins, leading to 'auth/missing-initial-state'.
 * 2. Google OAuth Policy: Google actively blocks OAuth requests from embedded
 *    webviews with '403: disallowed_useragent'.
 *
 * These utilities detect in-app browsers and provide guidance to open in Safari/Chrome.
 */

/**
 * Checks if the current environment is an In-App Browser (embedded webview).
 * @returns {boolean}
 */
export function isInAppBrowser() {
  if (typeof window === "undefined" || !window.navigator) return false;

  const ua = window.navigator.userAgent || window.navigator.vendor || "";

  // 1. Common Social Media In-App Browsers
  const isInstagram = /Instagram/i.test(ua);
  const isFacebook = /FBAN|FBAV/i.test(ua);
  const isLine = /Line\//i.test(ua);
  const isTikTok = /musical_ly|ByteLocale|TikTok/i.test(ua);
  const isTwitter = /Twitter/i.test(ua);
  const isSnapchat = /Snapchat/i.test(ua);
  const isWeChat = /MicroMessenger/i.test(ua);

  // 2. Generic iOS embedded WKWebView (contains Mobile/ but lacks standalone Safari signature)
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1);

  const isIosWebview =
    isIos &&
    !window.navigator.standalone &&
    !/Safari/i.test(ua) &&
    /AppleWebKit/i.test(ua);

  return (
    isInstagram ||
    isFacebook ||
    isLine ||
    isTikTok ||
    isTwitter ||
    isSnapchat ||
    isWeChat ||
    isIosWebview
  );
}

/**
 * Returns the human-readable name of the detected In-App Browser.
 * @returns {string}
 */
export function getInAppBrowserName() {
  if (typeof window === "undefined" || !window.navigator) return "In-App Browser";

  const ua = window.navigator.userAgent || "";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV/i.test(ua)) return "Facebook";
  if (/Line\//i.test(ua)) return "LINE";
  if (/TikTok|musical_ly/i.test(ua)) return "TikTok";
  if (/Twitter/i.test(ua)) return "Twitter (X)";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/MicroMessenger/i.test(ua)) return "WeChat";

  return "In-App Browser";
}

/**
 * Checks if the device is iOS (iPhone, iPad, iPod).
 * @returns {boolean}
 */
export function isIosDevice() {
  if (typeof window === "undefined" || !window.navigator) return false;
  const ua = window.navigator.userAgent || "";
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1)
  );
}

/**
 * Copies the current URL to clipboard with fallback for older WebViews.
 * @returns {Promise<boolean>}
 */
export async function copyCurrentUrlToClipboard() {
  if (typeof window === "undefined") return false;
  const url = window.location.href;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch (err) {
    console.warn("Clipboard API failed, falling back to execCommand:", err);
  }

  // Fallback for restricted WebViews
  try {
    const textArea = document.createElement("textarea");
    textArea.value = url;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch (fallbackErr) {
    console.error("Failed to copy URL to clipboard:", fallbackErr);
    return false;
  }
}
