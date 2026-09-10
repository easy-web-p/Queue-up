import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * 🔒 Record Medical Emergency Lookup Audit Log (Server-Authoritative)
 *
 * Enforces server timestamp and verifies that only authenticated staff supervisors
 * or admins can record and access medical emergency lookups.
 */
export async function handleRecordEmergencyLookupAuthoritative(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "AUTHENTICATION_REQUIRED");
  }

  const callerUid = request.auth.uid;
  const isStaff = request.auth.token?.staff_supervisor === true || request.auth.token?.staffSupervisor === true || request.auth.token?.role === "staff_supervisor";
  const isAdmin = request.auth.token?.admin === true || request.auth.token?.role === "admin";

  if (!isStaff && !isAdmin) {
    throw new HttpsError("permission-denied", "PERMISSION_DENIED: Only campus staff supervisors or admins may record emergency audits");
  }

  const { studentId, studentName, reason, severity = "URGENT" } = request.data || {};
  if (!studentId || typeof studentId !== "string" || !studentId.trim()) {
    throw new HttpsError("invalid-argument", "STUDENT_ID_REQUIRED");
  }

  const auditRef = db.collection("emergency_audit_logs").doc();
  const auditPayload = {
    id: auditRef.id,
    auditId: auditRef.id,
    action: "EMERGENCY_MEDICAL_LOOKUP",
    actorUid: callerUid,
    actorName: request.auth.token?.name || request.auth.token?.email || "Campus Staff",
    studentId: studentId.trim(),
    studentName: typeof studentName === "string" ? studentName.slice(0, 100) : "",
    reason: typeof reason === "string" ? reason.slice(0, 500) : "Medical emergency food check",
    severity: ["LOW", "MEDIUM", "URGENT", "CRITICAL"].includes(severity) ? severity : "URGENT",
    timestamp: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };

  await auditRef.set(auditPayload);

  return {
    success: true,
    auditId: auditRef.id,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 🔒 Record Merchant Operational Audit Log (Server-Authoritative)
 */
export async function handleRecordMerchantAuditLog(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "AUTHENTICATION_REQUIRED");
  }

  const callerUid = request.auth.uid;
  const isCallerAdmin = request.auth.token?.admin === true || request.auth.token?.role === "admin";
  const { storeId, action, targetId, details, reason } = request.data || {};

  if (!storeId || typeof storeId !== "string" || !storeId.trim()) {
    throw new HttpsError("invalid-argument", "STORE_ID_REQUIRED");
  }

  const cleanStoreId = storeId.trim();

  // Verify store ownership
  let isOwner = false;
  const shopSnap = await db.collection("shops").doc(cleanStoreId).get();
  if (shopSnap.exists && shopSnap.data().ownerUid === callerUid) {
    isOwner = true;
  }

  if (!isOwner && !isCallerAdmin) {
    throw new HttpsError("permission-denied", "PERMISSION_DENIED: Caller is not the owner of this store or admin");
  }

  const auditRef = db.collection("merchant_audit_logs").doc();
  const auditEntry = {
    id: auditRef.id,
    storeId: cleanStoreId,
    actorUid: callerUid,
    actorRole: isCallerAdmin ? "admin" : "merchant",
    action: typeof action === "string" ? action.slice(0, 100) : "MERCHANT_ACTION",
    targetId: typeof targetId === "string" ? targetId.slice(0, 100) : null,
    details: details && typeof details === "object" ? details : {},
    reason: typeof reason === "string" ? reason.slice(0, 500) : "",
    timestamp: FieldValue.serverTimestamp(),
  };

  await auditRef.set(auditEntry);

  return {
    success: true,
    auditId: auditRef.id,
  };
}
