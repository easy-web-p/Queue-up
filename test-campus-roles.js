/**
 * ============================================================================
 * CAMPUS ROLE GRANT TEST SUITE
 * ============================================================================
 *
 * Nothing in this project could appoint a staff supervisor. setCustomUserClaims
 * was called in exactly one place, granting student_vendor, while eight routes
 * and four Cloud Functions required staff_supervisor — so vendor approvals,
 * guardian-link approvals, the emergency lookup and the queue monitor were
 * unreachable by anyone, and the admin screen that appeared to manage staff was
 * three invented people in a useState array.
 *
 * These cover the decision rules behind the fix, and the two properties of
 * setCustomUserClaims that make it dangerous: it replaces rather than merges,
 * and a failure to call it must never be swallowed.
 */

import { readFileSync } from 'node:fs';
import {
  buildClaimPatch,
  canGrantRoles,
  validateGrantRequest,
  GRANTABLE_ROLES,
} from './functions/campusClaims.js';
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

const assert = (cond, m) => { if (!cond) throw new Error(m); };
const assertEqual = (a, e, m) => {
  if (a !== e) throw new Error(`${m}\n       expected: ${e}\n       actual:   ${a}`);
};

console.log('\n🎖️  Claim merging');

runTest('🚨 Granting a role preserves the claims the user already had', () => {
  // setCustomUserClaims REPLACES. Passing {role} alone erased everything else —
  // approving a shop for someone who also supervised the canteen silently
  // stripped their supervision.
  const existing = { role: 'staff_supervisor', staffSupervisor: true, someOtherClaim: 'keep me' };
  const next = buildClaimPatch(existing, 'student_vendor', true);
  assertEqual(next.someOtherClaim, 'keep me', 'unrelated claims must survive a grant');
});

runTest('🚨 A grant can never mint an admin', () => {
  // Admin is anchored to config/super-admins.js. If a grant could set it, one
  // compromised staff account would be enough to manufacture a second admin.
  for (const role of GRANTABLE_ROLES) {
    for (const enabled of [true, false]) {
      const next = buildClaimPatch({ admin: true }, role, enabled);
      assertEqual(next.admin, undefined, `${role}/${enabled} must not carry admin through`);
    }
  }
});

runTest('Granting staff_supervisor sets both claim shapes the rules accept', () => {
  const next = buildClaimPatch({}, 'staff_supervisor', true);
  assertEqual(next.role, 'staff_supervisor', 'role claim must be set');
  assertEqual(next.staffSupervisor, true, 'staffSupervisor flag must be set');
});

runTest('Revoking staff_supervisor clears both claim shapes', () => {
  // firestore.rules accepts EITHER role=='staff_supervisor' OR staffSupervisor==true.
  // Clearing one and not the other leaves the role fully intact.
  const next = buildClaimPatch({ role: 'staff_supervisor', staffSupervisor: true }, 'staff_supervisor', false);
  assertEqual(next.role, undefined, 'role claim must be cleared');
  assertEqual(next.staffSupervisor, undefined, 'staffSupervisor flag must be cleared');
});

runTest('🚨 Revoking a role the user does not hold leaves their real role alone', () => {
  // Otherwise "revoke merchant" becomes a way to strip supervision from someone.
  const supervisor = { role: 'staff_supervisor', staffSupervisor: true };
  const next = buildClaimPatch(supervisor, 'merchant', false);
  assertEqual(next.role, 'staff_supervisor', 'an unrelated revocation must not demote');
  assertEqual(next.staffSupervisor, true, 'an unrelated revocation must not clear the flag');
});

runTest('An ungrantable role is refused outright', () => {
  for (const bad of ['admin', 'superuser', '', null, 'customer']) {
    let threw = false;
    try { buildClaimPatch({}, bad, true); } catch { threw = true; }
    assert(threw, `${String(bad)} must not be grantable`);
  }
});

console.log('\n🔐 Who may grant');

runTest('🚨 A staff supervisor cannot appoint more staff supervisors', () => {
  // An escalation path with no ceiling. Grants are admin-only on purpose.
  const supervisor = { role: 'staff_supervisor', staffSupervisor: true, email: 'teacher@lomsak.ac.th' };
  assert(
    !canGrantRoles(supervisor, 'teacher@lomsak.ac.th', isBootstrapSuperAdmin),
    'a supervisor must not be able to grant roles'
  );
});

