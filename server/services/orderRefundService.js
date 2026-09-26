/**
 * Reversing the money on an order that will not be fulfilled.
 *
 * Cancelling a paid order used to release the kitchen slot and nothing else:
 * the customer's money stayed with the platform, the merchant kept the credit
 * in pendingSatang, and no reversal was ever posted. Merchant rejection had its
 * own copy of the reversal; cancellation had none at all.
 *
 * One implementation now serves both, so a route cannot cancel an order and
 * forget the money.
 */

import { recordRefund } from './ledgerService.js';
import { applyWalletDelta } from './customerWalletService.js';
import { resolveOrderBreakdown } from './orderPricing.js';

/**
 * Reverses payment for an order being cancelled or rejected, inside the
 * caller's transaction so the money and the status move together.
 *
 * Funds can only ever sit in pendingSatang at this point: the ledger moves them
 * on to on-hold at COMPLETED, and COMPLETED has no transition out.
 *
 * @param {object} t Firestore transaction
 * @param {object} adminDb
 * @param {object} params
 * @param {string} params.orderId
 * @param {object} params.order The stored order document
 * @param {string} params.reason Shown to the customer on the refund record
 * @param {string|null} params.actorUid Who triggered it, for the audit trail
 * @param {string} params.now ISO timestamp
 * @returns {Promise<{ reversed: boolean, method: 'wallet'|'gateway'|'none', amountSatang: number }>}
 */
export async function reverseOrderPayment(t, adminDb, { orderId, order, reason, actorUid = null, now }) {
  const wasPaid = order?.paymentStatus === 'PAID';
  const { totalSatang, platformFeeSatang, gatewayFeeSatang, merchantNetSatang } =
    resolveOrderBreakdown(order);

  // Nothing was ever captured: cash on collection, or still awaiting payment.
  if (!wasPaid || totalSatang <= 0) {
    return { reversed: false, method: 'none', amountSatang: 0 };
  }

  if (order.paidFromWallet) {
    // The wallet settled at order time, so it is refunded the same way rather
    // than queueing a gateway refund that would never arrive.
    await applyWalletDelta(t, adminDb, {
      uid: order.customerId,
      deltaSatang: totalSatang,
      type: 'REFUND',
      orderId,
      note: `คืนเงินอัตโนมัติ: ${reason}`,
      actorUid,
      now
    });

    await recordRefund(t, adminDb, {
      orderId,
      storeId: order.storeId,
      totalSatang,
      merchantNetSatang,
      platformFeeSatang,
      gatewayFeeSatang,
      now
    });

    return { reversed: true, method: 'wallet', amountSatang: totalSatang };
  }

  // Gateway payment: post the reversal now and record the outbox row that the
  // provider refund is executed against.
  const refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  t.set(adminDb.collection('refund_requests').doc(refundId), {
    id: refundId,
    orderId,
    storeId: order.storeId,
    customerId: order.customerId || null,
    amountSatang: totalSatang,
    reason,
    status: 'PENDING',
    requestedBy: actorUid,
    createdAt: now,
    updatedAt: now
  });

  await recordRefund(t, adminDb, {
    orderId,
    storeId: order.storeId,
    totalSatang,
    merchantNetSatang,
    platformFeeSatang,
    gatewayFeeSatang,
    now
  });

  return { reversed: true, method: 'gateway', amountSatang: totalSatang };
}

/**
 * Reads what a slot release would change, without writing it.
 *
 * Split in two because a Firestore transaction must finish reading before it
 * writes, and every caller has writes of its own to interleave. The workload
 * arithmetic lives here so the route and the expiry sweep cannot disagree about
 * how much capacity an order was holding.
 *
 * @returns {Promise<{ slotRef: object|null, slotUpdates: object|null }>}
 */
export async function readSlotRelease(t, adminDb, { order, now }) {
  if (!order?.storeId || !order?.slotId) {
    return { slotRef: null, slotUpdates: null };
  }

  const slotRef = adminDb
    .collection('stores').doc(order.storeId)
    .collection('pickup_slots').doc(order.slotId);
  const slotSnap = await t.get(slotRef);
  if (!slotSnap.exists) {
    return { slotRef: null, slotUpdates: null };
  }

  const slotData = slotSnap.data();
  const currentConfirmed = slotData.confirmedWorkload ?? 0;
  const orderWorkload = Number(order.workload)
    || (Array.isArray(order.items) ? order.items.reduce((s, it) => s + (it.quantity || 1), 0) : 1);

  return {
    slotRef,
    slotUpdates: {
      confirmedWorkload: Math.max(0, currentConfirmed - orderWorkload),
      updatedAt: now
    }
  };
}

/**
 * Statuses a customer may still cancel from.
 *
 * Once the kitchen has started cooking, the food exists and the store's own
 * cancellation policy no longer allows it — a store operator can still cancel
 * and refund, but the customer cannot do it unilaterally.
 */
export const CUSTOMER_CANCELLABLE_STATUSES = new Set([
  'DRAFT',
  'PAYMENT_PENDING',
  'PAID_AWAITING_MERCHANT'
]);

/**
 * @param {string} status Current order status
 * @returns {boolean}
 */
export function customerMayCancel(status) {
  return CUSTOMER_CANCELLABLE_STATUSES.has(String(status));
}
