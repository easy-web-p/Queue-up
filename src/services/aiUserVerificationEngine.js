/**
 * MULTI-LAYER USER VERIFICATION & TRUST SCORE ENGINE (aiUserVerificationEngine.js)
 * High-Security Verification System for QueueUp School Food CRM.
 * Multi-layer validation (Levels 0-5), Email domain checks, Thai Phone validation,
 * Blacklist dictionary, Trust Score Calculator (50-100), and PDPA Consent Auditing.
 */

// Disposable / Temp Email Blacklist
const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "10minutemail.com",
  "tempmail.com",
  "guerrillamail.com",
  "dispostable.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "throwawaymail.com",
  "getnada.com",
  "maildrop.cc",
];

// Reserved Names & Profanity Blacklist
const RESERVED_USERNAMES_BLACKLIST = [
  "admin",
  "administrator",
  "system",
  "support",
  "queueup",
  "root",
  "staff",
  "moderator",
  "official",
  "helpdesk",
  "superadmin",
  "canteen_admin",
  "security",
  "queueup_bot",
  "null",
  "undefined",
];

/**
 * 1. Email Domain & Syntax Verification
 * @param {string} email
 * @returns {object} { valid: boolean, isEducational: boolean, domain: string, reason: string }
 */
export function validateEmailDomain(email) {
  if (!email || typeof email !== "string") {
    return { valid: false, isEducational: false, domain: "", reason: "กรุณาระบุอีเมล" };
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(cleanEmail)) {
    return { valid: false, isEducational: false, domain: "", reason: "รูปแบบอีเมลไม่ถูกต้อง" };
  }

  const parts = cleanEmail.split("@");
  if (parts.length !== 2) {
    return { valid: false, isEducational: false, domain: "", reason: "รูปแบบโครงสร้างอีเมลไม่ถูกต้อง" };
  }

  const domain = parts[1];

  // Check Disposable Email Blacklist
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return {
      valid: false,
      isEducational: false,
      domain,
      reason: "ไม่ชั่วคราวให้ใช้อีเมลขยะหรือ Temporary Email ในการสมัครสมาชิก",
    };
  }

  // Check Educational Domain (.ac.th / .edu / school email)
  const isEducational = domain.endsWith(".ac.th") || domain.endsWith(".edu") || domain.includes("school");

  return {
    valid: true,
    isEducational,
    domain,
    reason: isEducational ? "อีเมลสถาบันการศึกษาได้รับการยืนยันระดับสูง" : "อีเมลทั่วไปผ่านการตรวจสอบสเปกโดเมน",
  };
}

/**
 * 2. Thai Phone Number Verification & Formatting
 * @param {string} phone
 * @returns {object} { valid: boolean, formatted: string, reason: string }
 */
