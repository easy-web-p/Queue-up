/**
 * ============================================================================
 * STUDENT WALLET TEST SUITE
 * ============================================================================
 *
 * FoodBooking has always offered "กระเป๋าเงินนักเรียน" as a payment method, and
 * no screen in the app showed the student a balance, an allowance, or one line
 * of the ledger. A parent could see all of it from GuardianDashboard; the child
 * whose money it is could see none of it. The only way to learn what was in the
 * wallet was to place an order and have the server refuse it.
 *
 * Three things this suite exists to hold:
 *
 *  1. **The screen must agree with the order transaction, exactly.** The page
 *     reimplements the counter rules in TypeScript because the client cannot
 *     import the Cloud Functions package. Two copies of an awkward rule drift,
 *     and when they drift the screen lies — so the ISO week key is pinned
 *     against `functions/walletLimits.js` across every year boundary rather
 *     than trusted.
 *
 *  2. **The headline number is what an order may cost, not the balance.** With
 *     ฿500 in the wallet and ฿40 of today's allowance left, an order may cost
 *     ฿40. Printing the balance is printing a number that does not decide
 *     anything.
 *
 *  3. **Unknown is not zero.** A wallet that could not be read must not render
 *     as ฿0.00 — that tells a student their money is gone.
 */

import { readFileSync } from 'node:fs';
import {
  bangkokDateKey,
  describeBlocker,
  describeLedgerEntry,
  formatBaht,
  isConfiguredLimit,
  isoWeekKey,
  walletSpendView,
} from './src/services/walletView.ts';
import { getIsoWeekKey, resolveSpendingCounters } from './functions/walletLimits.js';

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
const assertEqual = (a, e, m) => {
  if (a !== e) throw new Error(`${m}\n       expected: ${e}\n       actual:   ${a}`);
};

const read = (rel) => readFileSync(new URL(`./${rel}`, import.meta.url), 'utf8');
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const wallet = (over = {}) => ({
  studentId: 'STU1',
  balanceSatang: 50000,
  dailyLimitSatang: 20000,
  weeklyLimitSatang: 100000,
  spentTodaySatang: 0,
  spentThisWeekSatang: 0,
  lastSpentDate: '2026-09-23',
  lastSpentWeek: '2026-W39',
  isLocked: false,
  ...over,
});

const TODAY = '2026-09-23'; // a Wednesday, ISO 2026-W39

console.log('\n🔗 The screen and the order transaction must agree');

runTest('🚨 The week key matches the server across every year boundary', () => {
  // ISO weeks belong to the year containing their Thursday, so 2027-01-01 is
  // 2026-W53. A client that disagreed with the server by one week would show a
  // student a fresh allowance the server does not believe they have.
  let checked = 0;
  for (let year = 2024; year <= 2032; year += 1) {
    for (const [m, d] of [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [12, 27], [12, 28], [12, 29], [12, 30], [12, 31]]) {
      const ymd = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      assertEqual(isoWeekKey(ymd), getIsoWeekKey(ymd), `the two week keys disagree on ${ymd}`);
      checked += 1;
    }
  }
  assert(checked >= 80, `only ${checked} boundary dates were compared`);
});

runTest('🚨 The week key matches the server across a whole year of dates', () => {
  const date = new Date(Date.UTC(2026, 0, 1));
  let checked = 0;
  while (date.getUTCFullYear() === 2026) {
    const ymd = date.toISOString().slice(0, 10);
    assertEqual(isoWeekKey(ymd), getIsoWeekKey(ymd), `the two week keys disagree on ${ymd}`);
    date.setUTCDate(date.getUTCDate() + 1);
    checked += 1;
  }
  assertEqual(checked, 365, 'the year was not walked');
});

runTest('🚨 The rolled-over counters match the server exactly', () => {
  // resolveSpendingCounters is what createOrderAuthoritative runs its limit
  // check on. The page has to reach the same two numbers or it misreports the
  // allowance in one direction or the other.
  const cases = [
    wallet({ spentTodaySatang: 8000, spentThisWeekSatang: 30000 }),
    wallet({ lastSpentDate: '2026-09-22', spentTodaySatang: 8000 }),
    wallet({ lastSpentWeek: '2026-W38', spentThisWeekSatang: 30000 }),
    wallet({ lastSpentDate: '2026-09-22', lastSpentWeek: '2026-W38' }),
    wallet({ spentTodaySatang: -500, spentThisWeekSatang: 'x' }),
  ];
  for (const w of cases) {
    const server = resolveSpendingCounters(w, TODAY);
    const client = walletSpendView(w, TODAY);
    assertEqual(client.spentTodaySatang, server.spentToday, `today disagrees for ${JSON.stringify(w)}`);
    assertEqual(
      client.spentThisWeekSatang,
      server.spentThisWeek,
      `the week disagrees for ${JSON.stringify(w)}`
    );
    assertEqual(client.dailyLimitSatang, server.dailyLimitSatang, 'the daily limit disagrees');
    assertEqual(client.weeklyLimitSatang, server.weeklyLimitSatang, 'the weekly limit disagrees');
  }
});

