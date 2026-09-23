/**
 * ============================================================================
 * MERCHANT AUDIT LOG TEST SUITE
 * ============================================================================
 *
 * Validates the server-authoritative recordMerchantAuditLog logic:
 *  - Unauthenticated calls are rejected
 *  - Disallowed actions are rejected
 *  - Missing storeId is rejected
 *  - Store not found is rejected
 *  - Non-owner callers are rejected (permission-denied)
 *  - Valid store owner or admin calls are accepted
 *  - Metadata is bounded and sanitized
 */

import assert from 'node:assert';
import { isCallerAdmin } from './functions/campusClaims.js';
import { isBootstrapSuperAdmin } from './functions/superAdmins.js';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}\n       ${err.message}`);
  }
}

// Emulate recordMerchantAuditLog validation logic
const ALLOWED_ACTIONS = ['REGISTER_MERCHANT', 'UPDATE_STORE_PROFILE'];

function sanitizeMetadata(metadata) {
  const safeMetadata = {};
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    for (const [key, val] of Object.entries(metadata)) {
      if (typeof key === 'string' && key.length <= 50) {
        if (typeof val === 'string') {
          safeMetadata[key] = val.slice(0, 500);
        } else if (typeof val === 'number' || typeof val === 'boolean') {
          safeMetadata[key] = val;
        }
      }
    }
  }
  return safeMetadata;
}

// `mockUsers` is intentionally not destructured. Callers still pass a profile
// document so the suite can prove that a self-assigned admin flag there grants
// nothing — the point being that this function no longer reads it at all.
function emulateRecordMerchantAuditLog({ auth, data, mockShops = {} }) {
  if (!auth || !auth.uid) {
    throw new Error('unauthenticated: User must be authenticated to record audit log.');
  }

  const { action, storeId, metadata = {} } = data || {};

  if (!action || typeof action !== 'string' || !ALLOWED_ACTIONS.includes(action)) {
    throw new Error(`invalid-argument: Action '${action}' is not permitted for merchant audit logging.`);
  }

  if (!storeId || typeof storeId !== 'string') {
    throw new Error('invalid-argument: Valid storeId is required.');
  }

  const shopData = mockShops[storeId];
  if (!shopData) {
    throw new Error(`not-found: Shop document with id '${storeId}' was not found.`);
  }

  const isOwner = shopData.ownerUid === auth.uid;
  if (!isOwner) {
    // Calls the real decision rather than restating it. This line used to read
    // the caller's own users/{uid} profile — and when the function stopped doing
    // that, this model kept the old logic and the suite kept passing, proving
    // nothing about the code that actually ships.
    if (!isCallerAdmin(auth.token, isBootstrapSuperAdmin)) {
      throw new Error('permission-denied: Only the store owner or admin can record audit logs for this store.');
    }
  }

  const safeMetadata = sanitizeMetadata(metadata);

  return {
    success: true,
    logId: 'audit_' + Math.random().toString(36).substring(2, 9),
    entry: {
      action,
      actorUid: auth.uid,
      storeId,
      merchantId: shopData.merchantId || null,
      metadata: safeMetadata,
    },
  };
}

console.log('\n🔒 MERCHANT AUDIT LOG TEST SUITE\n');

runTest('Unauthenticated call throws unauthenticated', () => {
  assert.throws(() => {
    emulateRecordMerchantAuditLog({
      auth: null,
      data: { action: 'REGISTER_MERCHANT', storeId: 'STORE-001' },
    });
  }, /unauthenticated/);
});

runTest('Disallowed action throws invalid-argument', () => {
  assert.throws(() => {
    emulateRecordMerchantAuditLog({
      auth: { uid: 'user_123' },
      data: { action: 'DELETE_DATABASE', storeId: 'STORE-001' },
      mockShops: { 'STORE-001': { ownerUid: 'user_123' } },
    });
  }, /invalid-argument: Action 'DELETE_DATABASE' is not permitted/);
});

runTest('Missing storeId throws invalid-argument', () => {
  assert.throws(() => {
    emulateRecordMerchantAuditLog({
      auth: { uid: 'user_123' },
      data: { action: 'REGISTER_MERCHANT', storeId: '' },
    });
  }, /invalid-argument: Valid storeId is required/);
});

runTest('Non-existent store throws not-found', () => {
  assert.throws(() => {
    emulateRecordMerchantAuditLog({
      auth: { uid: 'user_123' },
      data: { action: 'UPDATE_STORE_PROFILE', storeId: 'STORE-404' },
      mockShops: {},
    });
  }, /not-found/);
});

runTest('Caller who is neither store owner nor admin is denied', () => {
  assert.throws(() => {
    emulateRecordMerchantAuditLog({
      auth: { uid: 'attacker_uid' },
      data: { action: 'UPDATE_STORE_PROFILE', storeId: 'STORE-001' },
      mockShops: { 'STORE-001': { ownerUid: 'legit_owner_uid' } },
      mockUsers: { attacker_uid: { role: 'customer' } },
    });
  }, /permission-denied/);
});

runTest('Store owner caller succeeds and records audit log', () => {
  const result = emulateRecordMerchantAuditLog({
    auth: { uid: 'owner_123' },
    data: {
      action: 'UPDATE_STORE_PROFILE',
      storeId: 'STORE-001',
      metadata: { storeName: 'ข้าวมันไก่เฮียเบิ้ม', canteenLocation: 'โรงอาหาร 1' },
    },
    mockShops: { 'STORE-001': { ownerUid: 'owner_123', merchantId: 'MCH-001' } },
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.entry.action, 'UPDATE_STORE_PROFILE');
  assert.strictEqual(result.entry.actorUid, 'owner_123');
  assert.strictEqual(result.entry.storeId, 'STORE-001');
  assert.strictEqual(result.entry.merchantId, 'MCH-001');
  assert.strictEqual(result.entry.metadata.storeName, 'ข้าวมันไก่เฮียเบิ้ม');
});

runTest('Admin caller succeeds even if not store owner', () => {
  const result = emulateRecordMerchantAuditLog({
    auth: { uid: 'admin_user', token: { role: 'admin' } },
    data: {
      action: 'UPDATE_STORE_PROFILE',
      storeId: 'STORE-001',
      metadata: { reason: 'Staff audit' },
    },
    mockShops: { 'STORE-001': { ownerUid: 'owner_123' } },
    mockUsers: { admin_user: { role: 'admin' } },
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.entry.actorUid, 'admin_user');
});

runTest('🚨 A self-assigned admin flag in the profile doc grants nothing', () => {
  // The escalation this function was one rules-regression away from. The Admin
  // SDK bypasses firestore.rules, so a profile field is not an authorization.
  assert.throws(() => {
    emulateRecordMerchantAuditLog({
      auth: { uid: 'attacker_uid', token: { role: 'customer' } },
      data: { action: 'UPDATE_STORE_PROFILE', storeId: 'STORE-001', metadata: {} },
      mockShops: { 'STORE-001': { ownerUid: 'legit_owner_uid' } },
      mockUsers: { attacker_uid: { role: 'admin', admin: true, isSuperAdmin: true } },
    });
  }, /permission-denied/);
});

runTest('A bootstrap super admin is still recognised', () => {
  const result = emulateRecordMerchantAuditLog({
    auth: { uid: 'boss', token: { email: '58140@lomsak.ac.th' } },
    data: { action: 'UPDATE_STORE_PROFILE', storeId: 'STORE-001', metadata: {} },
    mockShops: { 'STORE-001': { ownerUid: 'someone_else' } },
  });
  assert.strictEqual(result.success, true);
});

runTest('Metadata bounds and sanitization truncate oversized strings and drop invalid types', () => {
  const longString = 'A'.repeat(600);
  const result = emulateRecordMerchantAuditLog({
    auth: { uid: 'owner_123' },
    data: {
      action: 'REGISTER_MERCHANT',
      storeId: 'STORE-001',
      metadata: {
        normalKey: 'Valid value',
        longKey: longString,
        numericKey: 42,
        booleanKey: true,
        nestedObject: { bad: 'nested' },
      },
    },
    mockShops: { 'STORE-001': { ownerUid: 'owner_123' } },
  });

  assert.strictEqual(result.entry.metadata.normalKey, 'Valid value');
  assert.strictEqual(result.entry.metadata.longKey.length, 500);
  assert.strictEqual(result.entry.metadata.numericKey, 42);
  assert.strictEqual(result.entry.metadata.booleanKey, true);
  assert.strictEqual(result.entry.metadata.nestedObject, undefined);
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
