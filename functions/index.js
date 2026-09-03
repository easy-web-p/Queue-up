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
              const rawTopPrice = TOPPING_PRICES[topName] ?? product.toppingPrices?.[topName];
              const topPrice = Number(rawTopPrice);
              if (!Number.isFinite(topPrice) || topPrice < 0 || topPrice > 500) {
                throw new HttpsError("invalid-argument", `ไม่พบตัวเลือกท็อปปิ้งหรือราคาไม่ถูกต้อง: ${topName}`);
              }
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
      const storeId = String(product.storeId || product.shopId || "").trim();
      if (!storeId) {
        throw new HttpsError("failed-precondition", "ข้อมูลสินค้าไม่สมบูรณ์: ไม่พบการระบุรหัสร้านค้า (storeId)");
      }
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

        // 🔒 Dynamic Store Capacity Precedence:
        // Live store configuration takes immediate precedence over historical slot snapshots
        const capacityVal = typeof storeConfiguredCapacity === "number" && storeConfiguredCapacity > 0
          ? Number(storeConfiguredCapacity)
          : (slotSnap.exists && typeof slotSnap.data().capacity === "number" ? Number(slotSnap.data().capacity) : 0);

        if (!Number.isFinite(capacityVal) || capacityVal <= 0) {
          throw new HttpsError("failed-precondition", "ร้านค้ายังไม่ได้กำหนดขีดจำกัดจำนวนออเดอร์สำหรับรอบเวลานี้");
        }

        const currentOrders = slotSnap.exists ? Number(slotSnap.data().currentOrders || 0) : 0;
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
        booking: (booking?.date && (booking.timeSlot || booking.time)) ? {
          date: String(booking.date).trim(),
          timeSlot: String(booking.timeSlot || booking.time).trim()
        } : null,
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
      if (!existingResult.paymentId && opnSecretKey?.value) {
        try {
          const chargeListResponse = await fetch(`https://api.omise.co/charges?limit=10`, {
            headers: { authorization: `Basic ${Buffer.from(`${opnSecretKey.value()}:`).toString("base64")}` },
          });
          if (chargeListResponse.ok) {
            const chargeList = await chargeListResponse.json();
            const matchedCharge = chargeList.data?.find(c => c.metadata?.orderId === existingResult.orderId);
            if (matchedCharge) {
              const matchedQr = matchedCharge.source?.scannable_code?.image?.download_uri;
              await db.collection("orders").doc(existingResult.orderId).update({
                paymentId: matchedCharge.id,
                qrUrl: matchedQr || null,
                expiresAt: matchedCharge.expires_at || null,
                updatedAt: FieldValue.serverTimestamp()
              });
              existingResult.paymentId = matchedCharge.id;
              existingResult.qrUrl = matchedQr;
              existingResult.expiresAt = matchedCharge.expires_at || null;
            }
          }
        } catch (recoverErr) {
          console.warn("Charge recovery by metadata warning:", recoverErr);
        }
      }

      if (!existingResult.qrUrl && existingResult.paymentId && opnSecretKey?.value) {
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
    const isAdmin = request.auth.token?.admin === true || request.auth.token?.role === "admin";
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Only platform administrators can manually trigger order expiration.");
    }
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
    const isAdmin = request.auth.token?.admin === true || request.auth.token?.role === "admin";
    const isOwner = (shopSnap?.exists && (shopSnap.data().ownerUid === request.auth.uid || shopSnap.data().ownerId === request.auth.uid || shopSnap.data().merchantId === request.auth.uid)) || (profileSnap?.exists && profileSnap.data().ownerUid === request.auth.uid);
    if (!isAdmin && !isOwner) throw new HttpsError("permission-denied", "Only the store owner or platform admin can resolve this order.");

    // 🔒 Idempotency Guard: Terminal state protection against duplicate refunds or re-resolution
    const TERMINAL_RECONCILED_STATES = ["ACCEPTED", "REFUNDED", "REFUND_REQUESTED", "MANUAL_REFUND_PENDING"];
    if (TERMINAL_RECONCILED_STATES.includes(order.reconciliationStatus) || order.paymentStatus === "refunded") {
      throw new HttpsError("failed-precondition", `ออเดอร์นี้ได้รับการจัดการแล้ว (${order.reconciliationStatus || order.paymentStatus})`);
    }

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
        paymentStatus: "refunded",
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
        paymentStatus: "refunded",
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

