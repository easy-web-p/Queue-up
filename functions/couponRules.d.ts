/**
 * Types for couponRules.js.
 *
 * The client imports the same evaluator the order transaction uses, so that a
 * preview can never promise a discount the server refuses. JSDoc alone did not
 * give TypeScript the discriminated union, so the contract is spelled out here.
 */

export type CouponRefusalReason =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'NOT_STARTED'
  | 'OUTSIDE_HAPPY_HOUR'
  | 'MIN_SPEND_NOT_MET'
  | 'ALREADY_USED'
  | 'AUDIENCE_MISMATCH'
  | 'STORE_MISMATCH';

export declare const COUPON_REFUSAL: Readonly<Record<CouponRefusalReason, CouponRefusalReason>>;

export interface CouponDocument {
  id?: string;
  title?: string;
  description?: string;
  type?: 'FIXED' | 'PERCENT';
  amountSatang?: number;
  percent?: number;
  maxDiscountSatang?: number;
  minSpendSatang?: number;
  maxPerUser?: number;
  audienceRoles?: string[];
  storeId?: string;
  dailyWindow?: { start: string; end: string };
  startsOn?: string;
  expiresOn?: string;
  active?: boolean;
  /** Set on a loyalty reward: only this uid may use the code. */
  ownerUid?: string;
}

export interface CouponContext {
  subtotalSatang: number;
  nowYmd: string;
  nowHhmm: string;
  timesUsedByUser: number;
  userRoles: string[];
  storeId: string;
  /** The caller, checked against a coupon's ownerUid. */
  userId?: string;
}

export type CouponVerdict =
  | { ok: true; discountSatang: number; title: string }
  | { ok: false; reason: CouponRefusalReason; detail?: Record<string, unknown> };

export declare function normalizeCouponCode(raw: unknown): string | null;
export declare function isWithinDailyWindow(
  nowHhmm: string,
  startHhmm: string,
  endHhmm: string
): boolean;
export declare function evaluateCoupon(
  coupon: CouponDocument | null,
  context: CouponContext
): CouponVerdict;
export declare function describeCouponRefusal(
  reason: string,
  detail?: Record<string, unknown>
): string;
