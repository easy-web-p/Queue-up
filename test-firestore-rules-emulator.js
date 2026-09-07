/**
 * ============================================================================
 * FIRESTORE SECURITY RULES — REAL EMULATOR TEST SUITE
 * ============================================================================
 *
 * Runs firestore.rules through the actual Firestore rules engine against seeded
 * test data. The existing test-firestore-rules-integration.js is a hand-written
 * model of the rules — useful, but it can agree with itself while disagreeing with
 * what Firestore would really do. This suite cannot: every assertion is a live read
 * or write that the emulator allows or denies.
 *
 * Run with:  npm run test:rules:emulator
 * (starts the emulator, runs this file, shuts it down)
 */

import fs from 'node:fs';
import process from 'node:process';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}\n       ${err.message?.split('\n')[0]}`);
  }
}

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-queueup-rules',
  firestore: {
    rules: fs.readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

// ---------------------------------------------------------------------------
// Seed data, written with rules disabled so the fixtures themselves are not a
// test of the rules.
// ---------------------------------------------------------------------------
const STUDENT = 'student_alice';
const GUARDIAN = 'parent_bob';
const STRANGER = 'student_mallory';
const TEACHER = 'teacher_carol';
const MERCHANT = 'merchant_dave';
const SHOP = 'shop_dave';

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();

  await setDoc(doc(db, 'shops', SHOP), {
    id: SHOP,
    name: 'ร้านป้าแดง ตามสั่ง',
    ownerUid: MERCHANT,
    status: 'active',
    isOpen: true,
    maxOrdersPerSlot: 10,
  });

  await setDoc(doc(db, 'students', STUDENT), {
    studentId: STUDENT,
    name: 'สมหญิง ใจดี',
    class: 'ม.4/2',
    studentCode: '58140',
    guardianIds: [GUARDIAN],
    allergyInfo: ['อาหารทะเล / กุ้ง (Seafood)'],
    healthNotes: 'แพ้กุ้งรุนแรง พกยาประจำตัว',
  });

  await setDoc(doc(db, 'wallets', STUDENT), {
    studentId: STUDENT,
    balanceSatang: 50000,
    dailyLimitSatang: 20000,
    weeklyLimitSatang: 100000,
    guardianIds: [GUARDIAN],
    isLocked: false,
  });

  await setDoc(doc(db, 'staff_supervisors', TEACHER), {
    staffId: TEACHER,
    name: 'ครูสมชาย',
    role: 'CANTEEN_HEAD',
    canApproveVendors: true,
    canEmergencyLookup: true,
  });

  // One order per party, so "can I read someone else's" is a real question.
  await setDoc(doc(db, 'orders', 'order_alice'), {
    id: 'order_alice',
    orderId: 'order_alice',
    userId: STUDENT,
    storeId: SHOP,
    queueNumber: 'Q001',
    status: 'PENDING',
    queueStatus: 'waiting',
    customerName: 'สมหญิง ใจดี',
    customerPhone: '0812345678',
    pickupDate: '2026-09-07',
    totalAmountSatang: 6900,
  });

  await setDoc(doc(db, 'orders', 'order_stranger'), {
    id: 'order_stranger',
    orderId: 'order_stranger',
    userId: STRANGER,
    storeId: 'shop_other',
    queueNumber: 'Q002',
    status: 'PENDING',
    queueStatus: 'waiting',
    pickupDate: '2026-09-07',
  });

  await setDoc(doc(db, 'assistant_rate_limits', STRANGER), { windowStart: 1, count: 99 });
});

const asStudent = testEnv.authenticatedContext(STUDENT).firestore();
const asGuardian = testEnv.authenticatedContext(GUARDIAN).firestore();
const asStranger = testEnv.authenticatedContext(STRANGER).firestore();
const asTeacher = testEnv.authenticatedContext(TEACHER, { role: 'staff_supervisor' }).firestore();
const asMerchant = testEnv.authenticatedContext(MERCHANT).firestore();
const asAdmin = testEnv.authenticatedContext('admin_root', { admin: true }).firestore();
const asAnon = testEnv.unauthenticatedContext().firestore();

console.log('\n🔥 FIRESTORE RULES — REAL EMULATOR SUITE\n');

// ===========================================================================
console.log('1. Privilege escalation through the user profile document');
// ===========================================================================

await runTest('🚨 A user CANNOT self-assign role:"admin" when creating their profile', async () => {
  await assertFails(
    setDoc(doc(asStranger, 'users', STRANGER), { name: 'Mallory', role: 'admin' })
  );
});

await runTest('🚨 A user CANNOT self-assign admin:true', async () => {
  await assertFails(
    setDoc(doc(asStranger, 'users', STRANGER), { name: 'Mallory', admin: true })
  );
});

await runTest('A user CANNOT self-assign isSuperAdmin or a privileged roles array', async () => {
  await assertFails(setDoc(doc(asStranger, 'users', STRANGER), { isSuperAdmin: true }));
  await assertFails(setDoc(doc(asStranger, 'users', STRANGER), { roles: ['admin'] }));
});

await runTest('An ordinary profile can still be created', async () => {
  await assertSucceeds(
    setDoc(doc(asStranger, 'users', STRANGER), {
      name: 'Mallory',
      role: 'customer',
      roles: ['customer'],
    })
  );
});

await runTest('A user CANNOT escalate role on a later update', async () => {
  await assertFails(updateDoc(doc(asStranger, 'users', STRANGER), { role: 'admin' }));
});

await runTest('A user can still edit their own safe profile fields', async () => {
  await assertSucceeds(updateDoc(doc(asStranger, 'users', STRANGER), { name: 'Mallory M.' }));
});

await runTest('A user cannot read another user profile', async () => {
  await assertFails(getDoc(doc(asStudent, 'users', STRANGER)));
});

// ===========================================================================
console.log('\n2. Medical data — staff must go through the audited function');
// ===========================================================================

await runTest('🚨 A staff supervisor CANNOT read a student record directly', async () => {
  // Their route is emergencyMedicalLookup, which writes the audit entry first.
  await assertFails(getDoc(doc(asTeacher, 'students', STUDENT)));
});

await runTest('The student can read their own record', async () => {
  await assertSucceeds(getDoc(doc(asStudent, 'students', STUDENT)));
});

await runTest('A linked guardian can read their child record', async () => {
  await assertSucceeds(getDoc(doc(asGuardian, 'students', STUDENT)));
});

await runTest('An unrelated student cannot read it', async () => {
  await assertFails(getDoc(doc(asStranger, 'students', STUDENT)));
});

await runTest('Admin can still read it', async () => {
  await assertSucceeds(getDoc(doc(asAdmin, 'students', STUDENT)));
});

// ===========================================================================
console.log('\n3. Orders — the campus monitor query, and who may change state');
// ===========================================================================

await runTest('🚨 A staff supervisor CAN run the campus-wide queue query', async () => {
  // Without this the monitor's listener errors out and the board stays empty.
  const q = query(collection(asTeacher, 'orders'), where('pickupDate', '==', '2026-09-07'));
  await assertSucceeds(getDocs(q));
});

await runTest('🚨 A staff supervisor CANNOT change an order state', async () => {
  await assertFails(
    updateDoc(doc(asTeacher, 'orders', 'order_alice'), {
      status: 'CONFIRMED',
      queueStatus: 'waiting',
    })
  );
});

await runTest('A customer cannot read another customer order', async () => {
  await assertFails(getDoc(doc(asStudent, 'orders', 'order_stranger')));
});

await runTest('A customer can read their own order', async () => {
  await assertSucceeds(getDoc(doc(asStudent, 'orders', 'order_alice')));
});

await runTest('The owning merchant can read and advance their store order', async () => {
  await assertSucceeds(getDoc(doc(asMerchant, 'orders', 'order_alice')));
  await assertSucceeds(
    updateDoc(doc(asMerchant, 'orders', 'order_alice'), {
      status: 'CONFIRMED',
      queueStatus: 'waiting',
    })
  );
});

await runTest('The merchant cannot skip a state transition', async () => {
  await assertFails(
    updateDoc(doc(asMerchant, 'orders', 'order_alice'), {
      status: 'COMPLETED',
      queueStatus: 'completed',
    })
  );
});

await runTest('No client can create an order directly', async () => {
  await assertFails(
    setDoc(doc(asStudent, 'orders', 'forged_order'), {
      userId: STUDENT,
      storeId: SHOP,
      totalAmountSatang: 1,
    })
  );
});

await runTest('An anonymous visitor cannot read orders', async () => {
  await assertFails(getDoc(doc(asAnon, 'orders', 'order_alice')));
});

// ===========================================================================
console.log('\n4. Wallets and money');
// ===========================================================================

await runTest('🚨 A student cannot write their own wallet balance', async () => {
  await assertFails(updateDoc(doc(asStudent, 'wallets', STUDENT), { balanceSatang: 9999999 }));
});

await runTest('🚨 A guardian cannot write the wallet either — only Cloud Functions', async () => {
  await assertFails(updateDoc(doc(asGuardian, 'wallets', STUDENT), { balanceSatang: 9999999 }));
});

await runTest('The student and their guardian can read the wallet', async () => {
  await assertSucceeds(getDoc(doc(asStudent, 'wallets', STUDENT)));
  await assertSucceeds(getDoc(doc(asGuardian, 'wallets', STUDENT)));
});

await runTest('A stranger cannot read the wallet', async () => {
  await assertFails(getDoc(doc(asStranger, 'wallets', STUDENT)));
});

await runTest('Nobody can forge a wallet transaction', async () => {
  await assertFails(
    setDoc(doc(asStudent, 'wallet_transactions', 'forged'), {
      studentId: STUDENT,
      amountSatang: 100000,
      type: 'TOPUP',
    })
  );
});

// ===========================================================================
console.log('\n5. Staff directory and backend-only collections');
// ===========================================================================

await runTest('🚨 An ordinary user cannot enumerate the staff directory', async () => {
  await assertFails(getDoc(doc(asStranger, 'staff_supervisors', TEACHER)));
});

await runTest('A staff member can read their own record, and admin can read any', async () => {
  await assertSucceeds(getDoc(doc(asTeacher, 'staff_supervisors', TEACHER)));
  await assertSucceeds(getDoc(doc(asAdmin, 'staff_supervisors', TEACHER)));
});

await runTest('🚨 The assistant rate-limit counter is invisible and unwritable to clients', async () => {
  await assertFails(getDoc(doc(asStranger, 'assistant_rate_limits', STRANGER)));
  await assertFails(setDoc(doc(asStranger, 'assistant_rate_limits', STRANGER), { count: 0 }));
});

await runTest('Audit logs cannot be written or erased by a client', async () => {
  await assertFails(setDoc(doc(asTeacher, 'audit_logs', 'forged'), { action: 'NOPE' }));
  await assertFails(deleteDoc(doc(asAdmin, 'audit_logs', 'anything')));
});

// ===========================================================================
console.log('\n6. Store isolation');
// ===========================================================================

await runTest('A merchant cannot transfer ownership of their shop', async () => {
  await assertFails(updateDoc(doc(asMerchant, 'shops', SHOP), { ownerUid: STRANGER }));
});

await runTest('A merchant cannot change their own shop status', async () => {
  await assertFails(updateDoc(doc(asMerchant, 'shops', SHOP), { status: 'featured' }));
});

await runTest('A merchant can update their own shop hours', async () => {
  await assertSucceeds(updateDoc(doc(asMerchant, 'shops', SHOP), { isOpen: false }));
});

await runTest('A non-owner cannot touch the shop', async () => {
  await assertFails(updateDoc(doc(asStranger, 'shops', SHOP), { isOpen: false }));
});

await testEnv.cleanup();

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
