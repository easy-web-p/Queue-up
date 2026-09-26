import { Router } from 'express';
import Stripe from 'stripe';
import { adminDb } from '../firebaseAdmin.js';
import { recordRefund } from '../services/ledgerService.js';
import { resolveOrderBreakdown } from '../services/orderPricing.js';
import {
  settleOrderPayment,
  recordPaymentException,
  PENDING_SETTLEMENT_STATUSES
} from '../services/paymentSettlement.js';
import { optionalSecret, isProduction } from '../config/secrets.js';
import dotenv from 'dotenv';

dotenv.config();

export const webhookRouter = Router();

const stripeSecretKey = optionalSecret('STRIPE_SECRET_KEY');
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const webhookSecret = optionalSecret('STRIPE_WEBHOOK_SECRET');

// Required in production, but recorded rather than thrown: a throw here kills
// the whole function, health probe included. The handler below refuses every
// delivery while it is missing, so an unsigned payload is still never accepted.
if (isProduction && !webhookSecret) {
  console.error(
    '[Config] STRIPE_WEBHOOK_SECRET is required in production. Webhook deliveries ' +
    'are refused until it is set, since without it any caller could mark orders paid.'
  );
}

/** Reads the order id Stripe was told to carry, whatever object it came on. */
function orderIdFrom(object) {
  return object?.metadata?.orderId || object?.client_reference_id || null;
}

/**
 * Applies a confirmed payment to its order.
 *
 * Shared by the Checkout events and by payment_intent.succeeded, which is the
 * only thing that ever settles the direct PaymentIntent flow — before this it
 * was a log line, so that flow could take money and leave the order unpaid.
 */
async function applyPayment({
  orderId, amountPaidSatang, sessionId, paymentIntentId, paymentMethodType, changedBy, now
}) {
  const orderRef = adminDb.collection('orders').doc(orderId);

  const outcome = await adminDb.runTransaction(async (t) => {
    const snap = await t.get(orderRef);
    if (!snap.exists) {
      return { settled: false, reason: 'ORDER_NOT_FOUND', amountSatang: 0 };
    }
    return settleOrderPayment(t, adminDb, {
      orderRef,
      orderId,
      order: snap.data(),
      amountPaidSatang,
      providerCheckoutSessionId: sessionId || null,
      providerPaymentIntentId: paymentIntentId || null,
      paymentMethodType,
      changedBy,
      now
    });
  });

  if (outcome.settled) {
    console.log(`[Stripe Webhook] Order ${orderId} settled and awaiting merchant acceptance.`);
    return outcome;
  }

  // ALREADY_PAID is the normal case for a redelivered event. The rest mean money
  // moved that this order cannot absorb, so an operator has to see them.
  if (outcome.reason !== 'ALREADY_PAID') {
    const stored = await orderRef.get();
    const expected = stored.exists ? resolveOrderBreakdown(stored.data()).totalSatang : null;
    await recordPaymentException(adminDb, {
      orderId,
      reason: outcome.reason,
      providerPaymentIntentId: paymentIntentId || null,
      providerCheckoutSessionId: sessionId || null,
      amountSatang: amountPaidSatang,
      expectedSatang: expected,
      detail: outcome.reason === 'ORDER_NOT_PAYABLE'
        ? `Payment arrived for an order in status ${stored.data()?.status}. It needs refunding.`
        : `Payment could not be applied (${outcome.reason}).`,
      now
    });
  }

  return outcome;
}

/**
 * Marks a gateway refund as actually completed.
 *
 * Our own cancellation path queues a refund_requests row and posts the ledger
 * reversal; this closes the loop when Stripe confirms the money left. A refund
 * issued straight from the Stripe dashboard has no row and no reversal, so the
 * reversal is posted here instead — but only while the merchant credit is still
 * pending, since once it is on hold or paid out, taking it back is a decision
 * for a human rather than a webhook.
 */
