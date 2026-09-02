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

// Allowed standard pickup timeslots
const ALLOWED_SLOTS = ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00"];

// Standard Topping & Modifier Catalog Prices
const TOPPING_PRICES = {
  "ไข่ดาว": 10,
  "ไข่เจียว": 10,
  "หมูกรอบพิเศษ": 15,
  "กุนเชียง": 10,
  "ชีส": 15,
  "เพิ่มเส้น/ข้าว": 10,
};

// The browser sends only product id/quantity/modifiers/couponCode/idempotencyKey. Price, toppings, slot capacity, stock, discount and final order data are strictly computed and reserved here atomically via Firestore Transaction.
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
    const idempotencyRef = idempotencyDocId
      ? db.collection("idempotency_keys").doc(idempotencyDocId)
      : null;

    let reservedSlotDocId = null;

    // 🔒 Atomic Transaction: Validate stock, slot capacity, modifiers pricing, check/lock idempotency, decrement stock, and create order atomically
    const { totalSatang, existingResult, computedDetails } = await db.runTransaction(async (transaction) => {
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

      // 🔒 Strict Server-Authoritative Modifier & Toppings Calculation (Rejects unknown options)
      let modifierUnitPrice = 0;
      const sanitizedModifiers = [];
      if (Array.isArray(modifiers)) {
        for (const mod of modifiers) {
          if (mod && mod.id === "topping" && Array.isArray(mod.value)) {
            for (const topName of mod.value) {
              const topPrice = TOPPING_PRICES[topName] ?? product.toppingPrices?.[topName];
              if (typeof topPrice !== "number" || topPrice < 0) {
                throw new HttpsError("invalid-argument", `ไม่พบตัวเลือกท็อปปิ้ง: ${topName}`);
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
      const storeId = String(product.storeId || product.shopId || "STORE_DEFAULT");
      const storeName = String(product.storeName || product.shopName || "ร้านค้าในโรงเรียน");

      // 🔒 Strict Time-Slot Validation & Atomic Capacity Check
      if (booking && booking.date && (booking.timeSlot || booking.time)) {
        const slotTime = String(booking.timeSlot || booking.time).trim();
        const slotDate = String(booking.date).trim();

        if (!ALLOWED_SLOTS.includes(slotTime)) {
          throw new HttpsError("invalid-argument", `รอบเวลารับประทานไม่ถูกต้อง (${slotTime})`);
        }
        const parsedDate = new Date(slotDate);
        if (isNaN(parsedDate.getTime())) {
          throw new HttpsError("invalid-argument", "รูปแบบวันที่ไม่ถูกต้อง");
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (parsedDate < today) {
          throw new HttpsError("invalid-argument", "ไม่สามารถเลือกวันที่ย้อนหลังได้");
        }

        reservedSlotDocId = `${storeId}_${slotDate}_${slotTime}`;
        const slotRef = db.collection("store_slots").doc(reservedSlotDocId);
        const slotSnap = await transaction.get(slotRef);

        const currentOrders = slotSnap.exists ? Number(slotSnap.data().currentOrders || 0) : 0;
        const maxCapacity = slotSnap.exists ? Number(slotSnap.data().capacity || 20) : 20;

        if (currentOrders + quantity > maxCapacity) {
          throw new HttpsError("failed-precondition", `รอบเวลา ${slotTime} วันที่ ${slotDate} เต็มแล้ว (รองรับได้สูงสุด ${maxCapacity} คิว)`);
        }

        transaction.set(slotRef, {
          storeId,
          date: slotDate,
          timeSlot: slotTime,
          currentOrders: currentOrders + quantity,
          capacity: maxCapacity,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

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
            basePrice: unitPrice,
            modifierPrice: modifierUnitPrice,
            price: effectiveUnitPrice,
            quantity,
            modifiers: sanitizedModifiers,
          }
        ],
        modifiers: sanitizedModifiers,
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
      return {
        totalSatang: satang,
        computedDetails: {
          subtotal,
          discountAmount,
          totalAmount: finalAmount,
        }
      };
    });

    if (existingResult) {
      return existingResult;
    }

    let createdCharge = null;
    try {
      createdCharge = await opnRequest("/charges", opnSecretKey.value(), { amount: totalSatang, currency: "THB", description: `QueueUp ${orderRef.id}`, metadata: { orderId: orderRef.id, uid: request.auth.uid }, source: { type: "promptpay" } });
      const qrUrl = createdCharge.source?.scannable_code?.image?.download_uri;
      if (!qrUrl) throw new Error("PromptPay QR was not returned by provider.");
      await orderRef.update({ paymentId: createdCharge.id, qrUrl, updatedAt: FieldValue.serverTimestamp() });
      return {
        orderId: orderRef.id,
        paymentId: createdCharge.id,
        qrUrl,
        subtotal: computedDetails.subtotal,
        discountAmount: computedDetails.discountAmount,
        totalAmount: computedDetails.totalAmount,
        expiresAt: createdCharge.expires_at || null
      };
    } catch (error) {
      const failureUpdate = {
        paymentStatus: "creation_failed",
        error: String(error?.message || "Payment provider error"),
        updatedAt: FieldValue.serverTimestamp()
      };
      if (createdCharge?.id) {
        failureUpdate.paymentId = createdCharge.id;
        failureUpdate.paymentStatus = "charge_created_order_pending";
      }
      await orderRef.update(failureUpdate);

      // Revert stock & time-slot reservations only if NO charge was created with provider
      if (!createdCharge?.id) {
        try {
          await productRef.update({ stock: FieldValue.increment(quantity) });
        } catch (stockErr) {
          console.warn("Revert stock warning:", stockErr);
        }
        if (reservedSlotDocId) {
          try {
            await db.collection("store_slots").doc(reservedSlotDocId).update({
              currentOrders: FieldValue.increment(-quantity),
              updatedAt: FieldValue.serverTimestamp()
            });
          } catch (slotErr) {
            console.warn("Revert slot warning:", slotErr);
          }
        }
      }
      throw error;
    }
  }
);

// Callable function to safely check payment status on-demand
export const getPaymentStatus = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
    const { orderId } = request.data || {};
    if (typeof orderId !== "string" || !orderId.trim()) {
      throw new HttpsError("invalid-argument", "Order ID is required.");
    }
    const orderSnap = await db.collection("orders").doc(orderId.trim()).get();
    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
    const order = orderSnap.data();
    if (order.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Unauthorized order access.");
    }
    return {
      orderId: order.orderId,
      paymentStatus: order.paymentStatus,
      queueStatus: order.queueStatus,
      status: order.status,
      totalAmount: order.totalAmount,
    };
  }
);

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
      if (!orderSnap.exists) return res.status(400).send("Order mismatch");

      // 🔒 Idempotency check: Don't re-process already paid orders
      if (orderSnap.data().paymentStatus === "paid") {
        return res.status(200).send("Already processed");
      }

      const expectedSatang = Math.round(Number(orderSnap.data().totalAmount || orderSnap.data().totalPrice) * 100);
      if (charge.amount !== expectedSatang) return res.status(400).send("Amount mismatch");
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
