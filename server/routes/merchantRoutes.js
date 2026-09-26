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
import { recordOrderFulfilled, recordRefund } from '../services/ledgerService.js';
import { resolveOrderBreakdown } from '../services/orderPricing.js';
import { NotificationEngine } from '../services/notificationEngine.js';
import { applyWalletDelta } from '../services/customerWalletService.js';
import dotenv from 'dotenv';

dotenv.config();

export const merchantRouter = Router();

const stripeSecretKey = optionalSecret('STRIPE_SECRET_KEY');
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const HMAC_SECRET = requireSecret('HMAC_SECRET', 'dev-only-insecure-hmac-secret');

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

      t.update(orderRef, {
        status: 'MERCHANT_REJECTED',
        canonicalStatus: 'CANCELLED',
        settlementStatus: 'REVERSED',
        paymentStatus: order.paidFromWallet ? 'REFUNDED' : 'REFUND_PENDING',
        cancellationReason: reasonMessage,
        rejectionReasonCode: reasonCode,
        version: (order.version || 1) + 1,
        updatedAt: now
      });

      // Campus Wallet settles at order time, so a rejection must put the money
      // straight back rather than queueing a gateway refund that never comes.
      if (order.paidFromWallet && order.paymentStatus === 'PAID') {
        await applyWalletDelta(t, adminDb, {
          uid: order.customerId,
          deltaSatang: Number(order.totalSatang) || 0,
          type: 'REFUND',
          orderId,
          note: `คืนเงินอัตโนมัติ: ร้านปฏิเสธออเดอร์ (${reasonMessage})`,
          actorUid: req.user?.uid || null,
          now
        });
      }

      // Write Outbox record for refund
      const refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const refundRef = adminDb.collection('refund_requests').doc(refundId);
      t.set(refundRef, {
        id: refundId,
        orderId,
        storeId: order.storeId,
        amountSatang: order.totalSatang || Math.round((order.total || 0) * 100),
        reason: `${reasonCode}: ${reasonMessage}`,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now
      });

      // Reverse pending ledger entry if previously credited
      if (order.paymentStatus === 'PAID') {
        const { totalSatang, platformFeeSatang, gatewayFeeSatang, merchantNetSatang } =
          resolveOrderBreakdown(order);

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
    if (stripe && orderDataToRefund?.stripePaymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: orderDataToRefund.stripePaymentIntentId,
          reason: 'requested_by_customer'
        });
        console.log(`[Merchant API] Stripe refund initiated: ${refund.id}`);
        await orderRef.update({
          paymentStatus: 'REFUNDED',
          stripeRefundId: refund.id,
          updatedAt: new Date().toISOString()
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
      if (!orderSnap.exists) throw new Error(`Order ${orderId} not found`);

      const order = orderSnap.data();

      // Check lockout
      if (order.exchangePinLockedUntil && new Date() < new Date(order.exchangePinLockedUntil)) {
        throw new Error('PIN verification temporarily locked due to too many failed attempts.');
      }

      // Compute HMAC of incoming PIN
      const computedHash = crypto.createHmac('sha256', HMAC_SECRET).update(String(exchangePin).trim()).digest('hex');

      // Verify PIN
      const isPinValid = order.exchangePinHash
        ? order.exchangePinHash === computedHash
        : order.exchangePin === String(exchangePin).trim(); // fallback if unhashed in dev

      if (!isPinValid) {
        const failedAttempts = (order.exchangePinFailedAttempts || 0) + 1;
        const lockUntil = failedAttempts >= 5
          ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
          : null;

        t.update(orderRef, {
          exchangePinFailedAttempts: failedAttempts,
          exchangePinLockedUntil: lockUntil,
          updatedAt: now
        });

        throw new Error(`INVALID_PIN: รหัส PIN รับอาหารไม่ถูกต้อง (ผิด ${failedAttempts}/5 ครั้ง)`);
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
        success: true,
        orderId,
        status: 'COMPLETED',
        settlementStatus: newSettlementStatus,
        fundReleaseAt: isOnlinePaid ? fundReleaseAt : null
      };
    });

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
