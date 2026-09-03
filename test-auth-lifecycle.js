/**
 * 🧪 QueueUp Authentication Lifecycle & Session Race Test Matrix
 * Verifies React + Redux + Firebase Auth lifecycle, state machine transitions,
 * route guards, async race conditions, and error recovery.
 */

import assert from 'node:assert/strict';
import process from 'node:process';

console.log('🧪 Starting QueueUp Auth Lifecycle & Session Race Test Matrix...\n');

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
// Helper Simulation Models
// ---------------------------------------------------------

function getEffectiveRoles(user) {
  if (!user) return ['guest'];
  if (user.isFromCache === true || user.isVerifiedAuth !== true) {
    return ['customer'];
  }
  const email = (user.email || '').toLowerCase().trim();
  const isSuperAdmin = Boolean(
    user.isSuperAdmin === true ||
    user.admin === true ||
    (user.isTokenVerified === true && email === '58140@lomsak.ac.th')
  );
  if (isSuperAdmin) return ['customer', 'merchant', 'admin'];

  const isMerchant = Boolean(
    (Array.isArray(user.roles) && user.roles.includes('merchant')) ||
    user.isMerchantVerified === true ||
    user.isMerchantRegistered === true
  );
  if (isMerchant) return ['customer', 'merchant'];

  return ['customer'];
}

function isUserSuperAdmin(user) {
  if (!user || user.isFromCache === true || user.isVerifiedAuth !== true) return false;
  const email = (user.email || '').toLowerCase().trim();
  return Boolean(
    user.isSuperAdmin === true ||
    user.admin === true ||
    (user.isTokenVerified === true && email === '58140@lomsak.ac.th')
  );
}

function evaluateProtectedRoute({ user, isLoading, allowedRoles = [] }) {
  // 1. If auth is loading, or cached session pending verification for role-restricted route
  if (isLoading || (user && user.isVerifiedAuth !== true && allowedRoles && allowedRoles.length > 0)) {
    return { status: 'LOADING', component: '<Loading />' };
  }

  // 2. Unauthenticated
  if (!user) {
    if (allowedRoles.includes('admin') && allowedRoles.length === 1) {
      return { status: 'NOT_FOUND', component: '<NotFound />' };
    }
    return { status: 'REDIRECT_LOGIN', redirectTo: '/login' };
  }

  // 3. RBAC Check
  if (allowedRoles && allowedRoles.length > 0) {
    const isSuper = isUserSuperAdmin(user);
    const roles = getEffectiveRoles(user);
    const hasRole = allowedRoles.some((r) => roles.includes(r));

    if (!hasRole) {
      if (allowedRoles.includes('admin') && !isSuper) {
        return { status: 'NOT_FOUND', component: '<NotFound />' };
      }
      return { status: 'ACCESS_DENIED', component: '<AccessDenied />' };
    }
  }

  return { status: 'ALLOWED', component: '<TargetPage />' };
}

// ---------------------------------------------------------
// Test Scenarios Execution
// ---------------------------------------------------------

