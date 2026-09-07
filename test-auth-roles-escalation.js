/**
 * ============================================================================
 * PRIVILEGE ESCALATION TEST SUITE (utils/authRoles.js)
 * ============================================================================
 *
 * A user creates their own `users/{uid}` document, so every field in it is
 * attacker-controlled on first write. These tests pin down the rule that
 * privileged roles (admin, staff_supervisor) are honoured ONLY from verified
 * Firebase ID token custom claims or the super-admin email — never from the
 * profile document.
 *
 * firestore.rules blocks role/admin/isSuperAdmin at profile creation; this is the
 * second layer, so a gap in the rules cannot by itself unlock the admin UI.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  getEffectiveRoles,
  canAccessRole,
  isUserSuperAdmin,
  isUserMerchant,
  SUPER_ADMIN_EMAIL,
} from './src/utils/authRoles.js';

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

/** A signed-in session whose profile doc fields are supplied by the attacker. */
function session(profileFields = {}, claims = {}) {
  return {
    uid: 'user_mallory',
    email: 'mallory@example.com',
    isVerifiedAuth: true,
    isFromCache: false,
    isTokenVerified: true,
    tokenClaims: claims,
    ...profileFields,
  };
}

console.log('\n🛡️  PRIVILEGE ESCALATION TEST SUITE (authRoles)\n');

// ===========================================================================
console.log('1. Profile document must NOT be able to grant privileged roles');
// ===========================================================================

runTest("role:'admin' in profile doc does NOT grant admin", () => {
  const u = session({ role: 'admin' });
  assert(!getEffectiveRoles(u).includes('admin'), 'doc role must not grant admin');
  assert(!canAccessRole(u, 'admin'), 'canAccessRole must deny');
  assert(!isUserSuperAdmin(u), 'isUserSuperAdmin must deny');
});

runTest('admin:true in profile doc does NOT grant admin', () => {
  const u = session({ admin: true });
  assert(!getEffectiveRoles(u).includes('admin'), 'doc admin flag must not grant admin');
  assert(!isUserSuperAdmin(u), 'isUserSuperAdmin must deny');
});

runTest('isSuperAdmin:true in profile doc does NOT grant admin', () => {
  const u = session({ isSuperAdmin: true });
  assert(!getEffectiveRoles(u).includes('admin'), 'doc isSuperAdmin must not grant admin');
  assert(!isUserSuperAdmin(u), 'isUserSuperAdmin must deny');
});

runTest("roles:['admin'] array in profile doc does NOT grant admin", () => {
  const u = session({ roles: ['admin'] });
  assert(!getEffectiveRoles(u).includes('admin'), 'doc roles array must not grant admin');
});

runTest("role:'staff_supervisor' in profile doc does NOT grant staff access", () => {
  const u = session({ role: 'staff_supervisor' });
  assert(!getEffectiveRoles(u).includes('staff_supervisor'), 'doc role must not grant staff');
  assert(!canAccessRole(u, 'staff_supervisor'), 'canAccessRole must deny staff');
});

runTest("roles:['staff_supervisor'] array does NOT grant staff access", () => {
  const u = session({ roles: ['staff_supervisor', 'customer'] });
  assert(!getEffectiveRoles(u).includes('staff_supervisor'), 'doc roles must not grant staff');
});

runTest('Combined escalation payload grants nothing privileged', () => {
  // Everything an attacker might stuff into their first profile write at once.
  const u = session({
    role: 'admin',
    admin: true,
    isSuperAdmin: true,
    roles: ['admin', 'staff_supervisor'],
    activeRole: 'admin',
    isMerchantVerified: true,
  });
  const roles = getEffectiveRoles(u);
  assert(!roles.includes('admin'), 'must not grant admin');
  assert(!roles.includes('staff_supervisor'), 'must not grant staff_supervisor');
  assert(!isUserSuperAdmin(u), 'must not be super admin');
});

// ===========================================================================
console.log('\n2. Verified token claims DO grant privileged roles');
// ===========================================================================

runTest('Custom claim admin:true grants admin', () => {
  const u = session({}, { admin: true });
  assert(getEffectiveRoles(u).includes('admin'), 'claim must grant admin');
  assert(isUserSuperAdmin(u), 'claim must make super admin');
});

