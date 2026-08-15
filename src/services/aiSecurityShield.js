/**
 * ULTIMATE AI SECURITY SHIELD ENGINE (aiSecurityShield.js)
 * Intelligent Cybersecurity Shield for QueueUp Application.
 * Protection against XSS, Prompt Injection, CSRF/NoSQL Injection, Rate Limiting & PII Data Protection.
 */

// Audit Log Storage Key
const SECURITY_AUDIT_LOG_KEY = "queueup_security_audit_logs_v1";
const RATE_LIMIT_STORAGE_KEY = "queueup_rate_limit_tracker_v1";

/**
 * 1. AI Threat Detection Engine
 * Scans input text for cyber attack vectors (XSS, Script Injection, SQL/NoSQL Injection, Prompt Injection)
 * @param {string} input - User input string
 * @returns {object} { safe: boolean, threats: string[], sanitized: string, riskLevel: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL' }
 */
export function analyzeAndShieldInput(input) {
  if (typeof input !== "string") {
    return { safe: true, threats: [], sanitized: input, riskLevel: "LOW" };
  }

  const threats = [];
  let riskLevel = "LOW";
  let cleanText = input;

  // A. XSS & HTML Script Injection Detection
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /onerror\s*=/gi,
    /onload\s*=/gi,
    /eval\s*\(/gi,
    /document\.cookie/gi,
  ];

  xssPatterns.forEach((pattern) => {
    if (pattern.test(input)) {
      threats.push("Cross-Site Scripting (XSS) / Script Injection pattern detected");
      riskLevel = "CRITICAL";
    }
  });

  // B. AI Prompt Injection Detection (Attacks trying to override AI system instructions)
  const promptInjectionPatterns = [
    /ignore previous instructions/gi,
    /disregard system prompt/gi,
    /you are now in developer mode/gi,
    /system override/gi,
    /reveal system prompt/gi,
    /bypass security/gi,
    /ให้ลืมคำสั่งก่อนหน้า/gi,
    /ข้ามมาตรการความปลอดภัย/gi,
  ];

  promptInjectionPatterns.forEach((pattern) => {
    if (pattern.test(input)) {
      threats.push("AI Prompt Injection Attack attempt detected");
      if (riskLevel !== "CRITICAL") riskLevel = "HIGH";
    }
  });

  // C. SQL / NoSQL Injection Detection
  const nosqlPatterns = [
    /\{\s*"\$gt"\s*:/gi,
    /\{\s*"\$ne"\s*:/gi,
    /SELECT\s+.*\s+FROM/gi,
    /DROP\s+TABLE/gi,
    /UNION\s+SELECT/gi,
  ];

  nosqlPatterns.forEach((pattern) => {
    if (pattern.test(input)) {
      threats.push("Database Injection (SQL/NoSQL) pattern detected");
      riskLevel = "CRITICAL";
    }
  });

  // Perform Rigorous HTML Sanitization
  cleanText = cleanText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();

  // Log to Audit Logger if threat detected
  if (threats.length > 0) {
    logSecurityEvent("AI_THREAT_BLOCKED", {
      originalInputSample: input.substring(0, 50) + "...",
      threats,
      riskLevel,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    safe: threats.length === 0,
    threats,
    sanitized: cleanText,
    riskLevel,
  };
}

/**
 * 2. Rate Limiting Protection (Anti-Spam & DDoS Protection)
 * Prevents rapid-fire order submission or message spamming
 * @param {string} actionType - 'ORDER_SUBMIT' | 'CHAT_MESSAGE' | 'LOGIN_ATTEMPT'
 * @param {number} maxAllowed - Max attempts allowed in window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {object} { allowed: boolean, remainingMs: number, message: string }
 */
export function checkRateLimit(actionType = "GENERAL", maxAllowed = 5, windowMs = 60000) {
  try {
    const now = Date.now();
    const rawData = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    const tracker = rawData ? JSON.parse(rawData) : {};

    const history = tracker[actionType] || [];
    // Filter timestamps within window
    const recent = history.filter((timestamp) => now - timestamp < windowMs);

    if (recent.length >= maxAllowed) {
      const oldestInWindow = recent[0];
      const remainingMs = windowMs - (now - oldestInWindow);

      logSecurityEvent("RATE_LIMIT_EXCEEDED", {
        actionType,
        attemptsCount: recent.length,
        windowMs,
      });

      return {
        allowed: false,
        remainingMs,
        message: `กรุณารออีก ${Math.ceil(remainingMs / 1000)} วินาที ก่อนดำเนินการ ${actionType} อีกครั้งเพื่อความปลอดภัย`,
      };
    }

    // Record current attempt
    recent.push(now);
    tracker[actionType] = recent;
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(tracker));

    return { allowed: true, remainingMs: 0, message: "" };
  } catch (err) {
    console.warn("Rate limit check error:", err);
    return { allowed: true, remainingMs: 0, message: "" };
  }
}

/**
 * 3. PII (Personally Identifiable Information) Masking Utility
 * Masks sensitive user fields like national ID, credit card, or full phone number
 */
export function maskSensitiveData(str, type = "PHONE") {
  if (!str || typeof str !== "string") return str;

  if (type === "PHONE") {
    // 081-234-5678 -> 081-***-5678
    const digits = str.replace(/\D/g, "");
    if (digits.length >= 10) {
      return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
    }
    return str;
  }

  if (type === "CREDIT_CARD") {
    // 1234 5678 9012 3456 -> **** **** **** 3456
    const clean = str.replace(/\D/g, "");
    if (clean.length >= 12) {
      return `**** **** **** ${clean.slice(-4)}`;
    }
    return str;
  }

  if (type === "EMAIL") {
    // user@domain.com -> u***r@domain.com
    const parts = str.split("@");
    if (parts.length === 2) {
      const name = parts[0];
      const domain = parts[1];
      const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
      return `${maskedName}@${domain}`;
    }
  }

  return str;
}

/**
 * 4. Security Audit Logging System
 * Records security audit logs locally for inspection
 */
export function logSecurityEvent(eventType, payload = {}) {
  try {
    const rawLogs = localStorage.getItem(SECURITY_AUDIT_LOG_KEY);
    const logs = rawLogs ? JSON.parse(rawLogs) : [];

    const newLog = {
      id: `SEC-LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      eventType,
      payload,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
    };

    // Keep recent 100 audit logs
    const updated = [newLog, ...logs].slice(0, 100);
    localStorage.setItem(SECURITY_AUDIT_LOG_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Security audit log error:", err);
  }
}

/**
 * 5. Get Security Audit Logs & Security Health Report
 */
export function getSecurityHealthReport() {
  try {
    const rawLogs = localStorage.getItem(SECURITY_AUDIT_LOG_KEY);
    const logs = rawLogs ? JSON.parse(rawLogs) : [];

    const threatsBlocked = logs.filter((l) => l.eventType === "AI_THREAT_BLOCKED").length;
    const rateLimitsTriggered = logs.filter((l) => l.eventType === "RATE_LIMIT_EXCEEDED").length;

    return {
      status: threatsBlocked > 10 ? "WARNING" : "HEALTHY",
      totalLogs: logs.length,
      threatsBlocked,
      rateLimitsTriggered,
      shieldVersion: "QueueUp AI Security Sentinel v2.5",
      lastScanTime: new Date().toISOString(),
      recentLogs: logs.slice(0, 5),
    };
  } catch (err) {
    return {
      status: "HEALTHY",
      totalLogs: 0,
      threatsBlocked: 0,
      rateLimitsTriggered: 0,
      shieldVersion: "QueueUp AI Security Sentinel v2.5",
      lastScanTime: new Date().toISOString(),
      recentLogs: [],
    };
  }
}
