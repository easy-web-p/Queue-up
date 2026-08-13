/* global Buffer */
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

initializeApp();
const db = getFirestore();
const opnSecretKey = defineSecret("OPN_SECRET_KEY");
const ALLOWED_DISCOUNTS = new Set([0, 10, 20, 50]);

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

// The browser sends only product id/quantity. Price and final order data are recomputed here.
export const createPromptPayPayment = onCall(
  { region: "asia-southeast1", secrets: [opnSecretKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
    const { productId, quantity = 1, discountPercent = 0, booking } = request.data || {};
    if (typeof productId !== "string" || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !ALLOWED_DISCOUNTS.has(Number(discountPercent))) {
      throw new HttpsError("invalid-argument", "Invalid order details.");
    }
    const productSnap = await db.collection("products").doc(productId).get();
    if (!productSnap.exists) throw new HttpsError("not-found", "Product is not available for payment.");
    const product = productSnap.data();
    const unitPrice = Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new HttpsError("failed-precondition", "Invalid product price.");
    const totalSatang = Math.round(unitPrice * 100 * quantity * (1 - Number(discountPercent) / 100));
    const orderRef = db.collection("orders").doc();
    await orderRef.set({ userId: request.auth.uid, productId, itemTitle: String(product.name || "QueueUp order").slice(0, 250), quantity, booking: booking || null, totalPrice: totalSatang / 100, currency: "THB", paymentProvider: "opn", paymentMethod: "promptpay", paymentStatus: "pending", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    try {
      const charge = await opnRequest("/charges", opnSecretKey.value(), { amount: totalSatang, currency: "THB", description: `QueueUp ${orderRef.id}`, metadata: { orderId: orderRef.id, uid: request.auth.uid }, source: { type: "promptpay" } });
      const qrUrl = charge.source?.scannable_code?.image?.download_uri;
      if (!qrUrl) throw new Error("PromptPay QR was not returned by provider.");
      await orderRef.update({ paymentId: charge.id, updatedAt: FieldValue.serverTimestamp() });
      return { orderId: orderRef.id, paymentId: charge.id, qrUrl, expiresAt: charge.expires_at || null };
    } catch (error) {
      await orderRef.update({ paymentStatus: "creation_failed", updatedAt: FieldValue.serverTimestamp() });
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
      const expectedSatang = Math.round(Number(orderSnap.data().totalPrice) * 100);
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
