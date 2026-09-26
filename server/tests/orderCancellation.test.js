/**
 * Order Cancellation Test Suite
 *
 * Cancelling a paid order used to release the kitchen slot and nothing else:
 * the customer's money stayed with the platform and the merchant kept the
 * credit. These tests hold the money path to the same standard as the status
 * machine — a cancelled order is either refunded or was never paid, never
 * something in between.
 *
 * It also pins the Firestore rule that a transaction reads before it writes,
 * which the reversal work broke twice before the local store began enforcing it.
 */

process.env.ALLOW_MOCK_AUTH = 'true';
process.env.SUPER_ADMIN_EMAILS = 'root@queueup.test';

import http from 'http';
import express from 'express';
import { customerWalletRouter } from '../routes/customerWalletRoutes.js';
import { orderRouter } from '../routes/orderRoutes.js';
import { merchantRouter } from '../routes/merchantRoutes.js';
import { adminDb } from '../firebaseAdmin.js';
import { recordCustomerPayment } from '../services/ledgerService.js';
import { resolveOrderBreakdown } from '../services/orderPricing.js';
import { SlotTransactionService } from '../services/slotTransactionService.js';

console.log('===============================================================');
console.log('🚫 QUEUEUP ORDER CANCELLATION & REFUND SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api/wallet', customerWalletRouter);
app.use('/api/orders', orderRouter);
app.use('/api/merchant', merchantRouter);
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

async function request(baseUrl, path, method = 'GET', body = null, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
}

const SCHOOL = 'KKU';
const suffix = Date.now();
const STORE = `store-cancel-${suffix}`;
const OWNER = `merchant-cancel-owner-${suffix}`;
const STUDENT = `uid-student-cancel-${suffix}`;
const MENU = `menu-cancel-${suffix}`;

function as(uid, extra = {}) {
  return {
    'x-mock-user-id': uid,
    'x-mock-user-role': extra.role || 'customer',
    'x-mock-user-email': extra.email || `${uid}@kku.ac.th`,
    'x-mock-school-id': extra.schoolId || SCHOOL
  };
}

const COUNTER = as(`campus-counter-${suffix}`, { role: 'admin', schoolId: SCHOOL });
const MERCHANT = { 'x-mock-user-id': OWNER, 'x-mock-user-role': 'merchant' };

async function seed() {
  await adminDb.collection('stores').doc(STORE).set({
    id: STORE, name: 'ร้านข้าวมันไก่', ownerId: OWNER, isOpen: true,
    schoolId: SCHOOL, currentQueueCount: 0
  });
  await adminDb.collection('menu_items').doc(MENU).set({
    id: MENU, storeId: STORE, name: 'ข้าวมันไก่ต้ม', price: 50, isAvailable: true
  });
}

/** Every posting group touching this order must have debits equal to credits. */
async function ledgerBalances(orderId) {
  const snap = await adminDb.collection('ledger_entries').where('orderId', '==', orderId).get();
  const groups = new Map();
  for (const doc of snap.docs) {
    const e = doc.data();
    const g = groups.get(e.transactionGroupId) || { debit: 0, credit: 0 };
    g.debit += Number(e.debitSatang) || 0;
    g.credit += Number(e.creditSatang) || 0;
    groups.set(e.transactionGroupId, g);
  }
  const unbalanced = [...groups.entries()].filter(([, g]) => g.debit !== g.credit);
  return { groupCount: groups.size, unbalanced };
}

async function ledgerTypes(orderId) {
  const snap = await adminDb.collection('ledger_entries').where('orderId', '==', orderId).get();
  return snap.docs.map((d) => d.data().type);
}

async function refundRequestsFor(orderId) {
  const snap = await adminDb.collection('refund_requests').where('orderId', '==', orderId).get();
  return snap.docs.map((d) => d.data());
}

async function merchantPending() {
  const snap = await adminDb.collection('merchant_balances').doc(STORE).get();
  return snap.exists ? Number(snap.data().pendingSatang || 0) : 0;
}

async function walletBalance(baseUrl) {
  const res = await request(baseUrl, '/api/wallet', 'GET', null, as(STUDENT));
  return res.data?.wallet?.balanceSatang;
}

async function createWalletOrder(baseUrl, quantity = 1, extra = {}) {
  const res = await request(baseUrl, '/api/orders', 'POST', {
    storeId: STORE,
    items: [{ menuItemId: MENU, quantity }],
    paymentMethod: 'CAMPUS_WALLET',
    idempotencyKey: `cancel-wallet-${Date.now()}-${Math.random()}`,
    ...extra
  }, as(STUDENT));
  return res;
}

