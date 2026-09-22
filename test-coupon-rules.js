/**
 * ============================================================================
 * COUPON RULE TEST SUITE
 * ============================================================================
 *
 * Every one of the three promo codes enforced less than its own name promised:
 *
 *   WELCOME50  "ต้อนรับสมาชิกใหม่" — no once-per-user check at all. ฿50 off,
 *              every order, forever, for anyone who typed it. What tracked the
 *              claim was localStorage.queueup_claimed_welcome_coupon, which the
 *              user clears from their own browser.
 *   HAPPY15    "Happy Hour" — no time window. Every hour was happy hour.
 *   STUDENT10  "ส่วนลดนักเรียนนักศึกษา" — never checked the buyer was a student.
 *
 * And a code whose minimum spend was not met fell through to a silent zero
 * discount: the order went through at full price with the coupon still shown as
 * applied. Meanwhile the admin console wrote coupons to a `coupons` collection
 * nothing read, and FoodBooking.tsx kept a fourth copy of the discount maths.
 */

import { readFileSync } from 'node:fs';
import {
  evaluateCoupon,
  normalizeCouponCode,
  isWithinDailyWindow,
  describeCouponRefusal,
  COUPON_REFUSAL,
} from './functions/couponRules.js';
import { BUILTIN_COUPONS, getBuiltinCoupon } from './functions/builtinCoupons.js';

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

/** A context where nothing is in the way, so each test changes one thing. */
const ctx = (over = {}) => ({
  subtotalSatang: 20000,
  nowYmd: '2026-09-22',
  nowHhmm: '15:00',
  timesUsedByUser: 0,
  userRoles: ['customer', 'student'],
  storeId: 'shop_1',
  ...over,
});

console.log('\n🎟️  The rules each code always claimed to have');

runTest('🚨 WELCOME50 is a welcome: the second use is refused', () => {
  const c = getBuiltinCoupon('WELCOME50');
  const first = evaluateCoupon(c, ctx({ timesUsedByUser: 0 }));
  assert(first.ok, 'the first use must be allowed');
  assertEqual(first.discountSatang, 5000, '฿50 off');

  const second = evaluateCoupon(c, ctx({ timesUsedByUser: 1 }));
  assert(!second.ok, 'the second use must be refused');
  assertEqual(second.reason, COUPON_REFUSAL.ALREADY_USED, 'and refused for the right reason');
});

runTest('🚨 HAPPY15 has a happy hour', () => {
  const c = getBuiltinCoupon('HAPPY15');
  assert(evaluateCoupon(c, ctx({ nowHhmm: '15:00' })).ok, '15:00 is inside the window');
  const morning = evaluateCoupon(c, ctx({ nowHhmm: '09:00' }));
  assert(!morning.ok, '09:00 must be refused');
  assertEqual(morning.reason, COUPON_REFUSAL.OUTSIDE_HAPPY_HOUR, 'refused as outside the window');
});

runTest('🚨 STUDENT10 is for students', () => {
  const c = getBuiltinCoupon('STUDENT10');
  assert(evaluateCoupon(c, ctx({ userRoles: ['customer'] })).ok, 'a campus customer qualifies');
  const outsider = evaluateCoupon(c, ctx({ userRoles: ['merchant'] }));
  assert(!outsider.ok, 'someone outside the audience must be refused');
  assertEqual(outsider.reason, COUPON_REFUSAL.AUDIENCE_MISMATCH, 'refused on audience');
});

runTest('🚨 A minimum spend that is not met is a refusal, not a silent zero', () => {
  // The old server applied no discount and let the order through at full price
  // with the coupon still displayed as active.
  const r = evaluateCoupon(getBuiltinCoupon('WELCOME50'), ctx({ subtotalSatang: 5000 }));
  assert(!r.ok, 'must be refused outright');
  assertEqual(r.reason, COUPON_REFUSAL.MIN_SPEND_NOT_MET, 'and say why');
  assertEqual(r.detail.minSpendSatang, 10000, 'and say what the minimum is');
});

console.log('\n💰 Discount arithmetic');

runTest('A percentage coupon respects its cap', () => {
  const c = getBuiltinCoupon('HAPPY15'); // 15%, capped at ฿50
  assertEqual(evaluateCoupon(c, ctx({ subtotalSatang: 20000 })).discountSatang, 3000, '15% of ฿200 is ฿30');
  assertEqual(evaluateCoupon(c, ctx({ subtotalSatang: 100000 })).discountSatang, 5000, '15% of ฿1000 caps at ฿50');
});

runTest('🚨 A discount can never exceed the order', () => {
  // Otherwise a coupon turns into a refund.
  const huge = { id: 'X', type: 'FIXED', amountSatang: 999999, minSpendSatang: 0, active: true };
  const r = evaluateCoupon(huge, ctx({ subtotalSatang: 4200 }));
  assertEqual(r.discountSatang, 4200, 'the discount is bounded by the total');
});