runTest('🚨 An unset limit is unset on both sides, and zero is a real limit', () => {
  // A guardian who sets the daily limit to 0 is freezing the wallet on purpose.
  // Reading that as "unset" would quietly show them an allowance.
  const unset = wallet({ dailyLimitSatang: undefined });
  assertEqual(walletSpendView(unset, TODAY).dailyLimitSatang, null, 'an unset limit became a number');
  assertEqual(resolveSpendingCounters(unset, TODAY).dailyLimitSatang, null, 'the server disagrees');

  assert(isConfiguredLimit(0), 'a deliberate freeze was read as unset');
  const frozen = wallet({ dailyLimitSatang: 0 });
  assertEqual(walletSpendView(frozen, TODAY).dailyLimitSatang, 0, 'a freeze was discarded');
  assertEqual(walletSpendView(frozen, TODAY).remainingTodaySatang, 0, 'a frozen wallet has allowance');
});

console.log('\n💸 What an order may actually cost');

runTest('🚨 The spendable amount is the smallest of the three, not the balance', () => {
  // ฿500 in the wallet, ฿40 of today's allowance left: an order may cost ฿40.
  const v = walletSpendView(
    wallet({ balanceSatang: 50000, dailyLimitSatang: 20000, spentTodaySatang: 16000 }),
    TODAY
  );
  assertEqual(v.balanceSatang, 50000, 'the balance moved');
  assertEqual(v.spendableSatang, 4000, 'the daily allowance did not cap the order');
  assertEqual(v.blocker, null, 'a spendable wallet was reported blocked');
});

runTest("🚨 The week caps it too, not just the day", () => {
  const v = walletSpendView(
    wallet({ balanceSatang: 50000, weeklyLimitSatang: 100000, spentThisWeekSatang: 99000 }),
    TODAY
  );
  assertEqual(v.spendableSatang, 1000, 'the weekly allowance did not cap the order');
});

runTest('🚨 A poor wallet is capped by the money, not the allowance', () => {
  const v = walletSpendView(wallet({ balanceSatang: 700 }), TODAY);
  assertEqual(v.spendableSatang, 700, 'the allowance was offered as money');
});

runTest('🚨 An unconfigured wallet offers nothing, because the server refuses it', () => {
  // createOrderAuthoritative is fail-closed on a wallet with no limits stored.
  // A page showing a spendable balance there sends the student into a refusal.
  const v = walletSpendView(wallet({ dailyLimitSatang: undefined, weeklyLimitSatang: undefined }), TODAY);
  assertEqual(v.spendableSatang, 0, 'an unspendable wallet offered money');
  assertEqual(v.blocker, 'LIMITS_NOT_CONFIGURED', 'the reason is wrong');
  assert(describeBlocker(v.blocker).includes('วงเงิน'), 'the student is not told what is missing');
});

runTest('🚨 A locked wallet offers nothing, whatever is in it', () => {
  const v = walletSpendView(wallet({ isLocked: true, balanceSatang: 50000 }), TODAY);
  assertEqual(v.spendableSatang, 0, 'a locked wallet was spendable');
  assertEqual(v.blocker, 'LOCKED', 'the reason is wrong');
});

runTest('🚨 The blocker names the constraint that actually binds', () => {
  // "top up" and "wait until tomorrow" are different instructions.
  assertEqual(
    walletSpendView(wallet({ balanceSatang: 0 }), TODAY).blocker,
    'NO_BALANCE',
    'an empty wallet blamed a limit'
  );
  assertEqual(
    walletSpendView(wallet({ spentTodaySatang: 20000 }), TODAY).blocker,
    'DAILY_LIMIT_REACHED',
    'a spent day blamed the balance'
  );
  assertEqual(
    walletSpendView(wallet({ spentThisWeekSatang: 100000 }), TODAY).blocker,
    'WEEKLY_LIMIT_REACHED',
    'a spent week blamed the day'
  );
  for (const code of ['LOCKED', 'LIMITS_NOT_CONFIGURED', 'NO_BALANCE', 'DAILY_LIMIT_REACHED', 'WEEKLY_LIMIT_REACHED']) {
    const text = describeBlocker(code);
    assert(typeof text === 'string' && text.length > 20, `${code} has no explanation`);
  }
  assertEqual(describeBlocker(null), null, 'a wallet that works was given a complaint');
});