runTest("Custom claim role:'admin' grants admin", () => {
  const u = session({}, { role: 'admin' });
  assert(canAccessRole(u, 'admin'), 'claim must grant admin');
});

runTest("Custom claim role:'staff_supervisor' grants staff access", () => {
  const u = session({}, { role: 'staff_supervisor' });
  assert(canAccessRole(u, 'staff_supervisor'), 'claim must grant staff');
  assert(!canAccessRole(u, 'admin'), 'staff claim must not grant admin');
});

runTest('Super-admin email grants admin', () => {
  const u = { ...session(), email: SUPER_ADMIN_EMAIL };
  assert(isUserSuperAdmin(u), 'super admin email must be honoured');
  assert(canAccessRole(u, 'admin'), 'super admin email must grant admin');
});

// ===========================================================================
console.log('\n3. Non-privileged roles still work as before');
// ===========================================================================

runTest("Non-privileged doc role ('student_vendor') is still honoured", () => {
  const u = session({ role: 'student_vendor' });
  assert(getEffectiveRoles(u).includes('student_vendor'), 'student_vendor must survive');
});

runTest('Merchant via isMerchantVerified still works', () => {
  const u = session({ isMerchantVerified: true });
  assert(isUserMerchant(u), 'merchant must be granted');
});

runTest('Every session still carries the baseline customer role', () => {
  assert(getEffectiveRoles(session()).includes('customer'), 'customer baseline expected');
});

// ===========================================================================
console.log('\n4. Unverified / cached sessions stay unprivileged');
// ===========================================================================

runTest('Cached session cannot claim any role, even with valid claims', () => {
  const u = { ...session({}, { admin: true }), isFromCache: true };
  assert(JSON.stringify(getEffectiveRoles(u)) === JSON.stringify(['customer']), 'cache must be customer-only');
  assert(!isUserSuperAdmin(u), 'cached session must never be super admin');
});

runTest('Unverified session cannot claim any role', () => {
  const u = { ...session({}, { admin: true }), isVerifiedAuth: false };
  assert(!getEffectiveRoles(u).includes('admin'), 'unverified must not be admin');
});

runTest('Null user resolves to guest', () => {
  assert(JSON.stringify(getEffectiveRoles(null)) === JSON.stringify(['guest']), 'expected guest');
});

// ===========================================================================
console.log('\n5. firestore.rules — the server-side half of the same guards');
// ===========================================================================

const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

/** Extracts one top-level `match /collection/{id}` block (4-space indented). */
function ruleBlock(header) {
  const start = rules.indexOf(header);
  assert(start !== -1, `${header} not found in firestore.rules`);
  const rest = rules.slice(start);
  const end = rest.indexOf('\n    match /', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Extracts a single `allow <action>:` statement out of a rule block. */
function allowStatement(block, action) {
  const start = block.indexOf(`allow ${action}:`);
  assert(start !== -1, `allow ${action} not found`);
  const rest = block.slice(start);
  const next = rest.indexOf('allow ', 6);
  return next === -1 ? rest : rest.slice(0, next);
}

runTest("users create rule guards 'role' against self-assignment", () => {
  const create = allowStatement(ruleBlock('match /users/{userId}'), 'create');
  assert(create.includes("'role' in request.resource.data"), 'create rule must guard role');
});

runTest("users create rule guards 'admin' against self-assignment", () => {
  const create = allowStatement(ruleBlock('match /users/{userId}'), 'create');
  assert(create.includes("'admin' in request.resource.data"), 'create rule must guard admin');
});

runTest('users update rule still restricts writes to safe profile keys', () => {
  const update = allowStatement(ruleBlock('match /users/{userId}'), 'update');
  assert(update.includes('hasOnly'), 'update must remain restricted to a key allowlist');
  assert(!update.includes("'role'"), 'update allowlist must not include role');
});

runTest('students read does NOT grant staff a direct (unaudited) read', () => {
  const read = allowStatement(ruleBlock('match /students/{studentId}'), 'read');
  assert(
    !read.includes('isStaffSupervisor()'),
    'staff must reach medical data only via the audited emergencyMedicalLookup function'
  );
});

runTest('students read still serves the student and their guardians', () => {
  const read = allowStatement(ruleBlock('match /students/{studentId}'), 'read');
  assert(read.includes('isOwner(studentId)'), 'student must still read their own record');
  assert(read.includes('guardianIds'), 'guardians must still read their child record');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
