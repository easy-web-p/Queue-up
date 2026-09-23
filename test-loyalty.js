/**
 * ============================================================================
 * LOYALTY POINTS TEST SUITE
 * ============================================================================
 *
 * Half of this was already honest. `createOrderAuthoritative` writes
 * `pointsEarned: Math.floor(finalAmountSatang / 1000)` onto every order from
 * the amount actually charged, server-side.
 *
 * The other half was not:
 *
 *     const [userPoints, setUserPoints] = useState(1250);
 *
 *     const handleRedeemReward = (reward) => {
 *       setUserPoints((prev) => Math.max(0, prev - cost));
 *       toast.success('แลกสิทธิ์สำเร็จ! สามารถนำคูปองไปใช้ที่หน้าร้านได้ทันที');
 *     };
 *
 * Every account opened with 1,250 points it had never earned, shown beside a
 * membership tier computed from them. Redeeming subtracted from React state,
 * created no coupon, stored nothing, and told a student to take a reward to the
 * counter. The points came back on reload.
 *
 * What is tested: that the balance subtracts what was spent, that a cancelled
 * order earns nothing, that a redemption and its coupon are written together or
 * not at all, and that an issued code belongs to one person.
 */

import { readFileSync } from 'node:fs';
import {
  SATANG_PER_POINT,
  LOYALTY_REWARDS,
  LOYALTY_REFUSAL,
  findReward,
  pointsForOrder,
  computeBalance,
  checkRedeemable,
  buildRewardCouponCode,
  buildRewardCoupon,
} from './functions/loyaltyRules.js';
import { evaluateCoupon, normalizeCouponCode, COUPON_REFUSAL } from './functions/couponRules.js';

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

const order = (over = {}) => ({ status: 'COMPLETED', pointsEarned: 10, ...over });

console.log('\n🧮 The balance is earned minus spent');

runTest('🚨 Redeemed points are subtracted', () => {
  // The old screen summed earnings and never subtracted a redemption, so the
  // same balance could be spent over and over.
  const t = computeBalance([order({ pointsEarned: 100 })], [{ pointsCost: 40 }]);
  assertEqual(t.earned, 100, 'earned');
  assertEqual(t.spent, 40, 'spent');
  assertEqual(t.balance, 60, 'the redemption did not reduce the balance');
});

runTest('🚨 A balance never goes negative', () => {
  const t = computeBalance([order({ pointsEarned: 10 })], [{ pointsCost: 500 }]);
  assertEqual(t.balance, 0, 'a negative balance would read as an enormous one after coercion');
});

runTest('🚨 Nobody starts with points they did not earn', () => {
  // `useState(1250)`.
  assertEqual(computeBalance([], []).balance, 0, 'an account with no orders has no points');
  assertEqual(computeBalance().balance, 0, 'missing input must be zero, not a default gift');
});

runTest('🚨 A cancelled order earns nothing', () => {
  // Otherwise points are farmed by ordering and cancelling.
  for (const status of ['CANCELLED', 'PENDING', 'PREPARING', 'READY']) {
    assertEqual(pointsForOrder(order({ status })), 0, `${status} must not earn points`);
  }
  assertEqual(pointsForOrder(order({ status: 'COMPLETED' })), 10, 'a completed order earns');
});

runTest('An order written before pointsEarned existed still counts', () => {
  const o = { status: 'COMPLETED', finalAmountSatang: 12500 };
  assertEqual(pointsForOrder(o), 12, '฿125 at ฿10 a point is 12 points, rounded down');
});

runTest('The earn rate matches the one the order transaction uses', () => {
  // createOrderAuthoritative: `Math.floor(finalAmountSatang / 1000)`. Two
  // different divisors here and there is a balance nobody can reconcile.
  assertEqual(SATANG_PER_POINT, 1000, 'the client and server rates disagree');
  const live = read('functions/index.js');
  assert(
    /pointsEarned: Math\.floor\(finalAmountSatang \/ 1000\)/.test(live),
    'the order transaction no longer earns at ฿10 a point'
  );
});

runTest('Malformed rows do not corrupt the total', () => {
  const t = computeBalance(
    [order({ pointsEarned: 'abc' }), order({ pointsEarned: -5 }), null],
    [{ pointsCost: 'x' }, {}, null]
  );
  assert(Number.isInteger(t.balance) && t.balance >= 0, `balance was ${t.balance}`);
});

console.log('\n🎁 Redeeming');

runTest('🚨 A reward costing more than the balance is refused', () => {
  const r = checkRedeemable('DISCOUNT_15', 10);
  assert(!r.ok, '120 points were spent from a balance of 10');
  assertEqual(r.code, LOYALTY_REFUSAL.NOT_ENOUGH_POINTS, 'wrong refusal');
  assert(r.message.includes('120') && r.message.includes('10'), 'the refusal states neither number');
});