runTest('A missing wallet is not a crash, and offers nothing', () => {
  const v = walletSpendView(null, TODAY);
  assertEqual(v.spendableSatang, 0, 'a wallet that does not exist offered money');
  assertEqual(v.balanceSatang, 0, 'a missing wallet had a balance');
});

console.log('\n🧾 Reading the ledger');

runTest('🚨 The direction comes from the type, because every amount is positive', () => {
  // The ledger stores magnitudes. A page that took the sign from the number
  // would show every spend as money coming in.
  assertEqual(describeLedgerEntry({ type: 'SPEND', amountSatang: 6900 }).direction, -1, 'a spend read as income');
  assertEqual(describeLedgerEntry({ type: 'TOPUP', amountSatang: 6900 }).direction, 1, 'a top-up read as a spend');
  assertEqual(describeLedgerEntry({ type: 'REFUND', amountSatang: 6900 }).direction, 1, 'a refund read as a spend');
  assertEqual(describeLedgerEntry({ type: 'SPEND', amountSatang: 6900 }).amountSatang, 6900, 'the amount changed');
});

runTest('🚨 An unrecognised row is shown without a sign rather than guessed', () => {
  // Inventing a direction on a money line is worse than admitting to not
  // knowing which way it went.
  assertEqual(describeLedgerEntry({ type: 'SOMETHING_NEW', amountSatang: 100 }).direction, 0, 'a direction was invented');
  assertEqual(describeLedgerEntry({ type: 'ADJUSTMENT', amountSatang: 100 }).direction, 0, 'an adjustment was signed');
  assertEqual(describeLedgerEntry(null).amountSatang, 0, 'a missing row crashed');
  assertEqual(describeLedgerEntry({ amountSatang: -500, type: 'SPEND' }).amountSatang, 500, 'a negative magnitude leaked');
});

runTest('🚨 Every ledger type the backend writes is named on the screen', () => {
  // A type the backend writes and the page does not know renders as the
  // anonymous fallback — the REFUND row this app only just started writing is
  // exactly how that happens.
  const backend = new Set(
    [...read('functions/index.js').matchAll(/type:\s*"(TOPUP|SPEND|REFUND|ADJUSTMENT)"/g)].map((m) => m[1])
  );
  assert(backend.size >= 3, `only ${backend.size} ledger types found in the backend`);
  const view = read('src/services/walletView.ts');
  for (const type of backend) {
    assert(view.includes(`case '${type}':`), `the wallet page has no label for a ${type} row`);
  }
  assert(backend.has('REFUND'), 'the backend stopped writing refunds');
});

runTest('Money is formatted in one place, from satang', () => {
  assertEqual(formatBaht(6900), '฿69.00', 'satang were not divided');
  assertEqual(formatBaht(0), '฿0.00', 'zero is a real amount');
  assertEqual(formatBaht(null), '—', 'an unknown amount rendered as a number');
  assertEqual(formatBaht(undefined), '—', 'an unknown amount rendered as a number');
});

runTest("🚨 Today's date is read in Bangkok, not in the browser's timezone", () => {
  // A phone whose clock is set elsewhere must not report a rollover the server
  // has not made. 17:00 UTC is already tomorrow in Bangkok (UTC+7).
  assertEqual(bangkokDateKey(new Date('2026-09-23T17:30:00Z')), '2026-09-24', 'the evening did not roll over');
  assertEqual(bangkokDateKey(new Date('2026-09-23T16:59:00Z')), '2026-09-23', 'the day rolled over early');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(bangkokDateKey()), 'the key is not in the format the server writes');
});

console.log('\n🖥️  The page exists, and is reachable');

runTest('🚨 The student wallet page is routed and linked', () => {
  const app = stripComments(read('src/App.jsx'));
  assert(app.includes('StudentWallet'), 'the page is not routed at all');
  assert(/path="\/wallet"/.test(app), 'there is no /wallet route');
  assert(/path="\/wallet"[^>]*ProtectedRoute/.test(app), 'the wallet is readable without signing in');

  const profile = stripComments(read('src/pages/UserProfile.jsx'));
  assert(profile.includes('navigate("/wallet")'), 'nothing in the app links to the wallet');
});

