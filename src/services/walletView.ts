/**
 * ============================================================================
 * 👛 WHAT A STUDENT'S WALLET CAN ACTUALLY SPEND, RIGHT NOW
 * ============================================================================
 *
 * A student can choose "กระเป๋าเงินนักเรียน" at checkout, and until now no
 * screen in the app showed them the balance, the allowance left, or a single
 * line of the ledger. The only way to learn any of it was to place an order and
 * have it refused.
 *
 * Showing the raw `balanceSatang` would not have fixed that, because the
 * balance is not what an order is allowed to cost. `createOrderAuthoritative`
 * refuses an order that exceeds the daily or weekly limit a guardian set, and
 * refuses outright when no limit is stored at all (fail-closed — see
 * `functions/walletLimits.js`). A student with ฿500 and ฿40 of daily allowance
 * left can spend ฿40. The number worth printing is the smallest of the three.
 *
 * Two properties this module has to get right:
 *
 *  1. **A counter whose period has rolled over reads as zero.** The wallet
 *     keeps one running total per period, stamped with the period key it
 *     belongs to. A page that read `spentTodaySatang` directly would show
 *     yesterday's spending as today's, and tell a student they had no allowance
 *     left on a morning when they had all of it.
 *
 *  2. **It must agree with the server, exactly.** These are the same decisions
 *     `functions/walletLimits.js` makes inside the order transaction. Where the
 *     two disagree the screen lies — in whichever direction is worse. The week
 *     key in particular is ISO-8601, whose first and last days of January can
 *     belong to the neighbouring year, and `test-student-wallet.js` pins this
 *     implementation against the server's across every such boundary rather
 *     than trusting that two copies of an awkward rule stayed the same.
 */

import type { StudentWallet, WalletTransaction } from '../types/campus';

/** Both defaults mirror `functions/walletLimits.js`; the cross-check test pins them. */
export const DEFAULT_DAILY_LIMIT_SATANG = 20000;
export const DEFAULT_WEEKLY_LIMIT_SATANG = 100000;

/**
 * Today's calendar date in Asia/Bangkok, as "YYYY-MM-DD".
 *
 * The counters are keyed on the server's Bangkok date. A browser in another
 * timezone — or a phone whose clock is simply set elsewhere — must not read a
 * different day, or it reports a rollover that has not happened.
 */
