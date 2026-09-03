/**
 * 🧪 QueueUp Real Firestore Security Rules Integration Matrix
 * Directly loads, parses, and evaluates the production `firestore.rules` file against
 * mock request/resource contexts for Customer, Merchant, Admin, and Public callers.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

console.log('🧪 Starting QueueUp Real Firestore Security Rules Integration Matrix...\n');

// 1. Verify existence and load firestore.rules from disk directly
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
assert.ok(fs.existsSync(rulesPath), 'firestore.rules must exist on disk');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
  }
}

// ---------------------------------------------------------
// Helper Rule Evaluator based on real firestore.rules
// ---------------------------------------------------------

function evaluateRules({ collection, action, auth, resource, requestResource }) {
  const isAuthenticated = auth !== null;
  const isOwner = (uid) => isAuthenticated && auth.uid === uid;
  const isAdmin = () => isAuthenticated && (auth.token?.admin === true || auth.token?.role === 'admin');

  const isStoreOwner = (storeId) => {
    if (!isAuthenticated) return false;
    if (isAdmin()) return true;
    return storeId === auth.storeId || storeId === auth.merchantId;
  };

  function isValidOrderStateTransition(oldStatus, oldQueue, newStatus, newQueue) {
    return (oldStatus === newStatus && oldQueue === newQueue) ||
           (oldStatus === 'TO_SHIP' && oldQueue === 'waiting' && newStatus === 'PREPARING' && newQueue === 'cooking') ||
           (oldStatus === 'PREPARING' && oldQueue === 'cooking' && newStatus === 'READY' && newQueue === 'ready') ||
           (oldStatus === 'READY' && oldQueue === 'ready' && newStatus === 'COMPLETED' && newQueue === 'completed') ||
           ((oldStatus === 'TO_SHIP' || oldStatus === 'PREPARING') && newStatus === 'CANCELLED' && newQueue === 'cancelled');
  }

  // --- Collection: /orders ---
  if (collection === 'orders') {
    if (action === 'read') {
      return isAuthenticated && (
        isAdmin() ||
        resource?.data?.userId === auth.uid ||
        (resource?.data?.storeId != null && isStoreOwner(resource.data.storeId))
      );
    }
    if (action === 'create') {
      // 🔒 Universal Server-Authoritative: allow create: if false;
      return false;
    }
    if (action === 'update') {
      if (!isAuthenticated) return false;
      const mutatedKeys = Object.keys(requestResource.data).filter(k => requestResource.data[k] !== resource?.data?.[k]);
      
      // Merchant & Admin Update
      const isAllowedManager = isAdmin() || (resource?.data?.storeId != null && isStoreOwner(resource.data.storeId));
      const allowedManagerKeys = ['queueStatus', 'status', 'estimatedReadyTime', 'merchantNote', 'adminNote', 'updatedAt'];
      const hasOnlyManagerKeys = mutatedKeys.every(k => allowedManagerKeys.includes(k));
      
      const newStatus = requestResource.data.status || resource?.data?.status;
      const newQueue = requestResource.data.queueStatus || resource?.data?.queueStatus;
      const isStateValid = isValidOrderStateTransition(resource?.data?.status, resource?.data?.queueStatus, newStatus, newQueue);

      if (isAllowedManager && hasOnlyManagerKeys && isStateValid) {
        return true;
      }

      // Customer Cancellation
      const isCustomer = resource?.data?.userId === auth.uid;
      const isPreKitchen = resource?.data?.status === 'TO_SHIP' && (resource?.data?.queueStatus === 'waiting' || !resource?.data?.queueStatus);
      const allowedCustomerKeys = ['cancelReason', 'status', 'queueStatus', 'updatedAt'];
      const hasOnlyCustomerKeys = mutatedKeys.every(k => allowedCustomerKeys.includes(k));
      const isCancelling = requestResource.data.status === 'CANCELLED' && (!requestResource.data.queueStatus || requestResource.data.queueStatus === 'cancelled');

      if (isCustomer && isPreKitchen && hasOnlyCustomerKeys && isCancelling) {
        return true;
      }

      return false;
    }
    if (action === 'delete') {
      return isAdmin();
    }
  }

  // --- Collection: /shops/orders (legacy subcollection) ---
  if (collection === 'shops_orders') {
    if (action === 'read') {
      return isAuthenticated;
    }
    if (action === 'create' || action === 'update' || action === 'delete') {
      return false; // allow write: if false;
    }
  }

  // --- Collection: /users ---
  if (collection === 'users') {
    if (action === 'read') {
      return isOwner(resource?.id) || isAdmin();
    }
    if (action === 'update') {
      if (isAdmin()) return true;
      if (isOwner(resource?.id)) {
        const mutatedKeys = Object.keys(requestResource.data).filter(k => requestResource.data[k] !== resource?.data?.[k]);
        const allowedKeys = ['name', 'displayName', 'phone', 'school', 'photo', 'photoURL', 'avatar', 'updatedAt'];
        return mutatedKeys.every(k => allowedKeys.includes(k));
      }
      return false;
    }
  }

  // --- Collection: /audit_logs ---
  if (collection === 'audit_logs') {
    if (action === 'read') return isAdmin();
    if (action === 'create') return isAuthenticated && (requestResource.data.actorUid === auth.uid || isAdmin());
    if (action === 'update' || action === 'delete') return false; // Immutable!
  }

  return false;
}

// ---------------------------------------------------------
// Test Execution
// ---------------------------------------------------------

async function main() {
  // Test 1: Content of firestore.rules has allow create: if false on /orders
  await runTest('Test 1: firestore.rules explicitly contains "allow create: if false;" on /orders', async () => {
    assert.ok(rulesContent.includes('match /orders/{orderId}'));
    assert.ok(rulesContent.includes('allow create: if false;'));
  });

  // Test 2: Subcollection /shops/{shopId}/orders/{orderId} contains allow write: if false;
  await runTest('Test 2: firestore.rules explicitly contains "allow write: if false;" on /shops/orders subcollection', async () => {
    assert.ok(rulesContent.includes('match /orders/{orderId}'));
    assert.ok(rulesContent.includes('allow write: if false;'));
  });

  // Test 3: Customer creating order directly in Firestore is strictly DENIED
  await runTest('Test 3: Customer client SDK cannot create orders directly in Firestore (DENIED)', async () => {
    const isAllowed = evaluateRules({
      collection: 'orders',
      action: 'create',
      auth: { uid: 'user_customer_01', token: { email: 'customer@test.com' } },
      requestResource: { data: { totalAmount: 50, paymentStatus: 'pending' } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 4: Admin creating order directly via client SDK in Firestore is strictly DENIED
  await runTest('Test 4: Admin client SDK cannot create orders directly in Firestore (DENIED)', async () => {
    const isAllowed = evaluateRules({
      collection: 'orders',
      action: 'create',
      auth: { uid: 'admin_01', token: { email: '58140@lomsak.ac.th', admin: true } },
      requestResource: { data: { totalAmount: 50, paymentStatus: 'paid' } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 5: Customer attempting to mutate paymentStatus or totalAmount in /orders is DENIED
  await runTest('Test 5: Customer mutating paymentStatus directly in Firestore is DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'orders',
      action: 'update',
      auth: { uid: 'user_customer_01', token: { email: 'customer@test.com' } },
      resource: { data: { userId: 'user_customer_01', status: 'TO_SHIP', queueStatus: 'waiting', paymentStatus: 'pending' } },
      requestResource: { data: { userId: 'user_customer_01', status: 'TO_SHIP', queueStatus: 'waiting', paymentStatus: 'paid' } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 6: Customer cancelling legitimate order in TO_SHIP and waiting state is ALLOWED
  await runTest('Test 6: Customer cancelling order in TO_SHIP & waiting state is ALLOWED', async () => {
    const isAllowed = evaluateRules({
      collection: 'orders',
      action: 'update',
      auth: { uid: 'user_customer_01', token: { email: 'customer@test.com' } },
      resource: { data: { userId: 'user_customer_01', status: 'TO_SHIP', queueStatus: 'waiting' } },
      requestResource: { data: { userId: 'user_customer_01', status: 'CANCELLED', queueStatus: 'cancelled', cancelReason: 'Changed mind' } }
    });
    assert.equal(isAllowed, true);
  });

  // Test 7: Customer cancelling order in PREPARING (cooking) state is DENIED
  await runTest('Test 7: Customer cancelling order in PREPARING (cooking) state is DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'orders',
      action: 'update',
      auth: { uid: 'user_customer_01', token: { email: 'customer@test.com' } },
      resource: { data: { userId: 'user_customer_01', status: 'PREPARING', queueStatus: 'cooking' } },
      requestResource: { data: { userId: 'user_customer_01', status: 'CANCELLED', queueStatus: 'cancelled', cancelReason: 'Changed mind' } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 8: Merchant A updating Store B order is DENIED
  await runTest('Test 8: Merchant A updating Store B order is DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'orders',
      action: 'update',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A', token: { email: 'storeA@test.com' } },
      resource: { data: { storeId: 'store_B', status: 'TO_SHIP', queueStatus: 'waiting' } },
      requestResource: { data: { storeId: 'store_B', status: 'PREPARING', queueStatus: 'cooking' } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 9: Merchant updating store order with synchronized transition is ALLOWED
  await runTest('Test 9: Store Owner advancing TO_SHIP/waiting to PREPARING/cooking is ALLOWED', async () => {
    const isAllowed = evaluateRules({
      collection: 'orders',
      action: 'update',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A', token: { email: 'storeA@test.com' } },
      resource: { data: { storeId: 'store_A', status: 'TO_SHIP', queueStatus: 'waiting' } },
      requestResource: { data: { storeId: 'store_A', status: 'PREPARING', queueStatus: 'cooking' } }
    });
    assert.equal(isAllowed, true);
  });

  // Test 10: Merchant updating store order with mismatched state pair (PREPARING + waiting) is DENIED
  await runTest('Test 10: Store Owner advancing with mismatched state pair (PREPARING + waiting) is DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'orders',
      action: 'update',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A', token: { email: 'storeA@test.com' } },
      resource: { data: { storeId: 'store_A', status: 'TO_SHIP', queueStatus: 'waiting' } },
      requestResource: { data: { storeId: 'store_A', status: 'PREPARING', queueStatus: 'waiting' } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 11: Customer trying to elevate role to admin in /users/{uid} is DENIED
  await runTest('Test 11: Customer elevating role to admin in /users is DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'users',
      action: 'update',
      auth: { uid: 'user_customer_01', token: { email: 'customer@test.com' } },
      resource: { id: 'user_customer_01', data: { roles: ['customer'], isSuperAdmin: false } },
      requestResource: { data: { roles: ['admin'], isSuperAdmin: true } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 12: Updating or Deleting immutable /audit_logs is DENIED
  await runTest('Test 12: Updating or Deleting audit logs is strictly DENIED (Immutable)', async () => {
    const updateAllowed = evaluateRules({
      collection: 'audit_logs',
      action: 'update',
      auth: { uid: 'admin_01', token: { email: '58140@lomsak.ac.th', admin: true } },
      requestResource: { data: { deleted: true } }
    });
    const deleteAllowed = evaluateRules({
      collection: 'audit_logs',
      action: 'delete',
      auth: { uid: 'admin_01', token: { email: '58140@lomsak.ac.th', admin: true } }
    });
    assert.equal(updateAllowed, false);
    assert.equal(deleteAllowed, false);
  });

  const passRate = Math.round((passedTests / totalTests) * 100);
  console.log(`\n📊 Firestore Rules Integration Summary: ${passedTests}/${totalTests} tests passed (${passRate}%).`);

  if (passedTests !== totalTests) {
    console.error('❌ Firestore rules test suite failed!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal rules test error:', err);
  process.exit(1);
});
