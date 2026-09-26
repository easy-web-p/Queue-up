/**
 * Settlement Sweep Suite
 *
 * Two things have to happen without anybody pressing anything, or money stops
 * where it should not. A merchant who never taps accept was leaving a paid order
 * — and a pickup slot — held indefinitely, and held merchant funds only became
 * available when a store owner opened their wallet tab and pressed a button.
 *
 * The sweeps are driven here with an explicit clock, so the deadlines are tested
 * rather than waited out.
 */

process.env.ALLOW_MOCK_AUTH = 'true';

import http from 'http';
import express from 'express';
import { orderRouter } from '../routes/orderRoutes.js';
import { merchantRouter } from '../routes/merchantRoutes.js';
import { customerWalletRouter } from '../routes/customerWalletRoutes.js';
import { cronRouter } from '../routes/cronRoutes.js';
import { adminDb } from '../firebaseAdmin.js';
import { runStaleOrderSweep, releaseDueHeldFunds } from '../services/settlementSweeps.js';
import { SlotTransactionService } from '../services/slotTransactionService.js';

console.log('===============================================================');
console.log('🧹 QUEUEUP SETTLEMENT SWEEP SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api/orders', orderRouter);
app.use('/api/merchant', merchantRouter);
app.use('/api/wallet', customerWalletRouter);
app.use('/api/cron', cronRouter);
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

const MINUTE = 60 * 1000;
const SCHOOL = 'KKU';
const suffix = Date.now();
const STORE = `store-sweep-${suffix}`;
const OWNER = `merchant-sweep-${suffix}`;
const STUDENT = `uid-student-sweep-${suffix}`;
const MENU = `menu-sweep-${suffix}`;

let baseUrl = '';

function as(uid, role = 'customer') {
  return {
    'x-mock-user-id': uid,
    'x-mock-user-role': role,
    'x-mock-user-email': `${uid}@kku.ac.th`,
    'x-mock-school-id': SCHOOL
  };
}

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

async function order(orderId) {
  return (await adminDb.collection('orders').doc(orderId).get()).data();
}

async function walletBalance() {
  const res = await api('/api/wallet', 'GET', null, as(STUDENT));
  return res.data?.wallet?.balanceSatang;
}

async function merchantBalance() {
  const snap = await adminDb.collection('merchant_balances').doc(STORE).get();
  const d = snap.exists ? snap.data() : {};
  return {
    pending: Number(d.pendingSatang || 0),
    onHold: Number(d.onHoldSatang || 0),
    available: Number(d.availableSatang || 0)
  };
}

async function ledgerBalanced(orderId) {
  const snap = await adminDb.collection('ledger_entries').where('orderId', '==', orderId).get();
  const groups = new Map();
  for (const doc of snap.docs) {
    const e = doc.data();
    const g = groups.get(e.transactionGroupId) || { debit: 0, credit: 0 };
    g.debit += Number(e.debitSatang) || 0;
    g.credit += Number(e.creditSatang) || 0;
    groups.set(e.transactionGroupId, g);
  }
  return [...groups.values()].every((g) => g.debit === g.credit);
}

async function seed() {
  await adminDb.collection('stores').doc(STORE).set({
    id: STORE, name: 'ร้านข้าวหมูแดง', ownerId: OWNER, isOpen: true,
    schoolId: SCHOOL, currentQueueCount: 0
  });
  await adminDb.collection('menu_items').doc(MENU).set({
    id: MENU, storeId: STORE, name: 'ข้าวหมูแดง', price: 50, isAvailable: true
  });
}

async function walletOrder(quantity = 1, extra = {}) {
  const res = await api('/api/orders', 'POST', {
    storeId: STORE,
    items: [{ menuItemId: MENU, quantity }],
    paymentMethod: 'CAMPUS_WALLET',
    idempotencyKey: `sweep-${Date.now()}-${Math.random()}`,
    ...extra
  }, as(STUDENT));
  return res.data?.orderId;
}

