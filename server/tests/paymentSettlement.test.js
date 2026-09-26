/**
 * Gateway Payment Settlement Suite
 *
 * PromptPay is a delayed-notification method: Stripe sends
 * checkout.session.completed as soon as the QR is issued, with payment_status
 * still 'unpaid', and confirms the money later with
 * checkout.session.async_payment_succeeded. The webhook used to settle on the
 * first event, which marked orders PAID with nothing behind them, and it had no
 * handler at all for the direct PaymentIntent flow or for a confirmed refund.
 *
 * These tests drive the webhook with the event shapes Stripe actually sends.
 */

process.env.ALLOW_MOCK_AUTH = 'true';

import http from 'http';
import express from 'express';
import { webhookRouter } from '../routes/webhookRoutes.js';
import { orderRouter } from '../routes/orderRoutes.js';
import { adminDb } from '../firebaseAdmin.js';

console.log('===============================================================');
console.log('💳 QUEUEUP GATEWAY SETTLEMENT SUITE');
console.log('===============================================================');

const app = express();
// Mounted exactly as production does: raw body for the webhook, JSON elsewhere.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRouter);
app.use(express.json());
app.use('/api/orders', orderRouter);
const server = http.createServer(app);

let total = 0;
let passed = 0;

function check(condition, message, detail = '') {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}${detail ? ` (${detail})` : ''}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}${detail ? ` (${detail})` : ''}`);
    process.exitCode = 1;
  }
}

async function startServer() {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

const SCHOOL = 'KKU';
const suffix = Date.now();
const STORE = `store-settle-${suffix}`;
const OWNER = `merchant-settle-${suffix}`;
const STUDENT = `uid-student-settle-${suffix}`;
const MENU = `menu-settle-${suffix}`;

function as(uid) {
  return {
    'x-mock-user-id': uid,
    'x-mock-user-role': 'customer',
    'x-mock-user-email': `${uid}@kku.ac.th`,
    'x-mock-school-id': SCHOOL
  };
}

let baseUrl = '';

async function api(path, method = 'GET', body = null, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

/** Posts a Stripe-shaped event at the webhook the way Stripe would. */
async function sendEvent(event) {
  const res = await fetch(`${baseUrl}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

function checkoutEvent(type, { id, orderId, amountTotal, paymentStatus, paymentIntent }) {
  return {
    id,
    type,
    livemode: false,
    data: {
      object: {
        id: `cs_test_${orderId}`,
        object: 'checkout.session',
        amount_total: amountTotal,
        payment_status: paymentStatus,
        payment_intent: paymentIntent,
        payment_method_types: ['promptpay', 'card'],
        metadata: { orderId }
      }
    }
  };
}

async function seed() {
  await adminDb.collection('stores').doc(STORE).set({
    id: STORE, name: 'ร้านส้มตำ', ownerId: OWNER, isOpen: true,
    schoolId: SCHOOL, currentQueueCount: 0
  });
  await adminDb.collection('menu_items').doc(MENU).set({
    id: MENU, storeId: STORE, name: 'ส้มตำไทย', price: 60, isAvailable: true
  });
}

async function createOrder(quantity = 1) {
  const res = await api('/api/orders', 'POST', {
    storeId: STORE,
    items: [{ menuItemId: MENU, quantity }],
    paymentMethod: 'promptpay',
    idempotencyKey: `settle-${Date.now()}-${Math.random()}`
  }, as(STUDENT));
  return res.data?.orderId;
}

async function order(orderId) {
  return (await adminDb.collection('orders').doc(orderId).get()).data();
}

async function ledgerGroups(orderId) {
  const snap = await adminDb.collection('ledger_entries').where('orderId', '==', orderId).get();
  const groups = new Map();
  for (const doc of snap.docs) {
    const e = doc.data();
    const g = groups.get(e.transactionGroupId) || { debit: 0, credit: 0 };
    g.debit += Number(e.debitSatang) || 0;
    g.credit += Number(e.creditSatang) || 0;
    groups.set(e.transactionGroupId, g);
  }
  return {
    count: groups.size,
    unbalanced: [...groups.values()].filter((g) => g.debit !== g.credit).length
  };
}

async function exceptionsFor(orderId) {
  const snap = await adminDb.collection('payment_exceptions').where('orderId', '==', orderId).get();
  return snap.docs.map((d) => d.data());
}

