/**
 * ============================================================================
 * CAMPUS WALLET SPENDING LIMIT TEST SUITE
 * ============================================================================
 *
 * Covers the daily/weekly counter rules used by createOrderAuthoritative:
 *
 *  - the daily counter must key on the server's current date, so alternating the
 *    pickup date between today and tomorrow cannot keep resetting it;
 *  - the weekly counter must roll over on an ISO week boundary, so it cannot
 *    accumulate forever and lock a student out of their own money.
 */

import {
  getIsoWeekKey,
  resolveSpendingCounters,
  resolveMissingLimitDefaults,
  isConfiguredLimit,
  DEFAULT_DAILY_LIMIT_SATANG,
  DEFAULT_WEEKLY_LIMIT_SATANG,
} from './functions/walletLimits.js';
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

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n       expected: ${expected}\n       actual:   ${actual}`);
  }
}

console.log('\n💰 CAMPUS WALLET SPENDING LIMIT TEST SUITE\n');

// ===========================================================================
console.log('1. ISO week keys');
// ===========================================================================

runTest('Monday and Sunday of the same ISO week share a key', () => {
  // 2026-09-07 is a Monday; 2026-09-13 is the Sunday that closes that week.
  assertEqual(getIsoWeekKey('2026-09-07'), getIsoWeekKey('2026-09-13'), 'same week expected');
});

runTest('Sunday and the following Monday fall in different weeks', () => {
  assert(getIsoWeekKey('2026-09-13') !== getIsoWeekKey('2026-09-14'), 'week must roll on Monday');
});

runTest('2026-01-01 (a Thursday) is week 1 of 2026', () => {
  assertEqual(getIsoWeekKey('2026-01-01'), '2026-W01', 'Thursday Jan 1 belongs to week 1');
});

runTest('Year boundary: 2027-01-01 (a Friday) belongs to ISO week 53 of 2026', () => {
  // ISO weeks follow their Thursday, so early-January days can belong to the
  // outgoing year. A naive key would wrongly reset the counter here.
  assertEqual(getIsoWeekKey('2027-01-01'), '2026-W53', 'must follow the ISO Thursday rule');
});

runTest('2026-12-31 and 2027-01-01 share one ISO week', () => {
  assertEqual(getIsoWeekKey('2026-12-31'), getIsoWeekKey('2027-01-01'), 'same ISO week expected');
});

runTest('Malformed dates are rejected rather than silently keyed', () => {
  let threw = false;
  try { getIsoWeekKey('07/09/2026'); } catch { threw = true; }
  assert(threw, 'invalid input must throw');
});

// ===========================================================================
console.log('\n2. Daily counter — the pickup-date bypass');
// ===========================================================================

const TODAY = '2026-09-07';
const TOMORROW = '2026-09-08';

runTest('Same-day spending accumulates', () => {
  const wallet = { lastSpentDate: TODAY, lastSpentWeek: getIsoWeekKey(TODAY), spentTodaySatang: 15000 };
  assertEqual(resolveSpendingCounters(wallet, TODAY).spentToday, 15000, 'today total must carry');
});

runTest('🚨 A wallet last spent for a FUTURE pickup date still counts today', () => {
  // The old code stamped lastSpentDate with the pickup date, so a wallet that had
  // just spent for tomorrow presented a clean slate to the next order placed today.
  // Counters are now stamped with the spend date, so this simply does not arise.
  const wallet = { lastSpentDate: TODAY, spentTodaySatang: 19000, dailyLimitSatang: 20000 };
  const c = resolveSpendingCounters(wallet, TODAY);
  assertEqual(c.spentToday, 19000, 'spending must count against the day it happened');
  assert(19000 + 5000 > c.dailyLimitSatang, 'a further 50 THB must breach the 200 THB daily limit');
});

runTest('🚨 Alternating pickup dates cannot reset the daily counter', () => {
  // Simulates the reported bypass: order for today, then tomorrow, then today again.
  // Every order is placed on the same real day, so one counter tracks them all.
  let wallet = { balanceSatang: 1000000, dailyLimitSatang: 20000, weeklyLimitSatang: 100000 };
  let totalCounted = 0;
  for (const pickupDate of [TODAY, TOMORROW, TODAY, TOMORROW]) {
    const c = resolveSpendingCounters(wallet, TODAY); // TODAY = real date, regardless of pickup
    const amount = 6000; // 60 THB
    totalCounted = c.spentToday + amount;
    wallet = {
      ...wallet,
      spentTodaySatang: totalCounted,
      spentThisWeekSatang: c.spentThisWeek + amount,
      lastSpentDate: c.todayYmd,
      lastSpentWeek: c.weekKey,
      lastPickupDate: pickupDate,
    };
  }
  assertEqual(totalCounted, 24000, 'all four orders must land on one counter');
  assert(totalCounted > 20000, 'the 4th order would now be refused');
});

runTest('A new day resets the daily counter', () => {
  const wallet = { lastSpentDate: TODAY, spentTodaySatang: 20000 };
  assertEqual(resolveSpendingCounters(wallet, TOMORROW).spentToday, 0, 'new day starts clean');
});

// ===========================================================================
console.log('\n3. Weekly counter — the permanent lockout');
// ===========================================================================

runTest('Weekly spending accumulates within the same ISO week', () => {
  const wallet = { lastSpentWeek: getIsoWeekKey(TODAY), spentThisWeekSatang: 40000 };
  assertEqual(resolveSpendingCounters(wallet, TODAY).spentThisWeek, 40000, 'week total must carry');
});

runTest('🚨 Weekly counter resets on the next ISO week', () => {
  // Previously spentThisWeekSatang was read raw and never reset anywhere, so once it
  // passed the weekly limit the wallet was unusable forever.
  const wallet = { lastSpentWeek: getIsoWeekKey('2026-09-07'), spentThisWeekSatang: 99000 };
  const next = resolveSpendingCounters(wallet, '2026-09-14'); // following Monday
  assertEqual(next.spentThisWeek, 0, 'a new week must start clean');
});

runTest('🚨 A wallet already over the weekly limit recovers next week', () => {
  const wallet = {
    lastSpentWeek: getIsoWeekKey('2026-09-07'),
    spentThisWeekSatang: 500000, // far beyond the 1000 THB default
    weeklyLimitSatang: 100000,
  };
  const c = resolveSpendingCounters(wallet, '2026-09-14');
  assert(c.spentThisWeek + 5000 <= c.weeklyLimitSatang, 'student must be able to spend again');
});

runTest('Legacy wallet with no lastSpentWeek starts its weekly total fresh', () => {
  // Migration path: wallets written before the key existed carry an inflated total.
  const wallet = { spentThisWeekSatang: 750000, lastSpentDate: TODAY, spentTodaySatang: 3000 };
  const c = resolveSpendingCounters(wallet, TODAY);
  assertEqual(c.spentThisWeek, 0, 'unkeyed weekly total must not be trusted');
  assertEqual(c.spentToday, 3000, 'daily total is still keyed and must survive');
});

// ===========================================================================
console.log('\n4. Limits, defaults and defensive values');
// ===========================================================================

runTest('Configured limits are honoured', () => {
  const c = resolveSpendingCounters({ dailyLimitSatang: 5000, weeklyLimitSatang: 30000 }, TODAY);
  assertEqual(c.dailyLimitSatang, 5000, 'daily limit');
  assertEqual(c.weeklyLimitSatang, 30000, 'weekly limit');
});

runTest('Missing limits resolve to null (Fail-Closed)', () => {
  const c = resolveSpendingCounters({}, TODAY);
  assertEqual(c.dailyLimitSatang, null, 'unset daily limit must be null');
  assertEqual(c.weeklyLimitSatang, null, 'unset weekly limit must be null');
});

runTest('A zero limit is respected, not treated as unset', () => {
  const c = resolveSpendingCounters({ dailyLimitSatang: 0, weeklyLimitSatang: 0 }, TODAY);
  assertEqual(c.dailyLimitSatang, 0, 'a parent freezing spending must not be null');
  assertEqual(c.weeklyLimitSatang, 0, 'a parent freezing spending must not be null');
});

runTest('Corrupt or negative counters clamp to zero', () => {
  const c = resolveSpendingCounters(
    { lastSpentDate: TODAY, spentTodaySatang: -5000, lastSpentWeek: getIsoWeekKey(TODAY), spentThisWeekSatang: 'oops' },
    TODAY
  );
  assertEqual(c.spentToday, 0, 'negative must clamp');
  assertEqual(c.spentThisWeek, 0, 'non-numeric must clamp');
});

runTest('A missing wallet resolves to zeroed counters', () => {
  const c = resolveSpendingCounters(null, TODAY);
  assertEqual(c.spentToday, 0, 'no wallet, no spend');
  assertEqual(c.spentThisWeek, 0, 'no wallet, no spend');
});


// ---------------------------------------------------------------------------
// A wallet nobody can spend from
// ---------------------------------------------------------------------------
// Spending is fail-closed on the limit fields, and nothing in the app wrote
// them, so every wallet ever created was refused at checkout with
// WALLET_LIMITS_NOT_CONFIGURED. These fix that state at the two places a wallet
// is born, without ever overwriting a limit a guardian chose.

console.log('\n🔓 Wallet limit bootstrap');

runTest('🚨 A brand-new wallet is born spendable, not bricked', () => {
  const patch = resolveMissingLimitDefaults(null);
  assertEqual(patch.dailyLimitSatang, DEFAULT_DAILY_LIMIT_SATANG, 'daily default must be seeded');
  assertEqual(patch.weeklyLimitSatang, DEFAULT_WEEKLY_LIMIT_SATANG, 'weekly default must be seeded');

  // The whole point: the seeded wallet must now pass the check that was
  // refusing every order.
  const counters = resolveSpendingCounters(patch, TODAY);
  assert(counters.dailyLimitSatang !== null, 'seeded wallet must resolve a daily limit');
  assert(counters.weeklyLimitSatang !== null, 'seeded wallet must resolve a weekly limit');
});

runTest('🚨 A limit the guardian chose is never overwritten', () => {
  const chosen = { dailyLimitSatang: 5000, weeklyLimitSatang: 15000 };
  const patch = resolveMissingLimitDefaults(chosen);
  assertEqual(Object.keys(patch).length, 0, 'nothing may be patched over a configured wallet');
});

runTest('🚨 A deliberate freeze (limit 0) survives the bootstrap', () => {
  // A guardian setting the daily limit to 0 is freezing the wallet. Treating
  // that as "unset" would silently hand the student back a 200 THB allowance.
  const frozen = { dailyLimitSatang: 0, weeklyLimitSatang: 0 };
  const patch = resolveMissingLimitDefaults(frozen);
  assertEqual(patch.dailyLimitSatang, undefined, 'a 0 daily limit must not be replaced');
  assertEqual(patch.weeklyLimitSatang, undefined, 'a 0 weekly limit must not be replaced');
});

runTest('Only the missing half is filled in', () => {
  const half = { dailyLimitSatang: 3000 };
  const patch = resolveMissingLimitDefaults(half);
  assertEqual(patch.dailyLimitSatang, undefined, 'the configured half stays put');
  assertEqual(patch.weeklyLimitSatang, DEFAULT_WEEKLY_LIMIT_SATANG, 'the missing half is seeded');
});

runTest('Garbage in a limit field counts as unset, not as a limit', () => {
  for (const bad of [null, undefined, 'oops', NaN, Infinity, -1, {}]) {
    const patch = resolveMissingLimitDefaults({ dailyLimitSatang: bad, weeklyLimitSatang: 1 });
    assertEqual(
      patch.dailyLimitSatang,
      DEFAULT_DAILY_LIMIT_SATANG,
      `${String(bad)} must be treated as unset`
    );
  }
});

runTest('The bootstrap and the spend check agree on what "configured" means', () => {
  // If these two ever disagreed, a wallet would either be reseeded on every
  // order or stay permanently unspendable. Same predicate, proven on the same
  // values rather than assumed.
  for (const v of [0, 1, 20000, null, undefined, 'x', NaN, -1]) {
    const seeded = resolveMissingLimitDefaults({ dailyLimitSatang: v }).dailyLimitSatang === undefined;
    const spendable = resolveSpendingCounters({ dailyLimitSatang: v }, TODAY).dailyLimitSatang !== null;
    assertEqual(seeded, spendable, `disagreement on ${String(v)}: bootstrap kept=${seeded}, spend saw=${spendable}`);
    assertEqual(isConfiguredLimit(v), spendable, `isConfiguredLimit disagrees on ${String(v)}`);
  }
});

// ---------------------------------------------------------------------------
// The two call sites, read from the source
// ---------------------------------------------------------------------------
// A pure helper nobody calls fixes nothing. DEFAULT_DAILY_LIMIT_SATANG sat
// exported and unused in exactly this way while every order was being refused.

const functionsSource = readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8');

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
const liveFunctions = stripComments(functionsSource);

runTest('🚨 Every place that creates a wallet seeds the defaults', () => {
  // Each `tx.set(walletRef, {...})` that can bring a wallet into existence has
  // to carry the patch, or that path recreates the unspendable wallet.
  const creationWrites = liveFunctions.match(/tx\.set\(\s*walletRef,[\s\S]{0,600}?\{\s*merge:\s*true\s*\}/g) || [];
  assert(creationWrites.length >= 2, `expected the link-review and top-up writes, found ${creationWrites.length}`);

  const seeding = creationWrites.filter((w) => w.includes('resolveMissingLimitDefaults'));
  const bare = creationWrites.filter(
    (w) => !w.includes('resolveMissingLimitDefaults') && !w.includes('arrayRemove')
  );
  assert(seeding.length >= 2, `only ${seeding.length} wallet write(s) seed limits`);
  assertEqual(bare.length, 0, `a wallet write creates an unspendable wallet:\n${bare[0] || ''}`);
});

runTest('🚨 The wallet is read before it is written, or the transaction is invalid', () => {
  // Firestore rejects a transaction that reads after it writes. The link-review
  // read was added specifically for this patch, so it has to sit above the
  // first mutation in that function.
  const startsAt = liveFunctions.indexOf('export const reviewParentChildLink');
  assert(startsAt >= 0, 'reviewParentChildLink is gone or renamed — this test is no longer checking anything');
  const fn = liveFunctions.slice(startsAt + 'export const '.length);
  const endsAt = fn.indexOf('\nexport const');
  assert(endsAt > 0, 'could not find the end of reviewParentChildLink');
  const body = fn.slice(0, endsAt);
  const readAt = body.indexOf('tx.get(walletRef)');
  const firstWriteAt = Math.min(
    ...['tx.set(', 'tx.update(', 'tx.delete(']
      .map((t) => body.indexOf(t))
      .filter((i) => i >= 0)
  );
  assert(readAt >= 0, 'the wallet is never read, so the patch cannot know what is already set');
  assert(readAt < firstWriteAt, `wallet read at ${readAt} comes after the first write at ${firstWriteAt}`);
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
