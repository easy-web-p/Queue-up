/**
 * ============================================================================
 * 🏪 STORE-DEPLOYED COUPON RULES
 * ============================================================================
 *
 * A stall offering its own discount. No Firestore here — index.js does the
 * awaiting; these are the decisions, which are the part that can be wrong.
 *
 * The merchant dashboard had a "1-Click Deploy" button whose handler wrote the
 * coupon to `localStorage['queueup_merchant_coupons_<storeId>']` and then said
 * "เปิดใช้งานคูปอง … เรียบร้อยแล้ว! ลูกค้าสามารถใช้ส่วนลดได้ทันที". No customer
 * could ever use it: the order transaction prices coupons from `coupons/{code}`
 * in Firestore, and that collection is admin-write-only. A merchant ran a
 * promotion that existed on one laptop.
 *
 * Two things this has to get right that the localStorage version never faced:
 *
 *  1. **A coupon code is a document id, so it is global.** Two stalls cannot
 *     both own "HAPPY15", and a stall must not be able to overwrite a
 *     platform-wide coupon by choosing its name. A code already taken by
 *     someone else is refused, with the reason.
 *
 *  2. **A store coupon is only valid at that store.** `evaluateCoupon` already
 *     enforces `coupon.storeId`; this is what sets it, so a discount funded by
 *     one stall cannot be spent at another.
 */

/** Same shape the order transaction reads — see couponRules.evaluateCoupon. */
export const STORE_COUPON_REFUSAL = Object.freeze({
  CODE_INVALID: "CODE_INVALID",
  CODE_TAKEN: "CODE_TAKEN",
  CODE_RESERVED: "CODE_RESERVED",
  AMOUNT_INVALID: "AMOUNT_INVALID",
  PERCENT_INVALID: "PERCENT_INVALID",
  NOT_STORE_OWNER: "NOT_STORE_OWNER",
});

/**
 * Codes a stall may not claim.
 *
 * The dashboard's own suggestions used to be HAPPY15, STUDENT10 and VIPQUEUE —
 * two of which are the platform's built-in coupons. Deploying one would have
 * overwritten a campaign running across every stall in the school.
 */
export const RESERVED_CODES = Object.freeze(["WELCOME50", "HAPPY15", "STUDENT10"]);

/** A discount a stall cannot afford to have mistyped. ฿500 / 90% is the ceiling. */
export const MAX_STORE_DISCOUNT_SATANG = 50000;
export const MAX_STORE_PERCENT = 90;

/**
 * Validates what the merchant typed, before anything is written.
 *
 * @returns {{ok: true, coupon: object} | {ok: false, status, code, message}}
 */
export function validateStoreCoupon(input, storeId) {
  const raw = input || {};
  const code = typeof raw.code === "string" ? raw.code.trim().toUpperCase() : "";

  // Same grammar as normalizeCouponCode: a code is a document id.
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return {
      ok: false,
      status: "invalid-argument",
      code: STORE_COUPON_REFUSAL.CODE_INVALID,
      message: "โค้ดส่วนลดต้องเป็น A-Z, 0-9, - หรือ _ ความยาว 3-32 ตัวอักษร",
    };
  }

  if (RESERVED_CODES.includes(code)) {
    return {
      ok: false,
      status: "failed-precondition",
      code: STORE_COUPON_REFUSAL.CODE_RESERVED,
      message: `โค้ด ${code} เป็นคูปองกลางของระบบ กรุณาตั้งโค้ดอื่นสำหรับร้านของคุณ`,
    };
  }

  if (!storeId || typeof storeId !== "string") {
    return {
      ok: false,
      status: "invalid-argument",
      code: STORE_COUPON_REFUSAL.NOT_STORE_OWNER,
      message: "ไม่พบรหัสร้านค้า",
    };
  }

  const type = raw.type === "PERCENT" ? "PERCENT" : "FIXED";
  const minSpendSatang = Math.max(0, Math.round(Number(raw.minSpendSatang) || 0));

  if (type === "PERCENT") {
    const percent = Number(raw.percent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > MAX_STORE_PERCENT) {
      return {
        ok: false,
        status: "invalid-argument",
        code: STORE_COUPON_REFUSAL.PERCENT_INVALID,
        message: `ส่วนลดเป็นเปอร์เซ็นต์ต้องอยู่ระหว่าง 1-${MAX_STORE_PERCENT}%`,
      };
    }
    const cap = Math.round(Number(raw.maxDiscountSatang) || 0);
    if (cap < 0 || cap > MAX_STORE_DISCOUNT_SATANG) {
      return {
        ok: false,
        status: "invalid-argument",
        code: STORE_COUPON_REFUSAL.AMOUNT_INVALID,
        message: `เพดานส่วนลดต้องไม่เกิน ฿${MAX_STORE_DISCOUNT_SATANG / 100}`,
      };
    }
    return {
      ok: true,
      coupon: buildStoreCoupon({ code, type, percent, maxDiscountSatang: cap, minSpendSatang, raw }, storeId),
    };
  }

  const amountSatang = Math.round(Number(raw.amountSatang));
  if (!Number.isInteger(amountSatang) || amountSatang <= 0 || amountSatang > MAX_STORE_DISCOUNT_SATANG) {
    return {
      ok: false,
      status: "invalid-argument",
      code: STORE_COUPON_REFUSAL.AMOUNT_INVALID,
      message: `ส่วนลดต้องมากกว่า ฿0 และไม่เกิน ฿${MAX_STORE_DISCOUNT_SATANG / 100}`,
    };
  }

  return {
    ok: true,
    coupon: buildStoreCoupon({ code, type, amountSatang, minSpendSatang, raw }, storeId),
  };
}

/**
 * The coupon document, in the exact shape `evaluateCoupon` reads.
 *
 * `storeId` is what confines it to this stall. `isPublic` makes it discoverable
 * as a chip; the chip list is filtered by store, and the engine refuses it
 * elsewhere either way.
 */
export function buildStoreCoupon(fields, storeId) {
  const { code, type, percent, maxDiscountSatang, amountSatang, minSpendSatang, raw = {} } = fields;
  const coupon = {
    id: code,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 120) : code,
    description:
      typeof raw.description === "string" ? raw.description.trim().slice(0, 300) : "",
    type,
    minSpendSatang,
    storeId,
    isPublic: true,
    active: true,
    source: "STORE_DEPLOYED",
  };
  if (type === "PERCENT") {
    coupon.percent = percent;
    if (maxDiscountSatang > 0) coupon.maxDiscountSatang = maxDiscountSatang;
  } else {
    coupon.amountSatang = amountSatang;
  }
  return coupon;
}

/**
 * May this store write to this existing coupon document?
 *
 * A code is a global document id, so "deploy" on a name someone else holds
 * would overwrite their campaign. Only a coupon this same store already owns
 * may be replaced.
 */
export function canStoreClaimCode(existing, storeId) {
  if (!existing) return { ok: true };
  if (existing.storeId === storeId) return { ok: true };
  return {
    ok: false,
    status: "already-exists",
    code: STORE_COUPON_REFUSAL.CODE_TAKEN,
    message: "โค้ดนี้ถูกใช้ไปแล้วในระบบ กรุณาตั้งโค้ดอื่น",
  };
}
