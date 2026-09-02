/* global Buffer */
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";

initializeApp();
const db = getFirestore();
const opnSecretKey = defineSecret("OPN_SECRET_KEY");

async function opnRequest(path, key, body) {
  const response = await fetch(`https://api.omise.co${path}`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new HttpsError("internal", json.message || "Payment provider rejected the request.");
  return json;
}

async function retrieveCharge(chargeId, key) {
  const response = await fetch(`https://api.omise.co/charges/${encodeURIComponent(chargeId)}`, {
    headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
  });
  if (!response.ok) throw new Error("Unable to verify charge with Opn.");
  return response.json();
}

const ALLOWED_SLOTS = ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00"];
const TOPPING_PRICES = {
  "ไข่ดาว": 10,
  "ไข่เจียว": 10,
  "หมูกรอบพิเศษ": 15,
  "กุนเชียง": 10,
  "ชีส": 15,
  "เพิ่มเส้น/ข้าว": 10,
};

export const createPromptPayPayment = onCall(
  { region: "asia-southeast1", secrets: [opnSecretKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
    const { productId, quantity = 1, modifiers = [], couponCode, booking, idempotencyKey } = request.data || {};
    if (typeof productId !== "string" || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new HttpsError("invalid-argument", "Invalid order details.");
    }

    const orderRef = db.collection("orders").doc();
    const productRef = db.collection("products").doc(productId);
    const idempotencyDocId = typeof idempotencyKey === "string" && idempotencyKey.trim()
      ? `${request.auth.uid}_${idempotencyKey.trim()}`
      : null;
    const idempotencyRef = idempotencyDocId ? db.collection("idempotency_keys").doc(idempotencyDocId) : null;
    let reservedSlotDocId = null;

    const { totalSatang, existingResult, computedDetails } = await db.runTransaction(async (transaction) => {
      if (idempotencyRef) {
        const idempSnap = await transaction.get(idempotencyRef);
        if (idempSnap.exists) {
          const existingOrderId = idempSnap.data().orderId;
          const existingOrderDoc = await transaction.get(db.collection("orders").doc(existingOrderId));
          if (existingOrderDoc.exists) {
            const ord = existingOrderDoc.data();
            if (ord.paymentStatus !== "creation_failed" && ord.paymentStatus !== "cancelled" && ord.paymentStatus !== "expired") {
              return {
                existingResult: {
                  orderId: ord.orderId,
                  paymentId: ord.paymentId,
                  qrUrl: ord.qrUrl,
                  subtotal: ord.subtotal,
                  discountAmount: ord.discountAmount,
                  totalAmount: ord.totalAmount,
                  expiresAt: ord.expiresAt || null,
                }
              };
            }
          }
        }
      }

      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists) throw new HttpsError("not-found", "Product is not available for payment.");
      const product = productSnap.data();
      if (product.isAvailable === false) throw new HttpsError("failed-precondition", "เมนูนี้ปิดรับออเดอร์ชั่วคราว");
      if (typeof product.stock === "number" && product.stock < quantity) {
        throw new HttpsError("failed-precondition", `สินค้าในสต็อกไม่เพียงพอ (คงเหลือ ${product.stock} รายการ)`);
      }

      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new HttpsError("failed-precondition", "Invalid product price in database.");

      let modifierUnitPrice = 0;
      const sanitizedModifiers = [];
      if (Array.isArray(modifiers)) {
        for (const mod of modifiers) {
          if (mod && mod.id === "topping" && Array.isArray(mod.value)) {
            for (const topName of mod.value) {
              const topPrice = TOPPING_PRICES[topName] ?? product.toppingPrices?.[topName];
              if (typeof topPrice !== "number" || topPrice < 0) throw new HttpsError("invalid-argument", `ไม่พบตัวเลือกท็อปปิ้ง: ${topName}`);
              modifierUnitPrice += topPrice;
              sanitizedModifiers.push({ id: "topping", name: topName, price: topPrice });
            }
          } else if (mod && mod.id === "spicy") {
            sanitizedModifiers.push({ id: "spicy", value: String(mod.value || "ปกติ") });
          } else if (mod && mod.id === "note") {
            sanitizedModifiers.push({ id: "note", value: String(mod.value || "").slice(0, 100) });
          }
        }
      }

      const effectiveUnitPrice = unitPrice + modifierUnitPrice;
      const subtotal = effectiveUnitPrice * quantity;
      const storeId = String(product.storeId || product.shopId || "STORE_DEFAULT");
      const storeName = String(product.storeName || product.shopName || "ร้านค้าในโรงเรียน");

      if (booking && booking.date && (booking.timeSlot || booking.time)) {
        const slotTime = String(booking.timeSlot || booking.time).trim();
        const slotDate = String(booking.date).trim();
        if (!ALLOWED_SLOTS.includes(slotTime)) throw new HttpsError("invalid-argument", `รอบเวลารับประทานไม่ถูกต้อง (${slotTime})`);
        const parsedDate = new Date(slotDate);
        if (isNaN(parsedDate.getTime())) throw new HttpsError("invalid-argument", "รูปแบบวันที่ไม่ถูกต้อง");

        const nowUtc = new Date();
        const thaiTimeStr = nowUtc.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
        const thaiNow = new Date(thaiTimeStr);
        const currentThaiYmd = `${thaiNow.getFullYear()}-${String(thaiNow.getMonth() + 1).padStart(2, "0")}-${String(thaiNow.getDate()).padStart(2, "0")}`;
        if (slotDate < currentThaiYmd) throw new HttpsError("invalid-argument", "ไม่สามารถเลือกวันที่ย้อนหลังได้");
        if (slotDate === currentThaiYmd) {
          const [slotHour, slotMinute] = slotTime.split(":").map(Number);
          if (slotHour < thaiNow.getHours() || (slotHour === thaiNow.getHours() && slotMinute <= thaiNow.getMinutes())) {
            throw new HttpsError("invalid-argument", `รอบเวลา ${slotTime} ของวันนี้ผ่านไปแล้ว กรุณาเลือกรอบเวลาถัดไป`);
          }
        }

        const shopRef = db.collection("shops").doc(storeId);
        const shopSnap = await transaction.get(shopRef);
        const shopData = shopSnap.exists ? shopSnap.data() : null;
        if (shopData?.pickupSlots && Array.isArray(shopData.pickupSlots) && !shopData.pickupSlots.includes(slotTime)) {
          throw new HttpsError("failed-precondition", `ร้านค้านี้ไม่เปิดรับออเดอร์ในรอบเวลา ${slotTime}`);
        }

        const storeConfiguredCapacity = shopData?.slotCapacity ?? shopData?.maxOrdersPerSlot;
        reservedSlotDocId = `${storeId}_${slotDate}_${slotTime}`;
        const slotRef = db.collection("store_slots").doc(reservedSlotDocId);
        const slotSnap = await transaction.get(slotRef);
        if (typeof storeConfiguredCapacity !== "number" && !slotSnap.exists) {
          throw new HttpsError("failed-precondition", "ร้านค้ายังไม่ได้เปิดการตั้งค่าความจุสำหรับรอบเวลานี้");
        }
        const currentOrders = slotSnap.exists ? Number(slotSnap.data().currentOrders || 0) : 0;
        const capacityVal = slotSnap.exists && typeof slotSnap.data().capacity === "number" ? Number(slotSnap.data().capacity) : Number(storeConfiguredCapacity);
        if (!Number.isFinite(capacityVal) || capacityVal <= 0) throw new HttpsError("failed-precondition", "ร้านค้ายังไม่ได้กำหนดขีดจำกัดจำนวนออเดอร์สำหรับรอบเวลานี้");
        if (currentOrders + quantity > capacityVal) {
          throw new HttpsError("failed-precondition", `รอบเวลา ${slotTime} วันที่ ${slotDate} เต็มแล้ว (รองรับได้สูงสุด ${capacityVal} คิว)`);
        }
        transaction.set(slotRef, { storeId, date: slotDate, timeSlot: slotTime, currentOrders: currentOrders + quantity, capacity: capacityVal, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      let discountAmount = 0;
      if (typeof couponCode === "string" && couponCode.trim()) {
        const cleanCode = couponCode.trim().toUpperCase();
        const couponSnap = await transaction.get(db.collection("coupons").doc(cleanCode));
        if (couponSnap.exists) {
          const coupon = couponSnap.data();
          const minSpend = Number(coupon.minSpend) || 0;
          const discountVal = Number(coupon.discount) || 0;
          const isNotExpired = !coupon.expiryDate || new Date(coupon.expiryDate) > new Date();
          const isStoreMatch = !coupon.storeId || coupon.scope === "platform" || coupon.storeId === storeId;
          if (coupon.status === "Active" && isNotExpired && isStoreMatch && subtotal >= minSpend && discountVal > 0) {
            if (coupon.discountType === "percent" || coupon.type === "percent") discountAmount = Math.round((subtotal * Math.min(100, Math.max(0, discountVal))) / 100);
            else discountAmount = Math.min(subtotal, discountVal);
          }
        }
      }

      const finalAmount = Math.max(1, subtotal - discountAmount);
      const satang = Math.round(finalAmount * 100);
      if (typeof product.stock === "number") {
        transaction.update(productRef, { stock: product.stock - quantity, updatedAt: FieldValue.serverTimestamp() });
      }

      const orderData = {
        id: orderRef.id,
        orderId: orderRef.id,
        idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey.trim() : null,
        userId: request.auth.uid,
        storeId,
        storeName,
        productId,
        itemTitle: String(product.name || "QueueUp order").slice(0, 250),
        items: [{ productId, name: product.name, basePrice: unitPrice, modifierPrice: modifierUnitPrice, price: effectiveUnitPrice, quantity, modifiers: sanitizedModifiers }],
        modifiers: sanitizedModifiers,
        quantity,
        reservedQuantity: quantity,
        releasedQuantity: 0,
        booking: booking || null,
        subtotal,
        discountAmount,
        totalAmount: finalAmount,
        totalPrice: finalAmount,
        currency: "THB",
        paymentProvider: "opn",
        paymentMethod: "promptpay",
        paymentStatus: "pending",
        resourcesReleased: false,
        queueStatus: "waiting",
        status: "TO_SHIP",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      if (idempotencyRef) transaction.set(idempotencyRef, { orderId: orderRef.id, userId: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
      transaction.set(orderRef, orderData);
      return { totalSatang: satang, computedDetails: { subtotal, discountAmount, totalAmount: finalAmount } };
    });

    if (existingResult) {
      if (!existingResult.qrUrl && existingResult.paymentId) {
        try {
          const recoveredCharge = await retrieveCharge(existingResult.paymentId, opnSecretKey.value());
          const recoveredQr = recoveredCharge.source?.scannable_code?.image?.download_uri;
          if (recoveredQr) {
            await db.collection("orders").doc(existingResult.orderId).update({ qrUrl: recoveredQr, updatedAt: FieldValue.serverTimestamp() });
            existingResult.qrUrl = recoveredQr;
          }
        } catch (recoverErr) {
          console.warn("Charge recovery warning:", recoverErr);
        }
      }
      return existingResult;
    }

    let createdCharge = null;
    try {
      createdCharge = await opnRequest("/charges", opnSecretKey.value(), { amount: totalSatang, currency: "THB", description: `QueueUp ${orderRef.id}`, metadata: { orderId: orderRef.id, uid: request.auth.uid }, source: { type: "promptpay" } });
      const qrUrl = createdCharge.source?.scannable_code?.image?.download_uri;
      if (!qrUrl) throw new Error("PromptPay QR was not returned by provider.");
      await orderRef.update({ paymentId: createdCharge.id, qrUrl, expiresAt: createdCharge.expires_at || null, updatedAt: FieldValue.serverTimestamp() });
      return { orderId: orderRef.id, paymentId: createdCharge.id, qrUrl, subtotal: computedDetails.subtotal, discountAmount: computedDetails.discountAmount, totalAmount: computedDetails.totalAmount, expiresAt: createdCharge.expires_at || null };
    } catch (error) {
      const failureUpdate = { paymentStatus: "creation_failed", error: String(error?.message || "Payment provider error"), updatedAt: FieldValue.serverTimestamp() };
      if (createdCharge?.id) {
        failureUpdate.paymentId = createdCharge.id;
        failureUpdate.paymentStatus = "charge_created_order_pending";
      }
      await orderRef.update(failureUpdate);
      if (!createdCharge?.id) {
        try { await releaseOrderResources(orderRef, "Payment charge creation failed"); }
        catch (releaseErr) { console.warn("Atomic release after charge creation failure warning:", releaseErr); }
      }
      throw error;
    }
  }
);

// 🔒 Atomic, idempotent release. ALL transaction reads happen before any transaction write.
export async function releaseOrderResources(orderDocRef, cancelReason = "Payment expired") {
  return db.runTransaction(async (transaction) => {
    const freshSnap = await transaction.get(orderDocRef);
    if (!freshSnap.exists) return false;
    const data = freshSnap.data();
    if (data.paymentStatus === "paid" || data.paymentStatus === "paid_after_expired" || data.resourcesReleased === true) return false;

    const qty = Number(data.reservedQuantity ?? data.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      transaction.update(orderDocRef, {
        paymentStatus: "expired",
        status: "CANCELLED",
        cancelReason,
        resourcesReleased: true,
        releasedQuantity: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    }

    const productRef = data.productId ? db.collection("products").doc(data.productId) : null;
    const slotRef = data.booking?.date && (data.booking.timeSlot || data.booking.time) && data.storeId
      ? db.collection("store_slots").doc(`${data.storeId}_${String(data.booking.date).trim()}_${String(data.booking.timeSlot || data.booking.time).trim()}`)
      : null;

    // IMPORTANT: Firestore requires all transaction reads before writes.
    const productSnap = productRef ? await transaction.get(productRef) : null;
    const slotSnap = slotRef ? await transaction.get(slotRef) : null;

    const warnings = [];
    let stockAfterRelease = null;
    if (productRef) {
      if (!productSnap?.exists) {
        warnings.push("PRODUCT_MISSING");
      } else {
        const currentStock = Number(productSnap.data().stock);
        if (!Number.isFinite(currentStock) || currentStock < 0) {
          warnings.push("STOCK_COUNTER_INVALID");
        } else {
          stockAfterRelease = currentStock + qty;
        }
      }
    }

    let slotAfterRelease = null;
    if (slotRef) {
      if (!slotSnap?.exists) {
        warnings.push("SLOT_MISSING");
      } else {
        const currentOrders = Number(slotSnap.data().currentOrders);
        if (!Number.isFinite(currentOrders) || currentOrders < 0) {
          warnings.push("SLOT_COUNTER_INVALID");
          slotAfterRelease = 0;
        } else {
          if (currentOrders < qty) warnings.push("SLOT_COUNTER_INCONSISTENCY");
          slotAfterRelease = Math.max(0, currentOrders - qty);
        }
      }
    }

    // Writes begin only after every read is complete.
    if (productRef && productSnap?.exists && stockAfterRelease !== null) {
      transaction.update(productRef, { stock: stockAfterRelease, updatedAt: FieldValue.serverTimestamp() });
    }
    if (slotRef && slotSnap?.exists && slotAfterRelease !== null) {
      transaction.update(slotRef, { currentOrders: slotAfterRelease, updatedAt: FieldValue.serverTimestamp() });
    }

    const releaseAuditRef = db.collection("audit_logs").doc(`resource_release_${orderDocRef.id}`);
    transaction.set(releaseAuditRef, {
      actorUid: "system",
      actorType: "system",
      action: "RESOURCE_RELEASE",
      orderId: orderDocRef.id,
      productId: data.productId || null,
      storeId: data.storeId || null,
      quantity: qty,
      warnings,
      stockAfterRelease,
      slotAfterRelease,
      reason: cancelReason,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.update(orderDocRef, {
      paymentStatus: "expired",
      status: "CANCELLED",
      cancelReason,
      resourcesReleased: true,
      releasedQuantity: qty,
      resourceReleaseWarnings: warnings,
      resourceReleaseReason: cancelReason,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

// ⏰ Automated Cloud Scheduler: expires stale orders every 5 minutes.
export const scheduledExpirePendingOrders = onSchedule(
  { schedule: "every 5 minutes", region: "asia-southeast1" },
  async () => {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const staleSnap = await db.collection("orders")
      .where("paymentStatus", "in", ["pending", "charge_created_order_pending"])
      .where("createdAt", "<=", fifteenMinutesAgo)
      .limit(50)
      .get();
    for (const doc of staleSnap.docs) await releaseOrderResources(doc.ref, "Payment window expired (15 minutes)");
  }
);

export const expirePendingOrders = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const staleSnap = await db.collection("orders")
      .where("paymentStatus", "in", ["pending", "charge_created_order_pending"])
      .where("createdAt", "<=", fifteenMinutesAgo)
      .limit(50)
      .get();
    let expiredCount = 0;
    for (const doc of staleSnap.docs) if (await releaseOrderResources(doc.ref, "Payment window expired (15 minutes)")) expiredCount++;
    return { success: true, expiredCount };
  }
);

// Merchant/Admin resolution workflow for payments that completed after resources were released.
export const resolvePaidAfterExpiredOrder = onCall(
  { region: "asia-southeast1", secrets: [opnSecretKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
    const { orderId, decision, action, merchantNote = "" } = request.data || {};
    const effectiveDecision = decision || (action === "accept_special_queue" ? "ACCEPT" : action === "request_refund" ? "REFUND" : null);

    if (typeof orderId !== "string" || !orderId.trim()) throw new HttpsError("invalid-argument", "Order ID is required.");
    if (!['ACCEPT', 'REFUND'].includes(effectiveDecision)) throw new HttpsError("invalid-argument", "Decision must be ACCEPT or REFUND.");

    const orderRef = db.collection("orders").doc(orderId.trim());
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = orderSnap.data();

    const shopSnap = order.storeId ? await db.collection("shops").doc(order.storeId).get() : null;
    const profileSnap = order.storeId ? await db.collection("merchantProfiles").doc(order.storeId).get() : null;
    const isAdmin = request.auth.token?.admin === true || request.auth.token?.email === "58140@lomsak.ac.th";
    const isOwner = (shopSnap?.exists && (shopSnap.data().ownerUid === request.auth.uid || shopSnap.data().ownerId === request.auth.uid || shopSnap.data().merchantId === request.auth.uid)) || (profileSnap?.exists && profileSnap.data().ownerUid === request.auth.uid);
    if (!isAdmin && !isOwner) throw new HttpsError("permission-denied", "Only the store owner or platform admin can resolve this order.");
    if (order.paymentStatus !== "paid_after_expired" && order.flaggedForMerchantReview !== true) {
      throw new HttpsError("failed-precondition", "Order is not awaiting paid-after-expired reconciliation.");
    }

    if (effectiveDecision === "ACCEPT") {
      await orderRef.update({
        paymentStatus: "paid",
        status: "TO_SHIP",
        queueStatus: "waiting",
        flaggedForMerchantReview: false,
        reconciled: true,
        reconciliationStatus: "ACCEPTED",
        merchantNote: String(merchantNote).slice(0, 500),
        merchantReviewAction: "accepted_special_queue",
        reconciledBy: request.auth.uid,
        reconciledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection("audit_logs").doc(`reconcile_${orderRef.id}`).set({
        actorUid: request.auth.uid,
        action: "PAID_AFTER_EXPIRED_ACCEPTED",
        orderId: orderRef.id,
        storeId: order.storeId || null,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { success: true, status: "ACCEPTED" };
    }

    const paymentId = String(order.paymentId || "").trim();
    if (!paymentId) {
      // Offline / Slip / Simulated refund fallback
      await orderRef.update({
        paymentStatus: "refund_requested",
        status: "CANCELLED",
        flaggedForMerchantReview: false,
        reconciled: true,
        reconciliationStatus: "REFUND_REQUESTED",
        merchantNote: String(merchantNote).slice(0, 500),
        merchantReviewAction: "refund_requested",
        reconciledBy: request.auth.uid,
        reconciledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { success: true, status: "REFUND_REQUESTED" };
    }

    const amountSatang = Math.round(Number(order.totalAmount) * 100);
    if (!Number.isFinite(amountSatang) || amountSatang <= 0) throw new HttpsError("failed-precondition", "Invalid order amount for refund.");

    try {
      const refund = await opnRequest(`/charges/${encodeURIComponent(paymentId)}/refunds`, opnSecretKey.value(), {
        amount: amountSatang,
        metadata: { order_id: orderRef.id, reason: "paid_after_expired" },
      });
      const refundId = refund.id || null;
      await orderRef.update({
        paymentStatus: "paid_after_expired",
        status: "CANCELLED",
        flaggedForMerchantReview: false,
        reconciled: true,
        reconciliationStatus: "REFUNDED",
        refundId,
        refundedAmount: Number(order.totalAmount),
        merchantNote: String(merchantNote).slice(0, 500),
        merchantReviewAction: "refunded",
        reconciledBy: request.auth.uid,
        reconciledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection("audit_logs").doc(`reconcile_${orderRef.id}`).set({
        actorUid: request.auth.uid,
        action: "PAID_AFTER_EXPIRED_REFUNDED",
        orderId: orderRef.id,
        storeId: order.storeId || null,
        refundId,
        amount: Number(order.totalAmount),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { success: true, status: "REFUNDED", refundId };
    } catch (refundErr) {
      console.warn("Opn automated refund warning, marked for manual refund:", refundErr);
      await orderRef.update({
        paymentStatus: "refund_requested",
        status: "CANCELLED",
        flaggedForMerchantReview: false,
        reconciled: true,
        reconciliationStatus: "MANUAL_REFUND_PENDING",
        refundError: String(refundErr?.message || "Provider refund failed"),
        merchantNote: String(merchantNote).slice(0, 500),
        merchantReviewAction: "refund_requested",
        reconciledBy: request.auth.uid,
        reconciledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { success: true, status: "MANUAL_REFUND_PENDING" };
    }
  }
);
export const getPaymentStatus = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
    const { orderId } = request.data || {};
    if (typeof orderId !== "string" || !orderId.trim()) throw new HttpsError("invalid-argument", "Order ID is required.");
    const orderSnap = await db.collection("orders").doc(orderId.trim()).get();
    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = orderSnap.data();
    if (order.userId !== request.auth.uid) throw new HttpsError("permission-denied", "Unauthorized order access.");
    return { orderId: order.orderId, paymentStatus: order.paymentStatus, queueStatus: order.queueStatus, status: order.status, totalAmount: order.totalAmount };
  }
);

export const opnWebhook = onRequest(
  { region: "asia-southeast1", secrets: [opnSecretKey] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");
    try {
      const event = req.body;
      if (!event || !String(event.key || "").startsWith("charge.")) return res.status(200).send("Ignored");
      const chargeId = event.data?.id;
      if (!chargeId) return res.status(400).send("Missing charge id");
      const charge = await retrieveCharge(chargeId, opnSecretKey.value());
      const orderId = charge.metadata?.orderId;
      const chargeUid = charge.metadata?.uid;
      if (!orderId || !chargeUid || charge.currency !== "THB") return res.status(400).send("Invalid payment metadata");

      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) return res.status(400).send("Order mismatch");
      const order = orderSnap.data();
      if (order.userId !== chargeUid) return res.status(400).send("User ID mismatch");

      // Verify amount before accepting any successful payment state, including the late-payment branch.
      const expectedSatang = Math.round(Number(order.totalAmount || order.totalPrice) * 100);
      if (!Number.isFinite(expectedSatang) || charge.amount !== expectedSatang) return res.status(400).send("Amount mismatch");

      if (charge.status === "expired" || charge.status === "failed") {
        await releaseOrderResources(orderRef, `Payment provider reported charge ${charge.status}`);
        return res.status(200).send("Expired/Failed handled");
      }

      // Late success after resource release: record it for reconciliation, never silently re-reserve stock/slot.
      if (order.paymentStatus === "expired" || order.resourcesReleased) {
        await orderRef.update({
          paymentId: charge.id,
          paymentStatus: "paid_after_expired",
          providerStatus: charge.status,
          flaggedForMerchantReview: true,
          reconciliationStatus: "PENDING_REVIEW",
          reconciled: false,
          paidAt: charge.status === "successful" ? FieldValue.serverTimestamp() : null,
          updatedAt: FieldValue.serverTimestamp()
        });
        return res.status(200).send("Handled as paid_after_expired");
      }

      if (order.paymentStatus === "paid") return res.status(200).send("Already processed");

      const paymentStatus = charge.status === "successful" ? "paid" : charge.status;
      await orderRef.update({
        paymentId: charge.id,
        paymentStatus,
        providerStatus: charge.status,
        reconciled: true,
        paidAt: charge.status === "successful" ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp()
      });
      return res.status(200).send("OK");
    } catch (error) {
      console.error("Opn webhook error", error);
      return res.status(500).send("Webhook verification failed");
    }
  }
);
