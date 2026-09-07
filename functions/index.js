import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { resolveWalletAuthority, isStaffOrAdmin, MAX_TOPUP_SATANG } from "./walletAuthority.js";
import { resolveSpendingCounters } from "./walletLimits.js";
import { scanOrderForAllergens } from "./allergenGuard.js";
import { resolveLinkDecision, LINK_DECISIONS } from "./linkReview.js";
import { validatePilotLead, rateLimitKeyForAddress } from "./pilotLead.js";

// 🔒 Server-only credential. Never expose this through a VITE_* variable: Vite inlines
// those into the client bundle. Set with: firebase functions:secrets:set OPENAI_API_KEY
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const ASSISTANT_MAX_MESSAGE_CHARS = 500;
// Server-side quota for the OpenAI proxy. The client-side limiter in
// aiSecurityShield.js lives in localStorage and the user can simply clear it, so it
// cannot protect a credential that bills per call. This one is authoritative.
const ASSISTANT_MAX_CALLS_PER_WINDOW = 15;
const ASSISTANT_RATE_WINDOW_MS = 60000;
const ASSISTANT_MAX_STORE_NAME_CHARS = 120;

initializeApp();
const db = getFirestore();
const authAdmin = getAuth();

/**
 * ============================================================================
 * QUEUEUP & QUEUEUP FOR CAMPUS CLOUD FUNCTIONS
 * Direct Food Ordering, Authoritative Order Creation & Queue Issuance
 * Student Vendor Workflow, Campus Wallet & Emergency Medical Protocols
 * ============================================================================
 */

function isValidCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month && d.getUTCDate() === day;
}

function getBangkokCurrentTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getBangkokYmd(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = formatter.format(date);
  const ymdClean = ymd.replace(/-/g, "");

  const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", weekday: "short" });
  const weekdayShort = dayFormatter.format(date).toLowerCase();
  const weekdayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const dayOfWeekIndex = weekdayMap[weekdayShort] ?? 0;

  return { ymd, ymdClean, dayOfWeekIndex };
}

/**
 * Guards any operation acting on `studentId`'s wallet on behalf of the caller.
 * Throws HttpsError unless the caller is staff/admin or a school-verified guardian.
 * See walletAuthority.js for the rules themselves.
 */
async function assertWalletAuthority(auth, studentId, { allowSelf, action }) {
  const decision = await resolveWalletAuthority(db, auth, studentId, { allowSelf });

  if (decision.allowed) {
    return decision.role;
  }

  if (decision.reason === "SELF_SERVICE_FORBIDDEN") {
    throw new HttpsError(
      "permission-denied",
      `SELF_SERVICE_FORBIDDEN: นักเรียนไม่สามารถ${action}ให้ตนเองได้ กรุณาติดต่อผู้ปกครองหรือเจ้าหน้าที่โรงเรียน`
    );
  }

  throw new HttpsError(
    "permission-denied",
    `WALLET_AUTHORITY_REQUIRED: คุณไม่มีสิทธิ์${action}สำหรับนักเรียนรายนี้ (ต้องเป็นผู้ปกครองที่โรงเรียนยืนยันแล้ว หรือเจ้าหน้าที่)`
  );
}

/**
 * Fixed-window per-user quota, applied atomically so parallel calls cannot both read
 * the same count and each decide they are under the limit.
 */
async function consumeRateLimit(uid, { collection, maxCalls, windowMs, message }) {
  const ref = db.collection(collection).doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : {};

    const windowIsCurrent =
      typeof data.windowStart === "number" && now - data.windowStart < windowMs;
    const windowStart = windowIsCurrent ? data.windowStart : now;
    const count = windowIsCurrent ? Number(data.count) || 0 : 0;

    if (count >= maxCalls) {
      const retryInSec = Math.ceil((windowStart + windowMs - now) / 1000);
      throw new HttpsError("resource-exhausted", `${message} (ลองใหม่ในอีก ${retryInSec} วินาที)`);
    }

    tx.set(ref, { windowStart, count: count + 1, updatedAt: FieldValue.serverTimestamp() });
  });
}

/**
 * 🏫 Pilot Programme Lead Capture (public, unauthenticated)
 *
 * The landing page form previously did nothing but console.log(): the school was
 * shown "บันทึกข้อมูลเรียบร้อยแล้ว" and promised a callback within 24 hours, and
 * every lead was discarded. This is the only inbound channel the product has.
 *
 * Deliberately callable without sign-in — a school evaluating the product has no
 * account yet, and requiring one to ask for a demo is the same as having no form.
 * That makes it the app's only unauthenticated write path, so:
 *
 *  - the payload is validated and re-built field by field, never spread, so an
 *    unexpected key cannot reach the document;
 *  - submissions are rate limited per caller address, since there is no uid to
 *    key a quota on and nothing else stops a script filling the collection;
 *  - `pilot_leads` is closed to every client in firestore.rules (admin read,
 *    no client write), so the contact details the page promises to keep
 *    confidential are never readable or writable from a browser.
 */
export const submitPilotLead = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    const validation = validatePilotLead(request.data);
    if (!validation.ok) {
      throw new HttpsError("invalid-argument", `${validation.reason}: ${validation.message}`);
    }

    // rawRequest.ip is Express's view of the caller; behind a proxy it can be
    // absent, in which case rateLimitKeyForAddress buckets them together rather
    // than letting them past the limit.
    const callerKey = rateLimitKeyForAddress(request.rawRequest?.ip);
    await consumeRateLimit(callerKey, {
      collection: "pilot_lead_rate_limits",
      maxCalls: 5,
      windowMs: 60 * 60 * 1000,
      message: "ส่งคำขอบ่อยเกินไป กรุณาติดต่อเราทางโทรศัพท์หรืออีเมลโดยตรง",
    });

    const ref = await db.collection("pilot_leads").add({
      ...validation.lead,
      status: "NEW",
      source: "landing_page_pilot_form",
      submittedByUid: request.auth?.uid || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // No lead content in the log line: this collection exists precisely so the
    // school's contact details live in one controlled place.
    console.log(`[QueueUp] Pilot lead recorded: ${ref.id}`);

    return { success: true, leadId: ref.id };
  }
);

/**
 * 🔒 Server-Authoritative Order Creation (5-Phase Ordering with Campus Wallet support)
 */
