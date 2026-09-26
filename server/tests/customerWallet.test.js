/**
 * Campus Wallet Test Suite
 *
 * The wallet moves real money, so the properties that matter are the ones that
 * keep a balance honest: it cannot go negative, a retried top-up credits once,
 * an order debits and a rejection refunds in the same transaction as the order
 * itself, and nobody can credit or read a wallet that is not theirs.
 */

process.env.ALLOW_MOCK_AUTH = 'true';
process.env.SUPER_ADMIN_EMAILS = 'root@queueup.test';

import http from 'http';
import express from 'express';
import { customerWalletRouter } from '../routes/customerWalletRoutes.js';
import { orderRouter } from '../routes/orderRoutes.js';
import { merchantRouter } from '../routes/merchantRoutes.js';
import { adminDb } from '../firebaseAdmin.js';

console.log('===============================================================');
console.log('💳 QUEUEUP CAMPUS WALLET TEST SUITE');
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
const STORE = 'store-wallet-1';
const OWNER = 'merchant-wallet-owner';
const suffix = Date.now();
const STUDENT = `uid-student-wallet-${suffix}`;
const OTHER = `uid-other-student-${suffix}`;

function as(uid, extra = {}) {
  return {
    'x-mock-user-id': uid,
    'x-mock-user-role': extra.role || 'customer',
    'x-mock-user-email': extra.email || `${uid}@kku.ac.th`,
    'x-mock-school-id': extra.schoolId || SCHOOL
  };
}

const COUNTER = as('campus-counter', { role: 'admin', schoolId: SCHOOL });

async function seed() {
  await adminDb.collection('stores').doc(STORE).set({
    id: STORE, name: 'ร้านก๋วยเตี๋ยวเรือ', ownerId: OWNER, isOpen: true,
    schoolId: SCHOOL, currentQueueCount: 0
  });
  await adminDb.collection('menu_items').doc('menu-wallet-1').set({
    id: 'menu-wallet-1', storeId: STORE, name: 'ก๋วยเตี๋ยวเรือหมู', price: 50, isAvailable: true
  });
}