export function isAllowedPaymentTransition(currentStatus, nextStatus, actor = "webhook") {
  if (currentStatus === nextStatus) return true;
  const ALLOWED_TRANSITIONS = {
    webhook: {
      pending: ["paid", "failed", "expired", "charge_created_order_pending", "creation_failed"],
      charge_created_order_pending: ["paid", "failed", "expired", "creation_failed"],
      expired: ["paid_after_expired"],
      cancelled: ["paid_after_expired"],
      paid: ["paid"], // Webhook cannot trigger refund
      paid_after_expired: [],
      refunded: ["refunded"]
    },
    refund_flow: {
      paid: ["refunded"],
      paid_after_expired: ["paid", "refunded"]
    },
    merchant_reconcile: {
      paid_after_expired: ["paid", "refunded"]
    }
  };
  return (ALLOWED_TRANSITIONS[actor]?.[currentStatus] || []).includes(nextStatus);
}

export async function handleOpnWebhookCore(req, res, { db, retrieveCharge, releaseOrderResources, opnSecretKey }) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  try {
    const event = req.body;
    const ALLOWED_WEBHOOK_EVENTS = ["charge.complete", "charge.create", "charge.update"];
    if (!event || typeof event.key !== "string" || !ALLOWED_WEBHOOK_EVENTS.includes(event.key)) {
      return res.status(400).send("Unsupported or missing webhook event key");
    }

    // charge.create is an informational creation event; never transition orders to paid
    if (event.key === "charge.create") {
      return res.status(200).send("Charge creation event acknowledged");
    }

    const chargeId = event.data?.id;
    if (typeof chargeId !== "string" || !chargeId.trim() || !chargeId.startsWith("chrg_")) {
      return res.status(400).send("Invalid or missing Opn charge ID format");
    }

    const charge = await retrieveCharge(chargeId.trim(), typeof opnSecretKey === "object" && opnSecretKey.value ? opnSecretKey.value() : opnSecretKey);
    if (!charge || typeof charge !== "object") {
      return res.status(401).send("Unauthorized: Charge not found on payment provider");
    }

    const orderId = charge.metadata?.orderId;
    const chargeUid = charge.metadata?.uid;
    if (!orderId || !chargeUid || charge.currency !== "THB") {
      return res.status(400).send("Invalid payment metadata or unsupported currency");
    }

    // Deterministic event identity: If event.id is present use it, otherwise use deterministic composite key
    const eventId = (typeof event.id === "string" && event.id.trim())
      ? event.id.trim()
      : `evnt_${charge.id}_${event.key}_${charge.status}`;

    const txResult = await db.runTransaction(async (transaction) => {
      const eventRef = eventId ? db.collection("webhook_events").doc(eventId) : null;
      const eventSnap = eventRef ? await transaction.get(eventRef) : null;
      if (eventSnap?.exists && eventSnap.data()?.processed === true) {
        const processedData = eventSnap.data();
        if (processedData.chargeId !== charge.id || processedData.orderId !== orderId) {
          return { code: 409, message: "Security Violation: Event ID already bound to a different charge/order" };
        }
        return { code: 200, message: "Already processed event" };
      }

      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) return { code: 400, message: "Order mismatch" };
      const order = orderSnap.data();
      if (order.userId !== chargeUid) return { code: 400, message: "User ID mismatch" };
      if (order.paymentId && order.paymentId !== charge.id) return { code: 400, message: "Charge ID does not match order payment binding" };

      const TERMINAL_RECONCILED_STATES = ["ACCEPTED", "REFUNDED", "REFUND_REQUESTED", "MANUAL_REFUND_PENDING"];
      if (TERMINAL_RECONCILED_STATES.includes(order.reconciliationStatus) || order.paymentStatus === "refunded") {
        return { code: 200, message: "Already resolved in terminal reconciliation state" };
      }

      const expectedSatang = Math.round(Number(order.totalAmount || order.totalPrice) * 100);
      if (!Number.isFinite(expectedSatang) || charge.amount !== expectedSatang) {
        return { code: 400, message: "Amount mismatch" };
      }

      if (order.paymentStatus === "paid") {
        if (charge.status === "successful") {
          return { code: 200, message: "Already processed" };
        }
        return { code: 400, message: "Cannot downgrade already paid order to non-successful status" };
      }

      if (charge.status === "expired" || charge.status === "failed") {
        return { code: 200, handleRelease: true, chargeId: charge.id, status: charge.status };
      }

      if (order.paymentStatus === "expired" || order.resourcesReleased) {
        transaction.update(orderRef, {
          paymentId: charge.id,
          paymentStatus: "paid_after_expired",
          providerStatus: charge.status,
          flaggedForMerchantReview: true,
          reconciliationStatus: "PENDING_REVIEW",
          reconciled: false,
          paidAt: charge.status === "successful" ? FieldValue.serverTimestamp() : null,
          updatedAt: FieldValue.serverTimestamp()
        });
        const auditRef = db.collection("audit_logs").doc(`pay_late_${orderRef.id}_${charge.id}`);
        transaction.set(auditRef, {
          actorUid: "system",
          actorType: "system_webhook",
          action: "PAYMENT_PAID_AFTER_EXPIRED",
          orderId: orderRef.id,
          userId: order.userId,
          storeId: order.storeId || null,
          paymentId: charge.id,
          amount: Number(order.totalAmount || order.totalPrice),
          currency: "THB",
          provider: "opn",
          createdAt: FieldValue.serverTimestamp()
        }, { merge: true });
        if (eventRef) {
          transaction.set(eventRef, { eventId, chargeId: charge.id, orderId: orderRef.id, eventKey: event.key, processed: true, createdAt: FieldValue.serverTimestamp() });
        }
        return { code: 200, message: "Handled as paid_after_expired" };
      }

      const targetStatus = charge.status === "successful" ? "paid" : charge.status;
      if (!isAllowedPaymentTransition(order.paymentStatus, targetStatus, "webhook")) {
        return { code: 400, message: `Invalid payment transition from ${order.paymentStatus} to ${targetStatus}` };
      }

      transaction.update(orderRef, {
        paymentId: charge.id,
        paymentStatus: targetStatus,
        providerStatus: charge.status,
        reconciled: true,
        paidAt: charge.status === "successful" ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp()
      });

      if (charge.status === "successful") {
        const auditRef = db.collection("audit_logs").doc(`pay_success_${orderRef.id}_${charge.id}`);
        transaction.set(auditRef, {
          actorUid: "system",
          actorType: "system_webhook",
          action: "PAYMENT_SUCCESSFUL",
          orderId: orderRef.id,
          userId: order.userId,
          storeId: order.storeId || null,
          paymentId: charge.id,
          amount: Number(order.totalAmount || order.totalPrice),
          currency: "THB",
          provider: "opn",
          createdAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
      if (eventRef) {
        transaction.set(eventRef, { eventId, chargeId: charge.id, orderId: orderRef.id, eventKey: event.key, processed: true, createdAt: FieldValue.serverTimestamp() });
      }
      return { code: 200, message: "OK" };
    });

    if (txResult.handleRelease) {
      const orderRef = db.collection("orders").doc(orderId);
      const releaseOk = await releaseOrderResources(orderRef, `Payment provider reported charge ${txResult.status}`);
      if (eventId) {
        await db.collection("webhook_events").doc(eventId).set({
          eventId,
          chargeId: txResult.chargeId,
          orderId,
          eventKey: event.key,
          processed: true,
          released: Boolean(releaseOk),
          createdAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
      return res.status(200).send("Expired/Failed handled");
    }

    return res.status(txResult.code).send(txResult.message);
  } catch (error) {
    console.error("Opn webhook error", error);
    return res.status(500).send("Webhook verification failed");
  }
}

export const opnWebhook = onRequest(
  { region: "asia-southeast1", secrets: [opnSecretKey] },
  async (req, res) => {
    return await handleOpnWebhookCore(req, res, { db, retrieveCharge, releaseOrderResources, opnSecretKey });
  }
);
