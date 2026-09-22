/**
 * ============================================================================
 * 🎟️  COUPON RULES
 * ============================================================================
 *
 * What a coupon is worth, and whether this person may use it right now.
 *
 * The rules used to be an if/else chain of three hardcoded codes inside
 * createOrderAuthoritative, and every one of them enforced less than its own
 * name promised:
 *
 *   WELCOME50  "ต้อนรับสมาชิกใหม่" — no new-member check and no once-per-user
 *              check. ฿50 off, every order, forever, for anyone who typed it.
 *              What tracked the claim was localStorage, which the user clears.
 *   HAPPY15    "Happy Hour" — no time window. Every hour was happy hour.
 *   STUDENT10  "ส่วนลดนักเรียนนักศึกษา" — never checked that the buyer was a
 *              student.
 *
 * Meanwhile the admin console wrote coupons into a `coupons` collection that
 * nothing ever read, so a coupon created there did nothing at all, and
 * FoodBooking.tsx carried a fourth copy of the discount maths for its preview.
 *
 * Now there is one definition — a coupon document — and one evaluator, this
 * file. The server applies it inside the order transaction; the client calls the
 * same function to show a preview and can therefore never promise a discount the
 * server will refuse.
 *
 * Money is in satang (integers) throughout. Nothing here touches the clock or
 * the network: the caller passes `nowBangkok` and the redemption count, so the
 * rules are fully testable and the server stays the only authority.
 */

/** A refusal the caller can turn into a message. */
export const COUPON_REFUSAL = Object.freeze({
  NOT_FOUND: "NOT_FOUND",
  INACTIVE: "INACTIVE",
  EXPIRED: "EXPIRED",
  NOT_STARTED: "NOT_STARTED",
  OUTSIDE_HAPPY_HOUR: "OUTSIDE_HAPPY_HOUR",
  MIN_SPEND_NOT_MET: "MIN_SPEND_NOT_MET",
  ALREADY_USED: "ALREADY_USED",
  AUDIENCE_MISMATCH: "AUDIENCE_MISMATCH",
  STORE_MISMATCH: "STORE_MISMATCH",
});

/** Normalises whatever the user typed into the id a coupon document uses. */
export function normalizeCouponCode(raw) {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  // Coupon codes are document ids. Anything outside this set is not a code we
  // ever issued, and refusing it here keeps a stray "/" from addressing a
  // different collection path.
  return /^[A-Z0-9_-]{3,32}$/.test(code) ? code : null;
}

