/**
 * Order Handover Suite
 *
 * The pickup PIN is what stands between a paid order and the wrong person
 * walking off with the food, and completing an order is what starts the
 * merchant's money moving. Both live in one endpoint, and neither had a test.
 */

process.env.ALLOW_MOCK_AUTH = 'true';
process.env.SUPER_ADMIN_EMAILS = 'root@queueup.test';

import http from 'http';
import express from 'express';
import { orderRouter } from '../routes/orderRoutes.js';
import { merchantRouter } from '../routes/merchantRoutes.js';
import { customerWalletRouter } from '../routes/customerWalletRoutes.js';
import { adminDb } from '../firebaseAdmin.js';

console.log('===============================================================');
console.log('🔑 QUEUEUP ORDER HANDOVER SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api/orders', orderRouter);
app.use('/api/merchant', merchantRouter);
app.use('/api/wallet', customerWalletRouter);
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

const SCHOOL = 'KKU';
const suffix = Date.now();
const STORE = `store-handover-${suffix}`;
const OWNER = `merchant-handover-${suffix}`;
const OTHER_OWNER = `merchant-other-${suffix}`;
const OTHER_STORE = `store-other-${suffix}`;
const STUDENT = `uid-student-handover-${suffix}`;
const MENU = `menu-handover-${suffix}`;
let baseUrl = '';

function as(uid, role = 'customer') {
  return {
    'x-mock-user-id': uid,
    'x-mock-user-role': role,
    'x-mock-user-email': `${uid}@kku.ac.th`,
    'x-mock-school-id': SCHOOL
  };
}

const MERCHANT = as(OWNER, 'merchant');
const OTHER_MERCHANT = as(OTHER_OWNER, 'merchant');

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

async function order(id) {
  return (await adminDb.collection('orders').doc(id).get()).data();
}

async function balances() {
  const snap = await adminDb.collection('merchant_balances').doc(STORE).get();
  const d = snap.exists ? snap.data() : {};
  return {
    pending: Number(d.pendingSatang || 0),
    onHold: Number(d.onHoldSatang || 0),
    available: Number(d.availableSatang || 0)
  };
}

async function seed() {
  for (const [storeId, ownerId, name] of [
    [STORE, OWNER, 'ร้านก๋วยจั๊บญวน'],
    [OTHER_STORE, OTHER_OWNER, 'ร้านอื่น']
  ]) {
    await adminDb.collection('stores').doc(storeId).set({
      id: storeId, name, ownerId, isOpen: true, schoolId: SCHOOL, currentQueueCount: 0
    });
  }
  await adminDb.collection('menu_items').doc(MENU).set({
    id: MENU, storeId: STORE, name: 'ก๋วยจั๊บญวน', price: 50, isAvailable: true
  });

  // The student is on the school's roster, which is what makes them somebody the
  // campus counter may top up: a school administrator credits their own members.
  await adminDb.collection('school_members').doc(`member-${STUDENT}`).set({
    id: `member-${STUDENT}`, schoolId: SCHOOL, email: `${STUDENT}@kku.ac.th`,
    role: 'student', status: 'active', claimedByUid: STUDENT, isRegistered: true
  });
}

/** A wallet order, so the money path is exercised without a gateway. */
async function placeOrder(quantity = 1) {
  const res = await api('/api/orders', 'POST', {
    storeId: STORE,
    items: [{ menuItemId: MENU, quantity }],
    paymentMethod: 'CAMPUS_WALLET',
    idempotencyKey: `handover-${Date.now()}-${Math.random()}`
  }, as(STUDENT));
  return { orderId: res.data?.orderId, pin: res.data?.exchangePin };
}

async function acceptAndReady(orderId) {
  await api(`/api/merchant/orders/${orderId}/accept`, 'POST', {}, MERCHANT);
  await api(`/api/orders/${orderId}/status`, 'PATCH', { status: 'READY' }, MERCHANT);
}