runTest('An admin claim grants the authority', () => {
  assert(canGrantRoles({ admin: true }, 'x@y.z', isBootstrapSuperAdmin), 'admin:true must suffice');
  assert(canGrantRoles({ role: 'admin' }, 'x@y.z', isBootstrapSuperAdmin), 'role:admin must suffice');
});

runTest('The bootstrap super admin grants the authority', () => {
  // Required, or the first admin could never appoint anyone.
  assert(canGrantRoles({}, '58140@lomsak.ac.th', isBootstrapSuperAdmin), 'bootstrap admin must be able to grant');
});

runTest('🚨 An ordinary signed-in user cannot grant anything', () => {
  for (const claims of [{}, { role: 'customer' }, { role: 'student_vendor' }, { admin: false }, { admin: 'true' }]) {
    assert(
      !canGrantRoles(claims, 'student@lomsak.ac.th', isBootstrapSuperAdmin),
      `${JSON.stringify(claims)} must not be able to grant`
    );
  }
});

console.log('\n📋 Request validation');

runTest('🚨 An admin cannot grant themselves a role', () => {
  const r = validateGrantRequest({ targetUid: 'admin1', role: 'staff_supervisor', enabled: true }, 'admin1');
  assert(!r.ok && r.reason === 'SELF_GRANT_FORBIDDEN', 'self-grant must be refused');
});

runTest('An admin may revoke a role from themselves', () => {
  const r = validateGrantRequest({ targetUid: 'admin1', role: 'staff_supervisor', enabled: false }, 'admin1');
  assert(r.ok, 'self-revocation is harmless and must be allowed');
});

runTest('Missing or malformed arguments are refused', () => {
  assert(!validateGrantRequest({ role: 'merchant', enabled: true }, 'a').ok, 'no target');
  assert(!validateGrantRequest({ targetUid: '  ', role: 'merchant', enabled: true }, 'a').ok, 'blank target');
  assert(!validateGrantRequest({ targetUid: 'b', role: 'admin', enabled: true }, 'a').ok, 'admin is not grantable');
  assert(!validateGrantRequest({ targetUid: 'b', role: 'merchant' }, 'a').ok, 'enabled is required');
  assert(!validateGrantRequest({ targetUid: 'b', role: 'merchant', enabled: 'yes' }, 'a').ok, 'enabled must be boolean');
  assert(validateGrantRequest({ targetUid: 'b', role: 'merchant', enabled: true }, 'a').ok, 'a valid request must pass');
});

console.log('\n🔧 Wired into the backend');

const src = readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8');
const live = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

runTest('🚨 setCampusStaffRole exists and is admin-gated', () => {
  assert(live.includes('export const setCampusStaffRole'), 'the appointment function is missing');
  const fn = live.slice(live.indexOf('export const setCampusStaffRole'));
  const body = fn.slice(0, fn.indexOf('\nexport const'));
  assert(body.includes('canGrantRoles('), 'the grant is not gated on canGrantRoles');
  assert(body.includes('validateGrantRequest('), 'the request is not validated');
  assert(body.includes('buildClaimPatch('), 'claims are not merged');
});

runTest('🚨 No setCustomUserClaims call bypasses the merge', () => {
  // The whole failure mode: a raw object literal replaces the claim set.
  const calls = live.match(/setCustomUserClaims\([\s\S]{0,400}?\n\s*\);/g) || [];
  assert(calls.length > 0, 'no claim writes found — has the API changed?');
  for (const call of calls) {
    // A merge either happens in the call, or in the variable the call passes.
    // What must never appear is a bare object literal as the second argument:
    // that is the shape that replaces the whole claim set.
    const secondArg = call.slice(call.indexOf(',') + 1);
    const literal = /^\s*\{/.test(secondArg);
    assert(
      !literal,
      `a claim write passes an object literal and so replaces every other claim:\n       ${call.split('\n')[0]}`
    );
    const mergedHere = call.includes('buildClaimPatch');
    const variable = (secondArg.match(/^\s*([A-Za-z_$][\w$]*)/) || [])[1];
    const mergedNearby =
      variable && new RegExp(`${variable}\\s*=\\s*buildClaimPatch\\(`).test(live);
    assert(
      mergedHere || mergedNearby,
      `a claim write does not trace to buildClaimPatch:\n       ${call.split('\n')[0]}`
    );
  }
});

runTest('🚨 A failed claim write is no longer swallowed', () => {
  // It used to be wrapped in try/catch with a console.warn, so an approval could
  // report success while the claim that authorizes it was never written.
  const fn = live.slice(live.indexOf('export const reviewVendorApprovalRequest'));
  const body = fn.slice(0, fn.indexOf('\nexport const'));
  const claimAt = body.indexOf('setCustomUserClaims');
  assert(claimAt > 0, 'the vendor approval no longer sets claims');
  const around = body.slice(Math.max(0, claimAt - 400), claimAt + 200);
  assert(
    !/catch\s*\([^)]*\)\s*\{[^}]*console\.(warn|log|error)[^}]*\}/.test(around),
    'the claim write is still wrapped in a warn-and-continue catch'
  );
});