/** "HH:MM" → minutes since midnight, or null if it is not a time. */
function toMinutes(hhmm) {
  if (typeof hhmm !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Is `nowHhmm` inside [startHhmm, endHhmm]?
 *
 * Handles a window that wraps past midnight, so a 22:00–02:00 promotion behaves
 * the way anyone reading it would expect rather than matching nothing.
 */
export function isWithinDailyWindow(nowHhmm, startHhmm, endHhmm) {
  const now = toMinutes(nowHhmm);
  const start = toMinutes(startHhmm);
  const end = toMinutes(endHhmm);
  if (now === null || start === null || end === null) return true; // no window configured
  return start <= end ? now >= start && now <= end : now >= start || now <= end;
}

/**
 * Evaluates a coupon against one order.
 *
 * @param {object|null} coupon  the coupon document, or null if there is none
 * @param {object} context
 *   @param {number} context.subtotalSatang     order total before discount
 *   @param {string} context.nowYmd             server's Bangkok date, "YYYY-MM-DD"
 *   @param {string} context.nowHhmm            server's Bangkok time, "HH:MM"
 *   @param {number} context.timesUsedByUser    how often THIS user has redeemed it
 *   @param {string[]} context.userRoles        the user's verified roles
 *   @param {string} context.storeId            the store being ordered from
 * @returns {{ok: true, discountSatang: number, title: string}
 *          |{ok: false, reason: string, detail?: object}}
 */
export function evaluateCoupon(coupon, context) {
  const {
    subtotalSatang = 0,
    nowYmd = "",
    nowHhmm = "",
    timesUsedByUser = 0,
    userRoles = [],
    storeId = "",
  } = context || {};

  if (!coupon || typeof coupon !== "object") {
    return { ok: false, reason: COUPON_REFUSAL.NOT_FOUND };
  }
  if (coupon.active === false) {
    return { ok: false, reason: COUPON_REFUSAL.INACTIVE };
  }

  // --- Validity dates -------------------------------------------------------
  if (typeof coupon.startsOn === "string" && coupon.startsOn && nowYmd < coupon.startsOn) {
    return { ok: false, reason: COUPON_REFUSAL.NOT_STARTED, detail: { startsOn: coupon.startsOn } };
  }
  if (typeof coupon.expiresOn === "string" && coupon.expiresOn && nowYmd > coupon.expiresOn) {
    return { ok: false, reason: COUPON_REFUSAL.EXPIRED, detail: { expiresOn: coupon.expiresOn } };
  }

  // --- Happy hour -----------------------------------------------------------
  if (coupon.dailyWindow && !isWithinDailyWindow(nowHhmm, coupon.dailyWindow.start, coupon.dailyWindow.end)) {
    return {
      ok: false,
      reason: COUPON_REFUSAL.OUTSIDE_HAPPY_HOUR,
      detail: { start: coupon.dailyWindow.start, end: coupon.dailyWindow.end },
    };
  }

  // --- Who it is for --------------------------------------------------------
  if (Array.isArray(coupon.audienceRoles) && coupon.audienceRoles.length > 0) {
    const roles = Array.isArray(userRoles) ? userRoles : [];
    if (!coupon.audienceRoles.some((r) => roles.includes(r))) {
      return {
        ok: false,
        reason: COUPON_REFUSAL.AUDIENCE_MISMATCH,
        detail: { audienceRoles: coupon.audienceRoles },
      };
    }
  }

  // --- Which store ----------------------------------------------------------
  if (typeof coupon.storeId === "string" && coupon.storeId && coupon.storeId !== storeId) {
    return { ok: false, reason: COUPON_REFUSAL.STORE_MISMATCH, detail: { storeId: coupon.storeId } };
  }

  // --- How many times -------------------------------------------------------
  // A coupon with no stated limit is unlimited; the built-in three all state one.
  const maxPerUser =
    typeof coupon.maxPerUser === "number" && coupon.maxPerUser >= 0 ? coupon.maxPerUser : null;
  if (maxPerUser !== null && timesUsedByUser >= maxPerUser) {
    return {
      ok: false,
      reason: COUPON_REFUSAL.ALREADY_USED,
      detail: { maxPerUser, timesUsedByUser },
    };
  }

  // --- Minimum spend --------------------------------------------------------
  const minSpend = Number(coupon.minSpendSatang) || 0;
  if (subtotalSatang < minSpend) {
    return { ok: false, reason: COUPON_REFUSAL.MIN_SPEND_NOT_MET, detail: { minSpendSatang: minSpend } };
  }

  // --- The discount ---------------------------------------------------------
  let rawDiscount;
  if (coupon.type === "PERCENT") {
    const percent = Number(coupon.percent) || 0;
    const cap = Number(coupon.maxDiscountSatang) || 0;
    const byPercent = Math.round((subtotalSatang * percent) / 100);
    rawDiscount = cap > 0 ? Math.min(byPercent, cap) : byPercent;
  } else {
    rawDiscount = Number(coupon.amountSatang) || 0;
  }

  // Never more than the order, and never negative — a discount that exceeds the
  // total would otherwise produce a refund out of a coupon.
  const discountSatang = Math.max(0, Math.min(rawDiscount, subtotalSatang));

  return {
    ok: true,
    discountSatang,
    title: typeof coupon.title === "string" ? coupon.title : String(coupon.id || ""),
  };
}

/** Human-readable Thai for a refusal, so the server and the client agree. */
export function describeCouponRefusal(reason, detail = {}) {
  const baht = (satang) => (Number(satang) || 0) / 100;
  switch (reason) {
    case COUPON_REFUSAL.NOT_FOUND:
      return "ไม่พบโค้ดส่วนลดนี้ในระบบ";
    case COUPON_REFUSAL.INACTIVE:
      return "โค้ดส่วนลดนี้ถูกปิดใช้งานแล้ว";
    case COUPON_REFUSAL.EXPIRED:
      return `โค้ดส่วนลดนี้หมดอายุแล้ว (สิ้นสุด ${detail.expiresOn || "-"})`;
    case COUPON_REFUSAL.NOT_STARTED:
      return `โค้ดส่วนลดนี้ยังไม่เริ่มใช้งาน (เริ่ม ${detail.startsOn || "-"})`;
    case COUPON_REFUSAL.OUTSIDE_HAPPY_HOUR:
      return `โค้ดนี้ใช้ได้เฉพาะช่วง ${detail.start || "-"} ถึง ${detail.end || "-"} น. เท่านั้น`;
    case COUPON_REFUSAL.MIN_SPEND_NOT_MET:
      return `ยอดสั่งซื้อขั้นต่ำสำหรับโค้ดนี้คือ ฿${baht(detail.minSpendSatang)}`;
    case COUPON_REFUSAL.ALREADY_USED:
      return detail.maxPerUser === 1
        ? "โค้ดนี้ใช้ได้เพียงครั้งเดียวต่อหนึ่งบัญชี และคุณใช้ไปแล้ว"
        : `โค้ดนี้ใช้ได้สูงสุด ${detail.maxPerUser} ครั้งต่อบัญชี และคุณใช้ครบแล้ว`;
    case COUPON_REFUSAL.AUDIENCE_MISMATCH:
      return "บัญชีของคุณไม่อยู่ในกลุ่มที่ใช้โค้ดนี้ได้";
    case COUPON_REFUSAL.STORE_MISMATCH:
      return "โค้ดนี้ใช้ได้เฉพาะกับร้านค้าที่กำหนดเท่านั้น";
    default:
      return "ไม่สามารถใช้โค้ดส่วนลดนี้ได้";
  }
}