async function applyRefund({ paymentIntentId, refundId, amountRefundedSatang, now }) {
  const ordersSnap = await adminDb
    .collection('orders')
    .where('stripePaymentIntentId', '==', paymentIntentId)
    .get();

  if (ordersSnap.empty) {
    console.warn(`[Stripe Webhook] charge.refunded for unknown payment intent ${paymentIntentId}.`);
    return;
  }

  for (const doc of ordersSnap.docs) {
    const orderId = doc.id;
    const orderRef = adminDb.collection('orders').doc(orderId);

    const pendingRefunds = await adminDb
      .collection('refund_requests')
      .where('orderId', '==', orderId)
      .get();
    const openRequestIds = pendingRefunds.docs
      .filter((d) => d.data().status === 'PENDING')
      .map((d) => d.id);

    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(orderRef);
      if (!snap.exists) return;
      const order = snap.data();

      if (order.paymentStatus === 'REFUNDED') return; // Redelivered event.

      const needsLedgerReversal = order.settlementStatus !== 'REVERSED'
        && PENDING_SETTLEMENT_STATUSES.has(String(order.settlementStatus));
      const { totalSatang, platformFeeSatang, gatewayFeeSatang, merchantNetSatang } =
        resolveOrderBreakdown(order);

      t.update(orderRef, {
        paymentStatus: 'REFUNDED',
        settlementStatus: needsLedgerReversal ? 'REVERSED' : order.settlementStatus,
        refundedSatang: Number(amountRefundedSatang) || totalSatang,
        refundedAt: now,
        stripeRefundId: refundId || order.stripeRefundId || null,
        version: (order.version || 1) + 1,
        updatedAt: now
      });

      for (const requestId of openRequestIds) {
        t.set(adminDb.collection('refund_requests').doc(requestId), {
          status: 'COMPLETED',
          stripeRefundId: refundId || null,
          completedAt: now,
          updatedAt: now
        }, { merge: true });
      }

      if (needsLedgerReversal) {
        await recordRefund(t, adminDb, {
          orderId,
          storeId: order.storeId,
          totalSatang,
          merchantNetSatang,
          platformFeeSatang,
          gatewayFeeSatang,
          now
        });
      }

      t.set(orderRef.collection('events').doc(), {
        orderId,
        fromStatus: order.status,
        toStatus: order.status,
        changedBy: 'STRIPE_WEBHOOK',
        changerRole: 'system',
        note: `Refund ${refundId || ''} confirmed by Stripe (฿${((Number(amountRefundedSatang) || totalSatang) / 100).toFixed(2)}).`,
        timestamp: now
      });
    });

    // A refund on money that has already moved past pending cannot be unwound
    // by a webhook: the store may have been paid it out.
    const after = (await orderRef.get()).data();
    if (after && after.settlementStatus !== 'REVERSED') {
      await recordPaymentException(adminDb, {
        orderId,
        reason: 'REFUND_AFTER_SETTLEMENT',
        providerPaymentIntentId: paymentIntentId,
        amountSatang: Number(amountRefundedSatang) || null,
        detail: `Refund confirmed while settlement was ${after.settlementStatus}. `
          + 'The merchant balance needs adjusting by hand.',
        now
      });
    }

    console.log(`[Stripe Webhook] Refund recorded for order ${orderId}.`);
  }
}

/** Records a payment that the customer never completed. */
async function applyPaymentFailure({ orderId, reason, now }) {
  const orderRef = adminDb.collection('orders').doc(orderId);
  await adminDb.runTransaction(async (t) => {
    const snap = await t.get(orderRef);
    if (!snap.exists) return;
    const order = snap.data();

    // Money did arrive at some point, so this is not a simple failure.
    if (order.paymentStatus === 'PAID') return;

    t.update(orderRef, {
      paymentStatus: 'FAILED',
      version: (order.version || 1) + 1,
      updatedAt: now
    });
    t.set(orderRef.collection('events').doc(), {
      orderId,
      fromStatus: order.status,
      toStatus: order.status,
      changedBy: 'STRIPE_WEBHOOK',
      changerRole: 'system',
      note: `Payment not completed (${reason}). The customer can try again or cancel.`,
      timestamp: now
    });
  });
}

