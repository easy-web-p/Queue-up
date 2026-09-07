/**
 * ============================================================================
 * GUARDIAN LINK REVIEW TEST SUITE
 * ============================================================================
 *
 * The school's half of guardian verification. Until this existed, a guardian could
 * request a link and nothing could confirm one, so no guardian ever passed the check
 * that gates wallet top-ups, spending limits, order history and allergy data.
 *
 * What matters here is that approval is the moment access is granted, and that the
 * grant can be taken back. A link that reads VERIFIED while granting nothing — or one
 * that is deleted while the access it granted stays behind — is the failure mode.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { resolveLinkDecision, LINK_DECISIONS } from './functions/linkReview.js';

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

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}\n       expected: ${e}\n       actual:   ${a}`);
}

console.log('\n👪 GUARDIAN LINK REVIEW TEST SUITE\n');

// ===========================================================================
console.log('1. Approving a request grants access');
// ===========================================================================

runTest('PENDING → VERIFIED grants access', () => {
  assertEqual(
    resolveLinkDecision('PENDING', 'VERIFIED'),
    { ok: true, nextStatus: 'VERIFIED', grantsAccess: true, revokesAccess: false },
    'approval must grant access'
  );
});

runTest('PENDING → REJECTED grants nothing', () => {
  const r = resolveLinkDecision('PENDING', 'REJECTED');
  assert(r.ok && r.nextStatus === 'REJECTED', 'rejection must settle the link');
  assert(!r.grantsAccess && !r.revokesAccess, 'rejection touches no access');
});

runTest('A link with no status is treated as PENDING', () => {
  assert(resolveLinkDecision(undefined, 'VERIFIED').ok, 'missing status defaults to PENDING');
});

// ===========================================================================
console.log('\n2. A decision is made once');
// ===========================================================================

runTest('🚨 An already VERIFIED link cannot be re-approved', () => {
  // Re-approving would re-run the grant and log a second approval for one request.
  assertEqual(
    resolveLinkDecision('VERIFIED', 'VERIFIED'),
    { ok: false, reason: 'LINK_ALREADY_REVIEWED' },
    'a settled link must not be re-decided'
  );
});

runTest('🚨 A REJECTED link cannot be quietly flipped to VERIFIED', () => {
  assertEqual(
    resolveLinkDecision('REJECTED', 'VERIFIED'),
    { ok: false, reason: 'LINK_ALREADY_REVIEWED' },
    'a rejected link must stay rejected'
  );
});

runTest('A VERIFIED link cannot be rejected — it must be revoked', () => {
  // Rejection does not withdraw guardianIds; only revocation does. Allowing this
  // would mark the link rejected while leaving the access in place.
  assertEqual(
    resolveLinkDecision('VERIFIED', 'REJECTED'),
    { ok: false, reason: 'LINK_ALREADY_REVIEWED' },
    'rejecting a granted link must be refused'
  );
});

// ===========================================================================
console.log('\n3. Revocation withdraws what approval granted');
// ===========================================================================

runTest('🚨 VERIFIED → REVOKED withdraws access', () => {
  assertEqual(
    resolveLinkDecision('VERIFIED', 'REVOKED'),
    { ok: true, nextStatus: 'REJECTED', grantsAccess: false, revokesAccess: true },
    'revocation must withdraw access'
  );
});

runTest('A PENDING link cannot be revoked — there is nothing to revoke', () => {
  assertEqual(
    resolveLinkDecision('PENDING', 'REVOKED'),
    { ok: false, reason: 'REVOKE_REQUIRES_VERIFIED' },
    'revocation needs a prior grant'
  );
});

runTest('An already revoked link cannot be revoked again', () => {
  assert(!resolveLinkDecision('REJECTED', 'REVOKED').ok, 'nothing left to revoke');
});

// ===========================================================================
console.log('\n4. Input validation');
// ===========================================================================

runTest('An unknown decision is refused', () => {
  for (const bad of ['APPROVED', 'verified', '', null, undefined, 'DELETE']) {
    assertEqual(
      resolveLinkDecision('PENDING', bad),
      { ok: false, reason: 'INVALID_DECISION' },
      `"${bad}" must be refused`
    );
  }
});

runTest('The accepted decisions are exactly VERIFIED, REJECTED and REVOKED', () => {
  assertEqual(LINK_DECISIONS, ['VERIFIED', 'REJECTED', 'REVOKED'], 'decision set');
});

// ===========================================================================
console.log('\n5. The Cloud Function acts on the decision');
// ===========================================================================

const fnSrc = fs.readFileSync(path.resolve(process.cwd(), 'functions/index.js'), 'utf8');
const linkFn = fnSrc.slice(fnSrc.indexOf('export const reviewParentChildLink'));

runTest('🚨 Only staff or admins may review a link', () => {
  assert(linkFn.includes('isStaffOrAdmin(db, request.auth)'), 'staff gate required');
  assert(linkFn.includes('LINK_REVIEW_FORBIDDEN'), 'refusal must be identifiable');
});

runTest('🚨 Approval writes guardianIds onto BOTH the student and the wallet', () => {
  // These are the fields firestore.rules reads to grant a guardian access. Nothing in
  // the system wrote them before, so a "verified" guardian could still see nothing.
  const grant = linkFn.slice(linkFn.indexOf('outcome.grantsAccess'), linkFn.indexOf('outcome.revokesAccess'));
  assert(grant.includes('arrayUnion(guardianId)'), 'guardianIds must be granted');
  assert(grant.includes("collection(\"students\")") || grant.includes('studentRef'), 'student doc');
  assert(grant.includes('walletRef'), 'wallet doc');
  assert((grant.match(/arrayUnion/g) || []).length >= 2, 'both documents must be written');
});

runTest('🚨 Revocation removes guardianIds, so it is not cosmetic', () => {
  const revoke = linkFn.slice(linkFn.indexOf('outcome.revokesAccess'));
  assert((revoke.match(/arrayRemove\(guardianId\)/g) || []).length >= 2, 'both documents must be cleared');
});

runTest('Every decision is written to the audit log', () => {
  assert(linkFn.includes('PARENT_CHILD_LINK_${decision}'), 'decision must be audited');
  assert(linkFn.includes('audit_logs'), 'audit collection');
});

runTest('The status change and the access change are one atomic write', () => {
  // A link marked VERIFIED without its guardianIds write would grant nothing.
  assert(linkFn.includes('db.runTransaction'), 'must be transactional');
  const txStart = linkFn.indexOf('db.runTransaction');
  const auditIdx = linkFn.indexOf('audit_logs');
  assert(auditIdx > txStart, 'the audit entry must be inside the transaction');
});

// ===========================================================================
console.log('\n6. firestore.rules keeps clients out of the decision');
// ===========================================================================

const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const linkBlock = (() => {
  const start = rules.indexOf('match /parent_child_links/{linkId}');
  const rest = rules.slice(start);
  const end = rest.indexOf('\n    match /', 1);
  return end === -1 ? rest : rest.slice(0, end);
})();

runTest('🚨 No client may update a link directly', () => {
  const update = linkBlock.slice(linkBlock.indexOf('allow update:'));
  assert(/allow update:\s*if false;/.test(update), 'reviews must go through the function');
});

runTest('🚨 A VERIFIED link cannot be deleted by its guardian', () => {
  // Deleting it would not remove guardianIds, leaving the access standing.
  const del = linkBlock.slice(linkBlock.indexOf('allow delete:'));
  assert(del.includes("resource.data.status == 'PENDING'"), 'only undecided requests may be withdrawn');
});

runTest('A guardian can still create a request for themselves only', () => {
  const create = linkBlock.slice(linkBlock.indexOf('allow create:'), linkBlock.indexOf('allow update:'));
  assert(create.includes('request.resource.data.guardianId == request.auth.uid'), 'no impersonation');
  assert(create.includes("status == 'PENDING'"), 'cannot self-verify at creation');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
