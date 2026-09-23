/**
 * ============================================================================
 * 🏆 LOYALTY POINTS — CLIENT SIDE
 * ============================================================================
 *
 * Two calls, and no arithmetic. The balance is earned minus redeemed, computed
 * on the server from orders and redemption rows the browser cannot write, and
 * redeeming issues a real coupon in the same transaction that records the cost.
 *
 * What this replaces was `useState(1250)` — 1,250 points every account opened
 * with and had never earned — and a redeem handler that subtracted from that
 * React state, said "นำคูปองไปใช้ที่หน้าร้านได้ทันที", and created nothing. The
 * points came back on reload; the reward never existed at all.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config.js';

export interface LoyaltyReward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  /** Server's answer, so the button's state and the call's outcome agree. */
  affordable: boolean;
}

/** A coupon already redeemed and not yet spent — the reward, as a usable thing. */
export interface IssuedCoupon {
  code: string;
  title: string;
  description: string;
}

export interface LoyaltyBalance {
  /** Points from every COMPLETED order. */
  earned: number;
  /** Points already exchanged for rewards. */
  spent: number;
  /** earned − spent, never below zero. */
  balance: number;
  rewards: LoyaltyReward[];
  issued: IssuedCoupon[];
}

export interface RedeemResult {
  success: boolean;
  rewardId: string;
  /** The code to type at checkout. It works only for this account. */
  couponCode: string;
  pointsSpent: number;
  balance: number;
  message: string;
}

export async function fetchLoyaltyBalance(): Promise<LoyaltyBalance> {
  const callable = httpsCallable<Record<string, never>, LoyaltyBalance>(
    functions,
    'getLoyaltyBalance'
  );
  const res = await callable({});
  return res.data;
}

/**
 * Exchange points for a reward.
 *
 * Throws when the server refuses — not enough points, or an unknown reward.
 * The refusal has to reach the person: reported as success it would leave them
 * looking for a coupon that was never issued, which is precisely what the old
 * local-state version did every single time.
 */
export async function redeemLoyaltyReward(rewardId: string): Promise<RedeemResult> {
  const callable = httpsCallable<{ rewardId: string }, RedeemResult>(
    functions,
    'redeemLoyaltyReward'
  );
  const res = await callable({ rewardId });
  return res.data;
}