async function runTests() {
  baseUrl = await startServer();

  try {
    await seed();

    // --- A PromptPay QR is not a payment ---
    console.log('\n--- checkout.session.completed while still unpaid ---');
    const promptPayOrder = await createOrder(1);
    let res = await sendEvent(checkoutEvent('checkout.session.completed', {
      id: `evt_qr_${suffix}`, orderId: promptPayOrder, amountTotal: 6000,
      paymentStatus: 'unpaid', paymentIntent: `pi_test_${promptPayOrder}`
    }));
    check(res.status === 200, 'Stripe gets its 200 so the event is not retried', `status ${res.status}`);
    let stored = await order(promptPayOrder);
    check(stored.paymentStatus === 'REQUIRES_PAYMENT' && stored.status === 'PAYMENT_PENDING',
      'The order is NOT marked paid while the QR is merely open',
      `${stored.status} / ${stored.paymentStatus}`);
    check((await ledgerGroups(promptPayOrder)).count === 0,
      'Nothing is posted to the ledger for money that has not arrived');

    console.log('\n--- checkout.session.async_payment_succeeded ---');
    res = await sendEvent(checkoutEvent('checkout.session.async_payment_succeeded', {
      id: `evt_paid_${suffix}`, orderId: promptPayOrder, amountTotal: 6000,
      paymentStatus: 'paid', paymentIntent: `pi_test_${promptPayOrder}`
    }));
    check(res.status === 200, 'The confirmation is accepted', `status ${res.status}`);
    stored = await order(promptPayOrder);
    check(stored.paymentStatus === 'PAID' && stored.status === 'PAID_AWAITING_MERCHANT',
      'Now the order is paid and waiting on the merchant',
      `${stored.status} / ${stored.paymentStatus}`);
    check(typeof stored.merchantResponseDeadlineAt === 'string',
      'The merchant response deadline is set from the moment money arrived');
    let books = await ledgerGroups(promptPayOrder);
    check(books.count === 1 && books.unbalanced === 0,
      'Exactly one balanced payment posting exists', `${books.count} group(s)`);

    console.log('\n--- Duplicate and late events ---');
    res = await sendEvent(checkoutEvent('checkout.session.async_payment_succeeded', {
      id: `evt_paid_${suffix}`, orderId: promptPayOrder, amountTotal: 6000,
      paymentStatus: 'paid', paymentIntent: `pi_test_${promptPayOrder}`
    }));
    check(res.data?.deduplicated === true, 'A redelivered event is recognised by its id');

    res = await sendEvent(checkoutEvent('checkout.session.completed', {
      id: `evt_late_${suffix}`, orderId: promptPayOrder, amountTotal: 6000,
      paymentStatus: 'paid', paymentIntent: `pi_test_${promptPayOrder}`
    }));
    books = await ledgerGroups(promptPayOrder);
    check(books.count === 1,
      'A second event for the same money posts nothing further', `${books.count} group(s)`);
    check((await exceptionsFor(promptPayOrder)).length === 0,
      'An already-paid order is not treated as an exception');

    // --- The direct PaymentIntent flow ---
    console.log('\n--- payment_intent.succeeded (no Checkout session) ---');
    const intentOrder = await createOrder(2);
    res = await sendEvent({
      id: `evt_pi_${suffix}`,
      type: 'payment_intent.succeeded',
      livemode: false,
      data: {
        object: {
          id: `pi_direct_${intentOrder}`,
          object: 'payment_intent',
          amount: 12000,
          amount_received: 12000,
          payment_method_types: ['card'],
          metadata: { orderId: intentOrder }
        }
      }
    });
    check(res.status === 200, 'The intent event is accepted', `status ${res.status}`);
    stored = await order(intentOrder);
    check(stored.paymentStatus === 'PAID',
      'A PaymentIntent payment settles its order instead of vanishing',
      `paymentStatus ${stored.paymentStatus}`);
    check(stored.stripePaymentIntentId === `pi_direct_${intentOrder}`,
      'The intent id is recorded on the order for reconciliation');
    check((await ledgerGroups(intentOrder)).unbalanced === 0,
      'The posting for it balances');

    // --- Underpayment ---
    console.log('\n--- Less money than the order costs ---');
    const shortOrder = await createOrder(3);
    res = await sendEvent(checkoutEvent('checkout.session.completed', {
      id: `evt_short_${suffix}`, orderId: shortOrder, amountTotal: 100,
      paymentStatus: 'paid', paymentIntent: `pi_short_${shortOrder}`
    }));
    stored = await order(shortOrder);
    check(stored.paymentStatus !== 'PAID',
      'An underpaid order is not settled', `paymentStatus ${stored.paymentStatus}`);
    let exceptions = await exceptionsFor(shortOrder);
    check(exceptions.length === 1 && exceptions[0].reason === 'AMOUNT_MISMATCH',
      'The shortfall is recorded where an operator will find it',
      `${exceptions.length} exception(s): ${exceptions[0]?.reason}`);
    check(exceptions[0]?.amountSatang === 100 && exceptions[0]?.expectedSatang === 18000,
      'It records what arrived and what was owed',
      `${exceptions[0]?.amountSatang} of ${exceptions[0]?.expectedSatang}`);

    // --- Money for an order that no longer exists to be paid ---
    console.log('\n--- Payment arriving after cancellation ---');
    const lateOrder = await createOrder(1);
    await api(`/api/orders/${lateOrder}/status`, 'PATCH', { status: 'CANCELLED' }, as(STUDENT));
    res = await sendEvent(checkoutEvent('checkout.session.completed', {
      id: `evt_latepay_${suffix}`, orderId: lateOrder, amountTotal: 6000,
      paymentStatus: 'paid', paymentIntent: `pi_late_${lateOrder}`
    }));
    stored = await order(lateOrder);
    check(stored.status === 'CANCELLED' && stored.paymentStatus !== 'PAID',
      'A cancelled order is not resurrected by a late payment',
      `${stored.status} / ${stored.paymentStatus}`);
    exceptions = await exceptionsFor(lateOrder);
    check(exceptions.some((e) => e.reason === 'ORDER_NOT_PAYABLE'),
      'The stray payment is flagged for refunding by hand',
      exceptions.map((e) => e.reason).join(', '));

    // --- A failed PromptPay payment ---
    console.log('\n--- checkout.session.async_payment_failed ---');
    const failedOrder = await createOrder(1);
    await sendEvent(checkoutEvent('checkout.session.async_payment_failed', {
      id: `evt_fail_${suffix}`, orderId: failedOrder, amountTotal: 6000,
      paymentStatus: 'unpaid', paymentIntent: `pi_fail_${failedOrder}`
    }));
    stored = await order(failedOrder);
    check(stored.paymentStatus === 'FAILED',
      'The customer sees the payment failed rather than a silent pending order',
      `paymentStatus ${stored.paymentStatus}`);
    check(stored.status === 'PAYMENT_PENDING',
      'The order itself survives so they can try again', `status ${stored.status}`);

    // --- A confirmed refund closes the loop ---
    console.log('\n--- charge.refunded after our own cancellation ---');
    const refundOrder = await createOrder(1);
    await sendEvent(checkoutEvent('checkout.session.completed', {
      id: `evt_refpay_${suffix}`, orderId: refundOrder, amountTotal: 6000,
      paymentStatus: 'paid', paymentIntent: `pi_ref_${refundOrder}`
    }));
    await api(`/api/orders/${refundOrder}/status`, 'PATCH',
      { status: 'CANCELLED', note: 'ลูกค้ายกเลิก' }, as(STUDENT));
    stored = await order(refundOrder);
    check(stored.paymentStatus === 'REFUND_PENDING',
      'Cancelling queues the gateway refund', `paymentStatus ${stored.paymentStatus}`);

    await sendEvent({
      id: `evt_refunded_${suffix}`,
      type: 'charge.refunded',
      livemode: false,
      data: {
        object: {
          id: `ch_${refundOrder}`,
          object: 'charge',
          payment_intent: `pi_ref_${refundOrder}`,
          amount_refunded: 6000,
          refunds: { data: [{ id: `re_${refundOrder}` }] }
        }
      }
    });
    stored = await order(refundOrder);
    check(stored.paymentStatus === 'REFUNDED' && typeof stored.refundedAt === 'string',
      'Stripe confirming the refund is what marks it refunded',
      `paymentStatus ${stored.paymentStatus}`);
    check(stored.stripeRefundId === `re_${refundOrder}`,
      'The provider refund id is stored against the order');

    const requests = await adminDb.collection('refund_requests')
      .where('orderId', '==', refundOrder).get();
    check(requests.docs.length === 1 && requests.docs[0].data().status === 'COMPLETED',
      'The queued refund request is closed out rather than left pending',
      `status ${requests.docs[0]?.data().status}`);
    books = await ledgerGroups(refundOrder);
    check(books.count === 2 && books.unbalanced === 0,
      'Payment and refund are both posted once, and both balance',
      `${books.count} group(s)`);

    // --- Refunding straight from the Stripe dashboard ---
    console.log('\n--- charge.refunded with no request of ours ---');
    const dashboardOrder = await createOrder(1);
    await sendEvent(checkoutEvent('checkout.session.completed', {
      id: `evt_dashpay_${suffix}`, orderId: dashboardOrder, amountTotal: 6000,
      paymentStatus: 'paid', paymentIntent: `pi_dash_${dashboardOrder}`
    }));
    await sendEvent({
      id: `evt_dashref_${suffix}`,
      type: 'charge.refunded',
      livemode: false,
      data: {
        object: {
          id: `ch_${dashboardOrder}`,
          object: 'charge',
          payment_intent: `pi_dash_${dashboardOrder}`,
          amount_refunded: 6000,
          refunds: { data: [{ id: `re_${dashboardOrder}` }] }
        }
      }
    });
    stored = await order(dashboardOrder);
    check(stored.paymentStatus === 'REFUNDED' && stored.settlementStatus === 'REVERSED',
      'A refund issued outside the app still reverses the settlement',
      `${stored.paymentStatus} / ${stored.settlementStatus}`);
    books = await ledgerGroups(dashboardOrder);
    check(books.count === 2 && books.unbalanced === 0,
      'The books are corrected without anyone in the app doing anything',
      `${books.count} group(s)`);

    console.log('\n===============================================================');
    console.log(`📊 GATEWAY SETTLEMENT RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Settlement suite crashed:', err);
  process.exit(1);
});
