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
import { buildSeedProducts } from './src/lib/seedCatalog.js';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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

  await setDoc(doc(db, 'parent_child_links', 'link_pending'), {
    guardianId: GUARDIAN,
    studentId: STUDENT,
    guardianName: 'สมชาย ใจดี',
    studentName: 'สมหญิง ใจดี',
    relationship: 'FATHER',
    verifiedByGuardian: true,
    verifiedBySchool: false,
    status: 'PENDING',
  });

  await setDoc(doc(db, 'parent_child_links', 'link_verified'), {
    guardianId: GUARDIAN,
    studentId: STUDENT,
    guardianName: 'สมชาย ใจดี',
    studentName: 'สมหญิง ใจดี',
    relationship: 'FATHER',
    verifiedByGuardian: true,
    verifiedBySchool: true,
    status: 'VERIFIED',
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

// ===========================================================================
console.log('\n7. Guardian ↔ student links');
// ===========================================================================

await runTest('Anyone signed in can REQUEST a link, but only as themselves', async () => {
  await assertSucceeds(
    setDoc(doc(asGuardian, 'parent_child_links', 'req_ok'), {
      guardianId: GUARDIAN,
      studentId: STUDENT,
      status: 'PENDING',
    })
  );
  await assertFails(
    setDoc(doc(asStranger, 'parent_child_links', 'req_impersonation'), {
      guardianId: GUARDIAN,
      studentId: STUDENT,
      status: 'PENDING',
    })
  );
});

await runTest('🚨 A request cannot be created already VERIFIED', async () => {
  await assertFails(
    setDoc(doc(asStranger, 'parent_child_links', 'req_selfverified'), {
      guardianId: STRANGER,
      studentId: STUDENT,
      status: 'VERIFIED',
    })
  );
});

await runTest('🚨 A staff supervisor cannot flip a link to VERIFIED from the client', async () => {
  // Verification also writes guardianIds and an audit entry, so it goes through the
  // Cloud Function; a direct edit would mark it verified while granting nothing.
  await assertFails(
    updateDoc(doc(asTeacher, 'parent_child_links', 'link_pending'), { status: 'VERIFIED' })
  );
});

await runTest('🚨 A guardian cannot self-verify their own link', async () => {
  await assertFails(
    updateDoc(doc(asGuardian, 'parent_child_links', 'link_pending'), {
      status: 'VERIFIED',
      verifiedBySchool: true,
    })
  );
});

await runTest('Not even an admin can edit a link outside the function', async () => {
  await assertFails(
    updateDoc(doc(asAdmin, 'parent_child_links', 'link_pending'), { status: 'VERIFIED' })
  );
});

await runTest('A guardian may withdraw their own PENDING request', async () => {
  await assertSucceeds(deleteDoc(doc(asGuardian, 'parent_child_links', 'req_ok')));
});

await runTest('🚨 A guardian CANNOT delete a VERIFIED link to keep the access it granted', async () => {
  // Deleting the link does not remove guardianIds from the student and wallet, so
  // this would leave the access standing with no record of it. Revocation is staff's.
  await assertFails(deleteDoc(doc(asGuardian, 'parent_child_links', 'link_verified')));
});

await runTest('An unrelated user cannot read or delete someone else link', async () => {
  await assertFails(getDoc(doc(asStranger, 'parent_child_links', 'link_verified')));
  await assertFails(deleteDoc(doc(asStranger, 'parent_child_links', 'link_verified')));
});

await runTest('The guardian, the student and staff can read the link', async () => {
  await assertSucceeds(getDoc(doc(asGuardian, 'parent_child_links', 'link_verified')));
  await assertSucceeds(getDoc(doc(asStudent, 'parent_child_links', 'link_verified')));
  await assertSucceeds(getDoc(doc(asTeacher, 'parent_child_links', 'link_verified')));
});

await runTest('Staff can list pending requests (the approval panel query)', async () => {
  await assertSucceeds(getDocs(query(collection(asTeacher, 'parent_child_links'))));
});

// ===========================================================================
console.log('\n🏫 Pilot programme leads (public form, backend-only storage)');
// ===========================================================================

await runTest('🚨 An unauthenticated visitor CANNOT write a lead directly', async () => {
  // The landing page form takes no sign-in, so if the collection were open to the
  // form it would be open to everyone. It goes through submitPilotLead instead.
  await assertFails(
    addDoc(collection(asAnon, 'pilot_leads'), {
      schoolName: 'โรงเรียนปลอม',
      contactName: 'x',
      phone: '0812345678',
      email: 'x@example.com',
    })
  );
});

await runTest('🚨 Not even a signed-in user can write a lead', async () => {
  await assertFails(
    addDoc(collection(asStudent, 'pilot_leads'), { schoolName: 'x', contactName: 'y' })
  );
});

await runTest('🚨 A school contact is not readable by the public', async () => {
  // The form promises PDPA confidentiality over a name, position, phone and email.
  await assertFails(getDoc(doc(asAnon, 'pilot_leads', 'lead_1')));
  await assertFails(getDoc(doc(asStudent, 'pilot_leads', 'lead_1')));
  await assertFails(getDocs(query(collection(asStranger, 'pilot_leads'))));
});

await runTest('An admin can read the leads the team has to act on', async () => {
  await assertSucceeds(getDoc(doc(asAdmin, 'pilot_leads', 'lead_1')));
});

await runTest('🚨 Nobody can edit or delete a stored lead from a client', async () => {
  await assertFails(updateDoc(doc(asAdmin, 'pilot_leads', 'lead_1'), { status: 'CONVERTED' }));
  await assertFails(deleteDoc(doc(asAdmin, 'pilot_leads', 'lead_1')));
});

await runTest('🚨 The rate-limit counter cannot be read or reset from a browser', async () => {
  // It is the only thing bounding an unauthenticated endpoint. A caller who could
  // reset their own counter would have no limit at all.
  await assertFails(getDoc(doc(asAnon, 'pilot_lead_rate_limits', '203_0_113_7')));
  await assertFails(
    setDoc(doc(asAnon, 'pilot_lead_rate_limits', '203_0_113_7'), { count: 0, windowStart: 0 })
  );
  await assertFails(getDoc(doc(asAdmin, 'pilot_lead_rate_limits', '203_0_113_7')));
});

// ===========================================================================
console.log('\n📊 System evaluations (public wall, backend-only writes)');
// ===========================================================================

await runTest('🚨 Anyone can read the wall without an account', async () => {
  // The whole point of the wall: a supervisor or reviewer opens /queueup and reads
  // the scores. Reads were admin-only, so it fell back to hardcoded samples.
  await assertSucceeds(getDoc(doc(asAnon, 'systemEvaluations', 'eval_1')));
  await assertSucceeds(getDocs(query(collection(asAnon, 'systemEvaluations'))));
});

await runTest('🚨 No client can write an evaluation, signed in or not', async () => {
  // The form takes no sign-in, so a collection open to it is open to everyone.
  const evaluation = {
    userName: 'ปลอม',
    uxScore: 10, accountScore: 10, queueScore: 10, merchantScore: 10, securityScore: 10,
    comment: 'x',
  };
  await assertFails(addDoc(collection(asAnon, 'systemEvaluations'), evaluation));
  await assertFails(addDoc(collection(asStudent, 'systemEvaluations'), evaluation));
  await assertFails(setDoc(doc(asStudent, 'systemEvaluations', STUDENT), evaluation));
});

await runTest('🚨 A stored evaluation cannot be edited or deleted from a client', async () => {
  await assertFails(updateDoc(doc(asAdmin, 'systemEvaluations', 'eval_1'), { uxScore: 10 }));
  await assertFails(deleteDoc(doc(asAdmin, 'systemEvaluations', 'eval_1')));
});

await runTest('🚨 The evaluation rate-limit counter is closed to clients', async () => {
  await assertFails(getDoc(doc(asAnon, 'evaluation_rate_limits', '203_0_113_7')));
  await assertFails(
    setDoc(doc(asAnon, 'evaluation_rate_limits', '203_0_113_7'), { count: 0, windowStart: 0 })
  );
});

// ===========================================================================
console.log('\n🌱 Seeded menu products (the shape the seeder actually writes)');
// ===========================================================================

// Exactly what StoreAdminPage's seed button hands to Firestore.
const seeded = buildSeedProducts(
  [{ id: 'm1', name: 'ชุดไก่บักเก็ตซอสเกาหลี', price: 69, originalPrice: 120, sales: '4.5k ครั้ง', rating: 4.9 }],
  SHOP
)[0];

await runTest('🚨 The seeded shape is accepted by the rules, not just by the UI', async () => {
  // A seeder whose documents the rules refuse would report success for a menu
  // that never landed. This is the check that the two agree.
  await assertSucceeds(setDoc(doc(asMerchant, 'products', seeded.id), seeded));
});

await runTest('An admin can seed a store they do not own', async () => {
  await assertSucceeds(setDoc(doc(asAdmin, 'products', `${seeded.id}_admin`), seeded));
});

await runTest('🚨 A student cannot seed products', async () => {
  await assertFails(setDoc(doc(asStudent, 'products', 'forged_1'), seeded));
});

await runTest('🚨 A merchant cannot seed products into someone else store', async () => {
  await assertFails(
    setDoc(doc(asMerchant, 'products', 'cross_1'), { ...seeded, storeId: 'someone_else_shop' })
  );
});

await runTest('🚨 The seeder strips the fabricated sales figures before writing', async () => {
  for (const field of ['sales', 'salesCount', 'rating', 'originalPrice']) {
    if (field in seeded) throw new Error(`${field} must not reach the database`);
  }
});

await runTest('🚨 A seeded product carries the storeId ordering requires', async () => {
  if (seeded.storeId !== SHOP) throw new Error('a product with no store cannot be ordered');
  if (seeded.priceSatang !== 6900) throw new Error('satang must match the baht price');
});

// ===========================================================================
console.log('\n🔐 The sign-in profile write (client and rules must agree)');
// ===========================================================================

const GOOGLE_USER = 'google_returning_user';
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'users', GOOGLE_USER), {
    uid: GOOGLE_USER, email: 'somchai@kkumail.com', roles: ['customer'], activeRole: 'customer',
  });
});
const asGoogleUser = testEnv.authenticatedContext(GOOGLE_USER).firestore();