runTest('🚨 The grant writes the Firestore fallback record too', () => {
  // The claim is what the rules read, but the user's token keeps the old claims
  // for up to an hour. The staff_supervisors doc is what the backend falls back
  // to in the meantime — writing one without the other leaves a half-role.
  const fn = live.slice(live.indexOf('export const setCampusStaffRole'));
  const body = fn.slice(0, fn.indexOf('\nexport const'));
  assert(body.includes("collection(\"staff_supervisors\")"), 'no staff_supervisors record is written');
  assert(body.includes('batch.delete(staffRef)'), 'revocation leaves the fallback record behind');
  assert(body.includes('requiresReauth'), 'the caller is not told the user must sign in again');
});

runTest('🚨 The grant is audit-logged', () => {
  const fn = live.slice(live.indexOf('export const setCampusStaffRole'));
  const body = fn.slice(0, fn.indexOf('\nexport const'));
  assert(body.includes('CAMPUS_ROLE_GRANTED'), 'grants are not logged');
  assert(body.includes('CAMPUS_ROLE_REVOKED'), 'revocations are not logged');
  assert(body.includes("collection(\"audit_logs\")"), 'no audit collection is written');
});

console.log('\n🖥️  The admin screen tells the truth');

const adminPageRaw = readFileSync(new URL('./src/pages/StoreAdminPage.tsx', import.meta.url), 'utf8');
// Comments explain the bugs that were removed and naturally quote them. Assert
// against the live code, or the explanation trips the check it belongs to.
const adminPage = adminPageRaw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const manager = readFileSync(new URL('./src/components/StaffRoleManager.tsx', import.meta.url), 'utf8');

runTest('🚨 The invented staff roster is gone', () => {
  for (const ghost of ['ป้าแดง ใจดี', 'นายสมชาย มีชัย', 'นางสาววิภา เรียนดี', '081-234-5678']) {
    assert(!adminPage.includes(ghost), `the fabricated roster entry ${ghost} is still seeded`);
  }
});

runTest('🚨 The roster is read from Firestore, not from a literal', () => {
  assert(adminPage.includes("collection(db, 'shops', targetStoreId, 'staff')"), 'the roster is never fetched');
});

runTest('🚨 Removing shop staff really removes their access', () => {
  // The delete used to filter the local array only. The shops/{id}/staff record
  // survived, and that record is what grants access to the shop's orders.
  assert(adminPage.includes('deleteDoc('), 'the delete never reaches Firestore');
  const at = adminPage.indexOf("deleteDoc(doc(db, 'shops'");
  assert(at > 0, 'the shops/ mirror is not deleted');
  assert(adminPage.includes("deleteDoc(doc(db, 'merchantProfiles'"), 'the merchantProfiles mirror is not deleted');
});

runTest('🚨 New staff ids cannot collide with an existing record', () => {
  // `ST-${staffList.length + 1}` reused an id after any deletion, and set(merge)
  // then overwrote whoever already held it.
  assert(!adminPage.includes('staffList.length + 1'), 'the colliding id scheme is back');
});

runTest('The manager distinguishes loading, empty and failed', () => {
  for (const marker of ['ErrorState', 'EmptyState', 'Skeleton']) {
    assert(manager.includes(marker), `${marker} is not used — a failed read would look empty`);
  }
});

runTest('The manager warns that the role needs a fresh sign-in', () => {
  assert(/ออกจากระบบและเข้าใหม่/.test(manager), 'administrators are not told about token refresh');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
