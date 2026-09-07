/**
 * ============================================================================
 * CAMPUS WALLET AUTHORIZATION TEST SUITE
 * ============================================================================
 *
 * Covers the authorization rules guarding topupCampusWallet,
 * updateCampusWalletLimits and the CAMPUS_WALLET path of createOrderAuthoritative.
 *
 * Each case is written from the attacker's point of view: the wallet balance and
 * the parental spending controls must never be mutable by the student who
 * benefits from the change, and a wallet must never be spendable by a stranger.
 */

import {
  resolveWalletAuthority,
  isStaffOrAdmin,
  isVerifiedGuardianOf,
  MAX_TOPUP_SATANG,
} from './functions/walletAuthority.js';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(
        () => { passed++; console.log(`  ✅ ${name}`); },
        (err) => { failed++; console.log(`  ❌ ${name}\n       ${err.message}`); }
      );
    }
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}\n       ${err.message}`);
  }
  return Promise.resolve();
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}\n       expected: ${e}\n       actual:   ${a}`);
}

/**
 * Minimal in-memory Firestore double covering only what walletAuthority.js touches.
 * `staff` is a set of uids present in staff_supervisors.
 * `wallets` maps studentId -> wallet doc. `links` is a list of parent_child_links rows.
 */
function fakeDb({ staff = [], wallets = {}, links = [] } = {}) {
  const staffSet = new Set(staff);
  return {
    collection(name) {
      if (name === 'staff_supervisors') {
        return { doc: (uid) => ({ get: async () => ({ exists: staffSet.has(uid) }) }) };
      }
      if (name === 'wallets') {
        return {
          doc: (id) => ({
            get: async () =>
              wallets[id]
                ? { exists: true, data: () => wallets[id] }
                : { exists: false, data: () => undefined },
          }),
        };
      }
      if (name === 'parent_child_links') {
        const build = (filters) => ({
          where: (field, _op, value) => build([...filters, [field, value]]),
          limit: () => build(filters),
          get: async () => ({
            docs: links
              .filter((l) => filters.every(([field, value]) => l[field] === value))
              .map((l) => ({ data: () => l })),
          }),
        });
        return build([]);
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

const student = { uid: 'student_alice', token: {} };
const stranger = { uid: 'student_mallory', token: {} };
const guardian = { uid: 'parent_bob', token: {} };
const staffToken = { uid: 'teacher_carol', token: { role: 'staff_supervisor' } };
const adminToken = { uid: 'admin_dave', token: { admin: true } };
const staffByDoc = { uid: 'teacher_erin', token: {} };

console.log('\n🔒 CAMPUS WALLET AUTHORIZATION TEST SUITE\n');


// ===========================================================================
console.log('1. Top-up / limits: student must not be able to self-serve');
// ===========================================================================

await runTest('Student CANNOT top up their own wallet', async () => {
  const db = fakeDb({ wallets: { student_alice: { balanceSatang: 0 } } });
  const d = await resolveWalletAuthority(db, student, 'student_alice', { allowSelf: false });
  assertEqual(d, { allowed: false, reason: 'SELF_SERVICE_FORBIDDEN' }, 'self top-up must be denied');
});

await runTest('Student CANNOT raise their own spending limits / unlock wallet', async () => {
  const db = fakeDb({ wallets: { student_alice: { isLocked: true } } });
  const d = await resolveWalletAuthority(db, student, 'student_alice', { allowSelf: false });
  assert(d.allowed === false, 'student must not be able to change their own parental controls');
});

await runTest('Stranger CANNOT top up another student wallet', async () => {
  const db = fakeDb({ wallets: { student_alice: {} } });
  const d = await resolveWalletAuthority(db, stranger, 'student_alice', { allowSelf: false });
  assertEqual(d, { allowed: false, reason: 'WALLET_AUTHORITY_REQUIRED' }, 'stranger must be denied');
});

// ===========================================================================
console.log('\n2. Guardian links: only school-VERIFIED links are honoured');
// ===========================================================================

await runTest('Self-asserted PENDING link does NOT grant authority', async () => {
  // Any signed-in user can create this row per firestore.rules — it must prove nothing.
  const db = fakeDb({
    links: [{ guardianId: 'student_mallory', studentId: 'student_alice', status: 'PENDING', verifiedByGuardian: true, verifiedBySchool: false }],
  });
  const d = await resolveWalletAuthority(db, stranger, 'student_alice', { allowSelf: false });
  assertEqual(d, { allowed: false, reason: 'WALLET_AUTHORITY_REQUIRED' }, 'PENDING link must not grant authority');
});

await runTest('verifiedByGuardian alone does NOT grant authority', async () => {
  const db = fakeDb({
    links: [{ guardianId: 'student_mallory', studentId: 'student_alice', status: 'PENDING', verifiedByGuardian: true }],
  });
  assert(await isVerifiedGuardianOf(db, stranger, 'student_alice') === false, 'client-set flag must not be trusted');
});

await runTest('REJECTED link does NOT grant authority', async () => {
  const db = fakeDb({
    links: [{ guardianId: 'parent_bob', studentId: 'student_alice', status: 'REJECTED' }],
  });
  const d = await resolveWalletAuthority(db, guardian, 'student_alice', { allowSelf: false });
  assert(d.allowed === false, 'rejected link must be denied');
});

await runTest('VERIFIED link DOES grant guardian authority', async () => {
  const db = fakeDb({
    links: [{ guardianId: 'parent_bob', studentId: 'student_alice', status: 'VERIFIED' }],
  });
  const d = await resolveWalletAuthority(db, guardian, 'student_alice', { allowSelf: false });
  assertEqual(d, { allowed: true, role: 'GUARDIAN' }, 'verified guardian must be allowed');
});

await runTest('verifiedBySchool flag DOES grant guardian authority', async () => {
  const db = fakeDb({
    links: [{ guardianId: 'parent_bob', studentId: 'student_alice', status: 'PENDING', verifiedBySchool: true }],
  });
  const d = await resolveWalletAuthority(db, guardian, 'student_alice', { allowSelf: false });
  assertEqual(d, { allowed: true, role: 'GUARDIAN' }, 'school-verified link must be allowed');
});

await runTest('wallets.guardianIds DOES grant guardian authority', async () => {
  const db = fakeDb({ wallets: { student_alice: { guardianIds: ['parent_bob'] } } });
  const d = await resolveWalletAuthority(db, guardian, 'student_alice', { allowSelf: false });
  assertEqual(d, { allowed: true, role: 'GUARDIAN' }, 'wallet guardianIds must be honoured');
});

await runTest("Guardian of one child CANNOT act on a different child", async () => {
  const db = fakeDb({
    links: [{ guardianId: 'parent_bob', studentId: 'student_own_kid', status: 'VERIFIED' }],
  });
  const d = await resolveWalletAuthority(db, guardian, 'student_alice', { allowSelf: false });
  assert(d.allowed === false, 'guardian authority must not span to unrelated students');
});

// ===========================================================================
console.log('\n3. Staff / admin authority');
// ===========================================================================

await runTest('staff_supervisor custom claim grants authority', async () => {
  const d = await resolveWalletAuthority(fakeDb(), staffToken, 'student_alice', { allowSelf: false });
  assertEqual(d, { allowed: true, role: 'STAFF' }, 'staff claim must be allowed');
});

await runTest('admin claim grants authority', async () => {
  const d = await resolveWalletAuthority(fakeDb(), adminToken, 'student_alice', { allowSelf: false });
  assertEqual(d, { allowed: true, role: 'STAFF' }, 'admin claim must be allowed');
});

await runTest('staff_supervisors doc grants authority when claim not yet refreshed', async () => {
  const db = fakeDb({ staff: ['teacher_erin'] });
  const d = await resolveWalletAuthority(db, staffByDoc, 'student_alice', { allowSelf: false });
  assertEqual(d, { allowed: true, role: 'STAFF' }, 'staff directory fallback must work');
});

await runTest('Absent staff doc does NOT grant authority', async () => {
  const db = fakeDb({ staff: ['someone_else'] });
  assert(await isStaffOrAdmin(db, staffByDoc) === false, 'non-staff must not pass');
});

// ===========================================================================
console.log('\n4. Spending (allowSelf: true) — createOrderAuthoritative path');
// ===========================================================================

await runTest('Student CAN spend from their own wallet', async () => {
  const db = fakeDb({ wallets: { student_alice: { balanceSatang: 5000 } } });
  const d = await resolveWalletAuthority(db, student, 'student_alice', { allowSelf: true });
  assertEqual(d, { allowed: true, role: 'SELF' }, 'own-wallet spending must be allowed');
});

await runTest('🚨 Stranger CANNOT spend from another student wallet', async () => {
  const db = fakeDb({ wallets: { student_alice: { balanceSatang: 100000 } } });
  const d = await resolveWalletAuthority(db, stranger, 'student_alice', { allowSelf: true });
  assertEqual(d, { allowed: false, reason: 'WALLET_AUTHORITY_REQUIRED' }, 'wallet draining must be blocked');
});

await runTest('Verified guardian CAN spend on behalf of their child', async () => {
  const db = fakeDb({
    links: [{ guardianId: 'parent_bob', studentId: 'student_alice', status: 'VERIFIED' }],
  });
  const d = await resolveWalletAuthority(db, guardian, 'student_alice', { allowSelf: true });
  assertEqual(d, { allowed: true, role: 'GUARDIAN' }, 'guardian ordering must be allowed');
});

// ===========================================================================
console.log('\n5. Top-up amount bound');
// ===========================================================================

await runTest('MAX_TOPUP_SATANG is a sane positive bound (20,000 THB)', () => {
  assert(Number.isInteger(MAX_TOPUP_SATANG) && MAX_TOPUP_SATANG > 0, 'must be a positive integer');
  assertEqual(MAX_TOPUP_SATANG / 100, 20000, 'bound should equal 20,000 THB');
});


console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
