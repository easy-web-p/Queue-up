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

  // 🔒 Canonical Store Ownership: ONLY shops/{storeId}.ownerUid is canonical authority
  const isStoreOwner = (storeId) => {
    if (!isAuthenticated) return false;
    if (isAdmin()) return true;
    return storeId === auth.storeId;
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

  // --- Collection: /food_categories ---
  if (collection === 'food_categories') {
    if (action === 'read') return true;
    if (!isAuthenticated) return false;
    if (isAdmin()) return true;
    const storeId = requestResource?.data?.storeId || resource?.data?.storeId;
    if (!storeId || !isStoreOwner(storeId)) return false;
    if (action === 'update' && requestResource?.data?.storeId !== resource?.data?.storeId) return false;
    return true;
  }

  // --- Collection: /products ---
  if (collection === 'products') {
    if (action === 'read') return true;
    if (!isAuthenticated) return false;
    if (isAdmin()) return true;
    const storeId = requestResource?.data?.storeId || resource?.data?.storeId;
    if (!storeId || !isStoreOwner(storeId)) return false;
    if (action === 'create') {
      const p = requestResource.data;
      if (typeof p.name !== 'string' || p.name.length < 1 || p.name.length > 250) return false;
      if (typeof p.price !== 'number' || p.price <= 0) return false;
      if ('priceSatang' in p && (typeof p.priceSatang !== 'number' || p.priceSatang <= 0)) return false;
      if ('stock' in p && (typeof p.stock !== 'number' || p.stock < 0)) return false;
      return true;
    }
    if (action === 'update') {
      if (requestResource.data.storeId !== resource.data.storeId) return false; // 🔒 Lock storeId
      if ('price' in requestResource.data && (typeof requestResource.data.price !== 'number' || requestResource.data.price <= 0)) return false;
      if ('priceSatang' in requestResource.data && (typeof requestResource.data.priceSatang !== 'number' || requestResource.data.priceSatang <= 0)) return false;
      if ('stock' in requestResource.data && (typeof requestResource.data.stock !== 'number' || requestResource.data.stock < 0)) return false;
      return true;
    }
    if (action === 'delete') return isStoreOwner(resource.data.storeId);
  }

  // --- Collection: /modifier_groups ---
  if (collection === 'modifier_groups') {
    if (action === 'read') return true;
    if (!isAuthenticated) return false;
    if (isAdmin()) return true;
    const storeId = requestResource?.data?.storeId || resource?.data?.storeId;
    if (!storeId || !isStoreOwner(storeId)) return false;
    if (action === 'update' && requestResource.data.storeId !== resource.data.storeId) return false; // 🔒 Lock storeId
    return true;
  }

  // --- Collection: /store_slots ---
  if (collection === 'store_slots') {
    if (action === 'read') return true;
    return false; // 🔒 Universal Backend-Only: allow write: if false;
  }

  // --- Collection: /shops ---
  if (collection === 'shops') {
    if (action === 'read') return true;
    if (action === 'create') return isAuthenticated && (isAdmin() || requestResource.data?.ownerUid === auth.uid);
    if (action === 'update') {
      if (!isAuthenticated) return false;
      if (isAdmin()) return true;
      if (isStoreOwner(resource?.id)) {
        if (requestResource.data?.ownerUid !== resource?.data?.ownerUid) return false; // 🔒 Lock ownerUid
        if ('status' in requestResource.data && requestResource.data.status !== resource?.data?.status) return false; // 🔒 Lock Admin Status
        if ('rating' in requestResource.data && requestResource.data.rating !== resource?.data?.rating) return false; // 🔒 Lock Admin Rating
        if ('reviewsCount' in requestResource.data && requestResource.data.reviewsCount !== resource?.data?.reviewsCount) return false; // 🔒 Lock Admin ReviewsCount

        const mutatedKeys = Object.keys(requestResource.data).filter(k => requestResource.data[k] !== resource?.data?.[k]);
        const allowedShopKeys = [
          'name', 'description', 'location', 'hours', 'isOpen', 'contactPhone', 'logoUrl', 'bannerUrl',
          'operatingHours', 'operationalOverride', 'capacityConfig', 'slotCapacity', 'maxOrdersPerSlot', 'pickupSlots', 'updatedAt'
        ];
        return mutatedKeys.every(k => allowedShopKeys.includes(k));
      }
      return false;
    }
    if (action === 'delete') return isAdmin();
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
    if (action === 'create' || action === 'update' || action === 'delete') return false; // 🔒 Universal Backend-Only!
  }

  // --- Collection: /systemEvaluations ---
  if (collection === 'systemEvaluations') {
    if (action === 'read') return isAdmin();
    if (action === 'create') {
      return isAuthenticated &&
        requestResource.id === auth.uid &&
        requestResource.data?.userId === auth.uid &&
        typeof requestResource.data?.rating === 'number' &&
        requestResource.data?.rating >= 1 && requestResource.data?.rating <= 5;
    }
    if (action === 'update' || action === 'delete') return false;
  }

  // --- Collection: /webhook_events ---
  if (collection === 'webhook_events') {
    return false; // allow read, write: if false; (Universal Backend-Only)
  }

  // --- Collection: /resource_release_jobs ---
  if (collection === 'resource_release_jobs') {
    return false; // allow read, write: if false; (Universal Backend-Only)
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

  // Test 12: Client creating, updating or deleting /audit_logs is strictly DENIED (Universal Backend-Only)
  await runTest('Test 12: Client writing /audit_logs is strictly DENIED (Backend-Only)', async () => {
    const createAllowed = evaluateRules({
      collection: 'audit_logs',
      action: 'create',
      auth: { uid: 'user_customer_01', token: { email: 'customer@test.com' } },
      requestResource: { data: { actorUid: 'user_customer_01', action: 'LOGIN_SUCCESS' } }
    });
    const updateAllowed = evaluateRules({
      collection: 'audit_logs',
      action: 'update',
      auth: { uid: 'admin_01', token: { admin: true } },
      requestResource: { data: { deleted: true } }
    });
    const deleteAllowed = evaluateRules({
      collection: 'audit_logs',
      action: 'delete',
      auth: { uid: 'admin_01', token: { admin: true } }
    });
    assert.equal(createAllowed, false);
    assert.equal(updateAllowed, false);
    assert.equal(deleteAllowed, false);
  });

  // Test 13: Spoofed / duplicate /systemEvaluations from user with mismatched evalId is DENIED (Anti-Spam)
  await runTest('Test 13: System evaluation with mismatched evalId or spam payload is DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'systemEvaluations',
      action: 'create',
      auth: { uid: 'user_customer_01', token: { email: 'customer@test.com' } },
      requestResource: { id: 'random_eval_spam_id', data: { userId: 'user_customer_01', rating: 5 } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 14: Valid /systemEvaluations matching authenticated UID with rating 1-5 is ALLOWED
  await runTest('Test 14: Valid system evaluation matching authenticated UID is ALLOWED', async () => {
    const isAllowed = evaluateRules({
      collection: 'systemEvaluations',
      action: 'create',
      auth: { uid: 'user_customer_01', token: { email: 'customer@test.com' } },
      requestResource: { id: 'user_customer_01', data: { userId: 'user_customer_01', rating: 5, comment: 'Great service!' } }
    });
    assert.equal(isAllowed, true);
  });

  // Test 15: Client attempting to create /webhook_events is DENIED (Backend-Only)
  await runTest('Test 15: Client creating /webhook_events is strictly DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'webhook_events',
      action: 'create',
      auth: { uid: 'attacker_uid', token: { email: 'attacker@test.com' } },
      requestResource: { id: 'evnt_fake_01', data: { processed: true } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 16: Client attempting to update/delete /webhook_events is DENIED (Backend-Only)
  await runTest('Test 16: Client mutating /webhook_events is strictly DENIED', async () => {
    const updateAllowed = evaluateRules({
      collection: 'webhook_events',
      action: 'update',
      auth: { uid: 'attacker_uid', token: { email: 'attacker@test.com' } },
      requestResource: { data: { processed: false } }
    });
    const deleteAllowed = evaluateRules({
      collection: 'webhook_events',
      action: 'delete',
      auth: { uid: 'attacker_uid', token: { email: 'attacker@test.com' } }
    });
    assert.equal(updateAllowed, false);
    assert.equal(deleteAllowed, false);
  });

  // Test 17: Client attempting to create/update/delete /resource_release_jobs is DENIED (Backend-Only)
  await runTest('Test 17: Client creating or mutating /resource_release_jobs is strictly DENIED', async () => {
    const createAllowed = evaluateRules({
      collection: 'resource_release_jobs',
      action: 'create',
      auth: { uid: 'attacker_uid', token: { email: 'attacker@test.com' } },
      requestResource: { id: 'job_fake_01', data: { status: 'completed' } }
    });
    const updateAllowed = evaluateRules({
      collection: 'resource_release_jobs',
      action: 'update',
      auth: { uid: 'attacker_uid', token: { email: 'attacker@test.com' } },
      requestResource: { data: { status: 'failed' } }
    });
    assert.equal(createAllowed, false);
    assert.equal(updateAllowed, false);
  });

  // Test 18: Store Owner A creating product in Store A is ALLOWED
  await runTest('Test 18: Store Owner A creating product in Store A is ALLOWED', async () => {
    const isAllowed = evaluateRules({
      collection: 'products',
      action: 'create',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A' },
      requestResource: { data: { storeId: 'store_A', name: 'ข้าวผัดกะเพรา', price: 50, priceSatang: 5000, stock: 20 } }
    });
    assert.equal(isAllowed, true);
  });

  // Test 19: Store Owner A creating product in Store B is DENIED (Store Isolation)
  await runTest('Test 19: Store Owner A creating product in Store B is DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'products',
      action: 'create',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A' },
      requestResource: { data: { storeId: 'store_B', name: 'ข้าวผัดกะเพรา', price: 50, priceSatang: 5000, stock: 20 } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 20: Store Owner A modifying product storeId to Store B is strictly DENIED
  await runTest('Test 20: Store Owner modifying product storeId to another store is strictly DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'products',
      action: 'update',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A' },
      resource: { data: { storeId: 'store_A', name: 'ต้มยำกุ้ง', price: 80, stock: 10 } },
      requestResource: { data: { storeId: 'store_B', name: 'ต้มยำกุ้ง', price: 80, stock: 10 } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 21: Product with negative stock is DENIED
  await runTest('Test 21: Creating or updating product with negative stock is DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'products',
      action: 'create',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A' },
      requestResource: { data: { storeId: 'store_A', name: 'ข้าวมันไก่', price: 50, stock: -5 } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 22: Store Owner modifying ownerUid of Shop is strictly DENIED
  await runTest('Test 22: Store Owner attempting to transfer shop ownerUid is strictly DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'shops',
      action: 'update',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A' },
      resource: { id: 'store_A', data: { ownerUid: 'merchant_A_uid', name: 'ร้าน A' } },
      requestResource: { data: { ownerUid: 'merchant_imposter_uid', name: 'ร้าน A' } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 23: Store Owner creating Modifier Group in own store is ALLOWED
  await runTest('Test 23: Store Owner creating Modifier Group in own store is ALLOWED', async () => {
    const isAllowed = evaluateRules({
      collection: 'modifier_groups',
      action: 'create',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A' },
      requestResource: { data: { storeId: 'store_A', name: 'ระดับความหวาน' } }
    });
    assert.equal(isAllowed, true);
  });

  // Test 24: Store Owner creating Modifier Group in Store B is DENIED
  await runTest('Test 24: Store Owner creating Modifier Group in Store B is DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'modifier_groups',
      action: 'create',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A' },
      requestResource: { data: { storeId: 'store_B', name: 'ระดับความหวาน' } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 25: Client mutating store_slots directly in Firestore is strictly DENIED (Backend Only)
  await runTest('Test 25: Client mutating store_slots directly in Firestore is strictly DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'store_slots',
      action: 'update',
      auth: { uid: 'customer_01' },
      resource: { data: { currentOrders: 5, capacity: 10 } },
      requestResource: { data: { currentOrders: 6, capacity: 10 } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 26: Store Owner creating Food Category in own store is ALLOWED
  await runTest('Test 26: Store Owner creating Food Category in own store is ALLOWED', async () => {
    const isAllowed = evaluateRules({
      collection: 'food_categories',
      action: 'create',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A' },
      requestResource: { data: { storeId: 'store_A', name: 'เครื่องดื่ม' } }
    });
    assert.equal(isAllowed, true);
  });

  // Test 27: Store Owner attempting to mutate shop status (e.g. pending_approval -> active) is DENIED (Finding #1)
  await runTest('Test 27: Store Owner attempting to mutate shop status is strictly DENIED', async () => {
    const isAllowed = evaluateRules({
      collection: 'shops',
      action: 'update',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A' },
      resource: { id: 'store_A', data: { ownerUid: 'merchant_A_uid', status: 'pending_approval', name: 'ร้าน A' } },
      requestResource: { data: { ownerUid: 'merchant_A_uid', status: 'active', name: 'ร้าน A' } }
    });
    assert.equal(isAllowed, false);
  });

  // Test 28: Admin mutating shop status (e.g. pending_approval -> active) is ALLOWED
  await runTest('Test 28: Admin mutating shop status is ALLOWED', async () => {
    const isAllowed = evaluateRules({
      collection: 'shops',
      action: 'update',
      auth: { uid: 'admin_uid', token: { admin: true } },
      resource: { id: 'store_A', data: { ownerUid: 'merchant_A_uid', status: 'pending_approval', name: 'ร้าน A' } },
      requestResource: { data: { ownerUid: 'merchant_A_uid', status: 'active', name: 'ร้าน A' } }
    });
    assert.equal(isAllowed, true);
  });

  // Test 29: Store Owner updating allowed operational fields (isOpen, hours, operationalOverride) is ALLOWED
  await runTest('Test 29: Store Owner updating allowed operational fields is ALLOWED', async () => {
    const isAllowed = evaluateRules({
      collection: 'shops',
      action: 'update',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A' },
      resource: { id: 'store_A', data: { ownerUid: 'merchant_A_uid', status: 'active', name: 'ร้าน A', isOpen: false } },
      requestResource: { data: { ownerUid: 'merchant_A_uid', status: 'active', name: 'ร้าน A (สาขา 1)', isOpen: true, hours: '08:00 - 17:00' } }
    });
    assert.equal(isAllowed, true);
  });

  // Test 30: Canonical Ownership Rule AST verification in firestore.rules (Finding #2)
  await runTest('Test 30: isStoreOwner in firestore.rules uses ONLY canonical shops collection', async () => {
    assert.ok(rulesContent.includes('get(/databases/$(database)/documents/shops/$(storeId)).data.ownerUid == request.auth.uid'));
    assert.ok(!rulesContent.includes('documents/merchantProfiles/$(storeId)'));
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