runTest('An unknown reward is refused, not defaulted', () => {
  const r = checkRedeemable('FREE_MOTORCYCLE', 999999);
  assert(!r.ok, 'an unknown id was redeemable');
  assertEqual(r.code, LOYALTY_REFUSAL.UNKNOWN_REWARD, 'wrong refusal');
  assertEqual(findReward('FREE_MOTORCYCLE'), null, 'findReward invents a reward');
});

runTest('Exactly enough points is enough', () => {
  const reward = findReward('DISCOUNT_5');
  assert(checkRedeemable('DISCOUNT_5', reward.pointsCost).ok, 'an off-by-one at the boundary');
  assert(!checkRedeemable('DISCOUNT_5', reward.pointsCost - 1).ok, 'one point short still passed');
});

runTest('🚨 Every reward becomes a coupon the order engine can price', () => {
  // The old rewards were three labels. If a reward cannot be evaluated by
  // `evaluateCoupon`, redeeming it produces something no checkout can use.
  for (const reward of LOYALTY_REWARDS) {
    const code = buildRewardCouponCode(reward.id, 'abc123XYZ');
    assert(normalizeCouponCode(code) === code, `${reward.id} issues an unusable code: ${code}`);

    const coupon = buildRewardCoupon(reward, code, 'uid1');
    const verdict = evaluateCoupon(coupon, {
      subtotalSatang: 100000,
      nowYmd: '2026-01-01',
      nowHhmm: '12:00',
      timesUsedByUser: 0,
      userRoles: ['customer'],
      storeId: 'shop1',
      userId: 'uid1',
    });
    assert(verdict.ok, `${reward.id} cannot be priced: ${verdict.reason}`);
    assert(verdict.discountSatang > 0, `${reward.id} is worth nothing`);
  }
});

runTest('🚨 A redeemed coupon is single use', () => {
  const reward = findReward('DISCOUNT_5');
  const coupon = buildRewardCoupon(reward, 'LP-DISCOUNT5-AAA', 'uid1');
  assertEqual(coupon.maxPerUser, 1, 'a reward bought once could be spent forever');

  const verdict = evaluateCoupon(coupon, {
    subtotalSatang: 100000,
    nowYmd: '2026-01-01',
    nowHhmm: '12:00',
    timesUsedByUser: 1,
    userRoles: ['customer'],
    storeId: 'shop1',
    userId: 'uid1',
  });
  assert(!verdict.ok && verdict.reason === COUPON_REFUSAL.ALREADY_USED, 'a second use was allowed');
});

console.log('\n🔐 An issued code belongs to one person');

runTest('🚨 Someone else cannot use a code they overheard', () => {
  // The points that bought it were not theirs.
  const coupon = buildRewardCoupon(findReward('DISCOUNT_5'), 'LP-DISCOUNT5-AAA', 'uid1');
  assertEqual(coupon.ownerUid, 'uid1', 'the coupon names no owner');

  const verdict = evaluateCoupon(coupon, {
    subtotalSatang: 100000,
    nowYmd: '2026-01-01',
    nowHhmm: '12:00',
    timesUsedByUser: 0,
    userRoles: ['customer'],
    storeId: 'shop1',
    userId: 'someone_else',
  });
  assert(!verdict.ok, "another account priced an order with someone else's reward");
  assertEqual(verdict.reason, COUPON_REFUSAL.NOT_YOUR_COUPON, 'wrong refusal');
});

runTest('An ordinary coupon is unaffected by the owner check', () => {
  // Only enforced when a coupon states an owner, so WELCOME50 still works for
  // everyone.
  const verdict = evaluateCoupon(
    { id: 'WELCOME50', type: 'FIXED', amountSatang: 5000, active: true },
    {
      subtotalSatang: 100000,
      nowYmd: '2026-01-01',
      nowHhmm: '12:00',
      timesUsedByUser: 0,
      userRoles: ['customer'],
      storeId: 'shop1',
      userId: 'anyone',
    }
  );
  assert(verdict.ok, 'a public coupon was refused as belonging to someone else');
});

runTest('🚨 Both callers of evaluateCoupon pass the caller identity', () => {
  // Passed on one side only, the checkout screen shows a discount the order
  // transaction then takes away — or worse, the reverse.
  // Scoped to the evaluateCoupon call itself: `userId: effectiveUserId` also
  // appears on the order document being written, so a loose search over the
  // whole file passes even with the argument removed.
  const server = stripComments(read('functions/index.js'));
  const evalAt = server.indexOf('evaluateCoupon(');
  assert(evalAt > 0, 'the order transaction no longer evaluates coupons');
  const evalCall = server.slice(evalAt, server.indexOf('\n          );', evalAt));
  assert(/userId: effectiveUserId/.test(evalCall), 'the order transaction omits the caller');

  const client = stripComments(read('src/services/couponService.ts'));
  const clientAt = client.indexOf('evaluateCoupon(');
  assert(clientAt > 0, 'the preview no longer evaluates coupons');
  const clientCall = client.slice(clientAt, client.indexOf('\n  });', clientAt));
  assert(/userId: input\.userId/.test(clientCall), 'the preview omits the caller');
});

