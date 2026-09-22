/**
 * ============================================================================
 * WALLET TOP-UP CAPTURE TEST SUITE
 * ============================================================================
 *
 * topupCampusWallet writes a number into balanceSatang. Nothing behind it
 * captures a payment — there is no gateway, no slip check, no reconciliation.
 *
 * allowSelf:false kept the student out, which was the obvious hole. The one it
 * left open was a verified guardian crediting their own child up to ฿20,000 per
 * call, for free, repeatedly. That balance buys real food from stalls that
 * accrue real earnings, so the school would be settling with vendors against
 * money it never received.
 *
 * Staff top-ups still credit immediately — staff are the ones physically handed
 * the cash, so their call IS the capture. A guardian's call records a request
 * that staff confirm afterwards.
 */

import { readFileSync } from 'node:fs';

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

const assert = (c, m) => { if (!c) throw new Error(m); };

const src = readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8');
const live = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function fnBody(name) {
  const at = live.indexOf(`export const ${name}`);
  if (at < 0) throw new Error(`${name} does not exist`);
  const end = live.indexOf('\nexport const', at + 10);
  return live.slice(at, end < 0 ? undefined : end);
}

console.log('\n💰 A guardian can ask; only staff can grant');

runTest('🚨 A guardian top-up does not credit the balance', () => {
  const body = fnBody('topupCampusWallet');
  // Anchored on the whole statement, not just the comparison: a check for the
  // substring alone passes against `if (false && actorRole === "GUARDIAN")`,
  // which is a disabled branch and the original hole wide open again.
  const guardAt = body.indexOf('if (actorRole === "GUARDIAN") {');
  assert(
    guardAt > 0,
    'the guardian branch is missing or its condition has been weakened — guardians credit directly again'
  );

  // The guardian branch must return before reaching the transaction that writes
  // balanceSatang.
  const branch = body.slice(guardAt, body.indexOf('runTransaction', guardAt));
  assert(branch.includes('wallet_topup_requests'), 'the guardian path does not record a request');
  assert(branch.includes('"PENDING"'), 'the request is not created as PENDING');
  assert(branch.includes('return'), 'the guardian path falls through into the credit');
  assert(!branch.includes('balanceSatang'), 'the guardian path still touches the balance');
});

runTest('🚨 The guardian path reports that nothing was credited yet', () => {
  const body = fnBody('topupCampusWallet');
  assert(body.includes('pending: true'), 'the caller is not told the top-up is pending');
  assert(body.includes('pending: false'), 'the staff path does not distinguish itself');
});

runTest('Staff top-ups still credit immediately', () => {
  // Staff are handed the money, so their call is the capture. Removing this
  // would leave no way to add balance at all.
  const body = fnBody('topupCampusWallet');
  assert(body.includes('runTransaction'), 'the staff credit path is gone');
  assert(body.includes('balanceSatang: newBal'), 'the staff path no longer credits');
});

console.log('\n✅ Confirmation is staff-only and happens once');

runTest('🚨 Only staff may confirm a top-up', () => {
  const body = fnBody('reviewWalletTopupRequest');
  assert(body.includes('isStaffOrAdmin('), 'the confirmation is not gated on staff');
  // A guardian approving their own request would restore the whole hole.
  assert(
    !body.includes('resolveWalletAuthority') && !body.includes('assertWalletAuthority'),
    'the guardian authority path must not reach the confirmation'
  );
});

runTest('🚨 Confirming twice cannot credit twice', () => {
  // A double-click, a retry after a timeout, or two staff working the same
  // queue. The status check and the credit are in one transaction.
  const body = fnBody('reviewWalletTopupRequest');
  assert(body.includes('runTransaction'), 'the confirmation is not transactional');
  assert(body.includes('TOPUP_ALREADY_REVIEWED'), 'a reviewed request is not rejected');
  const statusAt = body.indexOf('topup.status !== "PENDING"');
  const creditAt = body.indexOf('balanceSatang: newBal');
  assert(statusAt > 0, 'the status is never checked');
  assert(statusAt < creditAt, 'the credit happens before the status is checked');
});

runTest('🚨 The wallet is read before it is written', () => {
  const body = fnBody('reviewWalletTopupRequest');
  const readAt = body.indexOf('tx.get(walletRef)');
  const firstWrite = Math.min(
    ...['tx.update(', 'tx.set('].map((t) => body.indexOf(t)).filter((i) => i > 0)
  );
  assert(readAt > 0, 'the wallet is never read');
  assert(readAt < firstWrite, 'the transaction writes before it reads — Firestore refuses this');
});

runTest('The amount is re-validated at confirmation, not trusted from the request', () => {
  const body = fnBody('reviewWalletTopupRequest');
  assert(body.includes('MAX_TOPUP_SATANG'), 'the stored amount is not re-bounded');
  assert(body.includes('Number.isInteger(amt)'), 'the stored amount is not re-validated');
});

runTest('A confirmed top-up leaves a transaction record and an audit entry', () => {
  const body = fnBody('reviewWalletTopupRequest');
  assert(body.includes('wallet_transactions'), 'no wallet transaction is recorded');
  assert(body.includes('WALLET_TOPUP_'), 'no audit entry is written');
  assert(body.includes('topupRequestId'), 'the credit cannot be traced back to the request');
});

runTest('A confirmed top-up also seeds limits, so the money is spendable', () => {
  // A wallet first created by a top-up would otherwise be credited and then
  // refuse every order — see the WALLET_LIMITS_NOT_CONFIGURED fix.
  const body = fnBody('reviewWalletTopupRequest');
  assert(body.includes('resolveMissingLimitDefaults'), 'a wallet born here would be unspendable');
});

console.log('\n🔒 The request collection is not client-writable');

runTest('🚨 Nobody can write a top-up request from a browser', () => {
  const rules = readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
  const at = rules.indexOf('match /wallet_topup_requests/');
  assert(at > 0, 'the collection has no rule');
  const end = rules.indexOf('\n    }', at);
  const block = rules.slice(at, end);
  assert(/allow write:\s*if false/.test(block), 'a client that can write a CONFIRMED row has no limit at all');
  assert(block.includes('allow read'), 'a guardian cannot see the status of their own request');
});

console.log('\n🖥️  The guardian is told what actually happened');

const dashboard = readFileSync(new URL('./src/pages/GuardianDashboard.tsx', import.meta.url), 'utf8');

runTest('🚨 A pending request is not reported as a completed top-up', () => {
  assert(dashboard.includes('result.pending'), 'the dashboard ignores the pending flag');
  const at = dashboard.indexOf('result.pending');
  const around = dashboard.slice(at, at + 700);
  assert(/ห้องธุรการ|ยืนยัน/.test(around), 'the parent is not told the money has not arrived yet');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