runTest('🚨 A discount can never be negative', () => {
  const negative = { id: 'X', type: 'FIXED', amountSatang: -5000, minSpendSatang: 0, active: true };
  assertEqual(evaluateCoupon(negative, ctx()).discountSatang, 0, 'a negative amount cannot add to the bill');
});

runTest('Satang arithmetic stays integral', () => {
  const c = { id: 'X', type: 'PERCENT', percent: 33, minSpendSatang: 0, active: true };
  const r = evaluateCoupon(c, ctx({ subtotalSatang: 10001 }));
  assert(Number.isInteger(r.discountSatang), `${r.discountSatang} is not a whole number of satang`);
});

console.log('\n⏰ Windows and dates');

runTest('A window that wraps past midnight still matches', () => {
  assert(isWithinDailyWindow('23:00', '22:00', '02:00'), '23:00 is inside 22:00–02:00');
  assert(isWithinDailyWindow('01:00', '22:00', '02:00'), '01:00 is inside 22:00–02:00');
  assert(!isWithinDailyWindow('12:00', '22:00', '02:00'), '12:00 is not');
});

runTest('Window boundaries are inclusive', () => {
  assert(isWithinDailyWindow('14:00', '14:00', '17:00'), 'the opening minute counts');
  assert(isWithinDailyWindow('17:00', '14:00', '17:00'), 'the closing minute counts');
  assert(!isWithinDailyWindow('17:01', '14:00', '17:00'), 'one minute past does not');
});

runTest('An unconfigured window never blocks anything', () => {
  assert(isWithinDailyWindow('03:00', undefined, undefined), 'no window means always open');
});

runTest('Start and expiry dates are honoured', () => {
  const c = { id: 'X', type: 'FIXED', amountSatang: 100, active: true, startsOn: '2026-10-01', expiresOn: '2026-10-31' };
  assertEqual(evaluateCoupon(c, ctx({ nowYmd: '2026-09-30' })).reason, COUPON_REFUSAL.NOT_STARTED, 'before the start');
  assert(evaluateCoupon(c, ctx({ nowYmd: '2026-10-15' })).ok, 'inside the range');
  assertEqual(evaluateCoupon(c, ctx({ nowYmd: '2026-11-01' })).reason, COUPON_REFUSAL.EXPIRED, 'after the end');
});

console.log('\n🛡️  Malformed and hostile input');

runTest('An unknown or missing code is refused, not applied', () => {
  assertEqual(evaluateCoupon(null, ctx()).reason, COUPON_REFUSAL.NOT_FOUND, 'no document, no discount');
  assertEqual(evaluateCoupon(undefined, ctx()).reason, COUPON_REFUSAL.NOT_FOUND, 'undefined, no discount');
});

runTest('A deactivated coupon stops working', () => {
  const c = { ...getBuiltinCoupon('WELCOME50'), active: false };
  assertEqual(evaluateCoupon(c, ctx()).reason, COUPON_REFUSAL.INACTIVE, 'an admin can retire a coupon');
});

runTest('🚨 A code cannot address a different document path', () => {
  // Codes become document ids, so a slash would traverse the collection.
  for (const bad of ['../orders/x', 'a/b', '', '  ', 'ab', 'x'.repeat(40), null, 42, {}]) {
    assertEqual(normalizeCouponCode(bad), null, `${JSON.stringify(bad)} must not become a document id`);
  }
  assertEqual(normalizeCouponCode('  welcome50  '), 'WELCOME50', 'a real code is trimmed and upper-cased');
});

runTest('A store-scoped coupon does not work at another store', () => {
  const c = { id: 'X', type: 'FIXED', amountSatang: 100, active: true, storeId: 'shop_2' };
  assertEqual(evaluateCoupon(c, ctx({ storeId: 'shop_1' })).reason, COUPON_REFUSAL.STORE_MISMATCH, 'wrong store');
  assert(evaluateCoupon(c, ctx({ storeId: 'shop_2' })).ok, 'right store');
});

runTest('Every refusal has a message a person can read', () => {
  for (const reason of Object.values(COUPON_REFUSAL)) {
    const msg = describeCouponRefusal(reason, { minSpendSatang: 10000, maxPerUser: 1, start: '14:00', end: '17:00' });
    assert(typeof msg === 'string' && msg.length > 8, `${reason} has no usable message`);
    assert(!msg.includes(reason), `${reason} leaks its code into the message`);
  }
});

console.log('\n🔧 Wired into the order transaction');

const src = readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8');
const live = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const orderFn = (() => {
  const at = live.indexOf('export const createOrderAuthoritative');
  return live.slice(at, live.indexOf('\nexport const', at + 10));
})();

