import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { handlePaymentWebhook } from "./paymentService.js";

let db = null;
function getDb() {
  if (!db) {
    db = getFirestore();
  }
  return db;
}

/**
 * 🔒 Payment Webhook HTTPS Endpoint
 *
 * Receives signed server-to-server callbacks from Payment Gateways (e.g. 2C2P).
 * Verifies signatures, enforces idempotency, updates order status, and logs audit entries.
 */
export const paymentWebhook = onRequest(
  { cors: false, timeoutSeconds: 30, maxInstances: 10 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    try {
      const response = await handlePaymentWebhook(getDb(), req.headers, req.body);
      res.status(response.status).json(response.body);
    } catch (err) {
      console.error("[paymentWebhook] Unhandled error:", err);
      res.status(500).json({ error: "INTERNAL_WEBHOOK_ERROR", message: err.message });
    }
  }
);
