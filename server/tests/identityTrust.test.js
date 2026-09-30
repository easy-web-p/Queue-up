/**
 * Identity Trust Suite
 *
 * Anyone can create a Firebase account claiming any email address; only the
 * provider's verification says the address is actually theirs. firestore.rules
 * has always required email_verified on its break-glass admin clause. The API
 * did not — so an account created with an administrator's address and never
 * verified could confirm merchant payouts and issue custom claims, and an
 * account created with a student's address could take their place on a school
 * roster along with whatever role it carried.
 *
 * These tests pin the rule that an unconfirmed address grants nothing.
 */

process.env.ALLOW_MOCK_AUTH = 'true';
process.env.SUPER_ADMIN_EMAILS = 'boss@queueup.test';

import http from 'http';
import express from 'express';
import { walletRouter } from '../routes/walletRoutes.js';
import { platformRouter } from '../routes/platformRoutes.js';
import { schoolRouter } from '../routes/schoolRoutes.js';
import { adminDb } from '../firebaseAdmin.js';
import { isSuperAdmin } from '../middleware/authenticate.js';

console.log('===============================================================');
console.log('🪪  QUEUEUP IDENTITY TRUST SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api/merchant', walletRouter);
app.use('/api/platform', platformRouter);
app.use('/api/schools', schoolRouter);
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
const SCHOOL = `school-trust-${suffix}`;
const STORE = `store-trust-${suffix}`;
const OWNER = `owner-trust-${suffix}`;
const STUDENT_EMAIL = `napat-${suffix}@kku.ac.th`;
let baseUrl = '';