/** Brings a gateway order to PAID the way the Stripe webhook does. */
async function settleByGateway(orderId) {
  const orderRef = adminDb.collection('orders').doc(orderId);
  const now = new Date().toISOString();
  await adminDb.runTransaction(async (t) => {
    const snap = await t.get(orderRef);
    const order = snap.data();
    const { totalSatang, platformFeeSatang, gatewayFeeSatang, merchantNetSatang } =
      resolveOrderBreakdown(order);
    t.update(orderRef, {
      status: 'PAID_AWAITING_MERCHANT',
      paymentStatus: 'PAID',
      settlementStatus: 'PENDING_ORDER_ACCEPTANCE',
      paidAt: now,
      stripePaymentIntentId: `pi_test_${orderId}`,
      version: (order.version || 1) + 1,
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
  });
}

async function runTests() {
  const baseUrl = await startServer();

  try {
    await seed();
    await request(baseUrl, `/api/wallet/${STUDENT}/credit`, 'POST', { amountSatang: 50000 }, COUNTER);

    // --- A customer cancelling a wallet order gets their money back ---
    console.log('\n--- Cancelling a wallet-paid order ---');
    let res = await createWalletOrder(baseUrl, 2);
    const walletOrderId = res.data?.orderId;
    check(res.status === 201 && res.data?.order?.paymentStatus === 'PAID',
      'A wallet order starts out paid', `paymentStatus ${res.data?.order?.paymentStatus}`);
    check(await walletBalance(baseUrl) === 40000,
      'The wallet is debited ฿100', `balance ${await walletBalance(baseUrl)}`);
    check(await merchantPending() === 9000,
      'The wallet payment credits the merchant like any other payment',
      `pending ${await merchantPending()}`);

    res = await request(baseUrl, `/api/orders/${walletOrderId}/status`, 'PATCH',
      { status: 'CANCELLED', note: 'เปลี่ยนใจ' }, as(STUDENT));
    check(res.status === 200, 'The customer cancels before the kitchen starts', `status ${res.status}`);
    check(await walletBalance(baseUrl) === 50000,
      'The full amount is back in the wallet', `balance ${await walletBalance(baseUrl)}`);

    let stored = (await adminDb.collection('orders').doc(walletOrderId).get()).data();
    check(stored.paymentStatus === 'REFUNDED',
      'The order records the refund, not just the cancellation',
      `paymentStatus ${stored.paymentStatus}`);
    check(stored.settlementStatus === 'REVERSED',
      'Settlement is reversed so the merchant is no longer owed',
      `settlementStatus ${stored.settlementStatus}`);
    check(stored.refundedSatang === 10000 && typeof stored.refundedAt === 'string',
      'The refunded amount and time are written to the order',
      `${stored.refundedSatang} satang at ${stored.refundedAt}`);

    let books = await ledgerBalances(walletOrderId);
    check(books.groupCount === 2 && books.unbalanced.length === 0,
      'Payment and refund are both posted, and both balance',
      `${books.groupCount} groups`);
    check((await ledgerTypes(walletOrderId)).includes('REFUND'),
      'A REFUND posting exists for the cancelled order');
    check((await refundRequestsFor(walletOrderId)).length === 0,
      'No gateway refund is queued for money the wallet already returned');
    check(await merchantPending() === 0,
      'The refund takes the merchant credit back off the books, not below zero',
      `pending ${await merchantPending()}`);

    // --- The cancellation window closes when cooking starts ---
    console.log('\n--- Once the kitchen has started ---');
    res = await createWalletOrder(baseUrl, 1);
    const cookingOrderId = res.data?.orderId;
    const balanceWhileCooking = await walletBalance(baseUrl);

    res = await request(baseUrl, `/api/merchant/orders/${cookingOrderId}/accept`, 'POST', {}, MERCHANT);
    check(res.status === 200 && res.data?.status === 'PREPARING',
      'The store accepts the order and starts cooking', `status ${res.data?.status}`);

    res = await request(baseUrl, `/api/orders/${cookingOrderId}/status`, 'PATCH',
      { status: 'CANCELLED' }, as(STUDENT));
    check(res.status === 409 && res.data?.error === 'CANCELLATION_WINDOW_CLOSED',
      'The customer can no longer cancel unilaterally', `${res.status} ${res.data?.error}`);
    check(await walletBalance(baseUrl) === balanceWhileCooking,
      'The refused cancellation moved no money', `balance ${await walletBalance(baseUrl)}`);

    res = await request(baseUrl, `/api/orders/${cookingOrderId}/status`, 'PATCH',
      { status: 'CANCELLED', note: 'ของหมดกลางทาง' }, MERCHANT);
    check(res.status === 200, 'The store operator can still cancel and refund', `status ${res.status}`);
    check(await walletBalance(baseUrl) === balanceWhileCooking + 5000,
      'The customer is refunded when the store cancels',
      `balance ${await walletBalance(baseUrl)}`);
    books = await ledgerBalances(cookingOrderId);
    check(books.unbalanced.length === 0, 'The store-side cancellation balances too');

    // --- A gateway payment is queued for refund, not silently dropped ---
    console.log('\n--- Cancelling a card / PromptPay order ---');
    res = await request(baseUrl, '/api/orders', 'POST', {
      storeId: STORE,
      items: [{ menuItemId: MENU, quantity: 3 }],
      paymentMethod: 'promptpay',
      idempotencyKey: `cancel-gateway-${suffix}`
    }, as(STUDENT));
    const gatewayOrderId = res.data?.orderId;
    check(res.status === 201 && res.data?.order?.paymentStatus === 'REQUIRES_PAYMENT',
      'A gateway order starts unpaid', `paymentStatus ${res.data?.order?.paymentStatus}`);

    await settleByGateway(gatewayOrderId);
    res = await request(baseUrl, `/api/orders/${gatewayOrderId}/status`, 'PATCH',
      { status: 'CANCELLED', note: 'ยกเลิกหลังชำระ' }, as(STUDENT));
    check(res.status === 200, 'The customer cancels the paid gateway order', `status ${res.status}`);

    stored = (await adminDb.collection('orders').doc(gatewayOrderId).get()).data();
    check(stored.paymentStatus === 'REFUND_PENDING',
      'The order is marked awaiting the provider refund, not already refunded',
      `paymentStatus ${stored.paymentStatus}`);
    check(stored.refundedAt === null,
      'No refund time is claimed before the provider has paid it back',
      `refundedAt ${stored.refundedAt}`);

    const queued = await refundRequestsFor(gatewayOrderId);
    check(queued.length === 1 && queued[0].status === 'PENDING' && queued[0].amountSatang === 15000,
      'Exactly one pending refund request is queued for the full amount',
      `${queued.length} request(s), ${queued[0]?.amountSatang} satang`);
    books = await ledgerBalances(gatewayOrderId);
    check(books.groupCount === 2 && books.unbalanced.length === 0,
      'The gateway refund posting balances', `${books.groupCount} groups`);

    // --- Nothing paid means nothing to refund ---
    console.log('\n--- Cancelling an order that was never paid ---');
    res = await request(baseUrl, '/api/orders', 'POST', {
      storeId: STORE,
      items: [{ menuItemId: MENU, quantity: 1 }],
      paymentMethod: 'promptpay',
      idempotencyKey: `cancel-unpaid-${suffix}`
    }, as(STUDENT));
    const unpaidOrderId = res.data?.orderId;

    res = await request(baseUrl, `/api/orders/${unpaidOrderId}/status`, 'PATCH',
      { status: 'CANCELLED' }, as(STUDENT));
    check(res.status === 200, 'An unpaid order cancels cleanly', `status ${res.status}`);
    stored = (await adminDb.collection('orders').doc(unpaidOrderId).get()).data();
    check(stored.paymentStatus === 'REQUIRES_PAYMENT',
      'It is not marked refunded, because nothing was taken',
      `paymentStatus ${stored.paymentStatus}`);
    check((await refundRequestsFor(unpaidOrderId)).length === 0,
      'No refund request is queued for an unpaid order');
    check((await ledgerTypes(unpaidOrderId)).length === 0,
      'No ledger posting is written for an unpaid cancellation');

    // --- The kitchen slot is released along with the money ---
    console.log('\n--- Releasing the pickup slot ---');
    const slotId = `2030-01-01_12-00`;
    const reservationId = `res-cancel-${suffix}`;
    const reserved = await SlotTransactionService.reserveSlot({
      storeId: STORE, slotId, reservationId, workload: 1,
      uid: STUDENT, schoolId: SCHOOL
    });
    check(reserved.success === true, 'A pickup slot is reserved', `reason ${reserved.reason || 'ok'}`);

    res = await createWalletOrder(baseUrl, 1, { slotId, reservationId });
    const slotOrderId = res.data?.orderId;
    let slot = (await SlotTransactionService.getSlotRef(STORE, slotId).get()).data();
    check(slot.confirmedWorkload === 1,
      'Creating the order confirms the slot workload', `confirmed ${slot.confirmedWorkload}`);

    res = await request(baseUrl, `/api/orders/${slotOrderId}/status`, 'PATCH',
      { status: 'CANCELLED' }, as(STUDENT));
    check(res.status === 200, 'The slot-bound order cancels', `status ${res.status}`);
    slot = (await SlotTransactionService.getSlotRef(STORE, slotId).get()).data();
    check(slot.confirmedWorkload === 0,
      'The workload is returned to the slot for someone else to book',
      `confirmed ${slot.confirmedWorkload}`);
    const reservation = (await adminDb.collection('reservations').doc(reservationId).get()).data();
    check(reservation?.status === 'CANCELLED',
      'The reservation is cancelled with the order', `status ${reservation?.status}`);

    // --- The rule that caught both bugs above ---
    console.log('\n--- Reads before writes ---');
    let guardError = null;
    try {
      await adminDb.runTransaction(async (t) => {
        const ref = adminDb.collection('orders').doc(unpaidOrderId);
        t.update(ref, { updatedAt: new Date().toISOString() });
        await t.get(ref);
      });
    } catch (err) {
      guardError = err;
    }
    check(guardError !== null && /reads.*before.*writes/i.test(guardError.message),
      'A transaction that reads after writing is rejected, as the real SDK does',
      guardError ? guardError.message.slice(0, 48) : 'no error thrown');

    console.log('\n===============================================================');
    console.log(`📊 CANCELLATION & REFUND RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Cancellation suite crashed:', err);
  process.exit(1);
});
