/**
 * Platform Operations Suite
 *
 * Confirming a merchant transfer and clearing a stuck payment are the two money
 * operations only a platform administrator can perform. They existed as API
 * calls nobody could see, which for money is close to not existing at all.
 *
 * These tests cover who may see and act on them, and that acting twice is safe.
 */

process.env.ALLOW_MOCK_AUTH = 'true';
process.env.SUPER_ADMIN_EMAILS = 'root@queueup.test';

import http from 'http';
import express from 'express';
import { walletRouter } from '../routes/walletRoutes.js';
import { platformRouter } from '../routes/platformRoutes.js';
import { adminDb } from '../firebaseAdmin.js';
import { recordPaymentException } from '../services/paymentSettlement.js';

console.log('===============================================================');
console.log('🏛️  QUEUEUP PLATFORM OPERATIONS SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api/merchant', walletRouter);
app.use('/api/platform', platformRouter);
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

const suffix = Date.now();
const STORE = `store-platform-${suffix}`;
const OWNER = `merchant-platform-${suffix}`;
const ORDER = `ord-platform-${suffix}`;
let baseUrl = '';

const MERCHANT = {
  'x-mock-user-id': OWNER,
  'x-mock-user-role': 'merchant',
  'x-mock-user-email': `${OWNER}@kku.ac.th`
};
const ADMIN = {
  'x-mock-user-id': `root-${suffix}`,
  'x-mock-user-role': 'admin',
  'x-mock-user-email': 'root@queueup.test'
};

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

const BANK = {
  bankName: 'ธนาคารกรุงไทย',
  accountName: 'ร้านข้าวแกงป้าแดง',
  accountNumber: '1234567890'
};

async function seed() {
  await adminDb.collection('stores').doc(STORE).set({
    id: STORE, name: 'ร้านข้าวแกงป้าแดง', ownerId: OWNER, isOpen: true, schoolId: 'KKU'
  });
  await adminDb.collection('merchant_balances').doc(STORE).set({
    storeId: STORE, availableSatang: 80000, pendingSatang: 0, onHoldSatang: 0, payoutReservedSatang: 0
  });
}

