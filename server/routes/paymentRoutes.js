import { Router } from 'express';
import Stripe from 'stripe';
import { adminDb } from '../firebaseAdmin.js';
import { optionalAuthenticate } from '../middleware/authenticate.js';
import { optionalSecret } from '../config/secrets.js';
import { verifySessionAgainstOrder } from '../services/paymentVerification.js';
import { settleOrderPayment, recordPaymentException } from '../services/paymentSettlement.js';
import dotenv from 'dotenv';

dotenv.config();

export const paymentRouter = Router();

const stripeSecretKey = optionalSecret('STRIPE_SECRET_KEY');
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

/** Guard for endpoints that cannot work without a configured Stripe key. */
function requireStripe(res) {
  if (stripe) return true;
  res.status(503).json({
    success: false,
    error: 'STRIPE_NOT_CONFIGURED',
    message: 'Stripe is not configured on this server.'
  });
  return false;
}

/**
 * Loads the order and authorises the caller to pay for it.
 *
 * The charged amount is ALWAYS taken from the stored order, never from the
 * request body: a client-supplied amount lets the payer choose their own price.
 *
 * @returns {Promise<{ order: object } | { error: { status: number, body: object } }>}
 */
async function loadPayableOrder(req, orderId) {
  const snap = await adminDb.collection('orders').doc(orderId).get();
  if (!snap.exists) {
    return { error: { status: 404, body: { success: false, error: 'ORDER_NOT_FOUND' } } };
  }

  const order = snap.data();
  const isOrderCustomer = Boolean(req.user?.uid) && req.user.uid === order.customerId;
  const isGuestOrder = order.customerId === 'guest-user';

  if (!isOrderCustomer && !isGuestOrder) {
    return {
      error: {
        status: 403,
        body: { success: false, error: 'FORBIDDEN', message: 'This order belongs to another customer.' }
      }
    };
  }

  if (order.paymentStatus === 'PAID') {
    return {
      error: {
        status: 409,
        body: { success: false, error: 'ALREADY_PAID', message: 'ออเดอร์นี้ชำระเงินแล้ว' }
      }
    };
  }

  const totalSatang = Number(order.totalSatang) || Math.round(Number(order.total || 0) * 100);
  if (!Number.isInteger(totalSatang) || totalSatang <= 0) {
    return {
      error: {
        status: 409,
        body: { success: false, error: 'ORDER_TOTAL_UNAVAILABLE', message: 'ยอดชำระของออเดอร์ไม่ถูกต้อง' }
      }
    };
  }

  return { order: { ...order, id: orderId, totalSatang } };
}

/**
 * POST /api/payment/create-checkout-session
 * Create Stripe Hosted Checkout Session for Cards and PromptPay
 */