await runTest('🚨 A returning sign-in can write exactly the fields it writes', async () => {
  // The regression: the sign-in path wrote roles, activeRole, isSuperAdmin,
  // isMerchantVerified, isMerchantRegistered, storeId and email back every visit.
  // None are owner-writable, so every returning Google user saw
  // "Missing or insufficient permissions" and lastLoginAt never moved.
  await assertSucceeds(
    setDoc(doc(asGoogleUser, 'users', GOOGLE_USER), {
      displayName: 'สมชาย',
      fullName: 'สมชาย',
      photo: '/yeti_mascot.jpg',
      photoURL: '/yeti_mascot.jpg',
      accountId: 'QUP-20260908-ABC',
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true })
  );
});

await runTest('🚨 The old payload is still refused, field by field', async () => {
  for (const forged of [
    { roles: ['admin'] },
    { activeRole: 'admin' },
    { isSuperAdmin: true },
    { isMerchantVerified: true },
    { isMerchantRegistered: true },
    { storeId: 'shop_1' },
    { email: 'someone-else@example.com' },
    { role: 'admin' },
    { admin: true },
  ]) {
    await assertFails(setDoc(doc(asGoogleUser, 'users', GOOGLE_USER), forged, { merge: true }));
  }
});

// ===========================================================================
console.log('\n💬 Customer–shop chat (one conversation, one owner)');
// ===========================================================================