runTest('🚨 The page reports the spendable figure, not just the balance', () => {
  const page = stripComments(read('src/pages/StudentWallet.tsx'));
  assert(page.includes('walletSpendView('), 'the page does not use the shared rules');
  assert(page.includes('spendableSatang'), 'the page never shows what an order may cost');
  assert(page.includes('describeBlocker('), 'a blocked wallet is not explained');
  assert(page.includes('fetchWalletTransactions('), 'the ledger is not read');
});

runTest('🚨 A failed read is not rendered as an empty wallet', () => {
  // ฿0.00 in place of "we could not load this" tells a student their money
  // is gone.
  const page = stripComments(read('src/pages/StudentWallet.tsx'));
  assert(page.includes('loadError'), 'there is no failure state');
  const guard = page.match(/!isLoading && !loadError && hasWallet/);
  assert(guard, 'the balance renders without checking that the read succeeded');
  assert(/loadError &&/.test(page), 'the failure is never shown to the student');
});

runTest('🚨 The page does not offer a top-up the server would refuse', () => {
  // assertWalletAuthority is called with allowSelf:false on every top-up path.
  // A button here would be a promise the backend breaks on purpose.
  const page = stripComments(read('src/pages/StudentWallet.tsx'));
  for (const call of ['topupCampusWallet', 'createTopupPaymentIntent', 'confirmStripeTopup']) {
    // The import alone is harmless; a call is the broken promise.
    assert(!new RegExp(`${call}\\s*\\(`).test(page), `the page calls ${call}, which a student may not do`);
  }
  assert(!/<(button|Link)[^>]*>[^<]*เติมเงิน/.test(page), 'the page offers a top-up control');

  const fns = stripComments(read('functions/index.js'));
  const at = fns.indexOf('export const createTopupPaymentIntent');
  assert(at > 0, 'createTopupPaymentIntent is gone');
  const fn = fns.slice(at, fns.indexOf('\nexport const', at + 10));
  assert(/allowSelf:\s*false/.test(fn), 'self top-up is no longer refused — this page should now offer it');
});

runTest('🚨 Checkout says what the wallet can cover before the order is refused', () => {
  const booking = stripComments(read('src/pages/FoodBooking.tsx'));
  assert(booking.includes('walletSpendView('), 'checkout does not read the wallet');
  assert(booking.includes('spendableSatang'), 'checkout never shows what is available');
  assert(booking.includes('describeBlocker('), 'a blocked wallet is not explained at checkout');

  // Null means unknown, and unknown must render nothing rather than ฿0.00.
  // Two places read it — the figure on the payment button and the card below
  // it — and each needs its own guard, so one count is not enough.
  const guards = (booking.match(/walletView &&/g) || []).length;
  const reads = (booking.match(/walletView\.[a-zA-Z]/g) || []).length;
  assert(guards >= 2, `only ${guards} of the wallet render sites check that it was read`);
  assert(reads > 0 && guards >= 2, 'checkout reads the wallet without a null guard');
});

runTest('The query behind the pending top-ups has an index', () => {
  // Without it the query throws, the catch returns [], and the student is told
  // nothing is pending when something is.
  const service = read('src/services/campusWalletService.ts');
  assert(service.includes('fetchTopupRequestsForStudent'), 'the student cannot see their pending top-ups');
  const page = stripComments(read('src/pages/StudentWallet.tsx'));
  assert(/fetchTopupRequestsForStudent\s*\(/.test(page), 'the page never asks for them');
  // Filtered on the student, not on who asked: fetchMyTopupRequests keys on
  // `requestedBy`, through which a student sees nothing of their own.
  const at = service.indexOf('export async function fetchTopupRequestsForStudent');
  const body = service.slice(at, service.indexOf('\n}', at));
  assert(body.includes("where('studentId', '=='"), 'the query is not filtered on the student');
  const indexes = JSON.parse(read('firestore.indexes.json')).indexes;
  const match = indexes.find(
    (i) =>
      i.collectionGroup === 'wallet_topup_requests' &&
      i.fields.some((f) => f.fieldPath === 'studentId') &&
      i.fields.some((f) => f.fieldPath === 'createdAt')
  );
  assert(match, 'wallet_topup_requests has no studentId + createdAt index');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
