import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, FieldPath } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { resolveWalletAuthority, isStaffOrAdmin, MAX_TOPUP_SATANG } from "./walletAuthority.js";
import { resolveSpendingCounters, resolveMissingLimitDefaults } from "./walletLimits.js";
import { isBootstrapSuperAdmin } from "./superAdmins.js";
import {
  evaluateCoupon,
  normalizeCouponCode,
  describeCouponRefusal,
} from "./couponRules.js";
import { BUILTIN_COUPONS } from "./builtinCoupons.js";
import {
  TOPUP_SOURCE,
  TOPUP_STATUS,
  STRIPE_CURRENCY,
  validateTopupAmount,
  interpretStripeEvent,
  buildTopupMetadata,
  resolveTopupTarget,
  canConfirmManually,
} from "./stripeTopup.js";
import {
  validateOrderRequest,
  checkStoreAvailability,
  checkSlotCapacity,
  nextQueueNumber,
} from "./orderRequest.js";
import { checkProductAvailability, priceOrder } from "./orderPricing.js";
import {
  OPEN_ORDER_STATUSES,
  DELETION_PLAN,
  checkDeletable,
  buildOrderAnonymisationPatch,
} from "./accountDeletion.js";

/**
 * Turns a refusal from one of the pure rule modules into an HttpsError.
 *
 * Those modules return {ok:false, status, code, message} rather than throwing,
 * so they carry no firebase-functions import and can be tested directly. This is
 * the single place that translation happens.
 */
function throwIfRefused(result) {
  if (!result.ok) {
    throw new HttpsError(result.status, result.message, { code: result.code });
  }
  return result;
}
import {
  buildClaimPatch,
  canGrantRoles,
  isCallerAdmin,
  validateGrantRequest,
  GRANTABLE_ROLES,
} from "./campusClaims.js";
import { scanOrderForAllergens } from "./allergenGuard.js";
import { resolveLinkDecision, LINK_DECISIONS } from "./linkReview.js";
import { validatePilotLead, rateLimitKeyForAddress } from "./pilotLead.js";
import { validateEvaluation } from "./systemEvaluation.js";

// 🔒 Server-only credential. Never expose this through a VITE_* variable: Vite inlines
// those into the client bundle. Set with: firebase functions:secrets:set OPENAI_API_KEY
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// Server-only, for the same reason OPENAI_API_KEY is: Vite inlines every VITE_*
// variable into the client bundle. The publishable key (pk_…) is designed to be
// public and lives in .env as VITE_STRIPE_PUBLISHABLE_KEY; these two never can.
//   firebase functions:secrets:set STRIPE_SECRET_KEY
//   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

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

  // Carried alongside the date so a rule that needs the time of day (a happy
  // hour window) reads it from the same resolved instant as the date, rather
  // than calling the clock a second time and landing on the other side of a
  // midnight boundary.
  const hhmm = getBangkokCurrentTime(date);

  return { ymd, ymdClean, dayOfWeekIndex, hhmm };
}

/**
 * The roles a coupon's audience rule may match against.
 *
 * Verified claims only, plus the baseline every signed-in user has. A role
 * written into the user's own profile document is not evidence of anything —
 * that document is attacker-controlled on first write — so an audience check
 * built on it would be a discount anyone could claim by editing their profile.
 */