async function runTests() {
  baseUrl = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });

  try {
    await seed();
    await api(`/api/wallet/${STUDENT}/credit`, 'POST', { amountSatang: 100000 },
      as(`counter-${suffix}`, 'admin'));

    // --- The merchant never answers ---
    console.log('\n--- An order the merchant never answered ---');
    const slotId = '2030-02-02_12-00';
    const reservationId = `res-sweep-${suffix}`;
    await SlotTransactionService.reserveSlot({
      storeId: STORE, slotId, reservationId, workload: 1, uid: STUDENT, schoolId: SCHOOL
    });
    const ignored = await walletOrder(1, { slotId, reservationId });
    const balanceAfterOrder = await walletBalance();
    check((await order(ignored)).status === 'PAID_AWAITING_MERCHANT',
      'It is paid and waiting on the merchant', `status ${(await order(ignored)).status}`);

    // Still inside the five-minute window: nothing should move.
    let swept = await runStaleOrderSweep({ nowMs: Date.now() + MINUTE });
    check(!swept.expiredPaid.includes(ignored),
      'The sweep leaves it alone while the merchant still has time',
      `expired ${swept.expiredPaid.length} other order(s)`);
    check(await walletBalance() === balanceAfterOrder, 'No money moved');

    // Past the deadline.
    swept = await runStaleOrderSweep({ nowMs: Date.now() + 10 * MINUTE });
    check(swept.expiredPaid.includes(ignored),
      'Past the deadline it is expired', `${swept.expiredPaid.length} expired`);
    let stored = await order(ignored);
    check(stored.status === 'EXPIRED' && stored.paymentStatus === 'REFUNDED',
      'The order is expired and the payment refunded',
      `${stored.status} / ${stored.paymentStatus}`);
    check(await walletBalance() === balanceAfterOrder + 5000,
      'The customer gets their money back without asking',
      `balance ${await walletBalance()}`);
    check(await ledgerBalanced(ignored), 'The refund posting balances');
    check(swept.refundedSatang >= 5000,
      'The sweep reports what it returned', `${swept.refundedSatang} satang`);

    const slot = (await SlotTransactionService.getSlotRef(STORE, slotId).get()).data();
    check(slot.confirmedWorkload === 0,
      'The abandoned order stops holding its pickup slot', `confirmed ${slot.confirmedWorkload}`);
    check((await adminDb.collection('reservations').doc(reservationId).get()).data()?.status === 'CANCELLED',
      'Its reservation is cancelled too');

    // --- Running it again must not refund twice ---
    console.log('\n--- Running the sweep again ---');
    const balanceAfterSweep = await walletBalance();
    swept = await runStaleOrderSweep({ nowMs: Date.now() + 20 * MINUTE });
    check(!swept.expiredPaid.includes(ignored), 'There is nothing left to expire on this order');
    check(await walletBalance() === balanceAfterSweep,
      'Nobody is refunded a second time', `balance ${await walletBalance()}`);

    // --- An accepted order is not the sweep's business ---
    console.log('\n--- An order the merchant did accept ---');
    const accepted = await walletOrder(1);
    await api(`/api/merchant/orders/${accepted}/accept`, 'POST', {}, as(OWNER, 'merchant'));
    const balanceAfterAccept = await walletBalance();
    swept = await runStaleOrderSweep({ nowMs: Date.now() + 60 * MINUTE });
    stored = await order(accepted);
    check(stored.status === 'PREPARING',
      'A cooking order is never expired out from under the kitchen', `status ${stored.status}`);
    check(await walletBalance() === balanceAfterAccept, 'And nothing is refunded');

    // --- Abandoned unpaid orders stop holding capacity ---
    console.log('\n--- An unpaid order nobody came back to ---');
    const unpaidRes = await api('/api/orders', 'POST', {
      storeId: STORE,
      items: [{ menuItemId: MENU, quantity: 1 }],
      paymentMethod: 'promptpay',
      idempotencyKey: `sweep-unpaid-${suffix}`
    }, as(STUDENT));
    const unpaid = unpaidRes.data?.orderId;

    swept = await runStaleOrderSweep({ nowMs: Date.now() + 10 * MINUTE });
    check(!swept.expiredUnpaid.includes(unpaid),
      'Ten minutes in, the customer may still be paying',
      `${swept.expiredUnpaid.length} expired`);

    swept = await runStaleOrderSweep({ nowMs: Date.now() + 31 * MINUTE });
    check(swept.expiredUnpaid.includes(unpaid),
      'After half an hour it is treated as abandoned');
    stored = await order(unpaid);
    check(stored.status === 'EXPIRED' && stored.paymentStatus === 'REQUIRES_PAYMENT',
      'It expires without inventing a refund for money never taken',
      `${stored.status} / ${stored.paymentStatus}`);
    check(await ledgerBalanced(unpaid), 'No unbalanced posting is left behind');

    // --- Held funds reach the merchant on their own ---
    console.log('\n--- Releasing held funds ---');
    const completed = await walletOrder(2);
    await api(`/api/merchant/orders/${completed}/accept`, 'POST', {}, as(OWNER, 'merchant'));
    await api(`/api/orders/${completed}/status`, 'PATCH',
      { status: 'READY' }, as(OWNER, 'merchant'));
    await api(`/api/orders/${completed}/status`, 'PATCH',
      { status: 'COMPLETED' }, as(OWNER, 'merchant'));

    stored = await order(completed);
    check(stored.settlementStatus === 'ON_HOLD',
      'A completed order puts the merchant net on hold', `settlement ${stored.settlementStatus}`);
    let balances = await merchantBalance();
    check(balances.onHold === 9000,
      'The hold shows on the merchant balance', `onHold ${balances.onHold}`);

    let released = await releaseDueHeldFunds({ storeId: STORE, nowMs: Date.now() });
    check(released.releasedOrders.length === 0,
      'Nothing is released while the hold period is still running',
      `${released.releasedOrders.length} released`);

    released = await releaseDueHeldFunds({ storeId: STORE, nowMs: Date.now() + 61 * MINUTE });
    check(released.releasedOrders.includes(completed),
      'Once the hour is up the funds release without a button press');
    balances = await merchantBalance();
    check(balances.onHold === 0 && balances.available === 9000,
      'They move from on-hold to available', `onHold ${balances.onHold}, available ${balances.available}`);
    check(await ledgerBalanced(completed), 'The release posting balances');

    released = await releaseDueHeldFunds({ storeId: STORE, nowMs: Date.now() + 120 * MINUTE });
    balances = await merchantBalance();
    check(released.releasedOrders.length === 0 && balances.available === 9000,
      'A second run does not pay the merchant twice', `available ${balances.available}`);

    // --- The endpoint is not open to the internet ---
    console.log('\n--- Cron endpoint authorisation ---');
    let res = await api('/api/cron/settlement', 'POST');
    check(res.status === 200 && res.data?.job === 'settlement',
      'With no secret configured it runs locally', `status ${res.status}`);

    process.env.CRON_SECRET = `sweep-secret-${suffix}`;
    res = await api('/api/cron/settlement', 'POST');
    check(res.status === 401,
      'Once a secret is configured an unauthenticated call is refused', `status ${res.status}`);

    res = await api('/api/cron/settlement', 'POST', null,
      { Authorization: `Bearer sweep-secret-${suffix}` });
    check(res.status === 200, 'The scheduler with the right secret gets through', `status ${res.status}`);
    delete process.env.CRON_SECRET;

    console.log('\n===============================================================');
    console.log(`📊 SETTLEMENT SWEEP RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Sweep suite crashed:', err);
  process.exit(1);
});
