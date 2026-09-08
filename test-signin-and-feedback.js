/**
 * ============================================================================
 * SIGN-IN, ROLE AND FEEDBACK TEST SUITE
 * ============================================================================
 *
 * Four failures visible on one screenshot of the product page, or caused by the
 * code behind it.
 *
 *  1. "Missing or insufficient permissions" on every returning Google sign-in.
 *     The rules let a profile's owner change thirteen keys — deliberately, since
 *     the excluded ones decide what a user can reach — and the sign-in path wrote
 *     roles, activeRole, isSuperAdmin, isMerchantVerified, isMerchantRegistered,
 *     storeId and email back on every visit. Refused every time, lastLoginAt
 *     never moved, and the user was shown an error for logging in again.
 *
 *  2. The required-option warning appeared only as a toast in the far corner
 *     while the groups it named sat at the top of a long form: what was wrong,
 *     without where.
 *
 *  3. localStorage["queueup_merchant_verified"] === "true" granted merchant
 *     status and dispatched a role switch. Nothing in the app ever wrote that
 *     key — it was a back door and nothing else.
 *
 *  4. A refused order-status write was logged to the console and no further. The
 *     kitchen board is driven by onSnapshot, so the card simply did not move and
 *     the student was never told their food was ready.
 *
 * The rules half of (1) is exercised against the real engine in
 * test-firestore-rules-emulator.js.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(ROOT + f, 'utf8');

const login = read('src/pages/Login.jsx');
const rules = read('firestore.rules');
const productDetail = read('src/pages/ProductDetail.jsx');
const searchBar = read('src/components/ShopeeSearchBar.jsx');
const merchant = read('src/pages/MerchantDashboard.jsx');

/**
 * Source with comments stripped. These assertions are about what the code does,
 * not what it says about itself — a comment explaining a removed back door must
 * not read as the back door still being there.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** The Google sign-in handler, where the profile write lives. */
const googleHandler = login.slice(
  login.indexOf('const userDocRef = doc(db, "users", gUser.uid)'),
  login.indexOf('return (\n    <div className="yeti-login-page"')
);

/**
 * The payload written on a return visit.
 *
 * Bounded from displayFields to the `if (userSnap.exists())` that FOLLOWS it —
 * an earlier one reads the document at the top of the handler, and searching from
 * the start finds that one and slices backwards into nothing.
 */
const displayFieldsStart = googleHandler.indexOf('const displayFields = {');
const returningPayload = googleHandler.slice(
  displayFieldsStart,
  googleHandler.indexOf('if (userSnap.exists())', displayFieldsStart)
);