export function bangkokDateKey(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is the key format the server writes.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * ISO-8601 week key ("2026-W37") for a "YYYY-MM-DD" date.
 *
 * ISO weeks start on Monday and a week belongs to the year containing its
 * Thursday, so 2027-01-01 is in 2026-W53. Computed in UTC on an already-local
 * calendar date, so no timezone shift can move the date across a boundary.
 */
export function isoWeekKey(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error(`isoWeekKey: expected a YYYY-MM-DD date, received: ${ymd}`);
  }
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  const dayOfWeek = date.getUTCDay() || 7; // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);

  const isoYear = date.getUTCFullYear();
  const firstDayOfIsoYear = Date.UTC(isoYear, 0, 1);
  const weekNumber = Math.ceil(((date.getTime() - firstDayOfIsoYear) / 86400000 + 1) / 7);

  return `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
}

/** Zero is a configured limit: a guardian freezing the wallet on purpose. */
export function isConfiguredLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export type WalletBlocker =
  | 'LOCKED'
  | 'LIMITS_NOT_CONFIGURED'
  | 'NO_BALANCE'
  | 'DAILY_LIMIT_REACHED'
  | 'WEEKLY_LIMIT_REACHED'
  | null;

export interface WalletSpendView {
  balanceSatang: number;
  /** Spent in the current period only. A rolled-over counter reads zero. */
  spentTodaySatang: number;
  spentThisWeekSatang: number;
  /** null when no limit is stored, which is not the same as an unlimited one. */
  dailyLimitSatang: number | null;
  weeklyLimitSatang: number | null;
  remainingTodaySatang: number | null;
  remainingThisWeekSatang: number | null;
  /** The most an order may cost right now: the smallest of the three. */
  spendableSatang: number;
  /** Why `spendableSatang` is 0, when it is. */
  blocker: WalletBlocker;
  todayKey: string;
  weekKey: string;
}

/**
 * What this wallet can spend right now, and why not, when it cannot.
 *
 * @param wallet   the wallet document, or null when the student has none yet
 * @param todayYmd today in Bangkok — passed in so the view is testable
 */
export function walletSpendView(
  wallet: StudentWallet | null | undefined,
  todayYmd: string
): WalletSpendView {
  const w = (wallet || {}) as Partial<StudentWallet>;
  const weekKey = isoWeekKey(todayYmd);

  const balanceSatang = Math.max(0, Number(w.balanceSatang) || 0);

  // A counter counts only while its stored key is the current one.
  const spentTodaySatang =
    w.lastSpentDate === todayYmd ? Math.max(0, Number(w.spentTodaySatang) || 0) : 0;
  const spentThisWeekSatang =
    w.lastSpentWeek === weekKey ? Math.max(0, Number(w.spentThisWeekSatang) || 0) : 0;

  const dailyLimitSatang = isConfiguredLimit(w.dailyLimitSatang) ? w.dailyLimitSatang : null;
  const weeklyLimitSatang = isConfiguredLimit(w.weeklyLimitSatang) ? w.weeklyLimitSatang : null;

  const remainingTodaySatang =
    dailyLimitSatang === null ? null : Math.max(0, dailyLimitSatang - spentTodaySatang);
  const remainingThisWeekSatang =
    weeklyLimitSatang === null ? null : Math.max(0, weeklyLimitSatang - spentThisWeekSatang);

  const base = {
    balanceSatang,
    spentTodaySatang,
    spentThisWeekSatang,
    dailyLimitSatang,
    weeklyLimitSatang,
    remainingTodaySatang,
    remainingThisWeekSatang,
    todayKey: todayYmd,
    weekKey,
  };

  if (w.isLocked === true) {
    return { ...base, spendableSatang: 0, blocker: 'LOCKED' };
  }
  // Fail-closed, exactly as the order transaction does: with no limit stored
  // the server refuses the order, so the screen must not offer an allowance.
  if (dailyLimitSatang === null || weeklyLimitSatang === null) {
    return { ...base, spendableSatang: 0, blocker: 'LIMITS_NOT_CONFIGURED' };
  }

  const spendableSatang = Math.min(
    balanceSatang,
    remainingTodaySatang as number,
    remainingThisWeekSatang as number
  );

  let blocker: WalletBlocker = null;
  if (spendableSatang <= 0) {
    // Name the binding constraint, not just the fact that it binds: "top up"
    // and "wait until tomorrow" are different instructions.
    if (remainingThisWeekSatang === 0) blocker = 'WEEKLY_LIMIT_REACHED';
    else if (remainingTodaySatang === 0) blocker = 'DAILY_LIMIT_REACHED';
    else blocker = 'NO_BALANCE';
  }

  return { ...base, spendableSatang: Math.max(0, spendableSatang), blocker };
}

/** Thai for why the wallet cannot be spent from, and what to do about it. */
export function describeBlocker(blocker: WalletBlocker): string | null {
  switch (blocker) {
    case 'LOCKED':
      return 'กระเป๋าเงินนี้ถูกล็อกโดยผู้ปกครอง จึงใช้จ่ายไม่ได้ชั่วคราว';
    case 'LIMITS_NOT_CONFIGURED':
      return 'ยังไม่ได้ตั้งวงเงินสำหรับกระเป๋านี้ จึงยังสั่งอาหารด้วยกระเป๋าเงินไม่ได้ กรุณาให้ผู้ปกครองหรือเจ้าหน้าที่ตั้งวงเงินก่อน';
    case 'NO_BALANCE':
      return 'ยอดเงินคงเหลือไม่พอ กรุณาให้ผู้ปกครองหรือเจ้าหน้าที่โรงเรียนเติมเงินให้';
    case 'DAILY_LIMIT_REACHED':
      return 'ใช้วงเงินของวันนี้ครบแล้ว วงเงินจะเริ่มใหม่ในวันพรุ่งนี้';
    case 'WEEKLY_LIMIT_REACHED':
      return 'ใช้วงเงินของสัปดาห์นี้ครบแล้ว วงเงินจะเริ่มใหม่ในวันจันทร์';
    default:
      return null;
  }
}

export interface LedgerEntry {
  /** +1 money in, -1 money out, 0 when the row does not say. */
  direction: 1 | -1 | 0;
  label: string;
  /** Always a positive magnitude; the ledger stores no signed amounts. */
  amountSatang: number;
}

/**
 * How one ledger row reads.
 *
 * Every row stores a positive magnitude and carries its direction in `type`, so
 * the sign has to come from the type and nowhere else. A row whose type this
 * app does not know is shown without a sign rather than guessed at — inventing
 * a direction on a money line is worse than admitting to not knowing.
 */
export function describeLedgerEntry(tx: Partial<WalletTransaction> | null | undefined): LedgerEntry {
  const amountSatang = Math.abs(Number(tx?.amountSatang) || 0);
  switch (tx?.type) {
    case 'TOPUP':
      return { direction: 1, label: 'เติมเงินเข้ากระเป๋า', amountSatang };
    case 'REFUND':
      return { direction: 1, label: 'คืนเงินจากการยกเลิกคำสั่งซื้อ', amountSatang };
    case 'SPEND':
      return { direction: -1, label: 'ชำระค่าอาหาร', amountSatang };
    case 'ADJUSTMENT':
      return { direction: 0, label: 'รายการปรับปรุงโดยเจ้าหน้าที่', amountSatang };
    default:
      return { direction: 0, label: 'รายการเคลื่อนไหว', amountSatang };
  }
}

/** ฿ with two decimals, from satang. One place, so no screen rounds differently. */
export function formatBaht(satang: number | null | undefined): string {
  // `Number(null)` is 0, so an unknown amount would print as ฿0.00 — which on a
  // wallet screen reads as "your money is gone" rather than "we do not know".
  if (satang === null || satang === undefined) return '—';
  const n = Number(satang);
  if (!Number.isFinite(n)) return '—';
  return `฿${(n / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
