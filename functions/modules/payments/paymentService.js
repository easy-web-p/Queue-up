import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { TwoC2pProvider } from "./twoC2pProvider.js";
import { getCanonicalSlotId } from "../orders/slotHelper.js";

const defaultGateway = new TwoC2pProvider();

/**
 * 💳 Process Campus Wallet Payment inside an ongoing Firestore Transaction
 *
 * Enforces atomic balance deduction, daily spending limit validation,
 * locked wallet checks, and writes to the immutable /wallet_transactions ledger.
 */
export async function processWalletPaymentInTransaction(tx, db, { studentOrUserId, amountSatang, orderId, storeId }) {
  const walletRef = db.collection("wallets").doc(studentOrUserId);
  const walletSnap = await tx.get(walletRef);

  if (!walletSnap.exists) {
    throw new HttpsError("failed-precondition", `WALLET_NOT_FOUND: ไม่พบบัญชีกระเป๋าเงินสำหรับรหัส ${studentOrUserId}`);
  }

  const walletData = walletSnap.data();

  if (walletData.isLocked === true || walletData.status === "LOCKED") {
    throw new HttpsError("failed-precondition", "CAMPUS_WALLET_LOCKED: กระเป๋าเงินถูกระงับการใช้งานชั่วคราว กรุณาติดต่อฝ่ายกิจการนักเรียน");
  }

  const balanceSatang = Number(walletData.balanceSatang) || 0;
  if (balanceSatang < amountSatang) {
    throw new HttpsError(
      "failed-precondition",
      `INSUFFICIENT_WALLET_BALANCE: ยอดเงินใน Campus Wallet ไม่เพียงพอ (คงเหลือ ฿${(balanceSatang / 100).toFixed(2)} แต่ยอดชำระ ฿${(amountSatang / 100).toFixed(2)})`
    );
  }

  // Daily Spending Limit Check
  const dailyLimitSatang = Number(walletData.dailyLimitSatang) || 50000; // Default 500 THB
  const dailySpentSatang = Number(walletData.dailySpentSatang) || 0;
  if (dailySpentSatang + amountSatang > dailyLimitSatang) {
    throw new HttpsError(
      "failed-precondition",
      `DAILY_LIMIT_EXCEEDED: เกินวงเงินจำกัดการใช้จ่ายรายวัน (ใช้วันนี้ไปแล้ว ฿${(dailySpentSatang / 100).toFixed(2)} / โควตา ฿${(dailyLimitSatang / 100).toFixed(2)})`
    );
  }

  // Deduct Wallet Balance
  tx.update(walletRef, {
    balanceSatang: FieldValue.increment(-amountSatang),
    dailySpentSatang: FieldValue.increment(amountSatang),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Write Immutable Ledger Record
  const txRef = db.collection("wallet_transactions").doc();
  const txPayload = {
    id: txRef.id,
    walletId: studentOrUserId,
    studentId: studentOrUserId,
    actorUid: studentOrUserId,
    type: "PAYMENT",
    amountSatang: -amountSatang,
    amountBaht: -(amountSatang / 100),
    orderId,
    storeId,
    description: `ชำระค่าอาหารคำสั่งซื้อ #${orderId}`,
    balanceAfterSatang: balanceSatang - amountSatang,
    createdAt: FieldValue.serverTimestamp(),
  };
  tx.set(txRef, txPayload);

  return {
    success: true,
    transactionId: txRef.id,
    paidAmountSatang: amountSatang,
  };
}

/**
 * 📲 Create PromptPay QR Payment Intent via Gateway
 */
export async function createPromptPayIntent({ orderId, amountSatang, description }) {
  return await defaultGateway.createPromptPayIntent({
    orderId,
    amountSatang,
    description: description || `QueueUp Order ${orderId}`,
    expiresInMinutes: 15,
  });
}

/**
 * ⚡ Process Payment Webhook Callback (Server-to-Server, Signed)
 */
export async function handlePaymentWebhook(db, headers, rawBody) {
  const result = await defaultGateway.verifyWebhookSignature(headers, rawBody);
  if (!result.isValid) {
    return { status: 400, body: { error: "INVALID_SIGNATURE", reason: result.reason } };
  }

  const { orderId, paidAmountSatang, paymentStatus, transactionRef } = result;

  // Idempotency: Run Firestore transaction to update order and lock against replay
  const outcome = await db.runTransaction(async (tx) => {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) {
      return { ok: false, error: "ORDER_NOT_FOUND" };
    }

    const orderData = orderSnap.data();

    // If already marked PAID, return idempotent success
    if (orderData.paymentStatus === "PAID") {
      return { ok: true, alreadyPaid: true, orderId };
    }

    if (paymentStatus === "PAID") {
      tx.update(orderRef, {
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        status: "CONFIRMED",
        paidAt: FieldValue.serverTimestamp(),
        paymentRef: transactionRef,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Append Audit Log
      const auditRef = db.collection("audit_logs").doc();
      tx.set(auditRef, {
        action: "PAYMENT_CONFIRMED_WEBHOOK",
        orderId,
        storeId: orderData.storeId,
        amountSatang: paidAmountSatang,
        paymentRef: transactionRef,
        timestamp: FieldValue.serverTimestamp(),
      });

      return { ok: true, paid: true, orderId };
    } else {
      tx.update(orderRef, {
        paymentStatus: "FAILED",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { ok: true, paid: false, orderId };
    }
  });

  return { status: 200, body: outcome };
}

/**
 * ⏳ Release Expired PromptPay Reservation (TTL Expiry Cleanup)
 */
export async function releaseExpiredReservation(db, orderId) {
  return await db.runTransaction(async (tx) => {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) return false;

    const orderData = orderSnap.data();
    if (orderData.paymentStatus !== "PENDING_QR") {
      return false; // Only release pending QR reservations
    }

    // 1. Mark Order EXPIRED / CANCELLED
    tx.update(orderRef, {
      paymentStatus: "EXPIRED",
      orderStatus: "CANCELLED",
      status: "CANCELLED",
      queueStatus: "cancelled",
      cancelReason: "PROMPTPAY_RESERVATION_TIMEOUT",
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 2. Restore Product Stock
    if (Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const prodId = item.productId || item.id;
        const qty = Number(item.quantity) || 0;
        if (prodId && qty > 0) {
          tx.update(db.collection("products").doc(prodId), {
            stock: FieldValue.increment(qty),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    // 3. Release Slot Quota using Canonical Slot ID
    if (orderData.storeId && orderData.pickupDate && orderData.pickupTime) {
      const canonicalSlotId = getCanonicalSlotId(orderData.storeId, orderData.pickupDate, orderData.pickupTime);
      const slotRef = db.collection("store_slots").doc(canonicalSlotId);
      tx.update(slotRef, {
        currentOrders: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return true;
  });
}
