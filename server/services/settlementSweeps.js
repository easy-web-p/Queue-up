/**
 * The two things that have to happen on their own for money not to get stuck.
 *
 * A merchant who never taps accept leaves a paid order sitting at
 * PAID_AWAITING_MERCHANT. The customer could cancel it themselves, but nobody
 * should have to chase a refund because a shop was busy, and an abandoned order
 * also holds a pickup slot nobody can book. And held funds only became
 * available when a merchant pressed a button in their dashboard, so a store that
 * never opened that tab was simply never paid.
 *
 * Both sweeps are idempotent and safe to run repeatedly: each re-reads the order
 * inside its transaction and does nothing if the state moved in the meantime.
 */

import { adminDb } from '../firebaseAdmin.js';
import { recordFundsReleased } from './ledgerService.js';
import { resolveOrderBreakdown } from './orderPricing.js';
import { reverseOrderPayment, readSlotRelease } from './orderRefundService.js';
import { NotificationEngine } from './notificationEngine.js';

/** How long an unpaid order may sit before it stops holding a slot. */
const UNPAID_ORDER_TTL_MS = 30 * 60 * 1000;

function msOf(value) {
  if (!value) return NaN;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return new Date(value).getTime();
}

/**
 * Expires one order and puts back whatever it was holding — the customer's
 * money and the kitchen slot.
 *
 * @returns {Promise<{ expired: boolean, refundMethod: string, amountSatang: number }>}
 */
async function expireOrder(orderId, { reason, requirePaid, now }) {
  const orderRef = adminDb.collection('orders').doc(orderId);

  return adminDb.runTransaction(async (t) => {
    const snap = await t.get(orderRef);
    if (!snap.exists) return { expired: false, refundMethod: 'none', amountSatang: 0 };

    const order = snap.data();
    const stillEligible = requirePaid
      ? order.status === 'PAID_AWAITING_MERCHANT'
      : order.status === 'PAYMENT_PENDING' || order.status === 'DRAFT';

    // Accepted, cancelled or paid since the query ran.
    if (!stillEligible) return { expired: false, refundMethod: 'none', amountSatang: 0 };

    const { slotRef, slotUpdates } = await readSlotRelease(t, adminDb, { order, now });
    const reversal = await reverseOrderPayment(t, adminDb, {
      orderId, order, reason, actorUid: null, now
    });

    t.update(orderRef, {
      status: 'EXPIRED',
      canonicalStatus: 'CANCELLED',
      cancellationReason: reason,
      settlementStatus: reversal.reversed ? 'REVERSED' : 'NOT_SETTLED',
      paymentStatus: reversal.method === 'wallet'
        ? 'REFUNDED'
        : (reversal.reversed ? 'REFUND_PENDING' : order.paymentStatus || 'REQUIRES_PAYMENT'),
      refundedSatang: reversal.method === 'wallet' ? reversal.amountSatang : 0,
      refundedAt: reversal.method === 'wallet' ? now : null,
      expiredAt: now,
      version: (order.version || 1) + 1,
      updatedAt: now
    });

    if (slotRef && slotUpdates) t.update(slotRef, slotUpdates);

    if (order.reservationId) {
      t.set(adminDb.collection('reservations').doc(order.reservationId), {
        status: 'CANCELLED',
        cancelledAt: now,
        updatedAt: now
      }, { merge: true });
    }

    t.set(orderRef.collection('events').doc(), {
      orderId,
      fromStatus: order.status,
      toStatus: 'EXPIRED',
      changedBy: 'SYSTEM_SWEEP',
      changerRole: 'system',
      note: reason,
      timestamp: now
    });

    return {
      expired: true,
      refundMethod: reversal.method,
      amountSatang: reversal.amountSatang,
      customerId: order.customerId,
      storeName: order.storeName,
      schoolId: order.schoolId,
      queueNumber: order.orderNumber || order.queueNumber || null
    };
  });
}

/**
 * Expires orders whose merchant never responded, and unpaid orders that have sat
 * long enough to be abandoned.
 *
 * @param {object} [options]
 * @param {number} [options.nowMs] Overridable for tests.
 * @returns {Promise<{ expiredPaid: string[], expiredUnpaid: string[], refundedSatang: number }>}
 */