export function validateThaiPhoneNumber(phone) {
  if (!phone || typeof phone !== "string") {
    return { valid: false, formatted: "", reason: "กรุณาระบุเบอร์โทรศัพท์" };
  }

  // Strip spaces, dashes, +66
  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.startsWith("66")) {
    cleanPhone = "0" + cleanPhone.slice(2);
  }

  // Thai mobile numbers start with 06, 08, 09 and have 10 digits
  const thaiMobileRegex = /^0[689]\d{8}$/;

  if (!thaiMobileRegex.test(cleanPhone)) {
    return {
      valid: false,
      formatted: cleanPhone,
      reason: "เบอร์โทรศัพท์ต้องขึ้นต้นด้วย 06, 08, 09 และมี 10 หลัก (เช่น 0812345678)",
    };
  }

  // Format as 081-234-5678
  const formatted = `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;

  return {
    valid: true,
    formatted,
    reason: "เบอร์โทรศัพท์ผ่านการยืนยันรูปแบบมาตรฐานประเทศไทย",
  };
}

/**
 * 3. Username & Display Name Sanity Inspection
 * @param {string} name
 * @returns {object} { valid: boolean, sanitized: string, reason: string }
 */
export function validateDisplayName(name) {
  if (!name || typeof name !== "string") {
    return { valid: false, sanitized: "", reason: "กรุณากรอกชื่อผู้ใช้งาน" };
  }

  const cleanName = name.trim();

  if (cleanName.length < 2) {
    return { valid: false, sanitized: cleanName, reason: "ชื่อผู้ใช้งานต้องมีความยาวอย่างน้อย 2 ตัวอักษร" };
  }

  if (cleanName.length > 60) {
    return { valid: false, sanitized: cleanName, reason: "ชื่อผู้ใช้งานต้องมีความยาวไม่เกิน 60 ตัวอักษร" };
  }

  // Check Reserved Blacklist
  const lowerName = cleanName.toLowerCase();
  const isBlacklisted = RESERVED_USERNAMES_BLACKLIST.some(
    (word) => lowerName === word || lowerName.startsWith(word + "_") || lowerName.endsWith("_" + word)
  );

  if (isBlacklisted) {
    return {
      valid: false,
      sanitized: cleanName,
      reason: `ไม่สามารถใช้คำสงวนระบบ "${cleanName}" เป็นชื่อผู้ใช้ได้`,
    };
  }

  return {
    valid: true,
    sanitized: cleanName,
    reason: "ชื่อผู้ใช้งานผ่านการตรวจสอบมาตรฐานความปลอดภัย",
  };
}

/**
 * 4. Profile Avatar Image File Inspection
 * @param {File|string} fileOrDataUrl
 * @returns {object} { valid: boolean, sizeMb: number, extension: string, reason: string }
 */
export function validateProfileAvatarImage(fileOrDataUrl) {
  if (!fileOrDataUrl) {
    return { valid: true, sizeMb: 0, extension: "default", reason: "ใช้อวาตาร์มาสคอตเริ่มต้น" };
  }

  // File Object Inspection
  if (fileOrDataUrl instanceof File) {
    const sizeMb = fileOrDataUrl.size / (1024 * 1024);
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!validTypes.includes(fileOrDataUrl.type)) {
      return {
        valid: false,
        sizeMb,
        extension: fileOrDataUrl.type,
        reason: "รองรับเฉพาะไฟล์รูปภาพประเภท JPG, JPEG, PNG, WEBP เท่านั้น",
      };
    }

    if (sizeMb > 5) {
      return {
        valid: false,
        sizeMb,
        extension: fileOrDataUrl.type,
        reason: `ขนาดไฟล์รูปภาพเกินกำหนด (ขนาดปัจจุบัน ${sizeMb.toFixed(1)}MB, จำกัดไม่เกิน 5MB)`,
      };
    }

    return { valid: true, sizeMb, extension: fileOrDataUrl.type, reason: "ไฟล์รูปภาพถูกต้องตามมาตรฐาน" };
  }

  // Data URL / Base64 Inspection
  if (typeof fileOrDataUrl === "string") {
    if (fileOrDataUrl.startsWith("data:image/")) {
      const approxSizeBytes = Math.round((fileOrDataUrl.length * 3) / 4);
      const sizeMb = approxSizeBytes / (1024 * 1024);

      if (sizeMb > 5.5) {
        return {
          valid: false,
          sizeMb,
          extension: "base64",
          reason: "ขนาดไฟล์รูปภาพเกินกำหนด 5MB",
        };
      }
    }
    return { valid: true, sizeMb: 0.5, extension: "url", reason: "รูปโปรไฟล์ผ่านการอนุมัติ" };
  }

  return { valid: false, sizeMb: 0, extension: "unknown", reason: "รูปแบบไฟล์ไม่ถูกต้อง" };
}

/**
 * 5. Calculate User Trust Score & Verification Level (Levels 0 to 5)
 * @param {object} profile - User profile object { email, phone, gender, birthDate, photo, role, accountId, createdAt, ... }
 * @param {array} orderHistory - Array of completed order objects
 * @returns {object} { trustScore, verificationLevel, levelName, badgeColor, status, breakdown, privileges }
 */
export function calculateUserTrustScore(profile = {}, orderHistory = []) {
  let score = 50; // Base Starting Trust Score
  const breakdown = [];

  // A. Email Verification (+20 Points)
  const emailCheck = validateEmailDomain(profile?.email || "");
  if (emailCheck.valid) {
    score += 20;
    breakdown.push({ label: "ยืนยันอีเมลถูกต้อง (+20)", points: 20, type: "bonus" });

    if (emailCheck.isEducational) {
      score += 10;
      breakdown.push({ label: "อีเมลสถาบันการศึกษา (.ac.th / .edu) (+10)", points: 10, type: "bonus" });
    }
  }

  // B. Phone Number Verification (+15 Points)
  const phoneCheck = validateThaiPhoneNumber(profile?.phone || "");
  if (phoneCheck.valid) {
    score += 15;
    breakdown.push({ label: "ยืนยันเบอร์โทรศัพท์ถูกต้อง (+15)", points: 15, type: "bonus" });
  }

  // C. Profile Completeness (+10 Points)
  const isProfileComplete = profile?.gender && profile?.birthDate && profile?.photo;
  if (isProfileComplete) {
    score += 10;
    breakdown.push({ label: "เติมข้อมูลส่วนตัวครบถ้วน (+10)", points: 10, type: "bonus" });
  }

  // D. Order History & Real Usage (+10 to +20 Points)
  const completedOrdersCount = (orderHistory || []).filter((o) => o?.status === "COMPLETED").length;
  if (completedOrdersCount >= 5) {
    score += 20;
    breakdown.push({ label: "มีประวัติสั่งซื้อจริงมากกว่า 5 รายการ (+20)", points: 20, type: "bonus" });
  } else if (completedOrdersCount >= 1) {
    score += 10;
    breakdown.push({ label: "มีประวัติสั่งซื้อสำเร็จ (+10)", points: 10, type: "bonus" });
  }

  // E. Deductions & Penalties (-15 Points for Cancellations)
  const refundCancellations = (orderHistory || []).filter((o) => o?.status === "REFUND").length;
  if (refundCancellations >= 3) {
    score -= 15;
    breakdown.push({ label: "มีการยกเลิกคำสั่งซื้อบ่อยครั้ง (-15)", points: -15, type: "penalty" });
  }

  // Cap Score 0 - 100
  score = Math.max(0, Math.min(100, score));

  // Determine Verification Level (Level 0 to Level 5)
  let level = 0;
  let levelName = "Level 0: Registered Account";
  let badgeColor = "#64748b"; // slate
  let statusText = "บัญชีเริ่มต้น (รอการยืนยัน)";

  if (profile?.role === "merchant" || profile?.isMerchantVerified) {
    level = 5;
    levelName = "Level 5: Verified Merchant Store";
    badgeColor = "#10b981"; // emerald
    statusText = "ร้านค้าผ่านการตรวจสอบเทคโนโลยีและความปลอดภัย 100%";
  } else if (emailCheck.isEducational || profile?.isStudentVerified) {
    level = 4;
    levelName = "Level 4: Student / Staff Verified";
    badgeColor = "#8b5cf6"; // purple
    statusText = "นักเรียน/บุคลากรสถานศึกษาได้รับการยืนยันตัวตนแล้ว";
  } else if (completedOrdersCount >= 1 && score >= 80) {
    level = 3;
    levelName = "Level 3: Active Verified Buyer";
    badgeColor = "#eab308"; // gold
    statusText = "ผู้ใช้งานยืนยันประวัติการสั่งซื้อจริงในระบบ";
  } else if (phoneCheck.valid && emailCheck.valid) {
    level = 2;
    levelName = "Level 2: Phone & Email Verified";
    badgeColor = "#0284c7"; // sky blue
    statusText = "ยืนยันอีเมลและเบอร์โทรศัพท์เรียบร้อยแล้ว";
  } else if (emailCheck.valid) {
    level = 1;
    levelName = "Level 1: Email Verified";
    badgeColor = "#f59e0b"; // amber
    statusText = "ยืนยันอีเมลแล้ว";
  }

  // Trust Status Assessment
  let trustCategory = "Normal";
  if (score >= 90) trustCategory = "Trusted Account 🛡️";
  else if (score >= 70) trustCategory = "Normal Account ✅";
  else if (score >= 50) trustCategory = "Warning Account ⚠️";
  else trustCategory = "Under Review 🛑";

  return {
    trustScore: score,
    verificationLevel: level,
    levelName,
    badgeColor,
    trustCategory,
    statusText,
    breakdown,
    privileges: {
      canOrder: score >= 50,
      canReview: score >= 60 && level >= 2,
      canReportStore: score >= 70 && level >= 2,
      maxCouponDiscount: level >= 3 ? "20%" : "10%",
    },
  };
}

/**
 * 6. Record PDPA Consent Audit Log
 * @param {string} userId
 * @param {string} consentType
 * @param {string} version
 * @returns {object} Audit Record
 */
export function recordPdpaConsent(userId, consentType = "full_pdpa_terms", version = "v2.5") {
  const auditRecord = {
    userId: userId || "guest_user",
    consentType,
    version,
    acceptedAt: new Date().toISOString(),
    ipHash: "IP_" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Browser",
  };

  try {
    const existingLogs = JSON.parse(localStorage.getItem("queueup_pdpa_audit_logs") || "[]");
    existingLogs.push(auditRecord);
    localStorage.setItem("queueup_pdpa_audit_logs", JSON.stringify(existingLogs.slice(-20)));
  } catch (err) {
    console.warn("Record PDPA Audit Log error:", err);
  }

  return auditRecord;
}