/**
 * POST /api/webhooks/stripe
 * Stripe Webhook Handler with Signature Verification and Event Deduplication
 * Note: Must be mounted with express.raw({ type: 'application/json' }) before express.json()
 */
webhookRouter.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  if (isProduction && !webhookSecret) {
    return res.status(503).send(
      'Webhook Error: STRIPE_WEBHOOK_SECRET is not configured on this deployment. ' +
      'Refusing to process an unsigned payload.'
    );
  }

  try {
    if (webhookSecret) {
      if (!stripe) {
        return res.status(503).send('Webhook Error: Stripe is not configured.');
      }
      if (!sig) {
        return res.status(400).send('Webhook Error: Missing stripe-signature header.');
      }
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Development only: signature verification is mandatory in production,
      // enforced by the boot-time check above.
      console.warn('[Stripe Webhook] STRIPE_WEBHOOK_SECRET unset — accepting unsigned payload (development only).');
      const rawText = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
      event = JSON.parse(rawText);
    }
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const eventId = event.id;
  const eventType = event.type;
  const eventRef = adminDb.collection('payment_webhook_events').doc(eventId);

  // 1. Idempotency Check: Prevent duplicate webhook processing
  try {
    const existing = await eventRef.get();
    if (existing.exists) {
      console.log(`[Stripe Webhook] Event ${eventId} already processed, skipping.`);
      return res.status(200).json({ received: true, deduplicated: true });
    }
  } catch (err) {
    console.warn('[Stripe Webhook] Deduplication lookup error:', err.message);
  }

  const now = new Date().toISOString();

  try {
    switch (eventType) {
      // The session finished. For a card this means paid; for PromptPay and any
      // other delayed-notification method it can mean "QR issued, still
      // waiting", which is why payment_status decides rather than the event.
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        const orderId = orderIdFrom(session);

        if (!orderId) {
          console.warn(`[Stripe Webhook] ${eventType} missing orderId metadata.`);
          break;
        }

        if (session.payment_status !== 'paid') {
          console.log(
            `[Stripe Webhook] ${eventType} for order ${orderId} is ${session.payment_status}; ` +
            'waiting for async_payment_succeeded before settling.'
          );
          break;
        }

        await applyPayment({
          orderId,
          amountPaidSatang: Number(session.amount_total),
          sessionId: session.id,
          paymentIntentId: session.payment_intent || null,
          paymentMethodType: session.payment_method_types?.[0] || 'promptpay',
          changedBy: 'STRIPE_WEBHOOK',
          now
        });
        break;
      }

      // The direct PaymentIntent flow has no session, so this is what settles
      // it. For a Checkout payment it arrives alongside the session event and
      // the second one to land is a no-op.
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const orderId = orderIdFrom(paymentIntent);

        if (!orderId) {
          console.log('[Stripe Webhook] payment_intent.succeeded without an order id; ignoring.');
          break;
        }

        await applyPayment({
          orderId,
          amountPaidSatang: Number(paymentIntent.amount_received ?? paymentIntent.amount),
          sessionId: null,
          paymentIntentId: paymentIntent.id,
          paymentMethodType: paymentIntent.payment_method_types?.[0] || 'promptpay',
          changedBy: 'STRIPE_WEBHOOK',
          now
        });
        break;
      }

      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = event.data.object;
        const orderId = orderIdFrom(session);
        if (orderId) {
          await applyPaymentFailure({ orderId, reason: eventType, now });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const orderId = orderIdFrom(paymentIntent);
        if (orderId) {
          await applyPaymentFailure({
            orderId,
            reason: paymentIntent.last_payment_error?.code || 'payment_failed',
            now
          });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        await applyRefund({
          paymentIntentId: charge.payment_intent,
          refundId: charge.refunds?.data?.[0]?.id || null,
          amountRefundedSatang: charge.amount_refunded,
          now
        });
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${eventType}`);
    }

    // Record webhook event as processed
    await eventRef.set({
      stripeEventId: eventId,
      type: eventType,
      processedAt: now,
      livemode: !!event.livemode
    });

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook] Processing error:', err);
    return res.status(500).json({ error: 'WEBHOOK_PROCESSING_FAILED', message: err.message });
  }
});