export const createOrderAuthoritative = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    // 1. Authentication Guard
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนทำการสั่งจองอาหาร");
    }

    const authUid = request.auth.uid;
    const {
      storeId,
      userId,
      customerName,
      customerPhone,
      items,
      pickupTime,
      pickupDate,
      paymentMode, // 'CAMPUS_WALLET' | 'DIRECT_ZERO_PAYMENT'
      studentId,   // Required if paymentMode === 'CAMPUS_WALLET'
      acknowledgeAllergenWarning, // set after the caller confirms an ALLERGEN_ALERT
    } = request.data || {};

    if (userId && userId !== authUid && request.auth.token?.admin !== true) {
      throw new HttpsError("permission-denied", "ไม่สามารถสร้างคำสั่งซื้อในนามของผู้ใช้อื่นได้");
    }

    const effectiveUserId = authUid;

    // 2. Strict Input Validation
    if (!storeId || typeof storeId !== "string" || !storeId.trim()) {
      throw new HttpsError("invalid-argument", "STORE_ID_REQUIRED: ไม่พบรหัสร้านค้า");
    }
    if (!customerPhone || typeof customerPhone !== "string" || !customerPhone.trim()) {
      throw new HttpsError("invalid-argument", "CUSTOMER_PHONE_REQUIRED: กรุณาระบุเบอร์โทรศัพท์สำหรับรับการแจ้งเตือนคิว");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpsError("invalid-argument", "ORDER_ITEMS_EMPTY: รายการอาหารในคำสั่งซื้อว่างเปล่า");
    }
    if (!pickupTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(pickupTime).trim())) {
      throw new HttpsError("invalid-argument", "INVALID_PICKUP_TIME_FORMAT: รูปแบบเวลารับอาหารไม่ถูกต้อง (ต้องเป็น HH:mm)");
    }

    const cleanPickupTime = String(pickupTime).trim();
    const now = new Date();
    const currentBangkok = getBangkokYmd(now);

    let targetYmd = currentBangkok.ymd;
    let targetYmdClean = currentBangkok.ymdClean;

    if (pickupDate) {
      const rawDate = String(pickupDate).trim();
      const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
      const isCleanDate = /^\d{8}$/.test(rawDate);
      if (!isIsoDate && !isCleanDate) {
        throw new HttpsError("invalid-argument", "INVALID_DATE_FORMAT: รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)");
      }
      const clean = rawDate.replace(/-/g, "");
      if (clean < currentBangkok.ymdClean) {
        throw new HttpsError("invalid-argument", "PAST_DATE_NOT_ALLOWED: ไม่สามารถเลือกวันที่ย้อนหลังได้");
      }
      targetYmd = isIsoDate ? rawDate : `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      targetYmdClean = clean;
    }

    const [pYear, pMonth, pDay] = targetYmd.split("-").map(Number);
    if (!isValidCalendarDate(pYear, pMonth, pDay)) {
      throw new HttpsError("invalid-argument", "INVALID_CALENDAR_DATE: วันที่ระบุไม่มีอยู่จริงในปฏิทิน");
    }
    const targetPickupDateObj = new Date(Date.UTC(pYear, pMonth - 1, pDay, 12, 0, 0));
    const targetBangkok = getBangkokYmd(targetPickupDateObj);

    // Strict same-day past pickup time validation
    if (targetYmdClean === currentBangkok.ymdClean) {
      const currentBangkokTime = getBangkokCurrentTime(now);
      if (cleanPickupTime <= currentBangkokTime) {
        throw new HttpsError("failed-precondition", `PAST_PICKUP_TIME_NOT_ALLOWED: เวลารับอาหาร (${cleanPickupTime} น.) ผ่านไปแล้วสำหรับวันนี้ (เวลาปัจจุบัน ${currentBangkokTime} น.)`);
      }
    }

    // Aggregate Product Quantities
    const productTotalQuantityMap = new Map();
    let totalOrderItemsCount = 0;

    for (const it of items) {
      if (!it.productId) {
        throw new HttpsError("invalid-argument", "PRODUCT_ID_REQUIRED: ทุกรายการต้องระบุ productId");
      }
      const qty = Number(it.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new HttpsError("invalid-argument", "INVALID_QUANTITY: จำนวนสินค้าต้องเป็นจำนวนเต็มบวก");
      }
      totalOrderItemsCount += qty;
      productTotalQuantityMap.set(it.productId, (productTotalQuantityMap.get(it.productId) || 0) + qty);
    }

    const isCampusWallet = paymentMode === "CAMPUS_WALLET";

    // 🔒 `studentId` is caller-supplied: without this check any signed-in user could
    // charge their own order to another student's wallet. Spending from a wallet that
    // is not your own requires a verified guardian link or a staff role.
    let effectiveStudentId = null;
    if (isCampusWallet) {
      effectiveStudentId =
        typeof studentId === "string" && studentId.trim() ? studentId.trim() : authUid;
      if (effectiveStudentId !== authUid) {
        await assertWalletAuthority(request.auth, effectiveStudentId, {
          allowSelf: true,
          action: "สั่งซื้อโดยใช้กระเป๋าเงิน",
        });
      }
    }

    try {
      return await db.runTransaction(async (tx) => {
        // ===================================================================
        // PHASE 0 & 1: READ ALL REQUIRED DOCUMENTS
        // ===================================================================
        const shopRef = db.collection("shops").doc(storeId);
        const shopSnap = await tx.get(shopRef);
        if (!shopSnap.exists) {
          throw new HttpsError("not-found", `STORE_NOT_FOUND: ร้านค้ารหัส ${storeId} ไม่มีอยู่ในระบบ`);
        }
        const shopData = shopSnap.data();

        // Optional Campus Wallet document
        let walletSnap = null;
        let walletRef = null;
        if (isCampusWallet && effectiveStudentId) {
          walletRef = db.collection("wallets").doc(effectiveStudentId);
          walletSnap = await tx.get(walletRef);
        }

        // Allergy profile for whoever the food is for. All reads must precede any
        // write in a transaction, so this is fetched here with the rest of Phase 1.
        const allergyProfileId = effectiveStudentId || authUid;
        const studentSnap = await tx.get(db.collection("students").doc(allergyProfileId));

        // Read all product documents
        const productSnapMap = new Map();
        const referencedModifierGroupIds = new Set();

        for (const prodId of productTotalQuantityMap.keys()) {
          const prodRef = db.collection("products").doc(prodId);
          const prodSnap = await tx.get(prodRef);
          if (!prodSnap.exists) {
            throw new HttpsError("not-found", `PRODUCT_NOT_FOUND: ไม่พบสินค้ารหัส ${prodId} ในระบบ`);
          }
          productSnapMap.set(prodId, prodSnap);
          const pData = prodSnap.data();
          if (Array.isArray(pData.modifierGroupIds)) {
            pData.modifierGroupIds.forEach((mgId) => referencedModifierGroupIds.add(mgId));
          }
        }

        // Add any modifierGroupIds selected in the request items
        for (const it of items) {
          if (Array.isArray(it.selectedModifiers)) {
            it.selectedModifiers.forEach((m) => {
              if (m.modifierGroupId) referencedModifierGroupIds.add(m.modifierGroupId);
            });
          }
        }

        // Read all referenced modifier groups
        const modifierGroupSnapMap = new Map();
        for (const mgId of referencedModifierGroupIds) {
          const modRef = db.collection("modifier_groups").doc(mgId);
          const modSnap = await tx.get(modRef);
          if (modSnap.exists) {
            modifierGroupSnapMap.set(mgId, modSnap);
          }
        }

        // Read Slot Capacity doc
        const cleanTime = cleanPickupTime.replace(":", "");
        const dateScopedSlotId = `slot_${storeId}_${targetYmdClean}_${cleanTime}`;
        const slotRef = db.collection("store_slots").doc(dateScopedSlotId);
        const slotSnap = await tx.get(slotRef);

        // Read Sequence Counter doc
        const counterDocId = `counter_${storeId}_${targetYmdClean}`;
        const counterRef = db.collection("queue_counters").doc(counterDocId);
        const counterSnap = await tx.get(counterRef);

        // ===================================================================
        // PHASE 2: VALIDATE BUSINESS RULES & CALCULATE AMOUNTS
        // ===================================================================
        // 2.1 Store Availability & Operating Hours
        if (shopData.isOpen === false || shopData.status === "closed") {
          throw new HttpsError("failed-precondition", "STORE_CLOSED: ร้านค้าปิดให้บริการชั่วคราว");
        }
        if (shopData.operationalOverride === "FORCE_CLOSE" || shopData.operationalOverride === "EMERGENCY_STOP") {
          throw new HttpsError("failed-precondition", "STORE_PAUSED: ร้านค้าหยุดรับออเดอร์ชั่วคราว");
        }

        if (shopData.operatingHours) {
          const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
          const targetDayName = days[targetBangkok.dayOfWeekIndex];
          const targetDaySchedule = shopData.operatingHours[targetDayName];

          if (targetDaySchedule) {
            if (!targetDaySchedule.isOpen) {
              throw new HttpsError("failed-precondition", `STORE_CLOSED_ON_DATE: ร้านค้าปิดทำการในวัน${targetDayName} (${targetYmd})`);
            }
            const { open, close } = targetDaySchedule;
            const isPickupAllowed =
              open <= close
                ? cleanPickupTime >= open && cleanPickupTime <= close
                : cleanPickupTime >= open || cleanPickupTime <= close;
            if (!isPickupAllowed) {
              throw new HttpsError("failed-precondition", `INVALID_PICKUP_TIME: เวลารับอาหาร ${cleanPickupTime} น. อยู่นอกเวลาทำการ (${open} - ${close})`);
            }
          }
        }

        // 2.2 Product Stock & Modifier Integrity
        for (const [prodId, requiredTotalQty] of productTotalQuantityMap.entries()) {
          const prodData = productSnapMap.get(prodId).data();
          if (prodData.storeId !== storeId) {
            throw new HttpsError("invalid-argument", `CROSS_STORE_PRODUCT_VIOLATION: สินค้า ${prodData.name} ไม่ได้เป็นของร้าน ${storeId}`);
          }
          if (prodData.isAvailable === false) {
            throw new HttpsError("failed-precondition", `PRODUCT_UNAVAILABLE: สินค้า ${prodData.name} ปิดรับออเดอร์ชั่วคราว`);
          }
          const currentStock = typeof prodData.stock === "number" ? prodData.stock : 0;
          if (currentStock < requiredTotalQty) {
            throw new HttpsError("failed-precondition", `INSUFFICIENT_STOCK: สินค้า "${prodData.name}" คงเหลือเพียง ${currentStock} ชุด (ต้องการ ${requiredTotalQty})`);
          }
        }

        let calculatedTotalSatang = 0;
        const validatedOrderItems = [];
        const itemCategories = new Set();
        // Menu text gathered for the allergen scan below. Built from the authoritative
        // product documents, not from anything the client sent.
        const allergenScanItems = [];

        for (const itemReq of items) {
          const prodData = productSnapMap.get(itemReq.productId).data();
          if (prodData.category) itemCategories.add(prodData.category);

          const basePriceSatang = prodData.priceSatang ?? Math.round((Number(prodData.price) || 0) * 100);
          let itemModifierSatang = 0;

          const selectedModifiers = itemReq.selectedModifiers || [];
          const allowedGroupIds = new Set(prodData.modifierGroupIds || []);
          const selectedModifierNames = [];

          // Validate linked required modifier groups
          if (Array.isArray(prodData.modifierGroupIds)) {
            for (const mgId of prodData.modifierGroupIds) {
              const modSnap = modifierGroupSnapMap.get(mgId);
              if (!modSnap || !modSnap.exists) {
                throw new HttpsError("not-found", `MODIFIER_GROUP_NOT_FOUND: ไม่พบกลุ่มตัวเลือก ${mgId} สำหรับเมนู "${prodData.name}"`);
              }
              const modData = modSnap.data();
              if (modData.storeId !== storeId) {
                throw new HttpsError("invalid-argument", `CROSS_STORE_MODIFIER_VIOLATION: กลุ่มตัวเลือก ${mgId} ไม่ได้เป็นของร้าน ${storeId}`);
              }
              const groupSelections = selectedModifiers.filter((m) => m.modifierGroupId === mgId);
              const minSelections = modData.minSelections ?? modData.minSelect ?? (modData.required || modData.isRequired ? 1 : 0);
              const maxSelections = modData.maxSelections ?? modData.maxSelect ?? (modData.selectionType === "single" ? 1 : null);
              const isSingle = modData.selectionType === "single" || modData.type === "single";

              // Check duplicate optionIds within group
              const optionIdsInGroup = groupSelections.map((m) => m.optionId);
              if (new Set(optionIdsInGroup).size !== optionIdsInGroup.length) {
                throw new HttpsError("invalid-argument", `DUPLICATE_MODIFIER_OPTION: กลุ่มตัวเลือก "${modData.name || mgId}" มีตัวเลือกซ้ำกัน`);
              }

              if (groupSelections.length < minSelections) {
                throw new HttpsError("invalid-argument", `REQUIRED_MODIFIER_MISSING: กรุณาเลือก ${modData.name || "ตัวเลือกที่จำเป็น"} อย่างน้อย ${minSelections} รายการ สำหรับเมนู "${prodData.name}"`);
              }
              if (maxSelections !== null && groupSelections.length > maxSelections) {
                throw new HttpsError("invalid-argument", `MAX_SELECTIONS_EXCEEDED: กลุ่มตัวเลือก "${modData.name}" เลือกได้สูงสุดไม่เกิน ${maxSelections} รายการ`);
              }
              if (isSingle && groupSelections.length > 1) {
                throw new HttpsError("invalid-argument", `SINGLE_SELECTION_VIOLATED: กลุ่มตัวเลือก "${modData.name}" สามารถเลือกได้เพียง 1 ตัวเลือกเท่านั้น`);
              }
            }
          }

          // Validate chosen modifier options
          if (selectedModifiers.length > 0) {
            for (const selMod of selectedModifiers) {
              if (!allowedGroupIds.has(selMod.modifierGroupId)) {
                throw new HttpsError("invalid-argument", `INVALID_PRODUCT_MODIFIER: กลุ่มตัวเลือก ${selMod.modifierGroupId} ไม่ได้เป็นของสินค้า "${prodData.name}"`);
              }
              const modSnap = modifierGroupSnapMap.get(selMod.modifierGroupId);
              if (!modSnap || !modSnap.exists) {
                throw new HttpsError("not-found", `MODIFIER_GROUP_NOT_FOUND: ไม่พบกลุ่มตัวเลือก ${selMod.modifierGroupId}`);
              }
              const modData = modSnap.data();
              const opt = (modData.options || []).find((o) => o.id === selMod.optionId);
              if (!opt) {
                throw new HttpsError("not-found", `OPTION_NOT_FOUND: ไม่พบตัวเลือก ${selMod.optionId}`);
              }
              if (opt.isOutOfStock) {
                throw new HttpsError("failed-precondition", `OPTION_OUT_OF_STOCK: ตัวเลือก "${opt.name}" หมดชั่วคราว`);
              }
              const optPriceSatang = opt.priceModifierSatang ?? Math.round((Number(opt.priceModifier) || 0) * 100);
              itemModifierSatang += optPriceSatang;
              if (opt.name) selectedModifierNames.push(String(opt.name));
            }
          }

          allergenScanItems.push({
            productId: itemReq.productId,
            name: prodData.name || "",
            category: prodData.category || "",
            description: prodData.description || "",
            modifierNames: selectedModifierNames,
            // Ingredients the store declared on the product. Read from Firestore, not
            // from the request, so a caller cannot clear the tags to dodge the check.
            declaredAllergens: Array.isArray(prodData.allergens) ? prodData.allergens : [],
          });

          const unitPriceSatang = basePriceSatang + itemModifierSatang;
          const subtotalSatang = unitPriceSatang * Number(itemReq.quantity);
          calculatedTotalSatang += subtotalSatang;

          validatedOrderItems.push({
            productId: itemReq.productId,
            name: prodData.name,
            category: prodData.category || "General",
            quantity: Number(itemReq.quantity),
            unitPriceSatang,
            unitPrice: unitPriceSatang / 100,
            subtotalSatang,
            subtotal: subtotalSatang / 100,
            customNotes: itemReq.customNotes || "",
            selectedModifiers,
          });
        }

        // 2.2b 🛡️ Allergen Guard
        //
        // Enforced here rather than only in the UI: src/utils/allergenMatcher.ts runs
        // in the browser, so calling the callable directly ordered straight past it.
        //
        // A hit blocks the order and reports what matched. The caller may retry with
        // acknowledgeAllergenWarning to proceed anyway, which the spec's "warn before
        // confirming" flow requires — matching is keyword-based and will sometimes
        // flag a dish that is actually safe. Every override is recorded on the order
        // and in audit_logs so a guardian or the school can see it happened.
        const studentAllergyProfile = studentSnap.exists ? studentSnap.data() : null;
        const studentAllergies = Array.isArray(studentAllergyProfile?.allergyInfo)
          ? studentAllergyProfile.allergyInfo
          : [];

        const allergenScan = scanOrderForAllergens(studentAllergies, allergenScanItems);

        if (allergenScan.hasAllergens && acknowledgeAllergenWarning !== true) {
          const allergenList = allergenScan.matchedAllergenNames.join(", ");
          const dishList = allergenScan.flaggedItems.map((f) => `"${f.name}"`).join(", ");
          // A store-declared ingredient is a fact about the recipe; a keyword match is
          // a guess from the name. Saying "อาจมี" for the former would understate it.
          const lead = allergenScan.hasDeclaredMatch
            ? `ALLERGEN_ALERT: ร้านค้าระบุว่าเมนู ${dishList} มีส่วนผสมที่แพ้ (${allergenList})`
            : `ALLERGEN_ALERT: เมนู ${dishList} อาจมีส่วนผสมที่แพ้ (${allergenList})`;
          throw new HttpsError(
            "failed-precondition",
            `${lead} กรุณาตรวจสอบกับร้านค้าก่อนยืนยันการสั่งซื้อ`,
            {
              code: "ALLERGEN_ALERT",
              matchedAllergenNames: allergenScan.matchedAllergenNames,
              hasDeclaredMatch: allergenScan.hasDeclaredMatch,
              flaggedItems: allergenScan.flaggedItems,
            }
          );
        }

        // 2.3 Campus Wallet Spending Rules Enforcement (Phase 0)
        let walletData = null;
        let walletCounters = null;
        if (isCampusWallet) {
          if (!walletSnap || !walletSnap.exists) {
            throw new HttpsError("not-found", "CAMPUS_WALLET_NOT_FOUND: ไม่พบบัญชีกระเป๋าเงินดิจิทัลสำหรับนักเรียน");
          }
          walletData = walletSnap.data();
          if (walletData.isLocked === true) {
            throw new HttpsError("failed-precondition", "CAMPUS_WALLET_LOCKED: กระเป๋าเงินถูกระงับการใช้งานชั่วคราวโดยผู้ปกครองหรือโรงเรียน");
          }

          const currentBalance = Number(walletData.balanceSatang) || 0;
          if (currentBalance < calculatedTotalSatang) {
            throw new HttpsError("failed-precondition", `INSUFFICIENT_WALLET_BALANCE: ยอดเงินในกระเป๋าไม่เพียงพอ (คงเหลือ ${currentBalance / 100} บาท, ยอดสั่งซื้อ ${calculatedTotalSatang / 100} บาท)`);
          }

          // Counters are keyed on the server's current Bangkok date, NOT on the
          // client-supplied pickup date — see walletLimits.js. Resolved once and
          // reused by the Phase 4 write below so the check and the increment can
          // never disagree about which period the spend belongs to.
          walletCounters = resolveSpendingCounters(walletData, currentBangkok.ymd);
          const { spentToday, spentThisWeek, dailyLimitSatang, weeklyLimitSatang } = walletCounters;

          // Fail-Closed: Guardian MUST configure limits before a student wallet can be used to purchase food
          if (dailyLimitSatang === null || weeklyLimitSatang === null) {
            throw new HttpsError(
              "failed-precondition",
              "WALLET_LIMITS_NOT_CONFIGURED: ผู้ปกครองยังไม่ได้ตั้งค่าวงเงินจำกัดการใช้จ่าย กรุณาตั้งค่าผ่าน Guardian Dashboard ก่อนทำรายการ"
            );
          }

          // Check Daily Limit
          if (spentToday + calculatedTotalSatang > dailyLimitSatang) {
            throw new HttpsError("failed-precondition", `DAILY_LIMIT_EXCEEDED: ยอดการใช้จ่ายเกินวงเงินรายวัน (${dailyLimitSatang / 100} บาท/วัน) วันนี้ใช้ไปแล้ว ${spentToday / 100} บาท`);
          }

          // Check Weekly Limit
          if (spentThisWeek + calculatedTotalSatang > weeklyLimitSatang) {
            throw new HttpsError("failed-precondition", `WEEKLY_LIMIT_EXCEEDED: ยอดการใช้จ่ายเกินวงเงินรายสัปดาห์ (${weeklyLimitSatang / 100} บาท/สัปดาห์) สัปดาห์นี้ใช้ไปแล้ว ${spentThisWeek / 100} บาท`);
          }

          // Check Blocked Categories
          const blockedCategories = Array.isArray(walletData.blockedCategories) ? walletData.blockedCategories : [];
          for (const cat of itemCategories) {
            if (blockedCategories.includes(cat)) {
              throw new HttpsError("failed-precondition", `BLOCKED_CATEGORY_VIOLATION: หมวดหมู่สินค้า "${cat}" ถูกจำกัดการซื้อโดยผู้ปกครอง`);
            }
          }
        }

        // 2.4 Slot Capacity (Fail-Closed)
        if (typeof shopData.maxOrdersPerSlot !== "number" || shopData.maxOrdersPerSlot <= 0) {
          throw new HttpsError("failed-precondition", "STORE_CAPACITY_NOT_CONFIGURED: ร้านค้ายังไม่ได้กำหนดขีดจำกัดโควตาคิวรับอาหาร");
        }
        const authoritativeCapacity = shopData.maxOrdersPerSlot;
        let currentSlotOrders = 0;
        if (slotSnap.exists) {
          const slotData = slotSnap.data();
          currentSlotOrders = Number(slotData.currentOrders) || 0;
        }
        if (currentSlotOrders + 1 > authoritativeCapacity) {
          throw new HttpsError("resource-exhausted", `SLOT_CAPACITY_EXCEEDED: รอบเวลารับอาหาร ${cleanPickupTime} น. ของวันที่ ${targetYmd} คิวเต็มแล้ว (${currentSlotOrders}/${authoritativeCapacity})`);
        }

        // 2.5 Queue Number Generation
        let sequenceNumber = 1;
        if (counterSnap.exists) {
          sequenceNumber = (Number(counterSnap.data().lastSequence) || 0) + 1;
        }
        const queueNumber = `Q${String(sequenceNumber).padStart(3, "0")}`;

        // ===================================================================
        // PHASE 3 & 4: WRITE ALL MUTATIONS ATOMICALLY (Including Wallet Deduction)
        // ===================================================================
        // Update product stock
        for (const [prodId, requiredTotalQty] of productTotalQuantityMap.entries()) {
          const prodRef = db.collection("products").doc(prodId);
          const prodData = productSnapMap.get(prodId).data();
          const currentStock = typeof prodData.stock === "number" ? prodData.stock : 0;
          tx.update(prodRef, {
            stock: currentStock - requiredTotalQty,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // Update slot capacity
        tx.set(
          slotRef,
          {
            slotId: dateScopedSlotId,
            storeId,
            date: targetYmd,
            timeSlot: cleanPickupTime,
            capacity: authoritativeCapacity,
            currentOrders: currentSlotOrders + 1,
            totalItemsReserved: (slotSnap.exists ? Number(slotSnap.data().totalItemsReserved || 0) : 0) + totalOrderItemsCount,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Update queue counter
        tx.set(
          counterRef,
          {
            storeId,
            date: targetYmd,
            lastSequence: sequenceNumber,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Create authoritative Order
        const orderDocRef = db.collection("orders").doc();
        const orderId = orderDocRef.id;

        const orderPayload = {
          id: orderId,
          orderId,
          storeId,
          userId: effectiveUserId,
          customerName: (customerName || "").trim() || "ลูกค้า QueueUp",
          customerPhone: customerPhone.trim(),
          queueNumber,
          status: "PENDING",
          queueStatus: "waiting",
          paymentMode: isCampusWallet ? "CAMPUS_WALLET" : "DIRECT_ZERO_PAYMENT",
          paymentStatus: isCampusWallet ? "PAID" : "NOT_APPLICABLE",
          studentId: effectiveStudentId,
          totalAmountSatang: calculatedTotalSatang,
          totalAmount: calculatedTotalSatang / 100,
          finalAmountSatang: calculatedTotalSatang,
          finalAmount: calculatedTotalSatang / 100,
          discountAppliedSatang: 0,
          pointsEarned: Math.floor(calculatedTotalSatang / 1000),
          items: validatedOrderItems,
          allergenWarningAcknowledged: allergenScan.hasAllergens,
          acknowledgedAllergenNames: allergenScan.matchedAllergenNames,
          pickupTime: cleanPickupTime,
          pickupDate: targetYmd,
          slotId: dateScopedSlotId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        tx.set(orderDocRef, orderPayload);

        // An order placed over an allergen warning is recorded in the same atomic
        // write as the order itself, so an override can never exist without its
        // audit entry. Guardians and staff can read what was overridden and why.
        if (allergenScan.hasAllergens) {
          const allergenAuditRef = db.collection("audit_logs").doc();
          tx.set(allergenAuditRef, {
            id: allergenAuditRef.id,
            action: "ALLERGEN_WARNING_OVERRIDDEN",
            actorUid: authUid,
            targetStudentId: allergyProfileId,
            orderId,
            storeId,
            matchedAllergenNames: allergenScan.matchedAllergenNames,
            // Overriding an ingredient the store declared is a materially more serious
            // act than overriding a name match, and the log should say which happened.
            hasDeclaredMatch: allergenScan.hasDeclaredMatch === true,
            flaggedItems: allergenScan.flaggedItems,
            timestamp: FieldValue.serverTimestamp(),
          });
        }

        // Phase 4: Atomic Wallet Deduction & Transaction Log
        if (isCampusWallet && walletRef && walletData && walletCounters) {
          const currentBal = Number(walletData.balanceSatang) || 0;

          // Same counters the limit check above ran on, stamped with the period keys
          // they belong to so the next order knows whether they are still current.
          tx.update(walletRef, {
            balanceSatang: currentBal - calculatedTotalSatang,
            spentTodaySatang: walletCounters.spentToday + calculatedTotalSatang,
            spentThisWeekSatang: walletCounters.spentThisWeek + calculatedTotalSatang,
            lastSpentDate: walletCounters.todayYmd,
            lastSpentWeek: walletCounters.weekKey,
            updatedAt: FieldValue.serverTimestamp(),
          });

          const txRef = db.collection("wallet_transactions").doc();
          tx.set(txRef, {
            id: txRef.id,
            walletId: effectiveStudentId,
            studentId: effectiveStudentId,
            orderId,
            amountSatang: calculatedTotalSatang,
            type: "SPEND",
            storeId,
            storeName: shopData.name || "Campus Store",
            actorUid: authUid,
            note: `ซื้ออาหารคิว ${queueNumber} ที่ร้าน ${shopData.name || storeId}`,
            timestamp: FieldValue.serverTimestamp(),
          });
        }

        return {
          success: true,
          orderId,
          queueNumber,
          totalAmountSatang: calculatedTotalSatang,
          totalAmountBaht: calculatedTotalSatang / 100,
          orderStatus: "PENDING",
          paymentMode: isCampusWallet ? "CAMPUS_WALLET" : "DIRECT_ZERO_PAYMENT",
          order: orderPayload,
        };
      });
    } catch (err) {
      console.error("[createOrderAuthoritative] Error:", err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message || "Failed to create authoritative order");
    }
  }
);

/**
 * 🔒 Record Merchant Audit Log (Server-Authoritative)
 *
 * Replaces client-side direct writes to `/audit_logs` which are blocked by
 * `allow write: if false;` in firestore.rules.
 *
 * Verifies caller authentication, whitelists permitted merchant actions,
 * ensures the caller is the store owner or admin, sanitizes and bounds
 * metadata, and appends an immutable record into `/audit_logs`.
 */
export const recordMerchantAuditLog = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated to record audit log.");
    }

    const { action, storeId, metadata = {} } = request.data || {};

    const ALLOWED_ACTIONS = ["REGISTER_MERCHANT", "UPDATE_STORE_PROFILE"];
    if (!action || typeof action !== "string" || !ALLOWED_ACTIONS.includes(action)) {
      throw new HttpsError("invalid-argument", `Action '${action}' is not permitted for merchant audit logging.`);
    }

    if (!storeId || typeof storeId !== "string") {
      throw new HttpsError("invalid-argument", "Valid storeId is required.");
    }

    // Verify ownership of the store in shops/{storeId}
    const shopSnap = await db.collection("shops").doc(storeId).get();
    if (!shopSnap.exists) {
      throw new HttpsError("not-found", `Shop document with id '${storeId}' was not found.`);
    }

    const shopData = shopSnap.data() || {};
    const isOwner = shopData.ownerUid === request.auth.uid;

    if (!isOwner) {
      // Check if caller is admin
      const callerUserSnap = await db.collection("users").doc(request.auth.uid).get();
      const isAdmin =
        callerUserSnap.exists &&
        (callerUserSnap.data().role === "admin" ||
          callerUserSnap.data().admin === true ||
          request.auth.token?.role === "admin");
      if (!isAdmin) {
        throw new HttpsError("permission-denied", "Only the store owner or admin can record audit logs for this store.");
      }
    }

    // Sanitize and bound metadata to prevent spam/abuse
    const safeMetadata = {};
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      for (const [key, val] of Object.entries(metadata)) {
        if (typeof key === "string" && key.length <= 50) {
          if (typeof val === "string") {
            safeMetadata[key] = val.slice(0, 500);
          } else if (typeof val === "number" || typeof val === "boolean") {
            safeMetadata[key] = val;
          }
        }
      }
    }

    const auditEntry = {
      action,
      actorUid: request.auth.uid,
      storeId,
      merchantId: shopData.merchantId || null,
      metadata: safeMetadata,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      serverTimestamp: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("audit_logs").add(auditEntry);

    return {
      success: true,
      logId: docRef.id,
    };
  }
);

/**
 * 🎓 Submit Vendor Approval Request (Student Entrepreneur Onboarding)
 */
export const submitVendorApprovalRequest = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนยื่นคำขอเปิดร้านค้า");
    }

    const {
      studentName,
      studentCode,
      class: studentClass,
      room,
      shopName,
      requestedZone,
      productCategories,
      menuPreview,
    } = request.data || {};

    if (!studentName || !studentCode || !shopName || !requestedZone) {
      throw new HttpsError("invalid-argument", "กรุณากรอกข้อมูลนักเรียนและข้อมูลร้านค้าให้ครบถ้วน");
    }

    const approvalDocRef = db.collection("vendor_approvals").doc();
    const payload = {
      id: approvalDocRef.id,
      studentVendorId: request.auth.uid,
      studentName: String(studentName).trim(),
      studentCode: String(studentCode).trim(),
      class: String(studentClass || "").trim(),
      room: String(room || "").trim(),
      shopName: String(shopName).trim(),
      requestedZone: String(requestedZone).trim(),
      productCategories: Array.isArray(productCategories) ? productCategories : ["Snacks"],
      menuPreview: Array.isArray(menuPreview) ? menuPreview : [],
      status: "PENDING",
      submittedAt: FieldValue.serverTimestamp(),
    };

    await approvalDocRef.set(payload);

    return {
      success: true,
      approvalId: approvalDocRef.id,
      message: "ยื่นคำขอเปิดร้านค้าสำเร็จ กรุณารออาจารย์หรือผู้รับผิดชอบโรงอาหารอนุมัติ",
    };
  }
);

/**
 * 👨‍🏫 Review Vendor Approval Request (Staff Supervisor / Admin Approval Panel)
 */
export const reviewVendorApprovalRequest = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนทำการตรวจสอบ");
    }

    const tokenRole = request.auth.token?.role;
    const isStaffOrAdmin = tokenRole === "staff_supervisor" || tokenRole === "admin" || request.auth.token?.admin === true;
    
    // Check in staff_supervisors collection if token role is not yet refreshed
    let isAuthorized = isStaffOrAdmin;
    if (!isAuthorized) {
      const staffDoc = await db.collection("staff_supervisors").doc(request.auth.uid).get();
      if (staffDoc.exists && staffDoc.data().canApproveVendors) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new HttpsError("permission-denied", "คุณไม่มีสิทธิ์ในการอนุมัติหรือปฏิเสธคำขอเปิดร้านค้า (ต้องเป็น Staff Supervisor หรือ Admin)");
    }

    const { approvalId, decision, rejectionReason } = request.data || {};
    if (!approvalId || !["APPROVED", "REJECTED"].includes(decision)) {
      throw new HttpsError("invalid-argument", "กรุณาระบุ approvalId และ decision ('APPROVED' หรือ 'REJECTED')");
    }

    const approvalRef = db.collection("vendor_approvals").doc(approvalId);
    const approvalSnap = await approvalRef.get();
    if (!approvalSnap.exists) {
      throw new HttpsError("not-found", "ไม่พบเอกสารคำขอนี้ในระบบ");
    }

    const approvalData = approvalSnap.data();
    const studentVendorId = approvalData.studentVendorId;

    if (decision === "APPROVED") {
      // 1. Update Approval Doc
      await approvalRef.update({
        status: "APPROVED",
        approvedBy: request.auth.uid,
        approvedByName: request.auth.token?.name || "อาจารย์ผู้ดูแลระบบ",
        approvedAt: FieldValue.serverTimestamp(),
      });

      // 2. Set Custom User Claims for student vendor role
      try {
        await authAdmin.setCustomUserClaims(studentVendorId, {
          role: "student_vendor",
        });
      } catch (err) {
        console.warn("[reviewVendorApprovalRequest] Warning setting custom claims:", err);
      }

      // 3. Ensure Shop Document is created and linked
      const shopDocRef = db.collection("shops").doc(`shop_${studentVendorId}`);
      await shopDocRef.set(
        {
          id: shopDocRef.id,
          name: approvalData.shopName,
          ownerUid: studentVendorId,
          ownerName: approvalData.studentName,
          zone: approvalData.requestedZone,
          status: "active",
          isOpen: true,
          maxOrdersPerSlot: 10,
          categories: approvalData.productCategories || ["Campus Snacks"],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 4. Update user profile role
      await db.collection("users").doc(studentVendorId).set(
        {
          role: "student_vendor",
          storeId: shopDocRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        success: true,
        status: "APPROVED",
        shopId: shopDocRef.id,
        message: "อนุมัติเปิดร้านค้าให้นักเรียนสำเร็จและเปิดใช้งานร้านเรียบร้อย",
      };
    } else {
      // REJECTED
      await approvalRef.update({
        status: "REJECTED",
        rejectionReason: rejectionReason || "ข้อมูลไม่ผ่านเกณฑ์การเปิดร้านในโรงเรียน",
        reviewedBy: request.auth.uid,
        reviewedAt: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        status: "REJECTED",
        message: "บันทึกผลการปฏิเสธคำขอเรียบร้อยแล้ว",
      };
    }
  }
);

/**
 * 👪 Review a Guardian ↔ Student Link (Staff Supervisor / Admin)
 *
 * The school's half of the two-way verification. A guardian asserts the
 * relationship by creating a `parent_child_links` row — firestore.rules lets any
 * signed-in user do that with `guardianId == uid` and status PENDING, and the
 * `verifiedByGuardian` flag on it is client-supplied — so nothing downstream trusts
 * a link until a staff supervisor has confirmed it here.
 *
 * Verifying also writes `guardianIds` onto the student and wallet documents. That
 * field is what firestore.rules reads to grant a guardian access, and until now
 * nothing in the system ever wrote it: a guardian could be linked and still be
 * unable to see their own child's wallet.
 *
 * decision:
 *   VERIFIED  - approve a PENDING link, granting access
 *   REJECTED  - decline a PENDING link
 *   REVOKED   - withdraw a previously VERIFIED link and remove the access it granted
 */
export const reviewParentChildLink = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนตรวจสอบคำขอผูกบัญชี");
    }

    if (!(await isStaffOrAdmin(db, request.auth))) {
      throw new HttpsError(
        "permission-denied",
        "LINK_REVIEW_FORBIDDEN: เฉพาะเจ้าหน้าที่ผู้ดูแลหรือผู้ดูแลระบบเท่านั้นที่ยืนยันการผูกบัญชีผู้ปกครองได้"
      );
    }

    const { linkId, decision, note } = request.data || {};
    if (!linkId || typeof linkId !== "string") {
      throw new HttpsError("invalid-argument", "กรุณาระบุ linkId");
    }
    if (!LINK_DECISIONS.includes(decision)) {
      throw new HttpsError(
        "invalid-argument",
        "กรุณาระบุ decision ('VERIFIED', 'REJECTED' หรือ 'REVOKED')"
      );
    }

    const linkRef = db.collection("parent_child_links").doc(linkId);

    return await db.runTransaction(async (tx) => {
      const linkSnap = await tx.get(linkRef);
      if (!linkSnap.exists) {
        throw new HttpsError("not-found", "ไม่พบคำขอผูกบัญชีนี้ในระบบ");
      }

      const link = linkSnap.data();
      const { guardianId, studentId } = link;
      if (!guardianId || !studentId) {
        throw new HttpsError("failed-precondition", "LINK_MALFORMED: คำขอผูกบัญชีไม่มี guardianId หรือ studentId");
      }

      const currentStatus = link.status || "PENDING";
      const outcome = resolveLinkDecision(currentStatus, decision);
      if (!outcome.ok) {
        const messages = {
          REVOKE_REQUIRES_VERIFIED: "REVOKE_REQUIRES_VERIFIED: เพิกถอนได้เฉพาะคำขอที่ยืนยันแล้วเท่านั้น",
          LINK_ALREADY_REVIEWED: `LINK_ALREADY_REVIEWED: คำขอนี้ถูกตรวจสอบไปแล้ว (สถานะปัจจุบัน: ${currentStatus})`,
        };
        throw new HttpsError("failed-precondition", messages[outcome.reason] || outcome.reason);
      }

      const reviewerUid = request.auth.uid;
      const reviewerName = request.auth.token?.name || request.auth.token?.email || "เจ้าหน้าที่ผู้ดูแล";
      const studentRef = db.collection("students").doc(studentId);
      const walletRef = db.collection("wallets").doc(studentId);

      if (outcome.grantsAccess) {
        tx.update(linkRef, {
          status: outcome.nextStatus,
          verifiedBySchool: true,
          verifiedBy: reviewerUid,
          verifiedByName: reviewerName,
          verifiedAt: FieldValue.serverTimestamp(),
          reviewNote: typeof note === "string" ? note.slice(0, 500) : "",
        });

        // arrayUnion is idempotent, so a re-link after a revocation is safe.
        tx.set(studentRef, { guardianIds: FieldValue.arrayUnion(guardianId) }, { merge: true });
        tx.set(
          walletRef,
          { studentId, guardianIds: FieldValue.arrayUnion(guardianId) },
          { merge: true }
        );
      } else if (outcome.revokesAccess) {
        tx.update(linkRef, {
          status: outcome.nextStatus,
          verifiedBySchool: false,
          revokedBy: reviewerUid,
          revokedAt: FieldValue.serverTimestamp(),
          reviewNote: typeof note === "string" ? note.slice(0, 500) : "",
        });

        // Withdraw the access the approval granted, or revocation is cosmetic.
        tx.set(studentRef, { guardianIds: FieldValue.arrayRemove(guardianId) }, { merge: true });
        tx.set(walletRef, { guardianIds: FieldValue.arrayRemove(guardianId) }, { merge: true });
      } else {
        tx.update(linkRef, {
          status: outcome.nextStatus,
          verifiedBySchool: false,
          reviewedBy: reviewerUid,
          reviewedAt: FieldValue.serverTimestamp(),
          reviewNote: typeof note === "string" ? note.slice(0, 500) : "",
        });
      }

      // Who may see a child's wallet and health record is worth an audit trail.
      const auditRef = db.collection("audit_logs").doc();
      tx.set(auditRef, {
        id: auditRef.id,
        action: `PARENT_CHILD_LINK_${decision}`,
        actorUid: reviewerUid,
        actorName: reviewerName,
        linkId,
        guardianId,
        targetStudentId: studentId,
        previousStatus: currentStatus,
        note: typeof note === "string" ? note.slice(0, 500) : "",
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        linkId,
        status: outcome.nextStatus,
        message:
          decision === "VERIFIED"
            ? "ยืนยันการผูกบัญชีผู้ปกครองเรียบร้อย ผู้ปกครองเข้าถึงข้อมูลของนักเรียนได้แล้ว"
            : decision === "REVOKED"
              ? "เพิกถอนสิทธิ์ผู้ปกครองเรียบร้อย ผู้ปกครองไม่สามารถเข้าถึงข้อมูลของนักเรียนได้อีก"
              : "บันทึกการปฏิเสธคำขอผูกบัญชีเรียบร้อย",
      };
    });
  }
);

/**
 * 💳 Top-up Campus Wallet (Staff or Guardian)
 */
export const topupCampusWallet = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนทำรายการเติมเงิน");
    }

    const { studentId, amountSatang, note, paymentMethod } = request.data || {};
    const amt = Number(amountSatang);
    if (!studentId || typeof studentId !== "string" || !Number.isInteger(amt) || amt <= 0) {
      throw new HttpsError("invalid-argument", "กรุณาระบุ studentId และจำนวนเงิน (Satang) ที่ถูกต้อง");
    }
    if (amt > MAX_TOPUP_SATANG) {
      throw new HttpsError(
        "invalid-argument",
        `TOPUP_AMOUNT_TOO_LARGE: เติมเงินได้สูงสุด ${MAX_TOPUP_SATANG / 100} บาทต่อรายการ`
      );
    }

    // 🔒 Credits balance with no payment capture, so it must never be self-service.
    const actorRole = await assertWalletAuthority(request.auth, studentId, {
      allowSelf: false,
      action: "เติมเงิน",
    });

    const walletRef = db.collection("wallets").doc(studentId);

    return await db.runTransaction(async (tx) => {
      const walletSnap = await tx.get(walletRef);
      let currentBal = 0;

      if (walletSnap.exists) {
        const walletData = walletSnap.data();
        currentBal = Number(walletData.balanceSatang) || 0;
      }

      const newBal = currentBal + amt;

      tx.set(
        walletRef,
        {
          studentId,
          balanceSatang: newBal,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const txRef = db.collection("wallet_transactions").doc();
      tx.set(txRef, {
        id: txRef.id,
        walletId: studentId,
        studentId,
        amountSatang: amt,
        type: "TOPUP",
        actorUid: request.auth.uid,
        actorRole,
        paymentMethod: paymentMethod || "PROMPTPAY",
        note: note || "เติมเงินเข้ากระเป๋านักเรียน",
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        studentId,
        addedSatang: amt,
        newBalanceSatang: newBal,
        newBalanceBaht: newBal / 100,
      };
    });
  }
);

/**
 * 🛡️ Update Campus Wallet Spending Limits & Categories (Guardian / Supervisor)
 */
export const updateCampusWalletLimits = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนตั้งค่ากระเป๋าเงิน");
    }

    const { studentId, dailyLimitSatang, weeklyLimitSatang, blockedCategories, isLocked } = request.data || {};
    if (!studentId || typeof studentId !== "string") {
      throw new HttpsError("invalid-argument", "กรุณาระบุ studentId");
    }

    // 🔒 These are the parental controls themselves: a student must never be able to
    // raise their own limits, clear blocked categories, or unlock their own wallet.
    await assertWalletAuthority(request.auth, studentId, {
      allowSelf: false,
      action: "ตั้งค่าวงเงินหรือปลดล็อกกระเป๋าเงิน",
    });

    const walletRef = db.collection("wallets").doc(studentId);
    const updatePayload = {
      studentId,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof dailyLimitSatang === "number" && dailyLimitSatang >= 0) {
      updatePayload.dailyLimitSatang = dailyLimitSatang;
    }
    if (typeof weeklyLimitSatang === "number" && weeklyLimitSatang >= 0) {
      updatePayload.weeklyLimitSatang = weeklyLimitSatang;
    }
    if (Array.isArray(blockedCategories)) {
      updatePayload.blockedCategories = blockedCategories;
    }
    if (typeof isLocked === "boolean") {
      updatePayload.isLocked = isLocked;
    }

    await walletRef.set(updatePayload, { merge: true });

    return {
      success: true,
      studentId,
      message: "อัปเดตการตั้งค่าและวงเงินการใช้งานเรียบร้อยแล้ว",
    };
  }
);

/**
 * 🚨 Emergency Medical / Allergy Lookup (Audited, Server-Authoritative)
 *
 * Reads the student's medical profile on the caller's behalf and writes the audit
 * entry before returning. Previously the client logged the access and then read
 * `students/{id}` itself, so dropping the (non-blocking, warn-only) log call was
 * enough to read a child's health data leaving no trace. Access and audit are now
 * inseparable: the log write is awaited on every path, hit or miss.
 *
 * Accepts either the student's uid or their studentCode, because the emergency
 * screen searches by the code printed on a student card.
 */
export const emergencyMedicalLookup = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนเข้าถึงข้อมูลฉุกเฉิน");
    }

    const { studentQuery, reason } = request.data || {};
    if (!studentQuery || typeof studentQuery !== "string" || !studentQuery.trim()) {
      throw new HttpsError("invalid-argument", "กรุณาระบุรหัสนักเรียนหรือรหัสประจำตัว");
    }
    const lookupKey = studentQuery.trim();

    // 🔒 Medical data: staff supervisors and admins only. When a staff_supervisors
    // record exists it is authoritative and its canEmergencyLookup flag is honoured.
    const token = request.auth.token || {};
    const staffDoc = await db.collection("staff_supervisors").doc(request.auth.uid).get();
    const staffData = staffDoc.exists ? staffDoc.data() : null;

    let authorized;
    if (token.admin === true || token.role === "admin") {
      authorized = true;
    } else if (staffData) {
      authorized = staffData.canEmergencyLookup === true;
    } else {
      authorized = token.role === "staff_supervisor";
    }

    if (!authorized) {
      throw new HttpsError(
        "permission-denied",
        "EMERGENCY_LOOKUP_FORBIDDEN: เฉพาะเจ้าหน้าที่ผู้ดูแลที่ได้รับสิทธิ์เท่านั้นที่เข้าถึงข้อมูลสุขภาพนักเรียนได้"
      );
    }

    // Resolve by document id (uid) first, then by the printed studentCode.
    let studentSnap = await db.collection("students").doc(lookupKey).get();
    if (!studentSnap.exists) {
      const byCode = await db
        .collection("students")
        .where("studentCode", "==", lookupKey)
        .limit(1)
        .get();
      studentSnap = byCode.empty ? null : byCode.docs[0];
    }

    const profile = studentSnap
      ? { ...studentSnap.data(), studentId: studentSnap.id }
      : null;

    // 🔒 Audit before returning — awaited, and recorded even when nothing was found,
    // so an attempt to probe for a student is as traceable as a successful read.
    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      id: auditRef.id,
      action: "EMERGENCY_MEDICAL_LOOKUP",
      actorUid: request.auth.uid,
      actorEmail: token.email || "N/A",
      lookupKey,
      targetStudentId: profile ? profile.studentId : null,
      targetStudentName: profile ? profile.name || "N/A" : null,
      found: Boolean(profile),
      reason: (typeof reason === "string" && reason.trim()) || "การรักษาพยาบาลหรืออุบัติเหตุฉุกเฉิน",
      timestamp: FieldValue.serverTimestamp(),
    });

    if (!profile) {
      return { success: true, auditId: auditRef.id, found: false, profile: null, recentOrders: [] };
    }

    // Recent meals, for allergen tracing. Orders key the student on `studentId` for
    // wallet orders and on `userId` otherwise, so both are consulted.
    const orderFields = ["studentId", "userId"];
    const ordersById = new Map();
    for (const field of orderFields) {
      const snap = await db
        .collection("orders")
        .where(field, "==", profile.studentId)
        .limit(15)
        .get();
      snap.docs.forEach((d) => {
        const o = d.data();
        ordersById.set(d.id, {
          id: d.id,
          queueNumber: o.queueNumber || null,
          status: o.status || null,
          storeId: o.storeId || null,
          pickupDate: o.pickupDate || null,
          pickupTime: o.pickupTime || null,
          createdAt: o.createdAt?.toDate ? o.createdAt.toDate().toISOString() : null,
          items: Array.isArray(o.items)
            ? o.items.map((it) => ({
                name: it.name,
                quantity: it.quantity,
                customNotes: it.customNotes || "",
                selectedModifiers: Array.isArray(it.selectedModifiers) ? it.selectedModifiers : [],
              }))
            : [],
        });
      });
    }

    const recentOrders = Array.from(ordersById.values())
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 15);

    return { success: true, auditId: auditRef.id, found: true, profile, recentOrders };
  }
);

/**
 * 🤖 Merchant Assistant Reply (server-side OpenAI proxy)
 *
 * The API key previously lived in VITE_OPENAI_API_KEY, which Vite inlines into the
 * client bundle — readable by anyone who opens DevTools. It is now a Cloud Functions
 * secret and never leaves the server. Set it with:
 *   firebase functions:secrets:set OPENAI_API_KEY
 *
 * Returns { text: null } when no key is configured or the upstream call fails, and
 * the client falls back to its local canned responses.
 */
export const generateAssistantReply = onCall(
  { region: "asia-southeast1", cors: true, secrets: [OPENAI_API_KEY] },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนใช้งานผู้ช่วยตอบกลับอัตโนมัติ");
    }

    const { userMessage, storeName, orderContext } = request.data || {};
    if (typeof userMessage !== "string" || !userMessage.trim()) {
      throw new HttpsError("invalid-argument", "ไม่พบข้อความสำหรับสร้างคำตอบ");
    }
    if (userMessage.length > ASSISTANT_MAX_MESSAGE_CHARS) {
      throw new HttpsError(
        "invalid-argument",
        `MESSAGE_TOO_LONG: ข้อความต้องไม่เกิน ${ASSISTANT_MAX_MESSAGE_CHARS} ตัวอักษร`
      );
    }

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      return { text: null, source: "NOT_CONFIGURED" };
    }

    // Charged per call, so the quota is enforced before the upstream request.
    await consumeRateLimit(request.auth.uid, {
      collection: "assistant_rate_limits",
      maxCalls: ASSISTANT_MAX_CALLS_PER_WINDOW,
      windowMs: ASSISTANT_RATE_WINDOW_MS,
      message: "ASSISTANT_RATE_LIMITED: ใช้งานผู้ช่วยตอบกลับบ่อยเกินไป",
    });

    const safeStoreName = String(storeName || "ร้านค้า QueueUp").slice(0, ASSISTANT_MAX_STORE_NAME_CHARS);
    const contextLine =
      orderContext && typeof orderContext === "object"
        ? `บริบทออเดอร์ปัจจุบัน: ${String(orderContext.itemTitle || "").slice(0, 200)} | ${String(orderContext.queueNo || "").slice(0, 40)} | ฿${String(orderContext.price ?? "").slice(0, 20)}`
        : "";

    const systemPrompt = `คุณคือผู้ช่วย AI ร้านค้าโรงเรียนชื่อ "${safeStoreName}" ในระบบ QueueUp CRM
หน้าที่ของคุณคือตอบกลับลูกค้าที่สั่งอาหารด้วยความสุภาพ เป็นกันเอง ภาษาไทย รวดเร็ว และกระชับ (ไม่เกิน 2-3 ประโยค)
${contextLine}`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        console.warn("[generateAssistantReply] Upstream status:", response.status);
        return { text: null, source: "UNAVAILABLE" };
      }

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content?.trim();
      return aiText ? { text: aiText, source: "OPENAI" } : { text: null, source: "EMPTY" };
    } catch (err) {
      console.warn("[generateAssistantReply] Upstream error:", err);
      return { text: null, source: "UNAVAILABLE" };
    }
  }
);

/**
 * Health check & platform status endpoint
 */
export const getSystemHealth = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    try {
      res.status(200).json({
        status: "ok",
        architecture: "Zero-Payment Direct Food Queue with QueueUp for Campus Extension",
        timestamp: new Date().toISOString(),
        region: "asia-southeast1",
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

/**
 * Scheduled Daily Maintenance (heartbeat)
 *
 * NOTE: wallet spending counters are NOT reset here. They reset lazily on the next
 * spend, by comparing the stored period key against the current one — see
 * walletLimits.js. That keeps limits correct even if this job never runs, which
 * matters because it previously did nothing at all while the weekly counter was
 * relying on it, leaving `spentThisWeekSatang` to accumulate without bound.
 */
export const scheduledDailyMaintenance = onSchedule(
  { schedule: "0 0 * * *", timeZone: "Asia/Bangkok", region: "asia-southeast1" },
  async () => {
    console.log("[QueueUp] Daily maintenance routine triggered successfully.");
  }
);