// A chat id is `<customerUid>_<storeId>`, so the uid prefix identifies the owner.
const CHAT_ID = `${STUDENT}_${SHOP}`;
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'chats', CHAT_ID), { storeId: SHOP });
  await setDoc(doc(db, 'chats', CHAT_ID, 'messages', 'm1'), {
    senderUid: STUDENT, text: 'เบอร์ติดต่อกลับ 081-234-5678',
  });
});

await runTest('🚨 A stranger cannot read someone else conversation', async () => {
  // `allow read, write: if isAuthenticated()` let every signed-in student read
  // every other student's messages with a shop — phone numbers included.
  await assertFails(getDoc(doc(asStranger, 'chats', CHAT_ID)));
  await assertFails(getDocs(collection(asStranger, 'chats', CHAT_ID, 'messages')));
});

await runTest('🚨 A stranger cannot post into someone else conversation', async () => {
  await assertFails(
    addDoc(collection(asStranger, 'chats', CHAT_ID, 'messages'), { senderUid: STRANGER, text: 'x' })
  );
});

await runTest('The customer can read and write their own', async () => {
  await assertSucceeds(getDocs(collection(asStudent, 'chats', CHAT_ID, 'messages')));
  await assertSucceeds(
    addDoc(collection(asStudent, 'chats', CHAT_ID, 'messages'), { senderUid: STUDENT, text: 'สวัสดีครับ' })
  );
});

await runTest("The shop's automatic acknowledgement still posts", async () => {
  // It is written client-side and carries no senderUid, so the rule has to allow
  // a message without one rather than require it.
  await assertSucceeds(
    addDoc(collection(asStudent, 'chats', CHAT_ID, 'messages'), { sender: 'merchant', text: 'รับทราบครับ' })
  );
});

await runTest('🚨 Nobody can post as another user, even in their own chat', async () => {
  await assertFails(
    addDoc(collection(asStudent, 'chats', CHAT_ID, 'messages'), { senderUid: STRANGER, text: 'ปลอม' })
  );
});

await testEnv.cleanup();

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