runTest("🚨 A personal coupon is not offered to everyone as a chip", () => {
  // `where active == true` alone would list every customer's redeemed reward
  // on every other customer's checkout screen.
  const svc = stripComments(read('src/services/couponService.ts'));
  const at = svc.indexOf('export async function fetchOfferedCoupons');
  assert(at > 0, 'the offered-coupons read is gone');
  const body = svc.slice(at, svc.indexOf('\n}', at));
  assert(body.includes("where('isPublic', '==', true)"), 'personal coupons are listed publicly');

  const rules = read('firestore.rules');
  const couponsAt = rules.indexOf('match /coupons/{couponId}');
  const couponRules = rules.slice(couponsAt, couponsAt + 900);
  assert(
    couponRules.includes('ownerUid'),
    "a personal coupon code is world-readable — one query away for everyone"
  );
});

console.log('\n🖥️  The server does the arithmetic');

const live = stripComments(read('functions/index.js'));
const redeemBody = (() => {
  const at = live.indexOf('export const redeemLoyaltyReward');
  if (at < 0) throw new Error('redeemLoyaltyReward does not exist');
  return live.slice(at, live.indexOf('\nexport const', at + 10));
})();

runTest('🚨 The redemption and the coupon are written together', () => {
  // Separately, a crash between them either takes the points and gives nothing,
  // or gives a reward that cost nothing and can be taken again.
  assert(redeemBody.includes('runTransaction'), 'the two writes are not atomic');
  const txAt = redeemBody.indexOf('runTransaction');
  const redemptionAt = redeemBody.indexOf('tx.set(redemptionRef');
  const couponAt = redeemBody.indexOf('tx.set(couponRef');
  assert(redemptionAt > txAt, 'the redemption is recorded outside the transaction');
  assert(couponAt > txAt, 'the coupon is issued outside the transaction');
});

runTest('🚨 A code collision cannot overwrite an unspent reward', () => {
  assert(redeemBody.includes('tx.get(couponRef)'), 'an existing coupon would be overwritten');
});

runTest('🚨 The balance is checked before anything is written', () => {
  const checkAt = redeemBody.indexOf('checkRedeemable(');
  const txAt = redeemBody.indexOf('runTransaction');
  assert(checkAt > 0, 'nothing checks whether the points exist');
  assert(checkAt < txAt, 'the reward is issued before the balance is checked');
});

runTest('🚨 Only COMPLETED orders are counted, in the query itself', () => {
  for (const fn of ['getLoyaltyBalance', 'redeemLoyaltyReward']) {
    const at = live.indexOf(`export const ${fn}`);
    const body = live.slice(at, live.indexOf('\nexport const', at + 10));
    assert(
      body.includes(`where("status", "==", "COMPLETED")`),
      `${fn} counts orders that were never paid for`
    );
  }
});

runTest('🚨 Redemptions are backend-only in the rules', () => {
  // A client able to delete a row here gets its points back and can redeem the
  // same reward forever.
  const rules = read('firestore.rules');
  const at = rules.indexOf('match /loyalty_redemptions/');
  assert(at > 0, 'loyalty_redemptions has no rule at all, so it falls to the default');
  const body = rules.slice(at, at + 400);
  assert(/allow write: if false;/.test(body), 'a client can write its own redemption rows');
  assert(body.includes('resource.data.userId == request.auth.uid'), 'anyone can read anyone’s');
});

console.log('\n🖥️  The screen stops inventing a balance');

const profile = stripComments(read('src/pages/UserProfile.jsx'));

runTest('🚨 The 1,250 free points are gone', () => {
  assert(!/useState\(1250\)/.test(profile), 'every account still opens with 1,250 points');
  assert(profile.includes('fetchLoyaltyBalance'), 'the balance is not read from the server');
});

runTest('🚨 Redeeming calls the server and reports its refusal', () => {
  const at = profile.indexOf('const handleRedeemReward');
  assert(at > 0, 'the redeem handler is gone');
  const body = profile.slice(at, profile.indexOf('const orderStatusTab', at));

  assert(body.includes('redeemLoyaltyReward('), 'redeeming still only changes local state');
  assert(!/setUserPoints/.test(body), 'the balance is still adjusted in the browser');
  assert(body.includes('toast.error('), 'a refusal never reaches the person');
  assert(body.includes('refreshLoyalty'), 'the balance is not re-read after spending');
});

runTest('The drawer shows the codes already bought', () => {
  // A reward is a coupon code. Showing only a success toast is what sent people
  // to the counter with nothing.
  const drawer = stripComments(read('src/components/ClientLoyaltyDrawer.jsx'));
  assert(drawer.includes('issued'), 'redeemed coupons are never shown');
  assert(drawer.includes('c.code'), 'the code itself is never displayed');
  assert(drawer.includes('reward.affordable'), "the button ignores the server's own answer");
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