export async function runStaleOrderSweep({ nowMs = Date.now() } = {}) {
  const now = new Date(nowMs).toISOString();
  const expiredPaid = [];
  const expiredUnpaid = [];
  let refundedSatang = 0;

  const awaitingSnap = await adminDb
    .collection('orders')
    .where('status', '==', 'PAID_AWAITING_MERCHANT')
    .get();

  for (const doc of awaitingSnap.docs) {
    const order = doc.data();
    const deadline = msOf(order.merchantResponseDeadlineAt);
    if (!Number.isFinite(deadline) || nowMs < deadline) continue;

    const result = await expireOrder(doc.id, {
      reason: 'ร้านค้าไม่ตอบรับออเดอร์ในเวลาที่กำหนด ระบบยกเลิกและคืนเงินอัตโนมัติ',
      requirePaid: true,
      now
    });

    if (!result.expired) continue;
    expiredPaid.push(doc.id);
    refundedSatang += result.amountSatang;

    if (result.customerId && result.customerId !== 'guest-user') {
      NotificationEngine.sendOrderStatusChange({
        orderId: doc.id,
        queueNumber: result.queueNumber || 'คิวของคุณ',
        storeName: result.storeName || 'ร้านอาหาร',
        customerId: result.customerId,
        schoolId: result.schoolId,
        status: 'EXPIRED'
      }).catch((e) => console.warn('[Sweep] Expiry notification note:', e.message));
    }
  }

  const pendingSnap = await adminDb
    .collection('orders')
    .where('status', '==', 'PAYMENT_PENDING')
    .get();

  for (const doc of pendingSnap.docs) {
    const order = doc.data();
    const createdMs = msOf(order.createdAt);
    if (!Number.isFinite(createdMs) || nowMs - createdMs < UNPAID_ORDER_TTL_MS) continue;

    const result = await expireOrder(doc.id, {
      reason: 'ไม่ได้ชำระเงินภายในเวลาที่กำหนด ระบบยกเลิกออเดอร์อัตโนมัติ',
      requirePaid: false,
      now
    });
    if (result.expired) expiredUnpaid.push(doc.id);
  }

  if (expiredPaid.length || expiredUnpaid.length) {
    console.log(
      `[Sweep] Expired ${expiredPaid.length} unanswered paid order(s) ` +
      `(฿${(refundedSatang / 100).toFixed(2)} returned) and ${expiredUnpaid.length} unpaid order(s).`
    );
  }

  return { expiredPaid, expiredUnpaid, refundedSatang };
}

/**
 * Moves merchant funds from on-hold to available once their hold has elapsed.
 *
 * Shared by the merchant's own dashboard button and by the scheduled sweep, so
 * a store is paid on time whether or not anybody presses anything.
 *
 * @param {object} [options]
 * @param {string|null} [options.storeId] Limit to one store.
 * @param {number} [options.nowMs]
 * @returns {Promise<{ releasedOrders: string[], releasedSatang: number }>}
 */
export async function releaseDueHeldFunds({ storeId = null, nowMs = Date.now() } = {}) {
  let query = adminDb.collection('orders').where('settlementStatus', '==', 'ON_HOLD');
  if (storeId) query = query.where('storeId', '==', storeId);

  const snap = await query.get();
  const now = new Date(nowMs).toISOString();
  const releasedOrders = [];
  let releasedSatang = 0;

  for (const doc of snap.docs) {
    const order = doc.data();
    const releaseAt = msOf(order.fundReleaseAt);
    if (Number.isFinite(releaseAt) && nowMs < releaseAt) continue;

    const orderRef = adminDb.collection('orders').doc(doc.id);
    const released = await adminDb.runTransaction(async (t) => {
      const fresh = await t.get(orderRef);
      if (!fresh.exists) return 0;
      const current = fresh.data();

      // Released by the dashboard button, or reversed, since the query ran.
      if (current.settlementStatus !== 'ON_HOLD') return 0;

      const { merchantNetSatang } = resolveOrderBreakdown(current);
      t.update(orderRef, { settlementStatus: 'AVAILABLE', fundsReleasedAt: now, updatedAt: now });
      await recordFundsReleased(t, adminDb, {
        orderId: doc.id,
        storeId: current.storeId,
        merchantNetSatang,
        now
      });
      return merchantNetSatang;
    });

    if (released > 0) {
      releasedOrders.push(doc.id);
      releasedSatang += released;
    }
  }

  return { releasedOrders, releasedSatang };
}

export { UNPAID_ORDER_TTL_MS };
