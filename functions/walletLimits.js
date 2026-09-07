/**
 * ============================================================================
 * 💰 CAMPUS WALLET SPENDING LIMIT COUNTERS
 * ============================================================================
 *
 * Daily and weekly spending counters, and the rules for when they reset.
 *
 * Two properties matter here:
 *
 *  1. Counters are keyed on the date the money actually leaves the wallet — the
 *     server's current Bangkok date — never on the pickup date the client asked
 *     for. Keying on the pickup date let a student alternate between ordering
 *     for today and for tomorrow: each order saw a different key, found no
 *     matching counter, reset the running total to zero, and the daily limit
 *     never bound. The balance is debited at order time, so order time is also
 *     the honest moment to count the spend against.
 *
 *  2. Resets are lazy rather than scheduled. A counter whose stored key is not
 *     the current key reads as zero, so a new day or a new ISO week starts
 *     clean without a cron job having to run. The weekly total previously had
 *     no reset path at all — `scheduledDailyMaintenance` logs a line and
 *     nothing else — so `spentThisWeekSatang` grew forever until it crossed the
 *     weekly limit and locked the student out permanently.
 *
 * Pure and dependency-free so the rules can be exercised directly by tests.
 */

export const DEFAULT_DAILY_LIMIT_SATANG = 20000; // 200 THB
export const DEFAULT_WEEKLY_LIMIT_SATANG = 100000; // 1000 THB

/**
 * ISO-8601 week key ("2026-W37") for a calendar date given as "YYYY-MM-DD".
 *
 * ISO weeks start on Monday, and a week belongs to the year containing its
 * Thursday — so the first days of January can fall in the last week of the
 * previous year, and vice versa. Computed in UTC on the already-localised
 * calendar date, so no timezone shifting can move the date across a boundary.
 */
export function getIsoWeekKey(ymd) {
  if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error(`getIsoWeekKey: expected a YYYY-MM-DD date, received: ${ymd}`);
  }

  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Shift to the Thursday of this ISO week (Mon=1 ... Sun=7).
  const dayOfWeek = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);

  const isoYear = date.getUTCFullYear();
  const firstDayOfIsoYear = Date.UTC(isoYear, 0, 1);
  const weekNumber = Math.ceil(((date.getTime() - firstDayOfIsoYear) / 86400000 + 1) / 7);

  return `${isoYear}-W${String(weekNumber).padStart(2, "0")}`;
}

/**
 * Resolves the spending counters and limits that apply right now.
 *
 * A stored counter counts only when its stored key matches the current key;
 * otherwise the period has rolled over and the counter reads zero. Wallets
 * written before `lastSpentWeek` existed therefore start their weekly total
 * fresh, which also clears any total that had inflated past the weekly limit.
 *
 * @param {object|null} walletData - the wallet document
 * @param {string} todayYmd - the server's current Bangkok date, "YYYY-MM-DD"
 */
export function resolveSpendingCounters(walletData, todayYmd) {
  const wallet = walletData || {};
  const weekKey = getIsoWeekKey(todayYmd);

  const spentToday =
    wallet.lastSpentDate === todayYmd ? Math.max(0, Number(wallet.spentTodaySatang) || 0) : 0;

  const spentThisWeek =
    wallet.lastSpentWeek === weekKey ? Math.max(0, Number(wallet.spentThisWeekSatang) || 0) : 0;

  const dailyLimitSatang =
    typeof wallet.dailyLimitSatang === "number" && wallet.dailyLimitSatang >= 0
      ? wallet.dailyLimitSatang
      : DEFAULT_DAILY_LIMIT_SATANG;

  const weeklyLimitSatang =
    typeof wallet.weeklyLimitSatang === "number" && wallet.weeklyLimitSatang >= 0
      ? wallet.weeklyLimitSatang
      : DEFAULT_WEEKLY_LIMIT_SATANG;

  return { todayYmd, weekKey, spentToday, spentThisWeek, dailyLimitSatang, weeklyLimitSatang };
}