async function runTests() {
  const baseUrl = await startServer();

  try {
    await seed();

    // --- Top-up authorisation ---
    console.log('\n--- Counter top-up ---');
    let res = await request(baseUrl, `/api/wallet/${STUDENT}/credit`, 'POST', { amountSatang: 10000 });
    check(res.status === 401, 'Anonymous top-up is rejected', `status ${res.status}`);

    res = await request(baseUrl, `/api/wallet/${STUDENT}/credit`, 'POST',
      { amountSatang: 10000 }, as(OTHER));
    check(res.status === 403, 'A student cannot credit another wallet', `status ${res.status}`);

    res = await request(baseUrl, `/api/wallet/${STUDENT}/credit`, 'POST',
      { amountSatang: -5000 }, COUNTER);
    check(res.status === 400 && res.data?.error === 'INVALID_AMOUNT',
      'A negative top-up is refused', `error ${res.data?.error}`);

    res = await request(baseUrl, `/api/wallet/${STUDENT}/credit`, 'POST',
      { amountSatang: 90000000 }, COUNTER);
    check(res.status === 400 && res.data?.error === 'AMOUNT_TOO_LARGE',
      'A mistyped enormous top-up is refused', `error ${res.data?.error}`);

    res = await request(baseUrl, `/api/wallet/${STUDENT}/credit`, 'POST',
      { amountSatang: 20000, idempotencyKey: `topup-key-${suffix}` }, COUNTER);
    check(res.status === 201 && res.data?.balanceSatang === 20000,
      'The campus counter credits ฿200', `balance ${res.data?.balanceSatang}`);

    res = await request(baseUrl, `/api/wallet/${STUDENT}/credit`, 'POST',
      { amountSatang: 20000, idempotencyKey: `topup-key-${suffix}` }, COUNTER);
    check(res.data?.balanceSatang === 20000,
      'A retried top-up with the same key credits only once',
      `balance ${res.data?.balanceSatang}`);

    // --- Reading a wallet ---
    console.log('\n--- Wallet visibility ---');
    res = await request(baseUrl, '/api/wallet', 'GET', null, as(STUDENT));
    check(res.status === 200 && res.data?.wallet?.balanceBaht === 200,
      'The owner reads their own balance', `฿${res.data?.wallet?.balanceBaht}`);
    check((res.data?.transactions?.length || 0) === 1,
      'The top-up appears in the transaction ledger',
      `${res.data?.transactions?.length} entries`);

    res = await request(baseUrl, `/api/wallet/${STUDENT}`, 'GET', null, as(OTHER));
    check(res.status === 403, 'Another student cannot read that wallet', `status ${res.status}`);

    res = await request(baseUrl, `/api/wallet/${STUDENT}`, 'GET', null, COUNTER);
    check(res.status === 200, 'The campus counter can look the wallet up', `status ${res.status}`);

    // --- Paying for an order from the wallet ---
    console.log('\n--- Paying an order from the wallet ---');
    res = await request(baseUrl, '/api/orders', 'POST', {
      storeId: STORE,
      items: [{ menuItemId: 'menu-wallet-1', quantity: 2 }],
      paymentMethod: 'CAMPUS_WALLET',
      idempotencyKey: `wallet-order-${Date.now()}`
    }, as(STUDENT));
    const walletOrderId = res.data?.orderId;
    check(res.status === 201 && res.data?.order?.paymentStatus === 'PAID',
      'A wallet order is paid the moment it is created',
      `paymentStatus ${res.data?.order?.paymentStatus}`);
    check(res.data?.walletBalanceSatang === 10000,
      'The balance drops by the order total (฿200 - ฿100)',
      `balance ${res.data?.walletBalanceSatang}`);
    check(res.data?.order?.estimatedGatewayFeeSatang === 0,
      'No card gateway fee is charged on a wallet payment');

    res = await request(baseUrl, '/api/orders', 'POST', {
      storeId: STORE,
      items: [{ menuItemId: 'menu-wallet-1', quantity: 10 }],
      paymentMethod: 'CAMPUS_WALLET',
      idempotencyKey: `wallet-overdraft-${Date.now()}`
    }, as(STUDENT));
    check(res.status === 400 && /WALLET_INSUFFICIENT_FUNDS/.test(res.data?.message || ''),
      'An order beyond the balance is refused', `message ${(res.data?.message || '').slice(0, 60)}`);

    const afterFailed = await request(baseUrl, '/api/wallet', 'GET', null, as(STUDENT));
    check(afterFailed.data?.wallet?.balanceSatang === 10000,
      'The refused order left the balance untouched',
      `balance ${afterFailed.data?.wallet?.balanceSatang}`);

    res = await request(baseUrl, '/api/orders', 'POST', {
      storeId: STORE,
      items: [{ menuItemId: 'menu-wallet-1', quantity: 1 }],
      paymentMethod: 'CAMPUS_WALLET',
      idempotencyKey: `wallet-guest-${Date.now()}`
    });
    check(res.status === 400 && /WALLET_REQUIRES_SIGN_IN/.test(res.data?.message || ''),
      'A guest cannot pay from a wallet', `message ${(res.data?.message || '').slice(0, 40)}`);

    // --- Refund on merchant rejection ---
    console.log('\n--- Refund when the merchant rejects ---');
    res = await request(baseUrl, `/api/merchant/orders/${walletOrderId}/reject`, 'POST',
      { reasonCode: 'ITEM_SOLD_OUT', reasonMessage: 'วัตถุดิบหมด' },
      { 'x-mock-user-id': OWNER, 'x-mock-user-role': 'merchant' });
    check(res.status === 200, 'The store owner rejects the wallet-paid order', `status ${res.status}`);

    const afterRefund = await request(baseUrl, '/api/wallet', 'GET', null, as(STUDENT));
    check(afterRefund.data?.wallet?.balanceSatang === 20000,
      'The full order amount is returned to the wallet',
      `balance ${afterRefund.data?.wallet?.balanceSatang}`);
    check(afterRefund.data?.transactions?.some((tx) => tx.type === 'REFUND'),
      'The refund is recorded in the ledger');

    const rejected = await adminDb.collection('orders').doc(walletOrderId).get();
    check(rejected.data()?.paymentStatus === 'REFUNDED',
      'A wallet refund settles immediately rather than waiting on a gateway',
      `paymentStatus ${rejected.data()?.paymentStatus}`);

    console.log('\n===============================================================');
    console.log(`📊 CAMPUS WALLET TEST RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Wallet suite crashed:', err);
  process.exit(1);
});
