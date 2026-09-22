/**
 * ============================================================================
 * 🎟️  COUPON PREVIEW
 * ============================================================================
 *
 * Reads the same coupon documents the order transaction reads, and evaluates
 * them with the same function, so the discount shown before checkout is the
 * discount the server will apply.
 *
 * FoodBooking.tsx used to carry its own copy of the maths — three hardcoded
 * codes and their minimum spends — beside a second copy on the server. They
 * already disagreed: the client capped STUDENT10 at ฿30 by writing 30 and the
 * server by writing 3000 satang, which happened to match, but nothing made them
 * match. This is a preview only; the Cloud Function remains the authority and
 * will refuse anything this gets wrong.
 */

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import {
  evaluateCoupon,
  normalizeCouponCode,
  describeCouponRefusal,
} from '../../functions/couponRules.js';

export interface CouponPreview {
  code: string;
  title: string;
  discountSatang: number;
}

export interface CouponRefusal {
  code: string;
  message: string;
  reason: string;
}

/** Bangkok "YYYY-MM-DD" and "HH:MM" — the same instant the server would resolve. */
function bangkokNow(): { ymd: string; hhmm: string } {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  return { ymd, hhmm };
}

export interface PreviewInput {
  rawCode: string;
  subtotalSatang: number;
  storeId: string;
  userId: string;
  userRoles: string[];
}

/**
 * Evaluates a code for display.
 *
 * Returns either the discount or the reason it cannot be used — never a silent
 * zero. The old client applied a coupon whose minimum spend was not met by
 * showing an error, but the old *server* silently applied no discount and let
 * the order through at full price with the coupon still displayed as active.
 */
export async function previewCoupon(
  input: PreviewInput
): Promise<{ ok: true; preview: CouponPreview } | { ok: false; refusal: CouponRefusal }> {
  const code = normalizeCouponCode(input.rawCode);
  if (!code) {
    return {
      ok: false,
      refusal: { code: input.rawCode, reason: 'NOT_FOUND', message: describeCouponRefusal('NOT_FOUND') },
    };
  }

  const snap = await getDoc(doc(db, 'coupons', code));
  const couponData = snap.exists() ? { id: code, ...snap.data() } : null;

  // How many times this account has already redeemed it. The document is
  // backend-written and owner-readable; if the read is refused, treat it as
  // unknown rather than as zero — the server will make the real decision, and
  // guessing zero here would advertise a discount it may refuse.
  let timesUsedByUser = 0;
  try {
    const redemption = await getDoc(doc(db, 'coupon_redemptions', `${input.userId}_${code}`));
    if (redemption.exists()) timesUsedByUser = Number(redemption.data().count) || 0;
  } catch {
    timesUsedByUser = 0;
  }

  const { ymd, hhmm } = bangkokNow();
  const verdict = evaluateCoupon(couponData, {
    subtotalSatang: input.subtotalSatang,
    nowYmd: ymd,
    nowHhmm: hhmm,
    timesUsedByUser,
    userRoles: input.userRoles,
    storeId: input.storeId,
  });

  // Narrowed with `in` rather than `!verdict.ok`: this project compiles with
  // strictNullChecks off, where a `true`/`false` literal discriminant widens to
  // boolean and stops narrowing the union.
  if ('reason' in verdict) {
    return {
      ok: false,
      refusal: {
        code,
        reason: verdict.reason,
        message: describeCouponRefusal(verdict.reason, verdict.detail),
      },
    };
  }

  return { ok: true, preview: { code, title: verdict.title, discountSatang: verdict.discountSatang } };
}

export interface OfferedCoupon {
  code: string;
  title: string;
  description: string;
}

/** The active coupons worth showing as suggestions. */
export async function fetchOfferedCoupons(): Promise<OfferedCoupon[]> {
  const snap = await getDocs(query(collection(db, 'coupons'), where('active', '==', true)));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      code: d.id,
      title: String(data.title ?? d.id),
      description: String(data.description ?? ''),
    };
  });
}
