/**
 * Settling a gateway payment onto an order.
 *
 * Three places used to do this: verify-session, the checkout.session.completed
 * webhook, and nothing at all for the direct PaymentIntent flow — which took
 * money and left the order in PAYMENT_PENDING forever. Each copy also trusted
 * that the event's arrival meant money had moved.
 *
 * With PromptPay that is not true. It is a delayed-notification method, so
 * checkout.session.completed can arrive with payment_status 'unpaid' while the
 * customer still has the QR open; the payment is confirmed later by
 * checkout.session.async_payment_succeeded, or refused by
 * checkout.session.async_payment_failed. Settling on the first event meant an
 * order could be marked PAID with no money behind it.
 *
 * One implementation now decides what settles, what does not, and what has to
 * be handed to a human.
 */

import { recordCustomerPayment } from './ledgerService.js';
import { resolveOrderBreakdown } from './orderPricing.js';

/** Minutes the merchant has to accept before the order can be expired. */
const MERCHANT_RESPONSE_WINDOW_MS = 5 * 60 * 1000;

/** Statuses from which a payment may still be applied to an order. */
const PAYABLE_STATUSES = new Set([
  'DRAFT',
  'PAYMENT_PENDING',
  'PAID_AWAITING_MERCHANT'
]);

/**
 * Applies a confirmed gateway payment to an order, inside the caller's
 * transaction so the order, the payment record and the ledger move together.
 *
 * Idempotent in two ways: an order already PAID is left alone, and the payment
 * document is keyed by the provider's own id, so a redelivered event overwrites
 * rather than duplicating.
 *
 * @param {object} t Firestore transaction
 * @param {object} adminDb
 * @param {object} params
 * @param {object} params.orderRef
 * @param {string} params.orderId
 * @param {object} params.order The stored order document
 * @param {number|null} [params.amountPaidSatang] What the provider says was
 *   captured. Checked against the order total when present.
 * @param {string} [params.provider]
 * @param {string|null} [params.providerPaymentIntentId]
 * @param {string|null} [params.providerCheckoutSessionId]
 * @param {string} [params.paymentMethodType]
 * @param {string} [params.changedBy] Audit trail actor
 * @param {string|null} [params.note] Audit trail note
 * @param {string} [params.now] ISO timestamp
 * @returns {Promise<{ settled: boolean, reason: string, amountSatang: number }>}
 */
export async function settleOrderPayment(t, adminDb, {
  orderRef,
  orderId,
  order,
  amountPaidSatang = null,
  provider = 'stripe',
  providerPaymentIntentId = null,
  providerCheckoutSessionId = null,
  paymentMethodType = 'promptpay',
  changedBy = 'STRIPE_WEBHOOK',
  note = null,
  now = new Date().toISOString()
}) {
  const { totalSatang, platformFeeSatang, gatewayFeeSatang, merchantNetSatang } =
    resolveOrderBreakdown(order);

  // Already settled: a redelivered or duplicated event, which Stripe sends
  // routinely. Nothing to do, and certainly nothing to post twice.
  if (order.paymentStatus === 'PAID') {
    return { settled: false, reason: 'ALREADY_PAID', amountSatang: totalSatang };
  }

  // The order is cancelled, rejected or already finished. Marking it paid now
  // would resurrect it; the money instead has to go back, which is the caller's
  // job because it happens outside this transaction.
  if (!PAYABLE_STATUSES.has(String(order.status))) {
    return { settled: false, reason: 'ORDER_NOT_PAYABLE', amountSatang: totalSatang };
  }

  // Less arrived than the order costs. This is not something a retry fixes and
  // it must not be written off silently, so it is refused and reported.
  if (amountPaidSatang !== null && Number.isFinite(Number(amountPaidSatang))
      && Number(amountPaidSatang) < totalSatang) {
    return {
      settled: false,
      reason: 'AMOUNT_MISMATCH',
      amountSatang: Number(amountPaidSatang)
    };
  }

  t.update(orderRef, {
    paymentStatus: 'PAID',
    status: 'PAID_AWAITING_MERCHANT',
    canonicalStatus: 'AWAITING_CONFIRMATION',
    settlementStatus: 'PENDING_ORDER_ACCEPTANCE',
    paidAt: now,
    merchantResponseDeadlineAt: new Date(Date.now() + MERCHANT_RESPONSE_WINDOW_MS).toISOString(),
    stripeSessionId: providerCheckoutSessionId || order.stripeSessionId || null,
    stripePaymentIntentId: providerPaymentIntentId || order.stripePaymentIntentId || null,
    version: (order.version || 1) + 1,
    updatedAt: now
  });

  // Keyed by the provider's id so a redelivery rewrites the same document.
  const paymentId = `pay_${providerCheckoutSessionId || providerPaymentIntentId || orderId}`;
  t.set(adminDb.collection('payments').doc(paymentId), {
    id: paymentId,
    orderId,
    storeId: order.storeId,
    customerId: order.customerId,
    amountSatang: totalSatang,
    currency: 'thb',
    provider,
    providerPaymentIntentId,
    providerCheckoutSessionId,
    paymentMethodType,
    status: 'PAID',
    paidAt: now,
    createdAt: now,
    updatedAt: now
  });

  await recordCustomerPayment(t, adminDb, {
    orderId,
    storeId: order.storeId,
    totalSatang,
    merchantNetSatang,
    platformFeeSatang,
    gatewayFeeSatang,
    now
  });

  t.set(orderRef.collection('events').doc(), {
    orderId,
    fromStatus: order.status,
    toStatus: 'PAID_AWAITING_MERCHANT',
    changedBy,
    changerRole: 'system',
    note: note || `Payment confirmed via ${provider} (${paymentMethodType}). Awaiting merchant acceptance.`,
    timestamp: now
  });

  return { settled: true, reason: 'SETTLED', amountSatang: totalSatang };
}

/**
 * Records a payment that arrived but could not be applied.
 *
 * An underpayment, or money for an order that has already been cancelled, is
 * real money sitting with the gateway. Left as a log line it would be lost at
 * the next deploy, so it is written where an operator can find and act on it.
 */
export async function recordPaymentException(adminDb, {
  orderId,
  reason,
  provider = 'stripe',
  providerPaymentIntentId = null,
  providerCheckoutSessionId = null,
  amountSatang = null,
  expectedSatang = null,
  detail = '',
  now = new Date().toISOString()
}) {
  const id = `pex_${orderId}_${reason}`.slice(0, 120);
  await adminDb.collection('payment_exceptions').doc(id).set({
    id,
    orderId,
    reason,
    provider,
    providerPaymentIntentId,
    providerCheckoutSessionId,
    amountSatang,
    expectedSatang,
    detail,
    status: 'OPEN',
    createdAt: now,
    updatedAt: now
  }, { merge: true });
  console.error(
    `[Payment] ${reason} on order ${orderId}: ${detail} — recorded in payment_exceptions/${id}`
  );
  return id;
}

/** Statuses whose merchant credit is still sitting in pendingSatang. */
export const PENDING_SETTLEMENT_STATUSES = new Set([
  'PENDING_ORDER_ACCEPTANCE',
  'PENDING_FULFILLMENT'
]);

export { MERCHANT_RESPONSE_WINDOW_MS, PAYABLE_STATUSES };
