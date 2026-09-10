import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { scanOrderForAllergens } from "./allergenGuard.js";
import { resolveLinkDecision, LINK_DECISIONS } from "./linkReview.js";
import { validatePilotLead, rateLimitKeyForAddress } from "./pilotLead.js";
import { validateEvaluation } from "./systemEvaluation.js";
import { handleCreateOrderAuthoritative } from "./modules/orders/createOrder.js";
import { handleCancelOrderAuthoritative } from "./modules/orders/cancelOrder.js";
import { handleUpdateOrderStatusAuthoritative } from "./modules/orders/updateOrderStatus.js";
import { handleCreateShopApplication, handleReviewShopApplication } from "./modules/identity/merchantApproval.js";
import { handleRecordEmergencyLookupAuthoritative } from "./modules/audits/auditService.js";
import { handleSendChatMessageAuthoritative } from "./modules/chat/chatService.js";
import { createPromptPayIntent } from "./modules/payments/paymentService.js";
import { paymentWebhook } from "./modules/payments/paymentWebhook.js";

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

export { scanOrderForAllergens, isValidCalendarDate, getBangkokCurrentTime, getBangkokYmd };

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
 * 🔒 Server-Authoritative Order Creation (Dual Payment & Instant Queue)
 */
export const createOrderAuthoritative = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => handleCreateOrderAuthoritative(db, request)
);

/**
 * 🔒 Update Order Status Authoritative (Server-Authoritative Lifecycle)
 */
export const updateOrderStatusAuthoritative = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => handleUpdateOrderStatusAuthoritative(db, request)
);

/**
 * 🔒 Cancel Order Authoritative (Server-Authoritative)
 */
export const cancelOrderAuthoritative = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => handleCancelOrderAuthoritative(db, request)
);

/**
 * 🔒 Merchant Shop Applications (Self-Service Onboarding & Staff Review)
 */
export const createShopApplication = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => handleCreateShopApplication(db, request)
);

export const reviewShopApplication = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => handleReviewShopApplication(db, authAdmin, request)
);

/**
 * 🔒 Chat System (Server-Authoritative Messaging & Merchant Auto-Replies)
 */
export const sendChatMessageAuthoritative = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => handleSendChatMessageAuthoritative(db, request)
);

/**
 * 🔒 PromptPay QR Intent Generation (2C2P / Bank Gateway Integration)
 */
export const createPromptPayQRIntent = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { orderId, amount } = request.data || {};
    return await createPromptPayIntent(db, { orderId, amount, uid: request.auth.uid });
  }
);

/**
 * 🔒 Emergency Lookup Audit Record (Server-Authoritative)
 */
export const recordEmergencyLookupAuthoritative = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => handleRecordEmergencyLookupAuthoritative(db, request)
);

// Re-export payment webhook for HTTPS callback
export { paymentWebhook };


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
 * Verifying also writes `guardianIds` onto the student document. That
 * field is what firestore.rules reads to grant a guardian access to view
 * health profiles and allergen alerts.
 *
 * decision:
 *   VERIFIED  - approve a PENDING link, granting access
 *   REJECTED  - decline a PENDING link
 *   REVOKED   - withdraw a previously VERIFIED link and remove the access it granted
 */

/**
 * Verifies caller is a staff supervisor or system administrator
 */
async function isStaffOrAdmin(db, auth) {
  if (!auth || !auth.uid) return false;
  const token = auth.token || {};
  if (token.admin === true || token.role === "admin" || token.role === "staff_supervisor" || token.staffSupervisor === true) {
    return true;
  }
  const snap = await db.collection("staff_supervisors").doc(auth.uid).get();
  return snap.exists;
}

/**
 * 🔒 Review Parent-Child Link (School Staff Only)
 *
 * Staff supervisors review linking requests. Decisions:
 *   VERIFIED  - approve the link and grant access to student info
 *   REJECTED  - turn down an invalid request
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
      const walletRef = db.collection("student_wallets").doc(studentId);
      const standardWalletRef = db.collection("wallets").doc(studentId);

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
        tx.set(walletRef, { guardianIds: FieldValue.arrayUnion(guardianId) }, { merge: true });
        tx.set(standardWalletRef, { guardianIds: FieldValue.arrayUnion(guardianId) }, { merge: true });
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
        tx.set(standardWalletRef, { guardianIds: FieldValue.arrayRemove(guardianId) }, { merge: true });
      } else {
        tx.update(linkRef, {
          status: outcome.nextStatus,
          verifiedBySchool: false,
          reviewedBy: reviewerUid,
          reviewedAt: FieldValue.serverTimestamp(),
          reviewNote: typeof note === "string" ? note.slice(0, 500) : "",
        });
      }

      // Record immutable audit trail
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

    // Recent meals, for allergen tracing. Consults studentId and userId.
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
 * Daily routine for maintenance tasks and health monitoring.
 */
export const scheduledDailyMaintenance = onSchedule(
  { schedule: "0 0 * * *", timeZone: "Asia/Bangkok", region: "asia-southeast1" },
  async () => {
    console.log("[QueueUp] Daily maintenance routine triggered successfully.");
  }
);