paymentRouter.post('/create-checkout-session', optionalAuthenticate, async (req, res) => {
  try {
    const {
      orderId,
      storeName = 'QueueUp Restaurant',
      customerEmail,
      paymentMethodType = 'promptpay',
      returnUrl
    } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'orderId is required.'
      });
    }

    const loaded = await loadPayableOrder(req, orderId);
    if (loaded.error) {
      return res.status(loaded.error.status).json(loaded.error.body);
    }
    const order = loaded.order;

    if (!requireStripe(res)) return;

    // Determine host origin
    const origin = req.headers.origin || req.headers.referer || returnUrl || 'http://localhost:3000';
    const baseUrl = origin.replace(/\/$/, '');

    // Map payment methods supported by Stripe in THB
    const allowedPaymentMethods = paymentMethodType === 'promptpay'
      ? ['promptpay', 'card']
      : ['card', 'promptpay'];

    // A single line item for the stored order total. Per-item pricing is not
    // itemised here so the charged sum can never drift from order.totalSatang.
    const lineItems = [
      {
        price_data: {
          currency: 'thb',
          product_data: {
            name: `ออเดอร์คิวอาหาร (${order.storeName || storeName})`,
            description: `รหัสคำสั่งซื้อ: ${orderId}`
          },
          unit_amount: order.totalSatang
        },
        quantity: 1
      }
    ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: allowedPaymentMethods,
      line_items: lineItems,
      mode: 'payment',
      customer_email: customerEmail || undefined,
      metadata: {
        orderId,
        storeName,
        customerId: req.user?.uid || 'guest'
      },
      success_url: `${baseUrl}/queue-tracking?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}&payment=success`,
      cancel_url: `${baseUrl}/queue-tracking?order_id=${orderId}&payment=cancelled`
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (err) {
    console.error('[Payment API] Stripe Checkout Session error:', err);
    return res.status(500).json({
      success: false,
      error: 'STRIPE_SESSION_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/payment/create-payment-intent
 * Direct PaymentIntent for in-app PromptPay / Card element
 */
paymentRouter.post('/create-payment-intent', optionalAuthenticate, async (req, res) => {
  try {
    const { orderId, storeName } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'MISSING_ORDER_ID' });
    }

    const loaded = await loadPayableOrder(req, orderId);
    if (loaded.error) {
      return res.status(loaded.error.status).json(loaded.error.body);
    }

    if (!requireStripe(res)) return;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: loaded.order.totalSatang,
      currency: 'thb',
      payment_method_types: ['card', 'promptpay'],
      metadata: {
        orderId: orderId || '',
        storeName: storeName || ''
      }
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (err) {
    console.error('[Payment API] Stripe PaymentIntent error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payment/verify-session
 * Verifies that a checkout session has been successfully paid.
 * Sets order.status = PAID_AWAITING_MERCHANT and settlement.status = PENDING_ORDER_ACCEPTANCE.
 * (Does NOT transition to PREPARING until merchant accepts).
 */
paymentRouter.post('/verify-session', optionalAuthenticate, async (req, res) => {
  try {
    if (!requireStripe(res)) return;

    const { sessionId, orderId } = req.body;

    if (!sessionId || !orderId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMS',
        message: 'sessionId and orderId are required.'
      });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const orderRef = adminDb.collection('orders').doc(orderId);
      const now = new Date().toISOString();

      // Settled through the same path as the webhook, so a session confirmed
      // here and an event arriving later cannot disagree about what happened.
      const outcome = await adminDb.runTransaction(async (t) => {
        const orderSnap = await t.get(orderRef);
        if (!orderSnap.exists) {
          throw new Error(`ORDER_NOT_FOUND: Order ${orderId} not found`);
        }

        const data = orderSnap.data();

        // A paid session proves only that something was paid: bind it to this
        // order, this customer and this amount before settling anything.
        const verdict = verifySessionAgainstOrder({
          session, orderId, order: data, user: req.user
        });
        if (!verdict.ok) {
          console.warn(`[Payment API] Session ${sessionId} rejected for ${orderId}: ${verdict.error}`);
          throw new Error(`${verdict.error}: ${verdict.message}`);
        }

        return settleOrderPayment(t, adminDb, {
          orderRef,
          orderId,
          order: data,
          amountPaidSatang: Number(session.amount_total),
          providerCheckoutSessionId: sessionId,
          providerPaymentIntentId: session.payment_intent || null,
          paymentMethodType: session.payment_method_types?.[0] || 'promptpay',
          changedBy: 'STRIPE_GATEWAY',
          note: `Payment verified via Stripe (${session.payment_method_types?.join(', ') || 'online'}). Awaiting merchant acceptance.`,
          now
        });
      });

      // Money arrived that this order cannot take — it was cancelled, or less
      // was captured than it costs. Refusing quietly would lose it.
      if (!outcome.settled && outcome.reason !== 'ALREADY_PAID') {
        await recordPaymentException(adminDb, {
          orderId,
          reason: outcome.reason,
          providerCheckoutSessionId: sessionId,
          providerPaymentIntentId: session.payment_intent || null,
          amountSatang: Number(session.amount_total),
          detail: `verify-session could not settle the order (${outcome.reason}).`,
          now
        });
        return res.status(409).json({
          success: false,
          paid: true,
          error: outcome.reason,
          message: outcome.reason === 'ORDER_NOT_PAYABLE'
            ? 'คำสั่งซื้อนี้ถูกยกเลิกไปแล้ว ทีมงานจะติดต่อเพื่อคืนเงินให้ค่ะ'
            : 'ยอดที่ชำระไม่ตรงกับคำสั่งซื้อ ทีมงานกำลังตรวจสอบค่ะ'
        });
      }

      console.log(`[Payment API] Order ${orderId} successfully marked PAID_AWAITING_MERCHANT via Stripe.`);
      return res.status(200).json({
        success: true,
        paid: true,
        orderId,
        paymentStatus: 'PAID',
        status: 'PAID_AWAITING_MERCHANT'
      });
    } else {
      return res.status(200).json({
        success: true,
        paid: false,
        paymentStatus: session.payment_status
      });
    }
  } catch (err) {
    console.error('[Payment API] Verify session error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
