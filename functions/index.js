/* global Buffer */
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
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

// The browser sends only product id/quantity/couponCode/idempotencyKey. Price, stock, discount and final order data are strictly computed and reserved here atomically via Firestore Transaction.
export const createPromptPayPayment = onCall(
  { region: "asia-southeast1", secrets: [opnSecretKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
    const { productId, quantity = 1, couponCode, booking, idempotencyKey } = request.data || {};
    if (typeof productId !== "string" || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new HttpsError("invalid-argument", "Invalid order details.");
    }

    const orderRef = db.collection("orders").doc();
    const productRef = db.collection("products").doc(productId);
    const idempotencyDocId = typeof idempotencyKey === "string" && idempotencyKey.trim()
      ? `${request.auth.uid}_${idempotencyKey.trim()}`
      : null;
    const idempotencyRef = idempotencyDocId
      ? db.collection("idempotency_keys").doc(idempotencyDocId)
      : null;

    // 🔒 Atomic Transaction: Validate stock, check/lock idempotency, decrement stock, and create order atomically
    const { totalSatang, existingResult } = await db.runTransaction(async (transaction) => {
      if (idempotencyRef) {
        const idempSnap = await transaction.get(idempotencyRef);
        if (idempSnap.exists) {
          const existingOrderId = idempSnap.data().orderId;
          const existingOrderDoc = await transaction.get(db.collection("orders").doc(existingOrderId));
          if (existingOrderDoc.exists) {
            const ord = existingOrderDoc.data();
            if (ord.paymentStatus !== "creation_failed" && ord.paymentStatus !== "cancelled") {
              return {
                existingResult: {
                  orderId: ord.orderId,
                  paymentId: ord.paymentId,
                  qrUrl: ord.qrUrl,
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

      if (product.isAvailable === false) {
        throw new HttpsError("failed-precondition", "เมนูนี้ปิดรับออเดอร์ชั่วคราว");
      }
      if (typeof product.stock === "number" && product.stock < quantity) {
        throw new HttpsError("failed-precondition", `สินค้าในสต็อกไม่เพียงพอ (คงเหลือ ${product.stock} รายการ)`);
      }

      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new HttpsError("failed-precondition", "Invalid product price in database.");
      }

      const storeId = String(product.storeId || product.shopId || "STORE_DEFAULT");
      const storeName = String(product.storeName || product.shopName || "ร้านค้าในโรงเรียน");
      const subtotal = unitPrice * quantity;
      let discountAmount = 0;

      // 🔒 Server-Authoritative & Store-Scoped Coupon Verification
      if (typeof couponCode === "string" && couponCode.trim()) {
        const cleanCode = couponCode.trim().toUpperCase();
        const couponRef = db.collection("coupons").doc(cleanCode);
        const couponSnap = await transaction.get(couponRef);
        if (couponSnap.exists) {
          const coupon = couponSnap.data();
          const minSpend = Number(coupon.minSpend) || 0;
          const discountVal = Number(coupon.discount) || 0;
          const isNotExpired = !coupon.expiryDate || new Date(coupon.expiryDate) > new Date();
          const isStoreMatch = !coupon.storeId || coupon.scope === "platform" || coupon.storeId === storeId;

          if (coupon.status === "Active" && isNotExpired && isStoreMatch && subtotal >= minSpend && discountVal > 0) {
            if (coupon.discountType === "percent" || coupon.type === "percent") {
              const percent = Math.min(100, Math.max(0, discountVal));
              discountAmount = Math.round((subtotal * percent) / 100);
            } else {
              discountAmount = Math.min(subtotal, discountVal);
            }
          }
        }
      }

      const finalAmount = Math.max(1, subtotal - discountAmount);
      const satang = Math.round(finalAmount * 100);

      // 🔒 Atomic stock decrement to prevent race conditions
      if (typeof product.stock === "number") {
        transaction.update(productRef, {
          stock: product.stock - quantity,
          updatedAt: FieldValue.serverTimestamp(),
        });
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
        items: [
          {
            productId,
            name: product.name,
            price: unitPrice,
            quantity,
          }
        ],
        quantity,
        booking: booking || null,
        subtotal,
        discountAmount,
        totalAmount: finalAmount,
        totalPrice: finalAmount,
        currency: "THB",
        paymentProvider: "opn",
        paymentMethod: "promptpay",
        paymentStatus: "pending",
        queueStatus: "waiting",
        status: "TO_SHIP",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      if (idempotencyRef) {
        transaction.set(idempotencyRef, {
          orderId: orderRef.id,
          userId: request.auth.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      transaction.set(orderRef, orderData);
      return { totalSatang: satang };
    });

    if (existingResult) {
      return existingResult;
    }

    try {
      const charge = await opnRequest("/charges", opnSecretKey.value(), { amount: totalSatang, currency: "THB", description: `QueueUp ${orderRef.id}`, metadata: { orderId: orderRef.id, uid: request.auth.uid }, source: { type: "promptpay" } });
      const qrUrl = charge.source?.scannable_code?.image?.download_uri;
      if (!qrUrl) throw new Error("PromptPay QR was not returned by provider.");
      await orderRef.update({ paymentId: charge.id, qrUrl, updatedAt: FieldValue.serverTimestamp() });
      return { orderId: orderRef.id, paymentId: charge.id, qrUrl, expiresAt: charge.expires_at || null };
    } catch (error) {
      await orderRef.update({ paymentStatus: "creation_failed", updatedAt: FieldValue.serverTimestamp() });
      // Revert stock decrement if payment provider rejects charge creation
      try {
        await productRef.update({ stock: FieldValue.increment(quantity) });
      } catch (stockErr) {
        console.warn("Revert stock warning:", stockErr);
      }
      throw error;
    }
  }
);

export const getPaymentStatus = onCall({ region: "asia-southeast1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  const orderId = request.data?.orderId;
  if (typeof orderId !== "string" || !orderId) throw new HttpsError("invalid-argument", "Invalid order id.");
  const order = await db.collection("orders").doc(orderId).get();
  if (!order.exists || order.data().userId !== request.auth.uid) throw new HttpsError("not-found", "Order not found.");
  return { paymentStatus: order.data().paymentStatus, providerStatus: order.data().providerStatus || "pending" };
});

// Set this function URL as the static webhook endpoint in the Opn dashboard.
// Never trust the webhook body by itself: retrieve the charge and compare metadata first.
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
      if (!orderId || charge.currency !== "THB") return res.status(400).send("Invalid payment metadata");
      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists || orderSnap.data().paymentId !== charge.id) return res.status(400).send("Order mismatch");

      // 🔒 Idempotency check: Don't re-process already paid orders
      if (orderSnap.data().paymentStatus === "paid") {
        return res.status(200).send("Already processed");
      }

      const expectedSatang = Math.round(Number(orderSnap.data().totalAmount || orderSnap.data().totalPrice) * 100);
      if (charge.amount !== expectedSatang) return res.status(400).send("Amount mismatch");
      const paymentStatus = charge.status === "successful" ? "paid" : charge.status;
      await orderRef.update({ paymentStatus, providerStatus: charge.status, paidAt: charge.status === "successful" ? FieldValue.serverTimestamp() : null, updatedAt: FieldValue.serverTimestamp() });
      return res.status(200).send("OK");
    } catch (error) {
      console.error("Opn webhook error", error);
      return res.status(500).send("Webhook verification failed");
    }
  }
);