function resolveOrderUserRoles(auth) {
  const claims = (auth && auth.token) || {};
  const roles = new Set(["customer"]);
  if (typeof claims.role === "string" && claims.role) roles.add(claims.role);
  if (claims.admin === true) roles.add("admin");
  if (claims.staffSupervisor === true) roles.add("staff_supervisor");
  // An @*.ac.th address is how the campus identifies its own students, and it
  // is verified by the identity provider rather than self-declared.
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  if (claims.email_verified === true && /\.ac\.th$/.test(email.split("@")[1] || "")) {
    roles.add("student");
  }
  return Array.from(roles);
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
 * 📊 System Evaluation Submission (public, unauthenticated)
 *
 * The evaluation wall is public so the project's supervisor and reviewers can read
 * and add scores without an account. Writes still go through here rather than
 * Firestore directly, for the same reason as the pilot form: a collection open to
 * an unauthenticated page is open to everyone, so the shape, the bounds and the
 * rate limit have to live somewhere the client cannot skip.
 *
 * This replaces a client write that never once succeeded — it wrote five scores
 * under a timestamp id while the rules demanded a uid-keyed document with a single
 * `rating` field — and whose failure was swallowed into localStorage while the page
 * said thank you.
 */
export const submitSystemEvaluation = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    const validation = validateEvaluation(request.data);
    if (!validation.ok) {
      throw new HttpsError("invalid-argument", `${validation.reason}: ${validation.message}`);
    }

    const callerKey = rateLimitKeyForAddress(request.rawRequest?.ip);
    await consumeRateLimit(callerKey, {
      collection: "evaluation_rate_limits",
      maxCalls: 3,
      windowMs: 60 * 60 * 1000,
      message: "ส่งผลประเมินบ่อยเกินไป กรุณารอสักครู่",
    });

    const ref = await db.collection("systemEvaluations").add({
      ...validation.evaluation,
      submittedByUid: request.auth?.uid || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`[QueueUp] System evaluation recorded: ${ref.id}`);
    return { success: true, evaluationId: ref.id, evaluation: validation.evaluation };
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
      // pickupTime / pickupDate are read by validateOrderRequest from the raw
      // payload; they are not destructured here because nothing else uses them.
      paymentMode, // 'CAMPUS_WALLET' | 'DIRECT_ZERO_PAYMENT'
      studentId,   // Required if paymentMode === 'CAMPUS_WALLET'
      acknowledgeAllergenWarning, // set after the caller confirms an ALLERGEN_ALERT
      couponCode, // Optional coupon promo code
    } = request.data || {};

    if (userId && userId !== authUid && request.auth.token?.admin !== true) {
      throw new HttpsError("permission-denied", "ไม่สามารถสร้างคำสั่งซื้อในนามของผู้ใช้อื่นได้");
    }

    const effectiveUserId = authUid;

    // 2. Strict Input Validation
    //
    // The rules themselves live in orderRequest.js: shape, calendar date, past
    // pickup, and the per-product quantity aggregation that keeps two cart lines
    // for the same dish from each passing a stock check the pair would fail.
    const now = new Date();
    const currentBangkok = getBangkokYmd(now);

    const validated = throwIfRefused(validateOrderRequest(request.data || {}, currentBangkok));
    const {
      cleanPickupTime,
      targetYmd,
      targetYmdClean,
      productTotalQuantityMap,
      totalOrderItemsCount,
    } = validated;

    const [pYear, pMonth, pDay] = targetYmd.split("-").map(Number);
    const targetPickupDateObj = new Date(Date.UTC(pYear, pMonth - 1, pDay, 12, 0, 0));
    const targetBangkok = getBangkokYmd(targetPickupDateObj);

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

        // Read the coupon and this user's redemption record.
        //
        // Both belong in the read phase, and the redemption record has to be read
        // inside the transaction rather than before it: checking "has this user
        // used the coupon?" outside the transaction and writing the redemption
        // inside it is a TOCTOU window, and two orders placed at once would each
        // see zero redemptions and both succeed. Read here, written in phase 4,
        // so the count a decision is made on is the count the commit is
        // conditioned on.
        const cleanCoupon = normalizeCouponCode(couponCode);
        let couponSnap = null;
        let redemptionSnap = null;
        let redemptionRef = null;
        if (cleanCoupon) {
          couponSnap = await tx.get(db.collection("coupons").doc(cleanCoupon));
          redemptionRef = db
            .collection("coupon_redemptions")
            .doc(`${effectiveUserId}_${cleanCoupon}`);
          redemptionSnap = await tx.get(redemptionRef);
        }

        // ===================================================================
        // PHASE 2: VALIDATE BUSINESS RULES & CALCULATE AMOUNTS
        // ===================================================================
        // 2.1 Store Availability & Operating Hours — see orderRequest.js
        throwIfRefused(checkStoreAvailability(shopData, targetBangkok, targetYmd, cleanPickupTime));

        // 2.2 Product Stock, Modifier Integrity & Pricing — see orderPricing.js
        //
        // Documents are read above and passed in; the rules themselves touch no
        // Firestore, so they can be exercised without the emulator. Every price
        // comes from the product document — nothing the client sent about money
        // is used.
        const productDataMap = new Map(
          Array.from(productSnapMap.entries()).map(([id, snap]) => [id, snap.data()])
        );
        const modifierGroupDataMap = new Map(
          Array.from(modifierGroupSnapMap.entries())
            .filter(([, snap]) => snap && snap.exists)
            .map(([id, snap]) => [id, snap.data()])
        );

        throwIfRefused(checkProductAvailability(productTotalQuantityMap, productDataMap, storeId));

        const priced = throwIfRefused(
          priceOrder(items, productDataMap, modifierGroupDataMap, storeId)
        );
        const {
          calculatedTotalSatang,
          validatedOrderItems,
          itemCategories,
          allergenScanItems,
        } = priced;

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

        // 2.2c 🎟️ Server-Authoritative Coupon Validation & Discount Calculation
        //
        // This was an if/else chain over three hardcoded codes, and each one
        // enforced less than its name promised: WELCOME50 had neither a
        // once-per-user nor a new-member check (the claim was tracked in
        // localStorage, which the user clears), HAPPY15 had no happy hour, and
        // STUDENT10 never checked the buyer was a student. A code that failed
        // its minimum spend also fell through to a silent zero discount rather
        // than saying why. The rules now live in coupon documents and in
        // couponRules.js, which the client calls too, so a preview cannot
        // promise a discount this will refuse.
        let discountSatang = 0;
        let couponTitle = "";

        if (cleanCoupon) {
          const verdict = evaluateCoupon(
            couponSnap && couponSnap.exists ? { id: cleanCoupon, ...couponSnap.data() } : null,
            {
              subtotalSatang: calculatedTotalSatang,
              nowYmd: currentBangkok.ymd,
              nowHhmm: currentBangkok.hhmm,
              timesUsedByUser:
                redemptionSnap && redemptionSnap.exists
                  ? Number(redemptionSnap.data().count) || 0
                  : 0,
              userRoles: resolveOrderUserRoles(request.auth),
              storeId,
            }
          );

          if (!verdict.ok) {
            // Refused out loud. Falling through to a zero discount let the app
            // charge full price with the coupon still shown as applied.
            throw new HttpsError(
              "failed-precondition",
              `COUPON_REJECTED: ${describeCouponRefusal(verdict.reason, verdict.detail)}`,
              { code: "COUPON_REJECTED", reason: verdict.reason, detail: verdict.detail || {} }
            );
          }

          discountSatang = verdict.discountSatang;
          couponTitle = verdict.title;
        }

        const finalAmountSatang = Math.max(0, calculatedTotalSatang - discountSatang);

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
          if (currentBalance < finalAmountSatang) {
            throw new HttpsError("failed-precondition", `INSUFFICIENT_WALLET_BALANCE: ยอดเงินในกระเป๋าไม่เพียงพอ (คงเหลือ ${currentBalance / 100} บาท, ยอดสั่งซื้อหลังหักส่วนลด ${finalAmountSatang / 100} บาท)`);
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
          if (spentToday + finalAmountSatang > dailyLimitSatang) {
            throw new HttpsError("failed-precondition", `DAILY_LIMIT_EXCEEDED: ยอดการใช้จ่ายเกินวงเงินรายวัน (${dailyLimitSatang / 100} บาท/วัน) วันนี้ใช้ไปแล้ว ${spentToday / 100} บาท`);
          }

          // Check Weekly Limit
          if (spentThisWeek + finalAmountSatang > weeklyLimitSatang) {
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

        // 2.4 Slot Capacity & 2.5 Queue Number — see orderRequest.js
        const capacity = throwIfRefused(
          checkSlotCapacity(
            shopData,
            slotSnap.exists ? slotSnap.data() : null,
            targetYmd,
            cleanPickupTime
          )
        );
        const authoritativeCapacity = capacity.capacity;
        const currentSlotOrders = capacity.currentSlotOrders;

        const { sequenceNumber, queueNumber } = nextQueueNumber(
          counterSnap.exists ? counterSnap.data() : null
        );

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
          finalAmountSatang: finalAmountSatang,
          finalAmount: finalAmountSatang / 100,
          discountAppliedSatang: discountSatang,
          discountAppliedBaht: discountSatang / 100,
          couponCode: discountSatang > 0 ? cleanCoupon : null,
          couponTitle: discountSatang > 0 ? couponTitle : null,
          pointsEarned: Math.floor(finalAmountSatang / 1000),
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
        // Record the redemption, in the same transaction that grants the
        // discount. This is what makes "once per account" true: the count was
        // read in the read phase, so the commit is conditioned on it not having
        // changed, and two simultaneous orders cannot both spend the last use.
        // The previous mechanism was a localStorage flag, which survives exactly
        // as long as the user wants it to.
        if (cleanCoupon && discountSatang > 0 && redemptionRef) {
          tx.set(
            redemptionRef,
            {
              userId: effectiveUserId,
              couponCode: cleanCoupon,
              count: FieldValue.increment(1),
              lastDiscountSatang: discountSatang,
              lastOrderId: orderId,
              lastRedeemedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

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
            balanceSatang: currentBal - finalAmountSatang,
            spentTodaySatang: walletCounters.spentToday + finalAmountSatang,
            spentThisWeekSatang: walletCounters.spentThisWeek + finalAmountSatang,
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
            amountSatang: finalAmountSatang,
            type: "SPEND",
            storeId,
            storeName: shopData.name || "Campus Store",
            actorUid: authUid,
            note: `ซื้ออาหารคิว ${queueNumber} ที่ร้าน ${shopData.name || storeId}${discountSatang > 0 ? ` (ใช้คูปอง ${cleanCoupon} ลด ${discountSatang / 100} บ.)` : ''}`,
            timestamp: FieldValue.serverTimestamp(),
          });
        }

        return {
          success: true,
          orderId,
          queueNumber,
          totalAmountSatang: calculatedTotalSatang,
          totalAmountBaht: calculatedTotalSatang / 100,
          finalAmountSatang,
          finalAmountBaht: finalAmountSatang / 100,
          discountSatang,
          discountBaht: discountSatang / 100,
          couponCode: discountSatang > 0 ? cleanCoupon : null,
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

    // Staff changes belong in the audit trail: a shops/{id}/staff record is what
    // grants access to a shop's orders, so adding or removing one is a permission
    // change. The admin screen used to note these in a local array that vanished
    // on refresh — visible for a moment, recorded nowhere.
    const ALLOWED_ACTIONS = [
      "REGISTER_MERCHANT",
      "UPDATE_STORE_PROFILE",
      "ADD_SHOP_STAFF",
      "REMOVE_SHOP_STAFF",
    ];
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
      // Admin status comes from the verified token, never from users/{uid}.
      //
      // This check used to read `role`/`admin` straight off the caller's own
      // profile document — a document the caller creates and owns. firestore.rules
      // does refuse a self-assigned admin flag, so the escalation was not live,
      // but the Admin SDK bypasses those rules entirely: the only thing standing
      // between a user and admin here was a rule enforced somewhere else. The
      // rules in this file have already regressed once. Every other function in
      // this project authorizes off claims; this one now does too.
      if (!isCallerAdmin(request.auth.token, isBootstrapSuperAdmin)) {
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
      //
      // Two bugs lived in these six lines. setCustomUserClaims REPLACES the
      // claim set, so passing {role} alone erased everything else the user had —
      // approving a shop for someone who also supervised the canteen quietly
      // stripped their supervisor role. And the catch only warned, so an
      // approval could report success, create the shop and set the profile role
      // while the claim that actually authorizes the vendor was never written:
      // the one part that matters was the one part allowed to fail silently.
      const existingClaims = (await authAdmin.getUser(studentVendorId)).customClaims || {};
      await authAdmin.setCustomUserClaims(
        studentVendorId,
        buildClaimPatch(existingClaims, "student_vendor", true)
      );

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

      // Read before any write: this is the transaction's second read and every
      // mutation below it is a write. Only the approval path touches limits, so
      // a rejection does not take the wallet into its read set and contend with
      // a concurrent top-up.
      const walletSnapForLimits = outcome.grantsAccess ? await tx.get(walletRef) : null;

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

        // This is where a student's wallet is born. Spending is fail-closed on
        // the limit fields, so a wallet created without them can never be spent
        // from — and until now nothing wrote them, which meant no campus-wallet
        // order could complete at all. Seed the defaults here, and only the
        // fields that are still missing, so a re-link never resets limits the
        // guardian has since chosen.
        tx.set(
          walletRef,
          {
            studentId,
            guardianIds: FieldValue.arrayUnion(guardianId),
            ...resolveMissingLimitDefaults(
              walletSnapForLimits && walletSnapForLimits.exists ? walletSnapForLimits.data() : null
            ),
          },
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
 * 🎟️ Install the built-in coupons as documents (Admin only)
 *
 * The three promotional codes lived as an if/else chain inside the order
 * transaction, a second chain in the booking page, and marketing copy in two
 * more files — while the admin console wrote coupons into a `coupons` collection
 * that nothing read. Creating a coupon there did nothing; retiring WELCOME50 was
 * impossible without a deploy.
 *
 * This seeds the three as real documents so the console's coupon screen governs
 * them. Merges rather than overwrites, so running it twice cannot undo an
 * administrator's later edits — only fill in a coupon that is missing.
 */
export const seedBuiltinCoupons = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนติดตั้งคูปองเริ่มต้น");
    }
    if (!isCallerAdmin(request.auth.token, isBootstrapSuperAdmin)) {
      throw new HttpsError(
        "permission-denied",
        "COUPON_SEED_FORBIDDEN: เฉพาะผู้ดูแลระบบเท่านั้นที่ติดตั้งคูปองเริ่มต้นได้"
      );
    }

    const batch = db.batch();
    const installed = [];
    const skipped = [];

    for (const coupon of BUILTIN_COUPONS) {
      const ref = db.collection("coupons").doc(coupon.id);
      const existing = await ref.get();
      if (existing.exists) {
        // Already there, possibly retuned by an administrator. Leave it alone.
        skipped.push(coupon.id);
        continue;
      }
      batch.set(ref, {
        ...coupon,
        builtin: true,
        createdBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      installed.push(coupon.id);
    }

    if (installed.length > 0) await batch.commit();

    return {
      success: true,
      installed,
      skipped,
      message: installed.length
        ? `ติดตั้งคูปองเริ่มต้น ${installed.length} รายการ: ${installed.join(", ")}`
        : "คูปองเริ่มต้นทั้งหมดมีอยู่ในระบบแล้ว",
    };
  }
);

/**
 * 🎖️ Appoint or remove a campus staff supervisor (Admin only)
 *
 * Until this existed, nothing in the entire project could create a
 * staff_supervisors record or set a staff_supervisor claim — setCustomUserClaims
 * was called in exactly one place, granting student_vendor. Meanwhile eight
 * routes and four Cloud Functions required staff_supervisor. Vendor approvals,
 * guardian-link approvals, the emergency lookup and the campus queue monitor
 * were all unreachable by anyone, and the only way to appoint a teacher was to
 * open the Firebase console and edit claims by hand.
 *
 * Grants are admin-only on purpose. A supervisor who could appoint supervisors
 * is an escalation path with no ceiling; admin itself stays anchored to
 * config/super-admins.js and cannot be granted from inside the app at all.
 *
 * Writes both halves of the role, because each covers a gap in the other:
 *   • the custom claim is what firestore.rules reads, but the user's existing
 *     token keeps the old claims until it refreshes (up to an hour, or the next
 *     sign-in);
 *   • the staff_supervisors document is what the Cloud Functions fall back to
 *     in the meantime.
 * Writing one without the other leaves a supervisor who can pass the backend
 * checks but fails every Firestore read, or the reverse.
 */
export const setCampusStaffRole = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนจัดการสิทธิ์เจ้าหน้าที่");
    }

    const actorClaims = request.auth.token || {};
    const actorEmail = actorClaims.email || "";
    if (!canGrantRoles(actorClaims, actorEmail, isBootstrapSuperAdmin)) {
      throw new HttpsError(
        "permission-denied",
        "ROLE_GRANT_FORBIDDEN: เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่กำหนดสิทธิ์เจ้าหน้าที่ได้"
      );
    }

    const { targetUid, targetEmail, role, enabled, note } = request.data || {};

    // Resolve an email to a uid so an admin can appoint a teacher by the address
    // the school already knows them by, instead of hunting for a uid.
    let resolvedUid = typeof targetUid === "string" ? targetUid.trim() : "";
    if (!resolvedUid && typeof targetEmail === "string" && targetEmail.trim()) {
      try {
        const record = await authAdmin.getUserByEmail(targetEmail.trim().toLowerCase());
        resolvedUid = record.uid;
      } catch {
        throw new HttpsError(
          "not-found",
          `USER_NOT_FOUND: ไม่พบผู้ใช้อีเมล ${targetEmail} ในระบบ (ผู้ใช้ต้องเข้าสู่ระบบอย่างน้อยหนึ่งครั้งก่อน)`
        );
      }
    }

    const check = validateGrantRequest({ targetUid: resolvedUid, role, enabled }, request.auth.uid);
    if (!check.ok) {
      const messages = {
        TARGET_REQUIRED: "กรุณาระบุ targetUid หรือ targetEmail ของผู้ใช้",
        ROLE_NOT_GRANTABLE: `กรุณาระบุ role ที่กำหนดได้ (${GRANTABLE_ROLES.join(", ")})`,
        ENABLED_REQUIRED: "กรุณาระบุ enabled เป็น true (ให้สิทธิ์) หรือ false (ถอนสิทธิ์)",
        SELF_GRANT_FORBIDDEN: "SELF_GRANT_FORBIDDEN: ไม่สามารถกำหนดสิทธิ์ให้ตัวเองได้",
      };
      throw new HttpsError("invalid-argument", messages[check.reason] || check.reason);
    }

    let targetRecord;
    try {
      targetRecord = await authAdmin.getUser(resolvedUid);
    } catch {
      throw new HttpsError("not-found", `USER_NOT_FOUND: ไม่พบผู้ใช้ ${resolvedUid} ในระบบ`);
    }

    // Merge rather than replace, or this grant erases every other claim the
    // user holds — see campusClaims.js.
    const nextClaims = buildClaimPatch(targetRecord.customClaims || {}, check.role, check.enabled);
    await authAdmin.setCustomUserClaims(resolvedUid, nextClaims);

    const actorName = actorClaims.name || actorEmail || "ผู้ดูแลระบบ";
    const staffRef = db.collection("staff_supervisors").doc(resolvedUid);
    const auditRef = db.collection("audit_logs").doc();
    const batch = db.batch();

    if (check.role === "staff_supervisor" && check.enabled) {
      batch.set(
        staffRef,
        {
          staffUid: resolvedUid,
          email: targetRecord.email || null,
          displayName: targetRecord.displayName || null,
          canApproveVendors: true,
          canReviewGuardianLinks: true,
          grantedBy: request.auth.uid,
          grantedByName: actorName,
          grantedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (check.role === "staff_supervisor") {
      // Revocation deletes the fallback record too. Leaving it behind would let
      // the backend keep honouring a role the claim no longer carries.
      batch.delete(staffRef);
    }

    batch.set(auditRef, {
      id: auditRef.id,
      action: check.enabled ? "CAMPUS_ROLE_GRANTED" : "CAMPUS_ROLE_REVOKED",
      actorUid: request.auth.uid,
      actorName,
      targetUid: resolvedUid,
      targetEmail: targetRecord.email || null,
      role: check.role,
      note: typeof note === "string" ? note.slice(0, 500) : "",
      timestamp: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      success: true,
      targetUid: resolvedUid,
      targetEmail: targetRecord.email || null,
      role: check.role,
      enabled: check.enabled,
      // The claim is live on the server but the user is still holding a token
      // that predates it. Saying so is the difference between "it did not work"
      // and "sign out and back in".
      requiresReauth: true,
      message: check.enabled
        ? `กำหนดสิทธิ์ ${check.role} ให้ ${targetRecord.email || resolvedUid} เรียบร้อย — ผู้ใช้ต้องออกจากระบบและเข้าใหม่จึงจะใช้สิทธิ์ได้`
        : `ถอนสิทธิ์ ${check.role} จาก ${targetRecord.email || resolvedUid} เรียบร้อย — ผู้ใช้ต้องออกจากระบบและเข้าใหม่`,
    };
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

    // ------------------------------------------------------------------
    // A guardian may request a top-up; only staff may grant one.
    // ------------------------------------------------------------------
    // There is no payment gateway behind this call — it writes a number into
    // balanceSatang and nothing collects the money. allowSelf:false kept the
    // student out, but a verified guardian could credit their own child up to
    // ฿20,000 per call for free, and that balance buys real food from stalls
    // that accrue real earnings. The school would be settling with vendors
    // against money it never received.
    //
    // Staff top-ups still credit immediately: staff are the ones physically
    // handed the cash or shown the transfer slip, so their call *is* the
    // capture. A guardian's call now creates a request that a member of staff
    // confirms once the money has actually arrived, through
    // reviewWalletTopupRequest below.
    if (actorRole === "GUARDIAN") {
      const requestRef = db.collection("wallet_topup_requests").doc();
      await requestRef.set({
        id: requestRef.id,
        studentId,
        amountSatang: amt,
        status: "PENDING",
        // Explicit, because canConfirmManually distinguishes on it. A request
        // with no source is treated as MANUAL for the rows written before this
        // field existed.
        source: TOPUP_SOURCE.MANUAL,
        requestedBy: request.auth.uid,
        requestedByName: request.auth.token?.name || request.auth.token?.email || "ผู้ปกครอง",
        paymentMethod: paymentMethod || "PROMPTPAY",
        note: typeof note === "string" ? note.slice(0, 500) : "",
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        pending: true,
        requestId: requestRef.id,
        studentId,
        requestedSatang: amt,
        message: `บันทึกคำขอเติมเงิน ฿${amt / 100} เรียบร้อย กรุณาชำระเงินที่ห้องธุรการ เจ้าหน้าที่จะยืนยันและเติมเงินเข้ากระเป๋าให้หลังได้รับเงินแล้วครับ`,
      };
    }

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
          // A top-up can also be the first thing that creates a wallet, and a
          // wallet with no limits cannot be spent from. Crediting a balance the
          // student then cannot use is the worst of both outcomes, so the same
          // defaults are seeded here — again only where a limit is missing.
          ...resolveMissingLimitDefaults(walletSnap.exists ? walletSnap.data() : null),
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
        pending: false,
        studentId,
        addedSatang: amt,
        newBalanceSatang: newBal,
        newBalanceBaht: newBal / 100,
      };
    });
  }
);

/**
 * 💳 Start a Stripe-paid wallet top-up
 *
 * The missing half of this system. topupCampusWallet writes a number into
 * balanceSatang and nothing captures a payment, which is why a guardian's
 * top-up currently records a request that staff confirm after cash arrives at
 * the office. This is the same flow with Stripe doing the capturing.
 *
 * Returns a client secret. The browser confirms the payment with the
 * publishable key; the balance does not move here and must not — a client that
 * could report its own success would be back to crediting itself. The wallet is
 * credited by stripeTopupWebhook below, on Stripe's word.
 *
 * PromptPay is listed first because it is how most people in Thailand pay.
 */
export const createTopupPaymentIntent = onCall(
  { region: "asia-southeast1", cors: true, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนเติมเงิน");
    }

    const { studentId, amountSatang } = request.data || {};
    if (!studentId || typeof studentId !== "string") {
      throw new HttpsError("invalid-argument", "กรุณาระบุ studentId");
    }

    // Same authority as the manual path: a student may not top up their own
    // wallet even when they are the one paying, because the wallet carries
    // spending controls a guardian set and self-service would route around the
    // person who set them.
    const actorRole = await assertWalletAuthority(request.auth, studentId, {
      allowSelf: false,
      action: "เติมเงิน",
    });

    const check = validateTopupAmount(amountSatang, MAX_TOPUP_SATANG);
    if (!check.ok) {
      throw new HttpsError("invalid-argument", `${check.code}: ${check.message}`);
    }

    // The request row exists before the PaymentIntent, so the webhook always
    // has something to complete. Created PENDING and only a verified webhook
    // moves it — see canConfirmManually.
    const requestRef = db.collection("wallet_topup_requests").doc();
    await requestRef.set({
      id: requestRef.id,
      studentId,
      amountSatang: check.amountSatang,
      status: TOPUP_STATUS.PENDING,
      source: TOPUP_SOURCE.STRIPE,
      requestedBy: request.auth.uid,
      requestedByName: request.auth.token?.name || request.auth.token?.email || "ผู้ปกครอง",
      requestedByRole: actorRole,
      paymentMethod: "STRIPE",
      createdAt: FieldValue.serverTimestamp(),
    });

    const stripe = new Stripe(STRIPE_SECRET_KEY.value());

    let intent;
    try {
      intent = await stripe.paymentIntents.create(
        {
          // Satang IS Stripe's minor unit for THB, so the stored amount goes
          // across unchanged. No ×100 anywhere in this file, by design.
          amount: check.amountSatang,
          currency: STRIPE_CURRENCY,
          payment_method_types: ["promptpay", "card"],
          // Everything the webhook needs to know whose wallet this is. It
          // arrives with no memory of this call, and reads Stripe's copy of
          // the metadata, which the browser cannot alter afterwards.
          metadata: buildTopupMetadata({
            studentId,
            requestId: requestRef.id,
            requestedBy: request.auth.uid,
          }),
          description: `QueueUp wallet top-up · student ${studentId}`,
        },
        // Stripe's own idempotency: a retried call returns the same
        // PaymentIntent rather than creating a second one to pay.
        { idempotencyKey: `topup_${requestRef.id}` }
      );
    } catch (err) {
      await requestRef.update({
        status: TOPUP_STATUS.FAILED,
        failureReason: String(err?.message || err).slice(0, 500),
        failedAt: FieldValue.serverTimestamp(),
      });
      throw new HttpsError(
        "internal",
        `STRIPE_INTENT_FAILED: เริ่มรายการชำระเงินไม่สำเร็จ: ${err?.message || err}`
      );
    }

    await requestRef.update({ paymentIntentId: intent.id });

    return {
      success: true,
      requestId: requestRef.id,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountSatang: check.amountSatang,
      currency: STRIPE_CURRENCY,
      // Nothing has been credited. Saying so is the difference between a parent
      // who waits for confirmation and one who tells their child to go and buy
      // lunch with money that has not arrived.
      pending: true,
      message: `เริ่มรายการเติมเงิน ฿${check.amountSatang / 100} — ยอดเงินจะเข้ากระเป๋าหลังชำระเงินสำเร็จ`,
    };
  }
);

/**
 * 💳 Stripe webhook — the only thing that credits a Stripe-paid top-up
 *
 * Three properties this endpoint has to hold, each of them a way to lose money:
 *
 *  1. **Verify the signature.** An unverified endpoint is a URL that credits
 *     wallets to anyone who can guess it. The raw body is required for this —
 *     see rawBody below.
 *
 *  2. **Survive redelivery.** Stripe retries on any non-2xx and can deliver the
 *     same event twice unprompted. The event id is recorded in the same
 *     transaction that moves the balance, so the second delivery finds it
 *     already there and credits nothing. This is what idempotency_keys was
 *     always for; it had a security rule and no writer until now.
 *
 *  3. **Credit what arrived, not what was asked for.** amount_received is
 *     Stripe's number. The request's own amountSatang is the client's, and
 *     trusting it would let a caller ask to pay ฿20 and be credited ฿20,000.
 *
 * Always answers 200 once the signature verifies, even for events it ignores.
 * A non-2xx makes Stripe retry, and retrying an event nobody handles eventually
 * gets the endpoint disabled — taking the ones that matter down with it.
 */
export const stripeTopupWebhook = onRequest(
  { region: "asia-southeast1", secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY.value());

    let event;
    try {
      // req.rawBody, not req.body. Express has already parsed and re-serialised
      // the JSON by this point, and re-serialising changes bytes — key order,
      // whitespace — so the signature over the original bytes no longer
      // matches. Firebase preserves the raw buffer for exactly this.
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      // Refused, not logged-and-accepted: a body whose signature does not
      // verify did not come from Stripe.
      console.error("[stripeTopupWebhook] signature verification failed:", err?.message);
      res.status(400).send(`Webhook signature verification failed`);
      return;
    }

    const verdict = interpretStripeEvent(event);
    if (verdict.action === "IGNORE") {
      res.status(200).json({ received: true, ignored: verdict.reason });
      return;
    }

    const target = resolveTopupTarget(verdict.metadata);
    if (!target.ok) {
      // An event from some other integration on the same Stripe account. Not an
      // error, and certainly not something to credit a wallet for.
      res.status(200).json({ received: true, ignored: target.reason });
      return;
    }

    const eventRef = db.collection("idempotency_keys").doc(`stripe_${event.id}`);
    const requestRef = db.collection("wallet_topup_requests").doc(target.requestId);
    const walletRef = db.collection("wallets").doc(target.studentId);

    try {
      const outcome = await db.runTransaction(async (tx) => {
        // Reads first, all of them, before any write.
        const eventSnap = await tx.get(eventRef);
        if (eventSnap.exists) {
          return { status: "duplicate", eventId: event.id };
        }

        const reqSnap = await tx.get(requestRef);
        if (!reqSnap.exists) {
          return { status: "unknown_request", requestId: target.requestId };
        }
        const topup = reqSnap.data();

        if (topup.status !== TOPUP_STATUS.PENDING) {
          // Already settled — by an earlier delivery of a different event for
          // the same intent, most likely.
          return { status: "already_settled", current: topup.status };
        }

        const walletSnap =
          verdict.action === "CREDIT" ? await tx.get(walletRef) : null;

        // ---- writes ----
        tx.set(eventRef, {
          id: `stripe_${event.id}`,
          source: "stripe",
          eventId: event.id,
          eventType: event.type,
          requestId: target.requestId,
          studentId: target.studentId,
          processedAt: FieldValue.serverTimestamp(),
        });

        if (verdict.action === "FAIL") {
          tx.update(requestRef, {
            status: TOPUP_STATUS.FAILED,
            failureReason: String(verdict.reason).slice(0, 500),
            failedAt: FieldValue.serverTimestamp(),
          });
          return { status: "failed", requestId: target.requestId };
        }

        const currentBal = walletSnap.exists
          ? Number(walletSnap.data().balanceSatang) || 0
          : 0;
        const newBal = currentBal + verdict.creditSatang;

        tx.set(
          walletRef,
          {
            studentId: target.studentId,
            balanceSatang: newBal,
            // A wallet first created by a top-up would otherwise be credited
            // and then refuse every order — spending is fail-closed on limits.
            ...resolveMissingLimitDefaults(walletSnap.exists ? walletSnap.data() : null),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        tx.update(requestRef, {
          status: TOPUP_STATUS.CONFIRMED,
          creditedSatang: verdict.creditSatang,
          paymentIntentId: verdict.paymentIntentId,
          confirmedBy: "stripe_webhook",
          confirmedAt: FieldValue.serverTimestamp(),
        });

        const txRef = db.collection("wallet_transactions").doc();
        tx.set(txRef, {
          id: txRef.id,
          walletId: target.studentId,
          studentId: target.studentId,
          amountSatang: verdict.creditSatang,
          type: "TOPUP",
          actorUid: topup.requestedBy || null,
          actorRole: "STRIPE",
          topupRequestId: target.requestId,
          paymentIntentId: verdict.paymentIntentId,
          stripeEventId: event.id,
          paymentMethod: "STRIPE",
          note: "เติมเงินผ่าน Stripe",
          timestamp: FieldValue.serverTimestamp(),
        });

        const auditRef = db.collection("audit_logs").doc();
        tx.set(auditRef, {
          id: auditRef.id,
          action: "WALLET_TOPUP_CONFIRMED",
          actorUid: "stripe_webhook",
          actorName: "Stripe",
          targetStudentId: target.studentId,
          topupRequestId: target.requestId,
          amountSatang: verdict.creditSatang,
          stripeEventId: event.id,
          timestamp: FieldValue.serverTimestamp(),
        });

        return { status: "credited", creditedSatang: verdict.creditSatang, newBalanceSatang: newBal };
      });

      res.status(200).json({ received: true, ...outcome });
    } catch (err) {
      // A 500 here is correct: the transaction did not commit, so Stripe should
      // retry. The idempotency record commits with the credit or not at all, so
      // a retry cannot double it.
      console.error("[stripeTopupWebhook] processing failed:", err);
      res.status(500).json({ received: false, error: "processing_failed" });
    }
  }
);

/**
 * 💰 Confirm or reject a guardian's top-up request (Staff / Admin only)
 *
 * The moment the money is actually recognised. A guardian's request is a claim
 * that they intend to pay; this is a member of staff saying the payment
 * arrived. Crediting on the claim alone let a guardian mint balance that buys
 * real food from stalls the school then has to settle with.
 *
 * The status check and the credit happen in one transaction, so confirming the
 * same request twice credits once — a double-click, a retry after a timeout, or
 * two members of staff working the same queue cannot double the balance.
 */
export const reviewWalletTopupRequest = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนตรวจสอบคำขอเติมเงิน");
    }

    // Deliberately staff-only, not "staff or the guardian who asked": a guardian
    // approving their own request would restore exactly the hole this closes.
    if (!(await isStaffOrAdmin(db, request.auth))) {
      throw new HttpsError(
        "permission-denied",
        "TOPUP_REVIEW_FORBIDDEN: เฉพาะเจ้าหน้าที่หรือผู้ดูแลระบบเท่านั้นที่ยืนยันการเติมเงินได้"
      );
    }

    const { requestId, decision, note } = request.data || {};
    if (!requestId || typeof requestId !== "string") {
      throw new HttpsError("invalid-argument", "กรุณาระบุ requestId");
    }
    if (!["CONFIRMED", "REJECTED"].includes(decision)) {
      throw new HttpsError("invalid-argument", "กรุณาระบุ decision ('CONFIRMED' หรือ 'REJECTED')");
    }

    const requestRef = db.collection("wallet_topup_requests").doc(requestId);

    return await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) {
        throw new HttpsError("not-found", "ไม่พบคำขอเติมเงินนี้ในระบบ");
      }

      const topup = reqSnap.data();
      if (topup.status !== "PENDING") {
        throw new HttpsError(
          "failed-precondition",
          `TOPUP_ALREADY_REVIEWED: คำขอนี้ถูกตรวจสอบไปแล้ว (สถานะปัจจุบัน: ${topup.status})`
        );
      }

      // Only a cash request can be completed by hand.
      //
      // Staff confirming a MANUAL request IS the capture — they are the ones
      // handed the money. A STRIPE request has Stripe doing the capturing, and
      // letting staff confirm it would credit a wallet for a payment that may
      // have failed or never been attempted. That is the hole the manual flow
      // was built to close, reopened from the other side.
      const manual = canConfirmManually(topup);
      if (!manual.ok) {
        throw new HttpsError("failed-precondition", `${manual.code}: ${manual.message}`);
      }

      const amt = Number(topup.amountSatang) || 0;
      if (!Number.isInteger(amt) || amt <= 0 || amt > MAX_TOPUP_SATANG) {
        throw new HttpsError("failed-precondition", "TOPUP_AMOUNT_INVALID: จำนวนเงินในคำขอไม่ถูกต้อง");
      }

      const walletRef = db.collection("wallets").doc(topup.studentId);
      // Read before any write, and only where the balance is about to change.
      const walletSnap = decision === "CONFIRMED" ? await tx.get(walletRef) : null;

      const reviewerUid = request.auth.uid;
      const reviewerName = request.auth.token?.name || request.auth.token?.email || "เจ้าหน้าที่";

      tx.update(requestRef, {
        status: decision,
        reviewedBy: reviewerUid,
        reviewedByName: reviewerName,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewNote: typeof note === "string" ? note.slice(0, 500) : "",
      });

      let newBal = null;
      if (decision === "CONFIRMED") {
        const currentBal = walletSnap.exists ? Number(walletSnap.data().balanceSatang) || 0 : 0;
        newBal = currentBal + amt;

        tx.set(
          walletRef,
          {
            studentId: topup.studentId,
            balanceSatang: newBal,
            ...resolveMissingLimitDefaults(walletSnap.exists ? walletSnap.data() : null),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const txRef = db.collection("wallet_transactions").doc();
        tx.set(txRef, {
          id: txRef.id,
          walletId: topup.studentId,
          studentId: topup.studentId,
          amountSatang: amt,
          type: "TOPUP",
          actorUid: reviewerUid,
          actorRole: "STAFF",
          requestedBy: topup.requestedBy || null,
          topupRequestId: requestId,
          paymentMethod: topup.paymentMethod || "PROMPTPAY",
          note: topup.note || "เติมเงินเข้ากระเป๋านักเรียน (ยืนยันโดยเจ้าหน้าที่)",
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      const auditRef = db.collection("audit_logs").doc();
      tx.set(auditRef, {
        id: auditRef.id,
        action: `WALLET_TOPUP_${decision}`,
        actorUid: reviewerUid,
        actorName: reviewerName,
        targetStudentId: topup.studentId,
        topupRequestId: requestId,
        amountSatang: amt,
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        requestId,
        status: decision,
        studentId: topup.studentId,
        newBalanceSatang: newBal,
        message:
          decision === "CONFIRMED"
            ? `ยืนยันการเติมเงิน ฿${amt / 100} เข้ากระเป๋าเรียบร้อย`
            : "ปฏิเสธคำขอเติมเงินเรียบร้อย",
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
 * 🗑️ Delete my account, and mean it
 *
 * The screen behind this deleted `users/{uid}` and nothing else. The Firebase
 * Auth account survived — so signing in again recreated the profile — and so
 * did the wallet, the orders, the guardian links and the child's allergy
 * record. A failed delete was swallowed with `console.warn` and the success
 * message showed either way. The PDPA page promises erasure; that was a
 * sign-out with a paragraph attached.
 *
 * Server-side because a browser cannot do this. It cannot delete an Auth user,
 * it cannot read another collection's documents to know what to remove, and
 * every collection involved is either closed to clients or closed to this kind
 * of sweep. A client-driven deletion would also be a client deciding which of
 * its own records to keep.
 *
 * Refused rather than done when something would be destroyed with it — money in
 * the wallet, an order a stall is cooking, the last admin account. See
 * accountDeletion.js, where those rules live and are tested.
 *
 * Deliberately not idempotent-by-accident: the Auth user is deleted LAST, so a
 * failure part-way leaves the account signed-in-able and the call can be
 * retried. Deleting it first would strand whatever remained with no owner and
 * no way back in.
 */
export const deleteMyAccount = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนลบบัญชี");
    }
    const uid = request.auth.uid;
    const claims = request.auth.token || {};

    // ------------------------------------------------------------------
    // 1. Is there anything deletion would destroy?
    // ------------------------------------------------------------------
    const [walletSnap, openOrdersSnap, pendingTopupsSnap, shopsSnap] = await Promise.all([
      db.collection("wallets").doc(uid).get(),
      db
        .collection("orders")
        .where("userId", "==", uid)
        .where("status", "in", OPEN_ORDER_STATUSES)
        .limit(50)
        .get(),
      db
        .collection("wallet_topup_requests")
        .where("requestedBy", "==", uid)
        .where("status", "==", TOPUP_STATUS.PENDING)
        .limit(10)
        .get(),
      db.collection("shops").where("ownerUid", "==", uid).where("isOpen", "==", true).limit(5).get(),
    ]);

    // Only asked when this account is itself an admin; listing users is
    // expensive and answers a question nobody else has.
    //
    // A bootstrap super-admin counts. Their admin rights come from an email in
    // config/super-admins.js rather than from a custom claim, so counting
    // claims alone would report "no admins left" while one is a sign-in away —
    // and, the other way round, would block the last claim-admin from leaving
    // when a bootstrap admin can still get back in.
    let isLastAdmin = false;
    if (isCallerAdmin(claims, isBootstrapSuperAdmin)) {
      const admins = await getAuth().listUsers(1000);
      const others = admins.users.filter((u) => {
        if (u.uid === uid) return false;
        const c = u.customClaims || {};
        return c.admin === true || c.role === "admin" || isBootstrapSuperAdmin(u.email || "");
      });
      isLastAdmin = others.length === 0;
    }

    throwIfRefused(
      checkDeletable({
        walletBalanceSatang: Number(walletSnap.exists ? walletSnap.data().balanceSatang : 0) || 0,
        openOrderCount: openOrdersSnap.size,
        pendingTopupCount: pendingTopupsSnap.size,
        activeShopCount: shopsSnap.size,
        isLastAdmin,
      })
    );

    // ------------------------------------------------------------------
    // 2. The audit entry goes FIRST, and is awaited.
    // ------------------------------------------------------------------
    // Written before anything is removed, because a deletion that fails
    // half-way still happened to whatever it reached, and an entry written
    // afterwards would be missing for exactly the cases that matter most.
    // audit_logs is `allow write: if false;` and is not itself deleted — a
    // record kept to prove a legal obligation is outside the right to erasure,
    // and the policy page says so rather than this code quietly deciding it.
    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      id: auditRef.id,
      action: "ACCOUNT_DELETED",
      actorUid: uid,
      actorName: claims.name || claims.email || uid,
      targetUid: uid,
      requestedAt: FieldValue.serverTimestamp(),
      timestamp: FieldValue.serverTimestamp(),
    });

    const deleted = {};
    const anonymised = {};

    // ------------------------------------------------------------------
    // 3. Purge, one collection at a time.
    // ------------------------------------------------------------------
    for (const entry of DELETION_PLAN.purge) {
      let docs = [];
      if (entry.byId) {
        const snap = await db.collection(entry.collection).doc(uid).get();
        if (snap.exists) docs = [snap.ref];
      } else if (entry.byIdPrefix) {
        // The uid is in the document id (`<uid>_<code>`, `<uid>_<storeId>`),
        // not in a field, so this is a key-range scan rather than a where.
        const snap = await db
          .collection(entry.collection)
          .orderBy(FieldPath.documentId())
          .startAt(`${uid}_`)
          .endAt(`${uid}_\uf8ff`)
          .get();
        docs = snap.docs.map((d) => d.ref);
      } else {
        const snap = await db.collection(entry.collection).where(entry.where, "==", uid).get();
        docs = snap.docs.map((d) => d.ref);
      }

      for (const ref of docs) {
        if (entry.subcollection) {
          // recursiveDelete rather than a delete: a document's subcollections
          // survive their parent in Firestore, so a chat deleted on its own
          // leaves every message in it readable by id.
          await db.recursiveDelete(ref);
        } else {
          await ref.delete();
        }
      }

      deleted[entry.collection] = (deleted[entry.collection] || 0) + docs.length;
    }

    // users/{uid} has a favourites subcollection, which the loop above would
    // orphan the same way.
    await db.recursiveDelete(db.collection("users").doc(uid));

    // ------------------------------------------------------------------
    // 4. Anonymise what has to stay.
    // ------------------------------------------------------------------
    // The stall's sales history and the school's settlement with it both rest
    // on these orders. A vendor losing a day's takings because a customer
    // closed their account is not erasure, it is data loss for someone else.
    const patch = buildOrderAnonymisationPatch(FieldValue.delete());
    for (const entry of DELETION_PLAN.anonymise) {
      const snap = await db.collection(entry.collection).where(entry.where, "==", uid).get();
      for (const d of snap.docs) {
        await d.ref.update(patch);
      }
      anonymised[entry.collection] = snap.size;
    }

    // ------------------------------------------------------------------
    // 5. The Auth account, last.
    // ------------------------------------------------------------------
    await getAuth().deleteUser(uid);

    await auditRef.update({
      deleted,
      anonymised,
      completedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      deleted,
      anonymised,
      retained: DELETION_PLAN.retain.map((r) => r.collection),
      message:
        "ลบบัญชีและข้อมูลส่วนบุคคลของคุณเรียบร้อยแล้ว " +
        "ประวัติคำสั่งซื้อถูกเก็บไว้แบบไม่ระบุตัวตนเพื่อการบัญชีของร้านค้า " +
        "และบันทึกความปลอดภัยถูกเก็บไว้ตามข้อกำหนดทางกฎหมาย",
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


