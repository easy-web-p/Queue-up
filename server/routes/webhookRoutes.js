import { Router } from 'express';
import Stripe from 'stripe';
import { adminDb } from '../firebaseAdmin.js';
import { recordCustomerPayment, recordRefund } from '../services/ledgerService.js';
import { resolveOrderBreakdown } from '../services/orderPricing.js';
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
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId || session.client_reference_id;

        if (!orderId) {
          console.warn('[Stripe Webhook] checkout.session.completed missing orderId metadata.');
          break;
        }

        const orderRef = adminDb.collection('orders').doc(orderId);

        await adminDb.runTransaction(async (t) => {
          const orderSnap = await t.get(orderRef);
          if (!orderSnap.exists) {
            console.error(`[Stripe Webhook] Order ${orderId} not found.`);
            return;
          }

          const order = orderSnap.data();

          // Idempotency check on order status
          if (order.paymentStatus === 'PAID') {
            console.log(`[Stripe Webhook] Order ${orderId} already marked PAID.`);
            return;
          }

          // 5-minute deadline for merchant to accept/reject
          const merchantDeadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();
          const { totalSatang, platformFeeSatang, gatewayFeeSatang, merchantNetSatang } =
            resolveOrderBreakdown(order);

          // Update Order State
          t.update(orderRef, {
            status: 'PAID_AWAITING_MERCHANT',
            paymentStatus: 'PAID',
            settlementStatus: 'PENDING_ORDER_ACCEPTANCE',
            paidAt: now,
            merchantResponseDeadlineAt: merchantDeadline,
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent || null,
            version: (order.version || 1) + 1,
            updatedAt: now
          });

          // Write Customer Payment Record
          const paymentId = `pay_${session.id}`;
          const paymentRef = adminDb.collection('payments').doc(paymentId);
          t.set(paymentRef, {
            id: paymentId,
            orderId,
            storeId: order.storeId,
            customerId: order.customerId,
            amountSatang: totalSatang,
            currency: 'thb',
            provider: 'stripe',
            providerPaymentIntentId: session.payment_intent || null,
            providerCheckoutSessionId: session.id,
            paymentMethodType: session.payment_method_types?.[0] || 'promptpay',
            status: 'PAID',
            paidAt: now,
            createdAt: now,
            updatedAt: now
          });

          // Record Double-Entry Ledger
          await recordCustomerPayment(t, adminDb, {
            orderId,
            storeId: order.storeId,
            totalSatang,
            merchantNetSatang,
            platformFeeSatang,
            gatewayFeeSatang,
            now
          });

          // Record Audit Event
          const auditRef = orderRef.collection('events').doc();
          t.set(auditRef, {
            orderId,
            fromStatus: order.status,
            toStatus: 'PAID_AWAITING_MERCHANT',
            changedBy: 'STRIPE_WEBHOOK',
            changerRole: 'system',
            note: `Payment verified via Stripe (${session.payment_method_types?.join(', ') || 'online'}). Awaiting merchant acceptance.`,
            timestamp: now
          });
        });

        console.log(`[Stripe Webhook] Order ${orderId} successfully transitioned to PAID_AWAITING_MERCHANT.`);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata?.orderId;
        if (orderId) {
          console.log(`[Stripe Webhook] payment_intent.succeeded for order ${orderId}`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        console.log(`[Stripe Webhook] charge.refunded for payment intent ${paymentIntentId}`);
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
