/**
 * Firestore Security Rules Test Suite
 *
 * Runs against the Firestore emulator, which compiles firestore.rules exactly
 * as production does. Each case pins one multi-tenant boundary: before these
 * rules were tightened, any account with role 'merchant' could read every
 * order and chat in every canteen, and any signed-in user could page through
 * a school's entire roster.
 *
 * Run with: npm run test:rules
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import fs from 'fs';

console.log('===============================================================');
console.log('🛡️  QUEUEUP FIRESTORE SECURITY RULES TEST SUITE');
console.log('===============================================================');

let total = 0;
let passed = 0;

async function expectAllowed(label, promise) {
  total++;
  try {
    await assertSucceeds(promise);
    console.log(`  ✅ [PASS] ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${label} — expected ALLOW, got DENY (${err.message})`);
    process.exitCode = 1;
  }
}

async function expectDenied(label, promise) {
  total++;
  try {
    await assertFails(promise);
    console.log(`  ✅ [PASS] ${label}`);
    passed++;
  } catch {
    console.error(`  ❌ [FAIL] ${label} — expected DENY, but it was ALLOWED`);
    process.exitCode = 1;
  }
}

const OWNER = 'merchant-owner-alpha';
const RIVAL = 'merchant-owner-beta';
const CUSTOMER = 'customer-somchai';
const OUTSIDER = 'customer-outsider';
const STORE = 'store-rules-alpha';
const RIVAL_STORE = 'store-rules-beta';
const SCHOOL = 'school-rules-1';

async function run() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-queueup-rules',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8899
    }
  });

  try {
    // Seed with rules disabled so fixtures are not themselves under test.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'stores', STORE), { id: STORE, name: 'ร้านอัลฟ่า', ownerId: OWNER });
      await setDoc(doc(db, 'stores', RIVAL_STORE), { id: RIVAL_STORE, name: 'ร้านเบต้า', ownerId: RIVAL });
      await setDoc(doc(db, 'menu_items', 'menu-alpha-1'), { storeId: STORE, name: 'กะเพราหมูกรอบ', price: 60 });
      await setDoc(doc(db, 'orders', 'ord-rules-1'), {
        storeId: STORE, customerId: CUSTOMER, schoolId: SCHOOL, status: 'PREPARING', total: 250
      });
      await setDoc(doc(db, 'chats', 'chat-rules-1'), {
        storeId: STORE, customerId: CUSTOMER, participantIds: [CUSTOMER, OWNER], lastMessage: 'สวัสดีครับ'
      });
      await setDoc(doc(db, 'customer_wallets', CUSTOMER), { uid: CUSTOMER, balanceSatang: 25000 });
      await setDoc(doc(db, 'wallet_transactions', 'wtx-rules-1'), {
        id: 'wtx-rules-1', uid: CUSTOMER, type: 'TOPUP', amountSatang: 25000, balanceAfterSatang: 25000
      });
      await setDoc(doc(db, 'school_members', 'member-rules-1'), {
        schoolId: SCHOOL, role: 'student', email: 'somchai@kku.ac.th',
        identifier: 'STD-6501094', fullName: 'สมชาย รักเรียน',
        status: 'active', claimedByUid: CUSTOMER, isRegistered: true
      });
    });

    const owner = testEnv.authenticatedContext(OWNER, { role: 'merchant' });
    const rival = testEnv.authenticatedContext(RIVAL, { role: 'merchant' });
    const customer = testEnv.authenticatedContext(CUSTOMER, { role: 'customer' });
    const outsider = testEnv.authenticatedContext(OUTSIDER, {
      role: 'customer', email: 'outsider@kku.ac.th', email_verified: true
    });
    // A school admin carries role + schoolId but no `admin` claim. Reading a
    // missing claim used to abort the whole rule before this arm was reached.
    const schoolAdmin = testEnv.authenticatedContext('school-admin-1', {
      role: 'admin', schoolId: SCHOOL
    });
    const otherSchoolAdmin = testEnv.authenticatedContext('school-admin-2', {
      role: 'admin', schoolId: 'school-rules-other'
    });

    console.log('\n--- Menu items: writes bound to the owning store ---');
    await expectAllowed('Store owner can update their own menu item',
      updateDoc(doc(owner.firestore(), 'menu_items', 'menu-alpha-1'), { price: 65 }));
    await expectDenied('A rival merchant cannot update another store menu item',
      updateDoc(doc(rival.firestore(), 'menu_items', 'menu-alpha-1'), { price: 1 }));
    await expectDenied('A customer cannot update a menu item',
      updateDoc(doc(customer.firestore(), 'menu_items', 'menu-alpha-1'), { price: 1 }));

    console.log('\n--- Orders: merchant reads scoped to their own store ---');
    await expectAllowed('The ordering customer can read their order',
      getDoc(doc(customer.firestore(), 'orders', 'ord-rules-1')));
    await expectAllowed('The store owner can read their store order',
      getDoc(doc(owner.firestore(), 'orders', 'ord-rules-1')));
    await expectDenied('A rival merchant cannot read another store order',
      getDoc(doc(rival.firestore(), 'orders', 'ord-rules-1')));
    await expectDenied('An unrelated customer cannot read the order',
      getDoc(doc(outsider.firestore(), 'orders', 'ord-rules-1')));
    await expectDenied('Direct client order writes stay forbidden',
      updateDoc(doc(customer.firestore(), 'orders', 'ord-rules-1'), { total: 1 }));

    console.log('\n--- Typing presence ---');
    await expectAllowed('A participant can publish their own typing presence',
      setDoc(doc(customer.firestore(), 'chats', 'chat-rules-1', 'typing', CUSTOMER),
        { uid: CUSTOMER, displayName: 'สมชาย', role: 'customer', expiresAt: Date.now() + 6000 }));
    await expectDenied('Nobody can publish presence under another person\'s uid',
      setDoc(doc(customer.firestore(), 'chats', 'chat-rules-1', 'typing', OWNER),
        { uid: OWNER, displayName: 'ร้านอัลฟ่า', role: 'merchant', expiresAt: Date.now() + 6000 }));
    await expectAllowed('The store operator can publish presence in their thread',
      setDoc(doc(owner.firestore(), 'chats', 'chat-rules-1', 'typing', OWNER),
        { uid: OWNER, displayName: 'ร้านอัลฟ่า', role: 'merchant', expiresAt: Date.now() + 6000 }));
    await expectAllowed('A participant can see who is typing',
      getDoc(doc(customer.firestore(), 'chats', 'chat-rules-1', 'typing', OWNER)));
    await expectDenied('A non-participant cannot see who is typing',
      getDoc(doc(outsider.firestore(), 'chats', 'chat-rules-1', 'typing', OWNER)));
    await expectDenied('A rival merchant cannot publish presence in another store thread',
      setDoc(doc(rival.firestore(), 'chats', 'chat-rules-1', 'typing', RIVAL),
        { uid: RIVAL, displayName: 'ร้านเบต้า', role: 'merchant', expiresAt: Date.now() + 6000 }));

    console.log('\n--- School admin claims resolve without an admin flag ---');
    await expectAllowed('A school admin can read an order from their own school',
      getDoc(doc(schoolAdmin.firestore(), 'orders', 'ord-rules-1')));
    await expectDenied('A school admin of another school cannot read that order',
      getDoc(doc(otherSchoolAdmin.firestore(), 'orders', 'ord-rules-1')));
    await expectAllowed('A school admin can read their own school roster',
      getDoc(doc(schoolAdmin.firestore(), 'school_members', 'member-rules-1')));
    await expectDenied('A school admin of another school cannot read that roster record',
      getDoc(doc(otherSchoolAdmin.firestore(), 'school_members', 'member-rules-1')));

    console.log('\n--- Chats: participants and the thread store only ---');
    await expectAllowed('A participant can read their thread',
      getDoc(doc(customer.firestore(), 'chats', 'chat-rules-1')));
    await expectAllowed('The store owner can read their store thread',
      getDoc(doc(owner.firestore(), 'chats', 'chat-rules-1')));
    await expectDenied('A rival merchant cannot read another store thread',
      getDoc(doc(rival.firestore(), 'chats', 'chat-rules-1')));
    await expectDenied('A non-participant cannot read the thread',
      getDoc(doc(outsider.firestore(), 'chats', 'chat-rules-1')));
    await expectDenied('Participants cannot be rewritten on an existing thread',
      updateDoc(doc(customer.firestore(), 'chats', 'chat-rules-1'), {
        participantIds: [CUSTOMER, OWNER, OUTSIDER]
      }));

    console.log('\n--- School roster: not readable by every signed-in account ---');
    await expectAllowed('A member can read their own roster record',
      getDoc(doc(customer.firestore(), 'school_members', 'member-rules-1')));
    await expectDenied('Another signed-in user cannot read that roster record',
      getDoc(doc(outsider.firestore(), 'school_members', 'member-rules-1')));
    await expectDenied('A merchant cannot enumerate the roster',
      getDoc(doc(rival.firestore(), 'school_members', 'member-rules-1')));

    console.log('\n--- Campus Wallet ---');
    await expectAllowed('The owner can read their own wallet balance',
      getDoc(doc(customer.firestore(), 'customer_wallets', CUSTOMER)));
    await expectDenied('Another account cannot read that wallet',
      getDoc(doc(outsider.firestore(), 'customer_wallets', CUSTOMER)));
    await expectDenied('A merchant cannot read a customer wallet',
      getDoc(doc(rival.firestore(), 'customer_wallets', CUSTOMER)));
    await expectDenied('Nobody can write a wallet balance from a client',
      setDoc(doc(customer.firestore(), 'customer_wallets', CUSTOMER), { balanceSatang: 9999999 }));
    await expectAllowed('The owner can read their own wallet transactions',
      getDoc(doc(customer.firestore(), 'wallet_transactions', 'wtx-rules-1')));
    await expectDenied('Another account cannot read those transactions',
      getDoc(doc(outsider.firestore(), 'wallet_transactions', 'wtx-rules-1')));

    console.log('\n--- Server-authoritative collections stay closed to clients ---');
    await expectDenied('Clients cannot read merchant balances',
      getDoc(doc(owner.firestore(), 'merchant_balances', STORE)));
    await expectDenied('Clients cannot read payout requests',
      getDoc(doc(owner.firestore(), 'payout_requests', 'payout-1')));
    await expectDenied('Clients cannot read the ledger',
      getDoc(doc(owner.firestore(), 'ledger_entries', 'ledger-1')));

    console.log('\n===============================================================');
    console.log(`📊 FIRESTORE RULES TEST RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exitCode = 1;
  } finally {
    await testEnv.cleanup();
  }
}

run().catch((err) => {
  console.error('❌ Rules suite crashed:', err);
  process.exit(1);
});