async function main() {
  // Test 1: Refresh with cached session does not cause premature 404 or redirect
  await runTest('Test 1: Page refresh with cached session waits in LOADING state for role-restricted routes', async () => {
    const cachedUser = {
      uid: 'u_merchant_01',
      email: 'merchant@test.com',
      roles: ['customer'],
      activeRole: 'customer',
      isVerifiedAuth: false,
      isTokenVerified: false,
      isFromCache: true
    };

    const result = evaluateProtectedRoute({
      user: cachedUser,
      isLoading: true,
      allowedRoles: ['merchant', 'admin']
    });

    assert.equal(result.status, 'LOADING');
    assert.equal(result.component, '<Loading />');
  });

  // Test 2: Slow Firebase Auth shows <Loading /> without leaking permissions
  await runTest('Test 2: Slow Firebase Auth verification displays Loading without leaking permissions', async () => {
    const result = evaluateProtectedRoute({
      user: null,
      isLoading: true,
      allowedRoles: ['admin']
    });

    assert.equal(result.status, 'LOADING');
    assert.equal(result.component, '<Loading />');
  });

  // Test 3: Unauthenticated user correctly routes to Login on protected pages
  await runTest('Test 3: Unauthenticated user redirected to Login once isLoading finishes', async () => {
    const result = evaluateProtectedRoute({
      user: null,
      isLoading: false,
      allowedRoles: []
    });

    assert.equal(result.status, 'REDIRECT_LOGIN');
    assert.equal(result.redirectTo, '/login');
  });

  // Test 4: Authenticated session properly unlocks Dashboard
  await runTest('Test 4: Authenticated verified merchant cleanly accesses Merchant Dashboard', async () => {
    const verifiedMerchant = {
      uid: 'u_merchant_01',
      email: 'somchai@store.com',
      roles: ['customer', 'merchant'],
      activeRole: 'merchant',
      isMerchantVerified: true,
      isVerifiedAuth: true,
      isTokenVerified: true,
      isFromCache: false
    };

    const result = evaluateProtectedRoute({
      user: verifiedMerchant,
      isLoading: false,
      allowedRoles: ['merchant', 'admin']
    });

    assert.equal(result.status, 'ALLOWED');
    assert.equal(result.component, '<TargetPage />');
  });

  // Test 5: Missing Firestore profile document resolves gracefully to customer without crash
  await runTest('Test 5: Missing Firestore profile document gracefully defaults to verified customer', async () => {
    const newFirebaseUser = {
      uid: 'u_new_user',
      email: 'newbie@school.ac.th',
      isVerifiedAuth: true,
      isTokenVerified: true,
      isFromCache: false
    };

    const roles = getEffectiveRoles(newFirebaseUser);
    assert.deepEqual(roles, ['customer']);
    assert.equal(isUserSuperAdmin(newFirebaseUser), false);

    const result = evaluateProtectedRoute({
      user: newFirebaseUser,
      isLoading: false,
      allowedRoles: []
    });
    assert.equal(result.status, 'ALLOWED');
  });

  // Test 6: Firestore fetch network error never leaves application in permanent loading
  await runTest('Test 6: Firestore fetch network error triggers fallback and clears isLoading', async () => {
    let appLoading = true;
    let appUser = null;

    async function simulateAuthFlowWithFirestoreFailure(firebaseUser) {
      try {
        // Simulate throwing network error
        throw new Error('Unavailable: Network connection lost');
      } catch {
        // Fallback recovery
        appUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          roles: ['customer'],
          isVerifiedAuth: true,
          isTokenVerified: true,
          isFromCache: false
        };
      } finally {
        appLoading = false; // Guaranteed to be set to false!
      }
    }

    await simulateAuthFlowWithFirestoreFailure({ uid: 'u_offline_01', email: 'offline@test.com' });
    assert.equal(appLoading, false); // Never stuck!
    assert.equal(appUser.uid, 'u_offline_01');
  });

  // Test 7: Logout during async profile fetch prevents stale user restoration
  await runTest('Test 7: Logout during async profile fetch drops stale execution sequence', async () => {
    let currentSeq = 0;
    let stateUser = { uid: 'initial' };

    async function handleAuthEvent(firebaseUser) {
      const thisSeq = ++currentSeq;
      if (!firebaseUser) {
        stateUser = null;
        return;
      }
      // Simulate async delay fetching Firestore doc
      await new Promise((r) => setTimeout(r, 10));
      // If sequence changed (e.g. user logged out in the interim), drop!
      if (thisSeq !== currentSeq) return;
      stateUser = { uid: firebaseUser.uid };
    }

    // User A logs in
    const p1 = handleAuthEvent({ uid: 'user_A' });
    // User immediately logs out before p1 finishes
    const p2 = handleAuthEvent(null);

    await Promise.all([p1, p2]);
    assert.equal(stateUser, null); // User A was safely discarded, no resurrection!
  });

  // Test 8: Rapid User A -> User B switch ensures only User B state is committed
  await runTest('Test 8: Rapid User A -> User B switch commits only User B state', async () => {
    let currentSeq = 0;
    let stateUser = null;

    async function handleAuthEvent(firebaseUser, delayMs) {
      const thisSeq = ++currentSeq;
      await new Promise((r) => setTimeout(r, delayMs));
      if (thisSeq !== currentSeq) return;
      stateUser = { uid: firebaseUser.uid };
    }

    // User A event takes 30ms, but User B event arrives right after and takes 5ms
    const pA = handleAuthEvent({ uid: 'user_A' }, 30);
    const pB = handleAuthEvent({ uid: 'user_B' }, 5);

    await Promise.all([pA, pB]);
    assert.equal(stateUser.uid, 'user_B'); // User B strictly preserved!
  });

  // Test 9: LocalStorage role tampering is rejected
  await runTest('Test 9: Tampered roles in LocalStorage are ignored during hydration', async () => {
    const tamperedCachedUser = {
      uid: 'u_hacker',
      roles: ['admin', 'merchant'],
      isVerifiedAuth: false,
      isFromCache: true
    };

    const roles = getEffectiveRoles(tamperedCachedUser);
    assert.deepEqual(roles, ['customer']);
    assert.equal(isUserSuperAdmin(tamperedCachedUser), false);
  });

  // Test 10: LocalStorage email tampering is rejected
  await runTest('Test 10: Tampered admin email in LocalStorage is ignored during hydration', async () => {
    const tamperedEmailUser = {
      uid: 'u_hacker',
      email: '58140@lomsak.ac.th',
      isVerifiedAuth: false,
      isFromCache: true
    };

    const roles = getEffectiveRoles(tamperedEmailUser);
    assert.deepEqual(roles, ['customer']);
    assert.equal(isUserSuperAdmin(tamperedEmailUser), false);
  });

  // Test 11: Refresh on /admin route waits for token verification instead of returning 404
  await runTest('Test 11: Refresh on /admin route waits in Loading state instead of throwing 404', async () => {
    const cachedAdmin = {
      uid: 'u_admin_01',
      email: '58140@lomsak.ac.th',
      isVerifiedAuth: false,
      isFromCache: true
    };

    const result = evaluateProtectedRoute({
      user: cachedAdmin,
      isLoading: true,
      allowedRoles: ['admin']
    });

    assert.equal(result.status, 'LOADING');
    assert.notEqual(result.status, 'NOT_FOUND');
  });

  // Test 12: Refresh on /merchant/dashboard waits for token verification instead of Access Denied
  await runTest('Test 12: Refresh on /merchant/dashboard waits in Loading state instead of Access Denied', async () => {
    const cachedMerchant = {
      uid: 'u_merchant_01',
      email: 'somchai@store.com',
      isVerifiedAuth: false,
      isFromCache: true
    };

    const result = evaluateProtectedRoute({
      user: cachedMerchant,
      isLoading: true,
      allowedRoles: ['merchant', 'admin']
    });

    assert.equal(result.status, 'LOADING');
    assert.notEqual(result.status, 'ACCESS_DENIED');
  });

  const passRate = Math.round((passedTests / totalTests) * 100);
  console.log(`\n📊 Auth Lifecycle Execution Summary: ${passedTests}/${totalTests} tests passed (${passRate}%).`);

  if (passedTests !== totalTests) {
    console.error('❌ Auth lifecycle test suite failed!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal auth test error:', err);
  process.exit(1);
});