async function runTests() {
  baseUrl = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });

  try {
    await seed();

    // --- Who can see the payout queue ---
    console.log('\n--- Visibility of the payout queue ---');
    let res = await api('/api/platform/payouts');
    check(res.status === 401, 'Anonymous access is refused', `status ${res.status}`);

    res = await api('/api/platform/payouts', 'GET', null, MERCHANT);
    check(res.status === 403, 'A merchant cannot see every store\'s withdrawals', `status ${res.status}`);

    res = await api('/api/platform/payouts', 'GET', null, ADMIN);
    check(res.status === 200 && Array.isArray(res.data?.payouts),
      'A platform admin can', `status ${res.status}`);

    // --- A request appears, with what the operator needs to act on it ---
    console.log('\n--- A withdrawal request reaches the queue ---');
    res = await api('/api/merchant/payouts', 'POST',
      { storeId: STORE, amountSatang: 50000, bankAccountSnapshot: BANK }, MERCHANT);
    const payoutId = res.data?.payoutId;
    check(res.status === 201 && res.data?.status === 'REQUESTED',
      'The merchant asks to withdraw ฿500', `status ${res.data?.status}`);

    res = await api('/api/platform/payouts?status=REQUESTED', 'GET', null, ADMIN);
    const queued = (res.data?.payouts || []).find((p) => p.id === payoutId);
    check(Boolean(queued), 'It shows in the REQUESTED queue');
    check(queued?.storeName === 'ร้านข้าวแกงป้าแดง',
      'The store is named, not just its id', `${queued?.storeName}`);
    check(queued?.bankAccountSnapshot?.bankName === 'ธนาคารกรุงไทย'
      && String(queued?.bankAccountSnapshot?.accountNumber || '').length > 0,
      'The destination account is shown, because confirming means having sent it');
    check(queued?.amountSatang === 50000, 'With the amount to transfer', `${queued?.amountSatang} satang`);

    // --- Confirming it moves it out of the queue ---
    console.log('\n--- Confirming the transfer ---');
    res = await api(`/api/merchant/payouts/${payoutId}/complete`, 'POST', {}, ADMIN);
    check(res.status === 200, 'The admin attests the transfer', `status ${res.status}`);

    res = await api('/api/platform/payouts?status=REQUESTED', 'GET', null, ADMIN);
    check(!(res.data?.payouts || []).some((p) => p.id === payoutId),
      'It leaves the outstanding queue');

    res = await api('/api/platform/payouts?status=PAID', 'GET', null, ADMIN);
    check((res.data?.payouts || []).some((p) => p.id === payoutId),
      'And appears among the paid ones');

    // --- The stuck-money queue ---
    console.log('\n--- The payment exception queue ---');
    await recordPaymentException(adminDb, {
      orderId: ORDER,
      reason: 'AMOUNT_MISMATCH',
      providerPaymentIntentId: `pi_platform_${suffix}`,
      amountSatang: 100,
      expectedSatang: 18000,
      detail: 'Paid ฿1 for an ฿180 order.'
    });

    res = await api('/api/platform/payment-exceptions', 'GET', null, MERCHANT);
    check(res.status === 403, 'A merchant cannot read the exception queue', `status ${res.status}`);

    res = await api('/api/platform/payment-exceptions', 'GET', null, ADMIN);
    let entry = (res.data?.exceptions || []).find((e) => e.orderId === ORDER);
    check(Boolean(entry), 'The stuck payment is listed for the admin');
    check(entry?.amountSatang === 100 && entry?.expectedSatang === 18000,
      'Showing what arrived against what was owed',
      `${entry?.amountSatang} of ${entry?.expectedSatang}`);
    check(entry?.status === 'OPEN', 'Open until somebody deals with it', `status ${entry?.status}`);

    console.log('\n--- Resolving one ---');
    res = await api(`/api/platform/payment-exceptions/${entry.id}/resolve`, 'POST',
      { action: 'REFUNDED_AT_GATEWAY', note: 'คืนเงินผ่าน Stripe Dashboard แล้ว' }, MERCHANT);
    check(res.status === 403, 'A merchant cannot close one', `status ${res.status}`);

    res = await api(`/api/platform/payment-exceptions/${entry.id}/resolve`, 'POST',
      { action: 'REFUNDED_AT_GATEWAY', note: 'คืนเงินผ่าน Stripe Dashboard แล้ว' }, ADMIN);
    check(res.status === 200, 'The admin records what they did', `status ${res.status}`);

    res = await api('/api/platform/payment-exceptions?status=OPEN', 'GET', null, ADMIN);
    check(!(res.data?.exceptions || []).some((e) => e.orderId === ORDER),
      'It leaves the open queue');

    res = await api('/api/platform/payment-exceptions?status=RESOLVED', 'GET', null, ADMIN);
    entry = (res.data?.exceptions || []).find((e) => e.orderId === ORDER);
    check(entry?.resolvedAction === 'REFUNDED_AT_GATEWAY' && Boolean(entry?.resolvedBy),
      'The record keeps what was done and who did it',
      `${entry?.resolvedAction} by ${entry?.resolvedByEmail}`);

    res = await api(`/api/platform/payment-exceptions/${entry.id}/resolve`, 'POST',
      { action: 'RECONCILED' }, ADMIN);
    check(res.status === 200 && res.data?.alreadyResolved === true,
      'Resolving twice is harmless and says so', `status ${res.status}`);

    res = await api(`/api/platform/payment-exceptions/pex_does_not_exist/resolve`, 'POST', {}, ADMIN);
    check(res.status === 404, 'Resolving something that does not exist is a 404', `status ${res.status}`);

    console.log('\n===============================================================');
    console.log(`📊 PLATFORM OPERATIONS RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Platform suite crashed:', err);
  process.exit(1);
});
