import { Router } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { adminDb } from '../firebaseAdmin.js';
import {
  authenticate,
  requireStoreOwnership,
  storeIdFromOrderParam
} from '../middleware/authenticate.js';
import { requireSecret, optionalSecret } from '../config/secrets.js';
import { recordOrderFulfilled } from '../services/ledgerService.js';
import { resolveOrderBreakdown } from '../services/orderPricing.js';
import { NotificationEngine } from '../services/notificationEngine.js';
import { reverseOrderPayment } from '../services/orderRefundService.js';
import dotenv from 'dotenv';

dotenv.config();

export const merchantRouter = Router();

const stripeSecretKey = optionalSecret('STRIPE_SECRET_KEY');
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const HMAC_SECRET = requireSecret('HMAC_SECRET', 'dev-only-insecure-hmac-secret');

/** Statuses from which food actually exists to hand over. */
const HANDOVER_STATUSES = new Set([
  'MERCHANT_ACCEPTED',
  'PREPARING',
  'READY',
  'READY_FOR_PICKUP'
]);

const PIN_ATTEMPT_LIMIT = 5;

/**
 * Checks a pickup PIN against the stored HMAC.
 *
 * Compared with timingSafeEqual: the digests are the same length every time, so
 * there is no reason to leak how much of one matched.
 */
