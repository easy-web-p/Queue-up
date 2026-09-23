/**
 * ============================================================================
 * 🏆 LOYALTY POINTS RULES
 * ============================================================================
 *
 * What a point is worth, what a reward costs, and whether this person can
 * afford it. No Firestore here — index.js does the reading; this is the
 * arithmetic, which is the part that can be wrong.
 *
 * Half of this was already real. `createOrderAuthoritative` writes
 * `pointsEarned: Math.floor(finalAmountSatang / 1000)` onto every order it
 * creates, server-side, from the amount actually charged. Points are earned
 * honestly.
 *
 * The other half was not. UserProfile held `useState(1250)` — every account
 * opened with 1,250 points it had never earned, displayed beside a membership
 * tier computed from them — and redeeming a reward did this:
 *
 *     setUserPoints((prev) => Math.max(0, prev - cost));
 *     toast.success('แลกสิทธิ์สำเร็จ! สามารถนำคูปองไปใช้ที่หน้าร้านได้ทันที');
 *
 * No coupon was created. Nothing was stored. The points came back on reload,
 * and a student was told to take a reward to the counter that did not exist.
 *
 * So: the balance is earned minus redeemed, both from documents the browser
 * cannot write, and a redemption issues a coupon the order engine already
 * knows how to price.
 */

/** ฿10 spent is one point. Matches createOrderAuthoritative, deliberately. */
export const SATANG_PER_POINT = 1000;

/**
 * The rewards, and what they become.
 *
 * `coupon` is the document a redemption writes — the same shape the order
 * transaction reads through `evaluateCoupon`, so a redeemed reward is priced by
 * the one engine rather than by a second copy of the maths. `ownerUid` and
 * `maxPerUser: 1` are what make an issued coupon this person's, once.
 */
export const LOYALTY_REWARDS = Object.freeze([
  Object.freeze({
    id: "DISCOUNT_5",
    title: "ส่วนลด 5 บาท",
    description: "ใช้ได้กับทุกเมนูในโรงอาหาร",
    pointsCost: 50,
    coupon: Object.freeze({ type: "FIXED", amountSatang: 500, minSpendSatang: 0 }),
  }),
  Object.freeze({
    id: "DISCOUNT_15",
    title: "ส่วนลด 15 บาท",
    description: "ใช้ได้กับออเดอร์ตั้งแต่ 50 บาทขึ้นไป",
    pointsCost: 120,
    coupon: Object.freeze({ type: "FIXED", amountSatang: 1500, minSpendSatang: 5000 }),
  }),
  Object.freeze({
    id: "DISCOUNT_30",
    title: "ส่วนลด 30 บาท",
    description: "ใช้ได้กับออเดอร์ตั้งแต่ 100 บาทขึ้นไป",
    pointsCost: 300,
    coupon: Object.freeze({ type: "FIXED", amountSatang: 3000, minSpendSatang: 10000 }),
  }),
]);

export const LOYALTY_REFUSAL = Object.freeze({
  UNKNOWN_REWARD: "UNKNOWN_REWARD",
  NOT_ENOUGH_POINTS: "NOT_ENOUGH_POINTS",
});

/** Look a reward up by id. Returns null rather than a default — an unknown id is a refusal. */
export function findReward(rewardId) {
  return LOYALTY_REWARDS.find((r) => r.id === rewardId) || null;
}

/**
 * Points from one order.
 *
 * Reads the stored `pointsEarned` and falls back to deriving it from the
 * amount, so orders written before that field existed still count. Only a
 * COMPLETED order earns: a cancelled one took no money, and awarding points for
 * it would let someone farm points by ordering and cancelling.
 */
export function pointsForOrder(order) {
  const o = order || {};
  if (String(o.status || "").toUpperCase() !== "COMPLETED") return 0;

  const stored = Number(o.pointsEarned);
  if (Number.isFinite(stored) && stored >= 0) return Math.floor(stored);

  const paid = Number(o.finalAmountSatang ?? o.totalSatang ?? 0);
  if (!Number.isFinite(paid) || paid <= 0) return 0;
  return Math.floor(paid / SATANG_PER_POINT);
}

/**
 * The balance: everything earned, less everything already spent.
 *
 * The old screen summed earnings and never subtracted a redemption, so a
 * balance could be spent repeatedly. Both sides come from documents no browser
 * can write.
 */
export function computeBalance(orders, redemptions) {
  const earned = (orders || []).reduce((sum, o) => sum + pointsForOrder(o), 0);
  const spent = (redemptions || []).reduce((sum, r) => {
    const cost = Number(r && r.pointsCost);
    return sum + (Number.isFinite(cost) && cost > 0 ? Math.floor(cost) : 0);
  }, 0);
  return { earned, spent, balance: Math.max(0, earned - spent) };
}

/**
 * May this person redeem this reward?
 *
 * @returns {{ok: true, reward: object} | {ok: false, status, code, message}}
 */
export function checkRedeemable(rewardId, balance) {
  const reward = findReward(rewardId);
  if (!reward) {
    return {
      ok: false,
      status: "invalid-argument",
      code: LOYALTY_REFUSAL.UNKNOWN_REWARD,
      message: "ไม่พบของรางวัลที่เลือก",
    };
  }
  const have = Number(balance) || 0;
  if (have < reward.pointsCost) {
    return {
      ok: false,
      status: "failed-precondition",
      code: LOYALTY_REFUSAL.NOT_ENOUGH_POINTS,
      message: `แต้มสะสมไม่เพียงพอ (ต้องการ ${reward.pointsCost} แต้ม มีอยู่ ${have} แต้ม)`,
    };
  }
  return { ok: true, reward };
}

/**
 * The coupon code a redemption issues.
 *
 * Must satisfy `normalizeCouponCode`'s `^[A-Z0-9_-]{3,32}$`, so the issued code
 * can be typed into the same box as any other. The redemption's document id
 * supplies the uniqueness; the reward id makes it legible on a receipt.
 */
export function buildRewardCouponCode(rewardId, redemptionId) {
  const suffix = String(redemptionId || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return `LP-${String(rewardId).toUpperCase().replace(/[^A-Z0-9]/g, "")}-${suffix}`.slice(0, 32);
}

/**
 * The coupon document a redemption writes.
 *
 * `ownerUid` is what stops an issued code working for anyone who overhears it —
 * `evaluateCoupon` refuses a coupon whose owner is not the caller. `maxPerUser: 1`
 * makes it single-use even for its owner.
 */
export function buildRewardCoupon(reward, code, ownerUid) {
  return {
    id: code,
    title: reward.title,
    description: `${reward.description} (แลกด้วย ${reward.pointsCost} แต้ม)`,
    ...reward.coupon,
    ownerUid,
    maxPerUser: 1,
    active: true,
    source: "LOYALTY_REDEMPTION",
    rewardId: reward.id,
  };
}