runTest('🚨 The hardcoded if/else chain is gone', () => {
  for (const code of ['WELCOME50', 'HAPPY15', 'STUDENT10']) {
    assert(
      !orderFn.includes(`"${code}"`) && !orderFn.includes(`'${code}'`),
      `${code} is still hardcoded in the order transaction`
    );
  }
});

runTest('🚨 The order transaction evaluates through the shared rules', () => {
  assert(orderFn.includes('evaluateCoupon('), 'the shared evaluator is not called');
  assert(orderFn.includes('COUPON_REJECTED'), 'a refused coupon does not throw');
});

runTest('🚨 The redemption is read before it is written', () => {
  // Checking the count outside the transaction and writing it inside is a TOCTOU
  // window: two simultaneous orders would each see zero uses and both succeed.
  const readAt = orderFn.indexOf('tx.get(redemptionRef)');
  const writeAt = orderFn.indexOf('tx.set(\n            redemptionRef');
  assert(readAt > 0, 'the redemption record is never read inside the transaction');
  assert(writeAt > 0, 'the redemption record is never written');
  assert(readAt < writeAt, 'the redemption is written before it is read — invalid transaction');
});

runTest('🚨 The redemption write is inside the order transaction', () => {
  assert(
    orderFn.includes('count: FieldValue.increment(1)'),
    'the redemption count is not incremented atomically with the order'
  );
});

runTest('🚨 Redemptions are backend-only in the rules', () => {
  const rules = readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
  const at = rules.indexOf('match /coupon_redemptions/');
  assert(at > 0, 'the collection has no rule at all, so it falls to the default deny — or worse');
  const block = rules.slice(at, rules.indexOf('}', rules.indexOf('allow write', at)));
  assert(/allow write:\s*if false/.test(block), 'a client that can write its own redemption count has no limit');
});

console.log('\n🖥️  One definition, not four');

const booking = readFileSync(new URL('./src/pages/FoodBooking.tsx', import.meta.url), 'utf8');
const liveBooking = booking.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

runTest('🚨 The booking page no longer computes its own discount', () => {
  assert(!/discountAmount:\s*Math\.min\(/.test(liveBooking), 'the page still does its own discount maths');
  assert(liveBooking.includes('previewCoupon('), 'the page does not use the shared evaluator');
});

runTest('The built-in coupons are installable as documents', () => {
  assert(live.includes('export const seedBuiltinCoupons'), 'there is no way to install them');
  assertEqual(BUILTIN_COUPONS.length, 3, 'the three advertised codes must all exist');
  for (const c of BUILTIN_COUPONS) {
    assert(typeof c.title === 'string' && c.title.length > 0, `${c.id} has no title`);
    assert(c.type === 'FIXED' || c.type === 'PERCENT', `${c.id} has no usable type`);
  }
});

console.log('\n🖥️  The admin console writes coupons the engine can read');

const admin = readFileSync(new URL('./src/pages/StoreAdminPage.tsx', import.meta.url), 'utf8');
const liveAdmin = admin.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

runTest('🚨 The three invented admin coupons are gone', () => {
  // WELCOME10, LUNCH5 and STUDENT20 existed nowhere, and were not even the
  // three codes the app advertised.
  for (const ghost of ['WELCOME10', 'LUNCH5', 'STUDENT20']) {
    assert(!liveAdmin.includes(ghost), `the fabricated coupon ${ghost} is still seeded`);
  }
});

runTest('🚨 A coupon created in the console is in the shape the evaluator reads', () => {
  // The old shape — {code, discount, minSpend, status} — shared no field with
  // evaluateCoupon, so every coupon made here resolved to a silent zero
  // discount: a valid code, a full-price order, and "applied" on screen.
  for (const field of ['amountSatang', 'minSpendSatang', 'active:', "type: 'FIXED'"]) {
    assert(liveAdmin.includes(field), `the console does not write ${field}`);
  }
  assert(!/discount:\s*Number\(newCouponDiscount\)/.test(liveAdmin), 'the old inert shape is still written');
});

runTest('🚨 Retiring a coupon really stops it working', () => {
  // The delete used to filter the local array and report success while the
  // document — and the discount it grants at checkout — survived.
  const at = liveAdmin.indexOf('ปิดใช้งานคูปอง');
  assert(at > 0, 'there is no way to retire a coupon');
  const around = liveAdmin.slice(at, at + 1500);
  assert(around.includes("setDoc(doc(db, 'coupons'"), 'retiring a coupon never reaches Firestore');
  assert(around.includes('active: false'), 'the coupon is not deactivated');
});

runTest('The console reads coupons from Firestore', () => {
  assert(liveAdmin.includes("getDocs(collection(db, 'coupons'))"), 'the list is never fetched');
});

runTest('A code typed in the console is validated as a document id', () => {
  assert(/\[A-Z0-9_-\]\{3,32\}/.test(liveAdmin), 'an arbitrary code could address another path');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
