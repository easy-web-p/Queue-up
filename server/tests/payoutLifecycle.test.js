/**
 * Merchant Payout Lifecycle Suite
 *
 * A payout moves money out of the platform. The properties that matter are
 * that it is never marked paid unless someone attests the transfer happened,
 * that confirming twice does not pay twice, and that a failed transfer returns
 * the merchant's money instead of stranding it.
 *
 * The previous implementation auto-completed on a setTimeout 1.5 seconds after
 * responding. On a serverless platform the instance is frozen the moment it
 * responds, so the callback usually never ran and the funds stayed reserved
 * forever — and when it did run, it marked the payout PAID with no transfer
 * behind it.
 */

process.env.ALLOW_MOCK_AUTH = 'true';
process.env.SUPER_ADMIN_EMAILS = 'root@queueup.test';

import http from 'http';
import express from 'express';
import { walletRouter } from '../routes/walletRoutes.js';
import { adminDb } from '../firebaseAdmin.js';
import { verifySessionAgainstOrder } from '../services/paymentVerification.js';

console.log('===============================================================');
console.log('🏦 QUEUEUP MERCHANT PAYOUT LIFECYCLE SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api/merchant', walletRouter);
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

const suffix = Date.now();
const STORE = `store-payout-${suffix}`;
const OWNER = `merchant-payout-owner-${suffix}`;
const RIVAL = `merchant-payout-rival-${suffix}`;

const asOwner = { 'x-mock-user-id': OWNER, 'x-mock-user-role': 'merchant' };
const BANK = {
  bankName: 'ธนาคารกสิกรไทย',
  accountName: 'ร้านทดสอบถอนเงิน',
  accountNumberMasked: '123-4-56789-0'
};
const asRival = { 'x-mock-user-id': RIVAL, 'x-mock-user-role': 'merchant' };
const asRoot = {
  'x-mock-user-id': `platform-root-${suffix}`,
  'x-mock-user-role': 'admin',
  'x-mock-user-email': 'root@queueup.test'
};

async function balance() {
  const snap = await adminDb.collection('merchant_balances').doc(STORE).get();
  return snap.exists ? snap.data() : {};
}

