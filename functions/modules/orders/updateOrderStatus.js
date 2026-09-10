import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Coupled Order & Queue State Machine Transition Rules
 */
export function isValidTransition(oldStatus, oldQueue, newStatus, newQueue) {
  const normOldStatus = String(oldStatus || "PENDING").toUpperCase();
  const normOldQueue = String(oldQueue || "waiting").toLowerCase();
  const normNewStatus = String(newStatus || "").toUpperCase();
  const normNewQueue = String(newQueue || "").toLowerCase();

  // Self transition
  if (normOldStatus === normNewStatus && normOldQueue === normNewQueue) return true;

  // Valid progressions
  if ((normOldStatus === "PENDING" || normOldStatus === "RESERVED") && normOldQueue === "waiting" && normNewStatus === "CONFIRMED" && normNewQueue === "waiting") return true;
  if (normOldStatus === "CONFIRMED" && normOldQueue === "waiting" && normNewStatus === "PREPARING" && normNewQueue === "cooking") return true;
  if (normOldStatus === "PREPARING" && normOldQueue === "cooking" && normNewStatus === "READY" && normNewQueue === "ready") return true;
  if (normOldStatus === "READY" && normOldQueue === "ready" && normNewStatus === "COMPLETED" && normNewQueue === "completed") return true;
  if ((normOldStatus === "PENDING" || normOldStatus === "CONFIRMED" || normOldStatus === "RESERVED") && normNewStatus === "CANCELLED" && normNewQueue === "cancelled") return true;

  return false;
}

/**
 * 🔒 Update Order Status Authoritative (Server-Authoritative)
 */
export async function handleUpdateOrderStatusAuthoritative(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "AUTHENTICATION_REQUIRED: กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }

  const callerUid = request.auth.uid;
  const isCallerAdmin = Boolean(
    request.auth.token?.admin === true ||
    request.auth.token?.role === "admin"
  );

  const {
    orderId,
    status: statusParam,
    newStatus: newStatusParam,
    queueStatus: queueParam,
    newQueueStatus: newQueueParam,
    paymentConfirmedByStore,
    merchantNote,
    estimatedReadyTime,
  } = request.data || {};

  const newStatus = newStatusParam || statusParam;
  const newQueueStatus = newQueueParam || queueParam;

  if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
    throw new HttpsError("invalid-argument", "ORDER_ID_REQUIRED: กรุณาระบุรหัสคำสั่งซื้อ");
  }

  const cleanOrderId = orderId.trim();

  return await db.runTransaction(async (tx) => {
    const orderRef = db.collection("orders").doc(cleanOrderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError("not-found", `ORDER_NOT_FOUND: ไม่พบคำสั่งซื้อรหัส ${cleanOrderId}`);
    }

    const orderData = orderSnap.data();
    const storeId = orderData.storeId;

    // Check store ownership
    let isStoreOwner = false;
    if (storeId) {
      const shopSnap = await tx.get(db.collection("shops").doc(storeId));
      if (shopSnap.exists && shopSnap.data().ownerUid === callerUid) {
        isStoreOwner = true;
      }
    }

    if (!isStoreOwner && !isCallerAdmin) {
      throw new HttpsError("permission-denied", "PERMISSION_DENIED: เฉพาะเจ้าของร้านหรือผู้ดูแลระบบเท่านั้นที่สามารถอัปเดตสถานะคำสั่งซื้อได้");
    }

    const currentStatus = orderData.status || orderData.orderStatus || "PENDING";
    const currentQueue = orderData.queueStatus || "waiting";

    if (!isValidTransition(currentStatus, currentQueue, newStatus, newQueueStatus)) {
      throw new HttpsError(
        "failed-precondition",
        `INVALID_STATE_TRANSITION: ไม่สามารถเปลี่ยนสถานะจาก [${currentStatus} / ${currentQueue}] เป็น [${newStatus} / ${newQueueStatus}] ได้`
      );
    }

    const updatePayload = {
      status: newStatus,
      orderStatus: newStatus,
      queueStatus: newQueueStatus,
      lastUpdatedBy: callerUid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof merchantNote === "string" && merchantNote.trim()) {
      updatePayload.merchantNote = merchantNote.trim().slice(0, 300);
    }
    if (typeof estimatedReadyTime === "string" && estimatedReadyTime.trim()) {
      updatePayload.estimatedReadyTime = estimatedReadyTime.trim().slice(0, 50);
    }

    // Store confirming payment for Pay at Store orders
    if (paymentConfirmedByStore === true && orderData.paymentMethod === "PAY_AT_STORE") {
      updatePayload.paymentStatus = "PAID";
      updatePayload.paidAt = FieldValue.serverTimestamp();
      updatePayload.paymentConfirmedByStore = true;
    }

    tx.update(orderRef, updatePayload);

    return {
      ok: true,
      orderId: cleanOrderId,
      status: newStatus,
      queueStatus: newQueueStatus,
      paymentStatus: updatePayload.paymentStatus || orderData.paymentStatus,
    };
  });
}