/** The keys an owner may change on their own profile. */
function allowedUpdateKeys() {
  const block = rules.slice(rules.indexOf('match /users/{userId}'));
  const list = block.slice(block.indexOf('affectedKeys().hasOnly(['));
  return (list.slice(0, list.indexOf(']')).match(/'([\w]+)'/g) || []).map((s) => s.replace(/'/g, ''));
}

console.log('\n🔐 SIGN-IN, ROLE AND FEEDBACK TEST SUITE\n');

// ===========================================================================
console.log('1. A returning Google sign-in writes only what it is allowed to');
// ===========================================================================

const PRIVILEGE_KEYS = ['roles', 'activeRole', 'isSuperAdmin', 'isMerchantVerified', 'isMerchantRegistered', 'storeId', 'email', 'role', 'admin'];

runTest('🚨 The returning-visit write carries no privilege field', () => {
  // This is the bug: every one of these is excluded from the allowed keys on
  // purpose, so writing them refused the whole update.
  assert(returningPayload.length > 0, 'the returning-visit payload must be locatable');
  for (const key of PRIVILEGE_KEYS) {
    assert(!new RegExp(`^\\s*${key}\\s*:`, 'm').test(returningPayload), `"${key}" must not be written on a return visit`);
  }
});

runTest('🚨 Every key it does write is on the rules\' allowed list', () => {
  // The check that ties the two halves together: the client and the rules used to
  // disagree, and nothing failed until a real user logged in twice.
  const allowed = new Set(allowedUpdateKeys());
  const written = (returningPayload.match(/^\s*(\w+):/gm) || []).map((s) => s.trim().replace(':', ''));
  assert(written.length >= 5, `expected the display fields, found ${written.length}`);
  for (const key of written) {
    assert(allowed.has(key), `"${key}" is written but the rules do not allow an owner to change it`);
  }
});

runTest('🚨 lastLoginAt is allowed by the rules', () => {
  // Leaving it out is what refused the write; it is a timestamp about the user's
  // own session and carries no privilege.
  assert(allowedUpdateKeys().includes('lastLoginAt'), 'lastLoginAt must be an allowed key');
});

runTest('🚨 The rules still refuse every privilege field', () => {
  const allowed = new Set(allowedUpdateKeys());
  for (const key of ['roles', 'role', 'admin', 'isSuperAdmin', 'isMerchantVerified', 'isMerchantRegistered', 'storeId', 'email']) {
    assert(!allowed.has(key), `"${key}" must never be owner-writable`);
  }
});

runTest('A first sign-in still creates the profile', () => {
  assert(googleHandler.includes('userSnap.exists()'), 'create and update must be told apart');
  const create = googleHandler.slice(googleHandler.indexOf('} else {'));
  assert(/roles:\s*\["customer"\]/.test(create), 'a self-created profile is capped at customer');
  assert(/activeRole:\s*"customer"/.test(create), 'and so is the active role');
});

runTest('Privilege still reaches Redux, derived rather than written', () => {
  // An admin signing in for the first time must still get their claims even
  // though the stored document says "customer".
  const dispatch = googleHandler.slice(googleHandler.indexOf('dispatch(setUser('));
  assert(dispatch.includes('roles: userRoles'), 'the derived roles must reach the store');
  assert(dispatch.includes('isSuperAdmin: isAdminAccount'), 'and so must admin status');
});

runTest('🚨 A failed profile sync no longer strands a signed-in user', () => {
  const cat = googleHandler.slice(googleHandler.indexOf('} catch (err) {'));
  assert(cat.includes('navigate('), 'the session is valid, so the user must still get in');
  assert(!/toast\.error/.test(cat), 'a working session is not an error');
  assert(/toast\.warning/.test(cat), 'but it is worth a warning');
});

// ===========================================================================
console.log('\n2. The validation message points at the field');
// ===========================================================================

runTest('🚨 Unanswered required groups are marked on the form', () => {
  assert(productDetail.includes('missingModifierIds'), 'the page must track which groups are missing');
  assert(productDetail.includes('queue-pd-mod-group-missing'), 'and mark them');
  assert(productDetail.includes('queue-pd-mod-required-msg'), 'with a message at the field');
});

runTest('The message is announced, not only coloured', () => {
  const block = productDetail.slice(productDetail.indexOf('queue-pd-mod-required-msg') - 200, productDetail.indexOf('queue-pd-mod-required-msg') + 100);
  assert(block.includes('role="alert"'), 'a screen reader must hear it too');
});

runTest('🚨 The page scrolls to the first unanswered group', () => {
  // A call, not a mention: the `typeof el.scrollIntoView === "function"` guard
  // contains the word too, so `includes` passed with the call deleted.
  assert(/\.scrollIntoView\(/.test(productDetail), 'naming a field off-screen does not help');
  assert(productDetail.includes('id={`mod-group-${grp.id}`}'), 'the groups need addressable ids');
});

runTest('Answering a group clears its own marker', () => {
  assert(productDetail.includes('clearMissingFlag'), 'the mark must not outlive the problem');
  const single = productDetail.indexOf('clearMissingFlag(grp.id);');
  assert(single !== -1, 'a single-choice answer must clear it');
  assert(productDetail.includes('if (nextChecked) clearMissingFlag(grp.id);'), 'and so must a multi-choice one');
});

runTest('Both entry points flag and announce', () => {
  // "Add to cart" and "Order now" both validate; only flagging on one of them
  // leaves the other exactly as it was.
  // The declaration reads `= (missing) =>`, so only the call sites match here.
  const flags = (productDetail.match(/flagMissingRequiredModifiers\(/g) || []).length;
  assert(flags >= 2, `expected both call sites to flag, found ${flags}`);
});

// ===========================================================================
console.log('\n3. A role never comes from localStorage');
// ===========================================================================

runTest('🚨 The merchant back door is gone', () => {
  assert(
    !stripComments(searchBar).includes('queueup_merchant_verified'),
    'a key nothing writes, that grants a role, is a back door and nothing else'
  );
});

runTest('🚨 No role decision anywhere reads localStorage', () => {
  // The repository's own rule: roles come from custom claims, never localStorage.
  const roleFiles = ['src/components/ShopeeSearchBar.jsx', 'src/utils/authRoles.js', 'src/components/ProtectedRoute.jsx', 'src/context/AuthContext.jsx'];
  for (const f of roleFiles) {
    const src = read(f);
    for (const m of src.matchAll(/localStorage\.getItem\(\s*["']([\w_]+)["']/g)) {
      assert(
        !/role|merchant|admin|verified|staff|guardian/i.test(m[1]),
        `${f} reads "${m[1]}" from localStorage in a role-bearing path`
      );
    }
  }
});

runTest('Merchant status is read from the verified profile instead', () => {
  const block = searchBar.slice(searchBar.indexOf('let isRegistered = false;'), searchBar.indexOf('if (isRegistered) {'));
  assert(block.includes("getDoc(doc(db, \"users\", user.uid))"), 'it must consult the stored profile');
  assert(block.includes('toast.error'), 'and say so when that check itself fails');
});

// ===========================================================================
console.log('\n4. The kitchen is told when an update does not land');
// ===========================================================================

runTest('🚨 A refused order-status write is shown to the merchant', () => {
  const handler = merchant.slice(merchant.indexOf('const handleUpdateOrderStatus'));
  const body = handler.slice(0, handler.indexOf('\n  };'));
  assert(body.includes('updateDoc'), 'the handler must be the one that writes');
  const cat = body.slice(body.indexOf('} catch'));
  assert(cat.includes('toast.error'), 'a console.error is not feedback to a cook');
});

runTest('The message says the customer was not notified', () => {
  const handler = merchant.slice(merchant.indexOf('const handleUpdateOrderStatus'));
  assert(
    handler.includes('ลูกค้ายังไม่ได้รับการแจ้งเตือน'),
    'the consequence is what the kitchen needs to know, not the stack trace'
  );
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