async function runTests() {
  baseUrl = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });

  try {
    await seed();
    await api(`/api/wallet/${STUDENT}/credit`, 'POST', { amountSatang: 200000 },
      as(`counter-${suffix}`, 'admin'));

    // --- The PIN is issued to the customer, and it works ---
    console.log('\n--- Handing over an order ---');
    let placed = await placeOrder(2);
    check(typeof placed.pin === 'string' && /^\d{4}$/.test(placed.pin),
      'The customer is given a four-digit pickup PIN', `pin length ${placed.pin?.length}`);

    let stored = await order(placed.orderId);
    check(!('exchangePin' in stored) || !stored.exchangePin,
      'The PIN itself is never stored on the order, only its hash');
    check(typeof stored.exchangePinHash === 'string' && stored.exchangePinHash.length === 64,
      'The stored hash is an HMAC-SHA256 digest');

    await acceptAndReady(placed.orderId);
    let res = await api(`/api/merchant/orders/${placed.orderId}/complete`, 'POST',
      { exchangePin: ` ${placed.pin} ` }, MERCHANT);
    check(res.status === 200 && res.data?.status === 'COMPLETED',
      'The right PIN hands the food over, spaces and all', `status ${res.status}`);
    check(res.data?.settlementStatus === 'ON_HOLD',
      'The merchant net goes on hold, not straight to withdrawable',
      `settlement ${res.data?.settlementStatus}`);
    let bal = await balances();
    check(bal.onHold === 9000 && bal.pending === 0,
      'The balance moves from pending to on-hold, once',
      `pending ${bal.pending}, onHold ${bal.onHold}`);

    console.log('\n--- Handing the same order over twice ---');
    res = await api(`/api/merchant/orders/${placed.orderId}/complete`, 'POST',
      { exchangePin: placed.pin }, MERCHANT);
    check(res.status >= 400,
      'A completed order cannot be completed again', `status ${res.status}`);
    bal = await balances();
    check(bal.onHold === 9000 && bal.pending === 0,
      'And the money does not move a second time',
      `pending ${bal.pending}, onHold ${bal.onHold}`);

    // --- A wrong PIN has to cost something ---
    console.log('\n--- Guessing the PIN ---');
    placed = await placeOrder(1);
    await acceptAndReady(placed.orderId);
    const wrong = placed.pin === '0000' ? '1111' : '0000';

    res = await api(`/api/merchant/orders/${placed.orderId}/complete`, 'POST',
      { exchangePin: wrong }, MERCHANT);
    check(res.status >= 400, 'A wrong PIN is refused', `status ${res.status}`);
    stored = await order(placed.orderId);
    check(stored.status !== 'COMPLETED', 'The order is not handed over', `status ${stored.status}`);
    check(stored.exchangePinFailedAttempts === 1,
      'The failed attempt is recorded — a counter that never increments is no lockout at all',
      `attempts ${stored.exchangePinFailedAttempts}`);

    for (let i = 0; i < 4; i++) {
      await api(`/api/merchant/orders/${placed.orderId}/complete`, 'POST',
        { exchangePin: wrong }, MERCHANT);
    }
    stored = await order(placed.orderId);
    check(stored.exchangePinFailedAttempts === 5,
      'Five wrong guesses are all counted', `attempts ${stored.exchangePinFailedAttempts}`);
    check(typeof stored.exchangePinLockedUntil === 'string'
      && new Date(stored.exchangePinLockedUntil) > new Date(),
      'And the order locks out further attempts', `until ${stored.exchangePinLockedUntil}`);

    res = await api(`/api/merchant/orders/${placed.orderId}/complete`, 'POST',
      { exchangePin: placed.pin }, MERCHANT);
    check(res.status >= 400,
      'Even the correct PIN is refused while locked out', `status ${res.status}`);

    // --- Completing something that was never cooked ---
    console.log('\n--- Completing out of order ---');
    placed = await placeOrder(1);
    const pendingBefore = (await balances()).pending;
    res = await api(`/api/merchant/orders/${placed.orderId}/complete`, 'POST',
      { exchangePin: placed.pin }, MERCHANT);
    check(res.status >= 400,
      'An order the merchant never accepted cannot be handed over', `status ${res.status}`);
    stored = await order(placed.orderId);
    check(stored.status === 'PAID_AWAITING_MERCHANT',
      'It stays where it was', `status ${stored.status}`);
    bal = await balances();
    check(bal.pending === pendingBefore,
      'The merchant credit stays in pending rather than being claimed as on-hold',
      `pending ${bal.pending}`);

    console.log('\n--- Completing a cancelled order ---');
    placed = await placeOrder(1);
    await api(`/api/orders/${placed.orderId}/status`, 'PATCH',
      { status: 'CANCELLED' }, as(STUDENT));
    res = await api(`/api/merchant/orders/${placed.orderId}/complete`, 'POST',
      { exchangePin: placed.pin }, MERCHANT);
    check(res.status >= 400,
      'A cancelled and refunded order cannot be completed', `status ${res.status}`);
    stored = await order(placed.orderId);
    check(stored.status === 'CANCELLED',
      'A refunded order does not become a sale', `status ${stored.status}`);

    // --- Someone else's order ---
    console.log('\n--- Another store trying to complete it ---');
    placed = await placeOrder(1);
    await acceptAndReady(placed.orderId);
    res = await api(`/api/merchant/orders/${placed.orderId}/complete`, 'POST',
      { exchangePin: placed.pin }, OTHER_MERCHANT);
    check(res.status === 403,
      'A different store cannot complete this store\'s order', `status ${res.status}`);

    res = await api(`/api/merchant/orders/${placed.orderId}/complete`, 'POST',
      { exchangePin: placed.pin });
    check(res.status === 401, 'Nor can an anonymous caller', `status ${res.status}`);

    res = await api(`/api/merchant/orders/${placed.orderId}/complete`, 'POST', {}, MERCHANT);
    check(res.status === 400 && res.data?.error === 'MISSING_PIN',
      'Completing with no PIN at all is refused', `error ${res.data?.error}`);

    // --- And no way around the PIN ---
    // The kitchen screen used to fall back to the generic status endpoint
    // whenever the PIN check failed, and that endpoint took COMPLETED without
    // asking for a PIN at all — so a wrong PIN still handed the food over.
    console.log('\n--- The generic status endpoint is not a way past the PIN ---');
    res = await api(`/api/orders/${placed.orderId}/status`, 'PATCH',
      { status: 'COMPLETED' }, MERCHANT);
    check(res.status === 400 && res.data?.error === 'USE_PIN_HANDOVER',
      'A shop cannot complete an order through the status endpoint',
      `${res.status} ${res.data?.error}`);
    stored = await order(placed.orderId);
    check(stored.status !== 'COMPLETED',
      'The order is not handed over', `status ${stored.status}`);

    res = await api(`/api/orders/${placed.orderId}/status`, 'PATCH',
      { status: 'COMPLETED' }, as(`root-handover-${suffix}`, 'super_admin'));
    check(res.status === 400,
      'Not even a platform admin skips it that way', `status ${res.status}`);

    console.log('\n===============================================================');
    console.log(`📊 ORDER HANDOVER RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Handover suite crashed:', err);
  process.exit(1);
});