/** A signed-in account. Pass verified: false for an address nobody confirmed. */
function account(uid, { email, role = 'customer', verified = true } = {}) {
  const headers = {
    'x-mock-user-id': uid,
    'x-mock-user-role': role,
    'x-mock-user-email': email || `${uid}@kku.ac.th`
  };
  if (!verified) headers['x-mock-email-verified'] = 'false';
  return headers;
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

async function seed() {
  await adminDb.collection('stores').doc(STORE).set({
    id: STORE, name: 'ร้านทดสอบสิทธิ์', ownerId: OWNER, isOpen: true, schoolId: SCHOOL
  });
  await adminDb.collection('merchant_balances').doc(STORE).set({
    storeId: STORE, availableSatang: 50000, pendingSatang: 0, onHoldSatang: 0, payoutReservedSatang: 0
  });
  await adminDb.collection('schools').doc(SCHOOL).set({
    id: SCHOOL, name: 'มหาวิทยาลัยทดสอบ', status: 'active'
  });
  // A roster row for a student who has not signed up yet.
  await adminDb.collection('school_members').doc(`member-${suffix}`).set({
    id: `member-${suffix}`,
    schoolId: SCHOOL,
    email: STUDENT_EMAIL,
    role: 'student',
    status: 'active',
    isRegistered: false,
    claimedByUid: null
  });
}

async function runTests() {
  baseUrl = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });

  try {
    await seed();

    // --- The unit that decides ---
    console.log('\n--- isSuperAdmin ---');
    check(isSuperAdmin({ verified: true, emailVerified: true, email: 'boss@queueup.test' }) === true,
      'The configured address, confirmed, is a platform admin');
    check(isSuperAdmin({ verified: true, emailVerified: false, email: 'boss@queueup.test' }) === false,
      'The same address unconfirmed is not — anyone can type an email into a sign-up form');
    check(isSuperAdmin({ verified: true, emailVerified: false, admin: true, email: 'x@y.z' }) === true,
      'A claim granted by an existing admin still stands on its own');
    check(isSuperAdmin({ verified: false, emailVerified: true, email: 'boss@queueup.test' }) === false,
      'And an unauthenticated caller is never one');

    // --- Money: confirming a payout ---
    console.log('\n--- Confirming a merchant payout ---');
    let res = await api('/api/merchant/payouts', 'POST', {
      storeId: STORE,
      amountSatang: 30000,
      bankAccountSnapshot: {
        bankName: 'ธนาคารออมสิน', accountName: 'ร้านทดสอบสิทธิ์', accountNumber: '9876543210'
      }
    }, account(OWNER, { role: 'merchant' }));
    const payoutId = res.data?.payoutId;
    check(res.status === 201, 'The shop requests a withdrawal', `status ${res.status}`);

    const impostor = account(`impostor-${suffix}`, {
      email: 'boss@queueup.test', role: 'customer', verified: false
    });

    res = await api('/api/platform/payouts', 'GET', null, impostor);
    check(res.status === 403,
      'An unconfirmed copy of the admin address cannot even see the payout queue',
      `status ${res.status}`);

    res = await api(`/api/merchant/payouts/${payoutId}/complete`, 'POST', {}, impostor);
    check(res.status === 403,
      'Nor attest that money was transferred', `status ${res.status}`);

    res = await api(`/api/merchant/payouts/${payoutId}/fail`, 'POST', { reason: 'x' }, impostor);
    check(res.status === 403, 'Nor record it as failed', `status ${res.status}`);

    let payout = (await adminDb.collection('payout_requests').doc(payoutId).get()).data();
    check(payout.status === 'REQUESTED',
      'The payout is untouched', `status ${payout.status}`);

    // role 'admin' is the school administrator's claim. A real token gives it no
    // platform authority, and the development mock-auth path used to: it set the
    // platform admin flag from `role === 'admin'`, so every suite that signed in
    // as a school administrator was really exercising a platform one, and no
    // scoped check could be caught failing to be scoped.
    const schoolAdmin = account(`dean-${suffix}`, { email: `dean-${suffix}@kku.ac.th`, role: 'admin' });
    res = await api(`/api/merchant/payouts/${payoutId}/complete`, 'POST', {}, schoolAdmin);
    check(res.status === 403,
      'A school administrator is not a platform administrator, mock auth included',
      `status ${res.status}`);

    payout = (await adminDb.collection('payout_requests').doc(payoutId).get()).data();
    check(payout.status === 'REQUESTED',
      'So the payout is still only requested', `status ${payout.status}`);

    const realAdmin = account(`boss-${suffix}`, { email: 'boss@queueup.test', role: 'admin' });
    res = await api(`/api/merchant/payouts/${payoutId}/complete`, 'POST', {}, realAdmin);
    check(res.status === 200,
      'The confirmed administrator still can', `status ${res.status}`);

    // --- Custom claims ---
    console.log('\n--- Issuing custom claims ---');
    res = await api(`/api/schools/users/some-uid/claims`, 'POST',
      { role: 'super_admin' }, impostor);
    check(res.status === 403,
      'An unconfirmed address cannot hand itself a role', `status ${res.status}`);

    // --- A school roster row ---
    console.log('\n--- Claiming a place on a roster ---');
    res = await api('/api/schools/membership/claim', 'POST', null,
      account(`squatter-${suffix}`, { email: STUDENT_EMAIL, verified: false }));
    check(res.status === 403 && res.data?.error === 'EMAIL_NOT_VERIFIED',
      'Signing up as somebody@kku.ac.th without confirming it claims nothing',
      `${res.status} ${res.data?.error}`);

    let member = (await adminDb.collection('school_members').doc(`member-${suffix}`).get()).data();
    check(!member.claimedByUid,
      'The roster row is still unclaimed', `claimedByUid ${member.claimedByUid}`);

    const realStudent = `napat-${suffix}`;
    res = await api('/api/schools/membership/claim', 'POST', null,
      account(realStudent, { email: STUDENT_EMAIL }));
    check(res.status === 200, 'The student who confirmed the address claims it', `status ${res.status}`);
    member = (await adminDb.collection('school_members').doc(`member-${suffix}`).get()).data();
    check(member.claimedByUid === realStudent,
      'And the row is bound to them', `claimedByUid ${member.claimedByUid}`);

    console.log('\n===============================================================');
    console.log(`📊 IDENTITY TRUST RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Identity trust suite crashed:', err);
  process.exit(1);
});
