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
 * Is this stored value a limit a human actually chose?
 *
 * The one definition of "configured", used both by the spend check below and by
 * the bootstrap patch above it. Written down once because the two must agree:
 * if the bootstrap thought a limit was missing while the spend check thought it
 * was present, a wallet would be reseeded to the default on every order.
 *
 * Zero counts as configured. A guardian who sets the daily limit to 0 is
 * freezing the wallet on purpose, and treating that as "unset" would quietly
 * replace the freeze with a 200 THB allowance.
 */
export function isConfiguredLimit(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * The limit fields a wallet still needs before it can be spent from.
 *
 * Spending is fail-closed: with no limits stored, resolveSpendingCounters
 * returns null and createOrderAuthoritative refuses the order. Nothing in the
 * app was writing limits, so every wallet ever created sat in that state and
 * no campus-wallet order could ever complete. The guardian screen that sets
 * limits is itself reachable only after the school verifies the link, so
 * "the guardian will set them first" was never a path a student could walk.
 *
 * So a wallet is born with the defaults instead, and the guardian tightens or
 * relaxes them afterwards. Returns only the fields that are missing, so
 * applying it can never overwrite a limit someone chose — including a
 * deliberate 0.
 *
 * @param {object|null} walletData - the wallet document, or null if it has none yet
 * @returns {{dailyLimitSatang?: number, weeklyLimitSatang?: number}} possibly empty
 */
export function resolveMissingLimitDefaults(walletData) {
  const wallet = walletData || {};
  const patch = {};

  if (!isConfiguredLimit(wallet.dailyLimitSatang)) {
    patch.dailyLimitSatang = DEFAULT_DAILY_LIMIT_SATANG;
  }
  if (!isConfiguredLimit(wallet.weeklyLimitSatang)) {
    patch.weeklyLimitSatang = DEFAULT_WEEKLY_LIMIT_SATANG;
  }

  return patch;
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

  // Fail-Closed: unset limits resolve to null. The caller (createOrderAuthoritative)
  // must reject the transaction with WALLET_LIMITS_NOT_CONFIGURED until a limit
  // exists. A limit of 0 remains valid as a deliberate spending freeze.
  const dailyLimitSatang = isConfiguredLimit(wallet.dailyLimitSatang)
    ? wallet.dailyLimitSatang
    : null;

  const weeklyLimitSatang = isConfiguredLimit(wallet.weeklyLimitSatang)
    ? wallet.weeklyLimitSatang
    : null;

  return { todayYmd, weekKey, spentToday, spentThisWeek, dailyLimitSatang, weeklyLimitSatang };
}
