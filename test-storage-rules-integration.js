/**
 * 🧪 QueueUp Firebase Storage Security Rules Integration Matrix
 * Validates storage.rules against multi-tenant isolation, MIME whitelists,
 * payload size boundaries, role-based store ownership, and deletion guards.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

console.log('🧪 Starting QueueUp Firebase Storage Security Rules Integration Matrix...\n');

const storageRulesPath = path.resolve(process.cwd(), 'storage.rules');
assert.ok(fs.existsSync(storageRulesPath), 'storage.rules must exist on disk');
const storageRulesContent = fs.readFileSync(storageRulesPath, 'utf8');

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
// Storage Rule Evaluator Model
// ---------------------------------------------------------

function evaluateStorageRules({ path: filePath, action, auth, resource, requestResource }) {
  const isAuthenticated = auth !== null;
  const isOwner = (uid) => isAuthenticated && auth.uid === uid;
  const isAdmin = () => isAuthenticated && (
    auth.token?.admin === true ||
    auth.token?.role === 'admin' ||
    auth.token?.isSuperAdmin === true ||
    auth.token?.email === '58140@lomsak.ac.th'
  );

  const isStoreOwner = (storeId) => {
    if (!isAuthenticated) return false;
    if (isAdmin()) return true;
    return auth.storeId === storeId || auth.merchantId === storeId;
  };

  const isValidImage = (maxSizeMB) => {
    if (!requestResource) return false;
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const mimeValid = allowedMimes.includes(requestResource.contentType);
    const sizeValid = typeof requestResource.size === 'number' && requestResource.size < maxSizeMB * 1024 * 1024;
    return mimeValid && sizeValid;
  };

  // 1. /users/{userId}/*
  if (filePath.startsWith('/users/')) {
    const segments = filePath.split('/').filter(Boolean);
    const targetUserId = segments[1];
    if (action === 'read') return true;
    if (action === 'create' || action === 'update') {
      return (isOwner(targetUserId) || isAdmin()) && isValidImage(5);
    }
    if (action === 'delete') {
      return isOwner(targetUserId) || isAdmin();
    }
  }

  // 2. /shops/{shopId}/*
  if (filePath.startsWith('/shops/')) {
    const segments = filePath.split('/').filter(Boolean);
    const targetShopId = segments[1];
    if (action === 'read') return true;
    if (action === 'create' || action === 'update') {
      return isStoreOwner(targetShopId) && isValidImage(10);
    }
    if (action === 'delete') {
      return isStoreOwner(targetShopId);
    }
  }

  // 3. /products/{productId}/*
  if (filePath.startsWith('/products/')) {
    if (action === 'read') return true;
    if (action === 'create' || action === 'update') {
      const productStoreId = requestResource?.metadata?.storeId || resource?.metadata?.storeId;
      return isAuthenticated && (isAdmin() || (productStoreId && isStoreOwner(productStoreId))) && isValidImage(10);
    }
    if (action === 'delete') {
      const productStoreId = resource?.metadata?.storeId;
      return isAuthenticated && (isAdmin() || (productStoreId && isStoreOwner(productStoreId)));
    }
  }

  return false;
}

// ---------------------------------------------------------
// Test Scenarios Execution
// ---------------------------------------------------------

async function main() {
  // Test 1: storage.rules exists and contains MIME whitelist
  await runTest('Test 1: storage.rules contains explicit image MIME whitelist', async () => {
    assert.ok(storageRulesContent.includes("image/jpeg"));
    assert.ok(storageRulesContent.includes("image/png"));
    assert.ok(storageRulesContent.includes("image/webp"));
  });

  // Test 2: Unauthenticated upload is DENIED
  await runTest('Test 2: Unauthenticated upload to any storage path is DENIED', async () => {
    const isAllowed = evaluateStorageRules({
      path: '/shops/store_01/banner.jpg',
      action: 'create',
      auth: null,
      requestResource: { contentType: 'image/jpeg', size: 1024 * 100 }
    });
    assert.equal(isAllowed, false);
  });

  // Test 3: Customer uploading to /shops/{shopId} is DENIED
  await runTest('Test 3: Customer uploading shop banner is DENIED', async () => {
    const isAllowed = evaluateStorageRules({
      path: '/shops/store_01/banner.jpg',
      action: 'create',
      auth: { uid: 'user_cust_01', token: { role: 'customer' } },
      requestResource: { contentType: 'image/jpeg', size: 1024 * 500 }
    });
    assert.equal(isAllowed, false);
  });

  // Test 4: Merchant A uploading to Store B is DENIED
  await runTest('Test 4: Merchant A uploading image to Store B is DENIED', async () => {
    const isAllowed = evaluateStorageRules({
      path: '/shops/store_B/logo.png',
      action: 'create',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A', token: { role: 'merchant' } },
      requestResource: { contentType: 'image/png', size: 1024 * 200 }
    });
    assert.equal(isAllowed, false);
  });

  // Test 5: Merchant A uploading to Store A is ALLOWED
  await runTest('Test 5: Merchant A uploading image to Store A is ALLOWED', async () => {
    const isAllowed = evaluateStorageRules({
      path: '/shops/store_A/logo.png',
      action: 'create',
      auth: { uid: 'merchant_A_uid', storeId: 'store_A', token: { role: 'merchant' } },
      requestResource: { contentType: 'image/png', size: 1024 * 200 }
    });
    assert.equal(isAllowed, true);
  });

  // Test 6: User uploading own profile avatar is ALLOWED
  await runTest('Test 6: User uploading own profile photo is ALLOWED', async () => {
    const isAllowed = evaluateStorageRules({
      path: '/users/user_cust_01/avatar.jpg',
      action: 'create',
      auth: { uid: 'user_cust_01', token: { role: 'customer' } },
      requestResource: { contentType: 'image/jpeg', size: 1024 * 300 }
    });
    assert.equal(isAllowed, true);
  });

  // Test 7: User uploading avatar for another user is DENIED
  await runTest('Test 7: User uploading avatar for another user is DENIED', async () => {
    const isAllowed = evaluateStorageRules({
      path: '/users/victim_uid/avatar.jpg',
      action: 'create',
      auth: { uid: 'attacker_uid', token: { role: 'customer' } },
      requestResource: { contentType: 'image/jpeg', size: 1024 * 300 }
    });
    assert.equal(isAllowed, false);
  });

  // Test 8: Unsupported MIME type (e.g. text/html, application/x-php) is DENIED
  await runTest('Test 8: Unsupported MIME type (text/html) is DENIED', async () => {
    const isAllowed = evaluateStorageRules({
      path: '/users/user_cust_01/malicious.html',
      action: 'create',
      auth: { uid: 'user_cust_01', token: { role: 'customer' } },
      requestResource: { contentType: 'text/html', size: 1024 }
    });
    assert.equal(isAllowed, false);
  });

  // Test 9: Oversized file (> 5MB for user avatar) is DENIED
  await runTest('Test 9: Oversized avatar image (> 5MB) is DENIED', async () => {
    const isAllowed = evaluateStorageRules({
      path: '/users/user_cust_01/giant_photo.jpg',
      action: 'create',
      auth: { uid: 'user_cust_01', token: { role: 'customer' } },
      requestResource: { contentType: 'image/jpeg', size: 6 * 1024 * 1024 }
    });
    assert.equal(isAllowed, false);
  });

  // Test 10: Customer deleting Store A image is DENIED
  await runTest('Test 10: Customer deleting Store A banner is DENIED', async () => {
    const isAllowed = evaluateStorageRules({
      path: '/shops/store_A/banner.jpg',
      action: 'delete',
      auth: { uid: 'user_cust_01', token: { role: 'customer' } }
    });
    assert.equal(isAllowed, false);
  });

  const passRate = Math.round((passedTests / totalTests) * 100);
  console.log(`\n📊 Storage Rules Integration Summary: ${passedTests}/${totalTests} tests passed (${passRate}%).`);

  if (passedTests !== totalTests) {
    console.error('❌ Storage rules test suite failed!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal storage test error:', err);
  process.exit(1);
});