function verifyPin(order, submittedPin) {
  const submitted = String(submittedPin ?? '').trim();
  if (!submitted) return false;

  if (order.exchangePinHash) {
    const computed = crypto.createHmac('sha256', HMAC_SECRET).update(submitted).digest('hex');
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(String(order.exchangePinHash), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // Fallback for an order written before PINs were hashed.
  return Boolean(order.exchangePin) && order.exchangePin === submitted;
}

/**
 * GET /api/merchant/orders
 * Retrieve list of orders for a store with merchant financial breakdown
 */
merchantRouter.get('/orders', authenticate, requireStoreOwnership(), async (req, res) => {
  try {
    // requireStoreOwnership resolved and authorised this storeId.
    const storeId = req.storeId;
    const limit = Math.min(Number(req.query.limit) || 200, 500);

    const snapshot = await adminDb
      .collection('orders')
      .where('storeId', '==', storeId)
      .get();

    const orders = [];
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    // Sort by createdAt desc
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    orders.splice(limit);

    return res.status(200).json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/orders/:id/accept
 * Merchant accepts paid order, triggers monotonic Queue Number generation and transitions to PREPARING
 */
merchantRouter.post('/orders/:id/accept', authenticate, requireStoreOwnership(storeIdFromOrderParam), async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const orderRef = adminDb.collection('orders').doc(orderId);
    const now = new Date().toISOString();

    const result = await adminDb.runTransaction(async (t) => {
      const orderSnap = await t.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error(`Order ${orderId} not found`);
      }

      const order = orderSnap.data();

      // Verify status is awaiting merchant
      if (order.status !== 'PAID_AWAITING_MERCHANT' && order.status !== 'PAYMENT_PENDING') {
        throw new Error(`Cannot accept order with current status: ${order.status}`);
      }

      // Check deadline
      if (order.merchantResponseDeadlineAt && new Date() > new Date(order.merchantResponseDeadlineAt)) {
        throw new Error('Merchant response deadline has expired for this order.');
      }

      const storeRef = adminDb.collection('stores').doc(order.storeId);
      const storeSnap = await t.get(storeRef);
      const storeData = storeSnap.exists ? storeSnap.data() : {};

      // Issue monotonic queue number upon acceptance
      const currentQueueSeq = (storeData.currentQueueCount || 0) + 1;
      const prefix = storeData.name?.includes('กาแฟ') || storeData.name?.includes('ชา') ? 'B' : 'A';
      const queueNumber = `${prefix}${String(currentQueueSeq).padStart(2, '0')}`;

      // Update store queue sequence
      t.update(storeRef, {
        currentQueueCount: currentQueueSeq,
        updatedAt: now
      });

      const isOnline = order.paymentMethod !== 'cash';
      const settlementStatus = isOnline ? 'PENDING_FULFILLMENT' : 'NOT_APPLICABLE';

      // Update Order document
      t.update(orderRef, {
        orderNumber: queueNumber,
        status: 'PREPARING',
        canonicalStatus: 'PREPARING',
        settlementStatus,
        acceptedAt: now,
        version: (order.version || 1) + 1,
        updatedAt: now
      });

      // Record Audit Event
      const auditRef = orderRef.collection('events').doc();
      t.set(auditRef, {
        orderId,
        fromStatus: order.status,
        toStatus: 'PREPARING',
        changedBy: req.user?.uid || 'merchant-staff',
        changerRole: 'merchant',
        note: `Order accepted by merchant. Queue number ${queueNumber} assigned.`,
        timestamp: now
      });

      return {
        success: true,
        orderId,
        orderNumber: queueNumber,
        status: 'PREPARING',
        settlementStatus
      };
    });

    orderRef.get().then(snap => {
      if (snap.exists) {
        const o = snap.data();
        if (o.customerId && o.customerId !== 'guest-user') {
          NotificationEngine.sendOrderStatusChange({
            orderId,
            queueNumber: o.orderNumber || result.queueNumber || 'คิวของคุณ',
            storeName: o.storeName || 'ร้านอาหาร',
            customerId: o.customerId,
            schoolId: o.schoolId,
            status: 'MERCHANT_ACCEPTED'
          }).catch(e => console.warn('[Merchant API] Accept notification note:', e.message));
        }
      }
    }).catch(() => {});

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Merchant API] Accept order error:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/orders/:id/reject
 * Merchant rejects order -> marks MERCHANT_REJECTED -> initiates Stripe refund
 */
merchantRouter.post('/orders/:id/reject', authenticate, requireStoreOwnership(storeIdFromOrderParam), async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { reasonCode = 'ITEM_SOLD_OUT', reasonMessage = 'ร้านค้าไม่สามารถรับออเดอร์ได้' } = req.body;
    const orderRef = adminDb.collection('orders').doc(orderId);
    const now = new Date().toISOString();

    let orderDataToRefund = null;
    let refundMethod = 'none';
    let refundAmountSatang = 0;

    await adminDb.runTransaction(async (t) => {
      const orderSnap = await t.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error(`Order ${orderId} not found`);
      }

      const order = orderSnap.data();
      orderDataToRefund = order;

      if (order.status !== 'PAID_AWAITING_MERCHANT' && order.status !== 'PAYMENT_PENDING') {
        throw new Error(`Cannot reject order with status ${order.status}`);
      }

      // The reversal reads the customer's wallet, so it has to run before any
      // write in this transaction: Firestore requires every read to precede
      // every write, and the order update below is a write.
      const reversal = await reverseOrderPayment(t, adminDb, {
        orderId,
        order,
        reason: `${reasonCode}: ${reasonMessage}`,
        actorUid: req.user?.uid || null,
        now
      });
      refundMethod = reversal.method;
      refundAmountSatang = reversal.amountSatang;

      t.update(orderRef, {
        status: 'MERCHANT_REJECTED',
        canonicalStatus: 'CANCELLED',
        settlementStatus: reversal.reversed ? 'REVERSED' : 'NOT_SETTLED',
        paymentStatus: reversal.method === 'wallet'
          ? 'REFUNDED'
          : (reversal.reversed ? 'REFUND_PENDING' : order.paymentStatus || 'UNPAID'),
        refundedSatang: reversal.method === 'wallet' ? reversal.amountSatang : 0,
        refundedAt: reversal.method === 'wallet' ? now : null,
        cancellationReason: reasonMessage,
        rejectionReasonCode: reasonCode,
        version: (order.version || 1) + 1,
        updatedAt: now
      });

      // Record Audit Event
      const auditRef = orderRef.collection('events').doc();
      t.set(auditRef, {
        orderId,
        fromStatus: order.status,
        toStatus: 'MERCHANT_REJECTED',
        changedBy: req.user?.uid || 'merchant-staff',
        changerRole: 'merchant',
        note: `Order rejected by merchant: ${reasonMessage}. Refund initiated.`,
        timestamp: now
      });
    });

    // Execute Stripe Refund asynchronously (Outbox/Saga pattern)
    if (refundMethod === 'gateway' && stripe && orderDataToRefund?.stripePaymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: orderDataToRefund.stripePaymentIntentId,
          reason: 'requested_by_customer'
        });
        console.log(`[Merchant API] Stripe refund initiated: ${refund.id}`);
        const refundedAt = new Date().toISOString();
        // charge.refunded closes out the refund_requests row and would set these
        // too, but recording them here keeps the order complete on a deployment
        // whose webhook is not configured yet.
        await orderRef.update({
          paymentStatus: 'REFUNDED',
          stripeRefundId: refund.id,
          refundedSatang: refundAmountSatang,
          refundedAt,
          updatedAt: refundedAt
        });
      } catch (stripeErr) {
        console.error('[Merchant API] Stripe refund error:', stripeErr.message);
      }
    }

    if (orderDataToRefund?.customerId && orderDataToRefund.customerId !== 'guest-user') {
      NotificationEngine.sendOrderStatusChange({
        orderId,
        queueNumber: orderDataToRefund.orderNumber || orderDataToRefund.queueNumber || 'คิวของคุณ',
        storeName: orderDataToRefund.storeName || 'ร้านอาหาร',
        customerId: orderDataToRefund.customerId,
        schoolId: orderDataToRefund.schoolId,
        status: 'MERCHANT_REJECTED'
      }).catch(e => console.warn('[Merchant API] Reject notification note:', e.message));
    }

    return res.status(200).json({
      success: true,
      orderId,
      status: 'MERCHANT_REJECTED',
      paymentStatus: 'REFUNDED'
    });
  } catch (err) {
    console.error('[Merchant API] Reject order error:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/orders/:id/ready
 * Mark food prepared and ready for customer pickup
 */
merchantRouter.post('/orders/:id/ready', authenticate, requireStoreOwnership(storeIdFromOrderParam), async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const orderRef = adminDb.collection('orders').doc(orderId);
    const now = new Date().toISOString();

    await adminDb.runTransaction(async (t) => {
      const orderSnap = await t.get(orderRef);
      if (!orderSnap.exists) throw new Error(`Order ${orderId} not found`);

      const order = orderSnap.data();
      t.update(orderRef, {
        status: 'READY_FOR_PICKUP',
        canonicalStatus: 'READY_FOR_PICKUP',
        version: (order.version || 1) + 1,
        updatedAt: now
      });

      const auditRef = orderRef.collection('events').doc();
      t.set(auditRef, {
        orderId,
        fromStatus: order.status,
        toStatus: 'READY_FOR_PICKUP',
        changedBy: req.user?.uid || 'merchant-staff',
        changerRole: 'merchant',
        note: 'Order is ready for pickup',
        timestamp: now
      });
    });

    orderRef.get().then(snap => {
      if (snap.exists) {
        const o = snap.data();
        if (o.customerId && o.customerId !== 'guest-user') {
          NotificationEngine.sendOrderReady({
            orderId,
            queueNumber: o.orderNumber || o.queueNumber || 'คิวของคุณ',
            storeId: o.storeId,
            storeName: o.storeName || 'ร้านอาหาร',
            customerId: o.customerId,
            schoolId: o.schoolId,
            lineNotifyToken: o.lineNotifyToken
          }).catch(e => console.warn('[Merchant API] Ready notification note:', e.message));
        }
      }
    }).catch(() => {});

    return res.status(200).json({ success: true, orderId, status: 'READY_FOR_PICKUP' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/orders/:id/complete
 * Verifies customer 4-digit pickup PIN via HMAC and marks COMPLETED.
 * Moves settlement status to ON_HOLD (holding period before release).
 */
merchantRouter.post('/orders/:id/complete', authenticate, requireStoreOwnership(storeIdFromOrderParam), async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { exchangePin } = req.body;

    if (!exchangePin) {
      return res.status(400).json({ success: false, error: 'MISSING_PIN', message: 'Pickup PIN is required.' });
    }

    const orderRef = adminDb.collection('orders').doc(orderId);
    const now = new Date().toISOString();

    const result = await adminDb.runTransaction(async (t) => {
      const orderSnap = await t.get(orderRef);
      if (!orderSnap.exists) {
        return { ok: false, status: 404, error: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` };
      }

      const order = orderSnap.data();

      // The food has to exist before it can be handed over. Without this an
      // order the shop never accepted could be completed straight from
      // PAID_AWAITING_MERCHANT — which told the order its money was on hold
      // while the ledger still had it pending, so the two disagreed and the
      // hold release then drove the balance negative. A cancelled and refunded
      // order could likewise be turned into a completed sale.
      if (!HANDOVER_STATUSES.has(String(order.status))) {
        return {
          ok: false,
          status: 409,
          error: 'ORDER_NOT_READY_FOR_HANDOVER',
          message: `ออเดอร์สถานะ ${order.status} ยังส่งมอบไม่ได้ กรุณารับออเดอร์และเตรียมอาหารก่อน`
        };
      }

      // Check lockout
      if (order.exchangePinLockedUntil && new Date() < new Date(order.exchangePinLockedUntil)) {
        return {
          ok: false,
          status: 423,
          error: 'PIN_LOCKED',
          message: 'ใส่รหัส PIN ผิดหลายครั้งเกินไป กรุณารอ 10 นาทีแล้วลองใหม่',
          lockedUntil: order.exchangePinLockedUntil
        };
      }

      const isPinValid = verifyPin(order, exchangePin);

      if (!isPinValid) {
        const failedAttempts = (order.exchangePinFailedAttempts || 0) + 1;
        const lockUntil = failedAttempts >= PIN_ATTEMPT_LIMIT
          ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
          : null;

        t.update(orderRef, {
          exchangePinFailedAttempts: failedAttempts,
          exchangePinLockedUntil: lockUntil,
          updatedAt: now
        });

        if (lockUntil) {
          t.set(orderRef.collection('events').doc(), {
            orderId,
            fromStatus: order.status,
            toStatus: order.status,
            changedBy: req.user?.uid || 'merchant-staff',
            changerRole: 'merchant',
            note: `Pickup PIN locked after ${failedAttempts} failed attempts.`,
            timestamp: now
          });
        }

        // Returned rather than thrown: a throw rolls the whole transaction back,
        // so the attempt counter was discarded every time and the lockout this
        // relies on could never trigger. A four-digit PIN with no lockout is
        // 10,000 guesses away from someone else's lunch.
        return {
          ok: false,
          status: 403,
          error: 'INVALID_PIN',
          message: `รหัส PIN รับอาหารไม่ถูกต้อง (ผิด ${failedAttempts}/${PIN_ATTEMPT_LIMIT} ครั้ง)`,
          failedAttempts,
          lockedUntil: lockUntil
        };
      }

      // Hold period for dispute & safety: 60 minutes
      const fundReleaseAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const { merchantNetSatang } = resolveOrderBreakdown(order);

      const isOnlinePaid = order.paymentMethod !== 'cash' && order.paymentStatus === 'PAID';
      const newSettlementStatus = isOnlinePaid ? 'ON_HOLD' : 'NOT_APPLICABLE';

      t.update(orderRef, {
        status: 'COMPLETED',
        canonicalStatus: 'COMPLETED',
        settlementStatus: newSettlementStatus,
        completedAt: now,
        fundReleaseAt: isOnlinePaid ? fundReleaseAt : null,
        exchangePinFailedAttempts: 0,
        exchangePinLockedUntil: null,
        version: (order.version || 1) + 1,
        updatedAt: now
      });

      // Record Order Fulfilled in Double-Entry Ledger (moves pending -> on_hold)
      // Strictly ONLY for online-paid orders where the platform collected escrow!
      if (isOnlinePaid && order.settlementStatus === 'PENDING_FULFILLMENT') {
        await recordOrderFulfilled(t, adminDb, {
          orderId,
          storeId: order.storeId,
          merchantNetSatang,
          now
        });
      }

      // Record Audit Event
      const auditRef = orderRef.collection('events').doc();
      t.set(auditRef, {
        orderId,
        fromStatus: order.status,
        toStatus: 'COMPLETED',
        changedBy: req.user?.uid || 'merchant-staff',
        changerRole: 'merchant',
        note: 'Customer PIN verified. Order completed. Funds placed ON_HOLD.',
        timestamp: now
      });

      return {
        ok: true,
        success: true,
        orderId,
        status: 'COMPLETED',
        settlementStatus: newSettlementStatus,
        fundReleaseAt: isOnlinePaid ? fundReleaseAt : null
      };
    });

    // A refused handover still commits what it recorded — the attempt counter —
    // so the answer is sent here rather than raised as an error.
    if (!result.ok) {
      const { ok, status, ...body } = result;
      return res.status(status).json({ success: false, ...body });
    }

    orderRef.get().then(snap => {
      if (snap.exists) {
        const o = snap.data();
        if (o.customerId && o.customerId !== 'guest-user') {
          NotificationEngine.sendOrderStatusChange({
            orderId,
            queueNumber: o.orderNumber || o.queueNumber || 'คิวของคุณ',
            storeName: o.storeName || 'ร้านอาหาร',
            customerId: o.customerId,
            schoolId: o.schoolId,
            status: 'COMPLETED'
          }).catch(e => console.warn('[Merchant API] Complete notification note:', e.message));
        }
      }
    }).catch(() => {});

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Merchant API] Complete order error:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
});
