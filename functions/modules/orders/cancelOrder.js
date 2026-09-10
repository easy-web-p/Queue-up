import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { getCanonicalSlotId } from "./slotHelper.js";

/**
 * 🔒 Cancel Order Authoritative (Server-Authoritative)
 *
 * Verifies caller authorization, confirms cancellable lifecycle state,
 * restores stock, restores slot capacity using canonical slot ID,
 * and refunds Wallet balance if payment was made via Campus Wallet.
 */
export async function handleCancelOrderAuthoritative(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "AUTHENTICATION_REQUIRED: กรุณาเข้าสู่ระบบก่อนทำรายการ");
  }

  const { orderId, reason } = request.data || {};
  if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
    throw new HttpsError("invalid-argument", "ORDER_ID_REQUIRED: กรุณาระบุรหัสคำสั่งซื้อ");
  }

  const cleanOrderId = orderId.trim();
  const callerUid = request.auth.uid;
  const isCallerAdmin = request.auth.token?.admin === true || request.auth.token?.role === "admin";

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

    const isOrderCustomer = orderData.userId === callerUid;
    if (!isOrderCustomer && !isStoreOwner && !isCallerAdmin) {
      throw new HttpsError("permission-denied", "PERMISSION_DENIED: คุณไม่มีสิทธิ์ยกเลิกคำสั่งซื้อนี้");
    }

    // Customer can only cancel in PENDING or waiting states before cooking begins
    const currentStatus = String(orderData.status || orderData.orderStatus || "PENDING").toUpperCase();
    const currentQueueStatus = String(orderData.queueStatus || "waiting").toLowerCase();

    if (isOrderCustomer && !isStoreOwner && !isCallerAdmin) {
      if (currentStatus !== "PENDING" && currentStatus !== "CONFIRMED" && currentStatus !== "RESERVED") {
        throw new HttpsError("failed-precondition", `CANNOT_CANCEL_IN_STATE: ไม่สามารถยกเลิกได้เนื่องจากร้านค้าเริ่มปรุงอาหารแล้ว (${currentStatus})`);
      }
      if (currentQueueStatus !== "waiting") {
        throw new HttpsError("failed-precondition", `CANNOT_CANCEL_IN_QUEUE: ไม่สามารถยกเลิกได้เนื่องจากคิวอยู่ในสถานะ ${currentQueueStatus}`);
      }
    }

    if (currentStatus === "CANCELLED" || currentStatus === "COMPLETED") {
      throw new HttpsError("failed-precondition", `ORDER_ALREADY_FINAL: คำสั่งซื้ออยู่ในสถานะสิ้นสุดแล้ว (${currentStatus})`);
    }

    // 1. Mark Order CANCELLED
    const cancelPayload = {
      status: "CANCELLED",
      orderStatus: "CANCELLED",
      queueStatus: "cancelled",
      paymentStatus: orderData.paymentStatus === "PAID" ? "REFUNDED" : "CANCELLED",
      cancelledBy: callerUid,
      cancelledByRole: isCallerAdmin ? "admin" : isStoreOwner ? "merchant" : "customer",
      cancelReason: typeof reason === "string" ? reason.slice(0, 300) : "Customer or Merchant Cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.update(orderRef, cancelPayload);

    // 2. Restore Product Stock
    if (Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const productId = item.productId || item.id;
        const qty = Number(item.quantity || item.qty) || 0;
        if (productId && typeof productId === "string" && qty > 0) {
          const productRef = db.collection("products").doc(productId);
          tx.update(productRef, {
            stock: FieldValue.increment(qty),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    // 3. Release Slot Allocation using CANONICAL slot ID helper
    if (storeId && orderData.pickupDate && orderData.pickupTime) {
      const canonicalSlotId = getCanonicalSlotId(storeId, orderData.pickupDate, orderData.pickupTime);
      const slotRef = db.collection("store_slots").doc(canonicalSlotId);
      const slotSnap = await tx.get(slotRef);
      if (slotSnap.exists) {
        tx.update(slotRef, {
          currentOrders: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    // 4. Wallet Refund if paid via Campus Wallet
    if (orderData.paymentMethod === "WALLET" && orderData.paymentStatus === "PAID" && orderData.finalAmountSatang > 0) {
      const walletId = orderData.studentId || orderData.userId;
      const walletRef = db.collection("wallets").doc(walletId);
      const walletSnap = await tx.get(walletRef);
      if (walletSnap.exists) {
        const refundSatang = orderData.finalAmountSatang;
        tx.update(walletRef, {
          balanceSatang: FieldValue.increment(refundSatang),
          dailySpentSatang: FieldValue.increment(-refundSatang),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Write Refund Ledger Record
        const refundTxRef = db.collection("wallet_transactions").doc();
        tx.set(refundTxRef, {
          id: refundTxRef.id,
          walletId,
          studentId: walletId,
          actorUid: callerUid,
          type: "REFUND",
          amountSatang: refundSatang,
          amountBaht: refundSatang / 100,
          orderId: cleanOrderId,
          storeId,
          description: `คืนเงินคำสั่งซื้อ #${cleanOrderId} (ยกเลิก)`,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return {
      ok: true,
      orderId: cleanOrderId,
      status: "CANCELLED",
      queueStatus: "cancelled",
    };
  });
}