async function runTests() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await adminDb.collection('stores').doc(STORE).set({
      id: STORE, name: 'ร้านทดสอบถอนเงิน', ownerId: OWNER, isOpen: true
    });
    await adminDb.collection('merchant_balances').doc(STORE).set({
      storeId: STORE, availableSatang: 100000, pendingSatang: 0, onHoldSatang: 0,
      payoutReservedSatang: 0, totalPaidOutSatang: 0
    });

    // --- A payout needs somewhere to go ---
    console.log('\n--- A payout request needs a destination ---');
    let noBank = await request(baseUrl, '/api/merchant/payouts', 'POST',
      { storeId: STORE, amountSatang: 40000 }, asOwner);
    check(noBank.status === 400 && noBank.data?.error === 'MISSING_BANK_ACCOUNT',
      'A payout without bank details is refused, not given a placeholder account',
      `error ${noBank.data?.error}`);

    noBank = await request(baseUrl, '/api/merchant/payouts', 'POST',
      { storeId: STORE, amountSatang: 40000, bankAccountSnapshot: { bankName: 'ธนาคาร' } }, asOwner);
    check(noBank.status === 400,
      'Partial bank details are refused too', `status ${noBank.status}`);

    // --- Requesting reserves, and stops there ---
    console.log('\n--- A payout request reserves, it does not pay ---');
    let res = await request(baseUrl, '/api/merchant/payouts', 'POST',
      { storeId: STORE, amountSatang: 40000, bankAccountSnapshot: BANK }, asOwner);
    const payoutId = res.data?.payoutId;
    check(res.status === 201 && res.data?.status === 'REQUESTED',
      'The payout is created as REQUESTED', `status ${res.data?.status}`);

    let b = await balance();
    check(b.availableSatang === 60000 && b.payoutReservedSatang === 40000,
      'The funds move from available to reserved',
      `available ${b.availableSatang}, reserved ${b.payoutReservedSatang}`);
    check((b.totalPaidOutSatang || 0) === 0,
      'Nothing is recorded as paid out yet');

    // The old timer would have settled by now; prove nothing does on its own.
    await new Promise((r) => setTimeout(r, 2000));
    b = await balance();
    check((b.totalPaidOutSatang || 0) === 0 && b.payoutReservedSatang === 40000,
      'It still is not paid two seconds later — no timer settles money',
      `reserved ${b.payoutReservedSatang}`);

    res = await request(baseUrl, '/api/merchant/payouts', 'POST',
      { storeId: STORE, amountSatang: 70000, bankAccountSnapshot: BANK }, asOwner);
    check(res.status === 400 && /INSUFFICIENT_FUNDS/.test(res.data?.error || ''),
      'A second request beyond the unreserved balance is refused',
      `error ${(res.data?.error || '').slice(0, 30)}`);

    // --- Only a platform admin may attest a transfer ---
    console.log('\n--- Confirming a transfer ---');
    res = await request(baseUrl, `/api/merchant/payouts/${payoutId}/complete`, 'POST', {});
    check(res.status === 401, 'Anonymous confirmation is rejected', `status ${res.status}`);

    res = await request(baseUrl, `/api/merchant/payouts/${payoutId}/complete`, 'POST', {}, asOwner);
    check(res.status === 403,
      'The merchant cannot confirm their own payout', `status ${res.status}`);

    res = await request(baseUrl, `/api/merchant/payouts/${payoutId}/complete`, 'POST', {}, asRival);
    check(res.status === 403, 'Another merchant cannot confirm it either', `status ${res.status}`);

    res = await request(baseUrl, `/api/merchant/payouts/${payoutId}/complete`, 'POST',
      { providerTransferId: 'tr_test_123' }, asRoot);
    check(res.status === 200 && res.data?.alreadyPaid === false,
      'A platform admin confirms the transfer', `status ${res.status}`);

    b = await balance();
    check(b.payoutReservedSatang === 0 && b.totalPaidOutSatang === 40000,
      'Reserved funds become paid out', `reserved ${b.payoutReservedSatang}, paidOut ${b.totalPaidOutSatang}`);

    res = await request(baseUrl, `/api/merchant/payouts/${payoutId}/complete`, 'POST', {}, asRoot);
    check(res.status === 200 && res.data?.alreadyPaid === true,
      'Confirming twice is idempotent');
    b = await balance();
    check(b.totalPaidOutSatang === 40000,
      'A repeated confirmation does not pay the merchant twice',
      `paidOut ${b.totalPaidOutSatang}`);

    // --- A failed transfer must give the money back ---
    console.log('\n--- A failed transfer returns the money ---');
    res = await request(baseUrl, '/api/merchant/payouts', 'POST',
      { storeId: STORE, amountSatang: 30000, bankAccountSnapshot: BANK }, asOwner);
    const failingPayoutId = res.data?.payoutId;
    b = await balance();
    const availableBeforeFailure = b.availableSatang;

    res = await request(baseUrl, `/api/merchant/payouts/${failingPayoutId}/fail`, 'POST',
      { reason: 'เลขบัญชีไม่ถูกต้อง' }, asOwner);
    check(res.status === 403, 'The merchant cannot mark their own payout failed', `status ${res.status}`);

    res = await request(baseUrl, `/api/merchant/payouts/${failingPayoutId}/fail`, 'POST',
      { reason: 'เลขบัญชีไม่ถูกต้อง' }, asRoot);
    check(res.status === 200, 'A platform admin marks it failed', `status ${res.status}`);

    b = await balance();
    check(b.payoutReservedSatang === 0 && b.availableSatang === availableBeforeFailure + 30000,
      'The reserved funds return to available rather than stranding',
      `available ${b.availableSatang}, reserved ${b.payoutReservedSatang}`);

    res = await request(baseUrl, `/api/merchant/payouts/${failingPayoutId}/complete`, 'POST', {}, asRoot);
    check(res.status === 400 && /NOT_PENDING/.test(res.data?.error || ''),
      'A failed payout cannot then be confirmed as paid',
      `error ${(res.data?.error || '').slice(0, 30)}`);

    res = await request(baseUrl, '/api/merchant/payouts/does-not-exist/complete', 'POST', {}, asRoot);
    check(res.status === 404, 'Confirming an unknown payout is a 404', `status ${res.status}`);

    // --- The books still balance after all of it ---
    console.log('\n--- The books after the whole lifecycle ---');
    const ledgerSnap = await adminDb.collection('ledger_entries').where('storeId', '==', STORE).get();
    const groups = new Map();
    ledgerSnap.docs.forEach((d) => {
      const e = d.data();
      const g = groups.get(e.transactionGroupId) || { debit: 0, credit: 0 };
      g.debit += Number(e.debitSatang) || 0;
      g.credit += Number(e.creditSatang) || 0;
      groups.set(e.transactionGroupId, g);
    });
    const unbalanced = Array.from(groups.entries()).filter(([, g]) => g.debit !== g.credit);
    check(unbalanced.length === 0,
      'Every posting written during the lifecycle balances',
      `${groups.size} groups checked`);

    b = await balance();
    check(b.availableSatang + b.payoutReservedSatang + b.totalPaidOutSatang === 100000,
      'Available, reserved and paid out still add up to what we started with',
      `${b.availableSatang} + ${b.payoutReservedSatang} + ${b.totalPaidOutSatang}`);

    // --- A checkout session may only settle the order it was created for ---
    console.log('\n--- Checkout session binding ---');
    const order = { customerId: 'cust-1', totalSatang: 200000 };
    const cheapSession = { metadata: { orderId: 'ord-cheap' }, amount_total: 4500 };

    let verdict = verifySessionAgainstOrder({
      session: cheapSession, orderId: 'ord-expensive', order, user: { uid: 'cust-1' }
    });
    check(verdict.ok === false && verdict.error === 'SESSION_ORDER_MISMATCH',
      'A session from another order cannot settle this one', `error ${verdict.error}`);

    verdict = verifySessionAgainstOrder({
      session: { metadata: { orderId: 'ord-1' }, amount_total: 4500 },
      orderId: 'ord-1', order, user: { uid: 'cust-1' }
    });
    check(verdict.ok === false && verdict.error === 'AMOUNT_MISMATCH',
      'Paying less than the order total does not settle it', `error ${verdict.error}`);

    verdict = verifySessionAgainstOrder({
      session: { metadata: { orderId: 'ord-1' }, amount_total: 200000 },
      orderId: 'ord-1', order, user: { uid: 'someone-else' }
    });
    check(verdict.ok === false && verdict.error === 'FORBIDDEN_ORDER',
      'Another account cannot settle someone else\'s order', `error ${verdict.error}`);

    verdict = verifySessionAgainstOrder({
      session: { metadata: { orderId: 'ord-1' }, amount_total: 200000 },
      orderId: 'ord-1', order, user: { uid: 'cust-1' }
    });
    check(verdict.ok === true, 'The right customer, order and amount settles');

    verdict = verifySessionAgainstOrder({
      session: { metadata: { orderId: 'ord-1' }, amount_total: 200000 },
      orderId: 'ord-1', order: { customerId: 'guest-user', totalSatang: 200000 }, user: null
    });
    check(verdict.ok === true, 'A guest order is still settleable by its holder');

    console.log('\n===============================================================');
    console.log(`📊 PAYOUT LIFECYCLE RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Payout suite crashed:', err);
  process.exit(1);
});
