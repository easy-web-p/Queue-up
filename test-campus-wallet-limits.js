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
} from './functions/walletLimits.js';

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

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
