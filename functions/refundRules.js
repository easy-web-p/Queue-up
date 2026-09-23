/**
 * ============================================================================
 * ↩️ CANCELLATION & REFUND RULES
 * ============================================================================
 *
 * Who may cancel an order, when, and how much money comes back. No Firestore
 * here — index.js does the awaiting; these are the decisions, which are the
 * part that can be wrong.
 *
 * Until now money could enter this system and be spent, and never come back.
 * `createOrderAuthoritative` debits `wallets/{studentId}.balanceSatang` inside
 * the order transaction. Cancelling was a plain client-side write of
 * `status: 'CANCELLED'`, which the rules allowed for the customer before the
 * kitchen started and for the stall at any point — and nothing anywhere
 * credited the wallet back. `WalletTransaction.type` has listed 'REFUND' the
 * whole time and no code ever wrote one. So a stall that ran out of an
 * ingredient cancelled the order, and the student had paid for nothing.
 *
 * Meanwhile the PDPA page carries a "นโยบายการคืนเงินและยกเลิกคำสั่งซื้อ"
 * section promising cancellation before the kitchen starts, and no screen in
 * the app had a cancel button at all.
 *
 * Three things these rules exist to get right:
 *
 *  1. **A refund is the amount actually charged.** `finalAmountSatang` — after
 *     the coupon — not the subtotal. Refunding the subtotal would pay out the
 *     discount as cash.
 *
 *  2. **Once only.** A refund is recorded on the order itself, and a second
 *     cancellation of the same order refunds nothing. Without that, a retried
 *     request or two members of staff working the same queue pay twice.
 *
 *  3. **A customer's window closes when the food starts.** After that only the
 *     stall may cancel — they are the ones who know whether it can still be
 *     stopped, and they are the ones absorbing the loss.
 */

/** Cancelling is only ever possible while the food is still owed. */
export const CANCELLABLE_STATUSES = Object.freeze(["PENDING", "CONFIRMED", "PREPARING", "READY"]);

/** A customer may pull out only before the kitchen commits to cooking. */
export const CUSTOMER_CANCELLABLE_STATUSES = Object.freeze(["PENDING", "CONFIRMED"]);

export const REFUND_REFUSAL = Object.freeze({
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  ALREADY_CANCELLED: "ALREADY_CANCELLED",
  ALREADY_COMPLETED: "ALREADY_COMPLETED",
  TOO_LATE_FOR_CUSTOMER: "TOO_LATE_FOR_CUSTOMER",
  NOT_YOUR_ORDER: "NOT_YOUR_ORDER",
});

/** Who is asking. The stall and the school can cancel later than the customer. */
export const CANCEL_ACTOR = Object.freeze({
  CUSTOMER: "CUSTOMER",
  STORE: "STORE",
  ADMIN: "ADMIN",
});

/**
 * May this order be cancelled, by this person, right now?
 *
 * Returns a refusal rather than throwing, so index.js can turn it into an
 * HttpsError and the tests can call it directly.
 *
 * @param {object|null} order  the order document, or null when it is missing
 * @param {string} actor       one of CANCEL_ACTOR
 * @returns {{ok: true} | {ok: false, status, code, message}}
 */
export function checkCancellable(order, actor) {
  if (!order) {
    return {
      ok: false,
      status: "not-found",
      code: REFUND_REFUSAL.ORDER_NOT_FOUND,
      message: "ไม่พบคำสั่งซื้อนี้ในระบบ",
    };
  }

  const status = String(order.status || "").toUpperCase();

  if (status === "CANCELLED") {
    // Not an error the caller must handle loudly, but not a second refund
    // either. index.js reports it as already-done.
    return {
      ok: false,
      status: "failed-precondition",
      code: REFUND_REFUSAL.ALREADY_CANCELLED,
      message: "คำสั่งซื้อนี้ถูกยกเลิกไปแล้ว",
    };
  }

  if (!CANCELLABLE_STATUSES.includes(status)) {
    return {
      ok: false,
      status: "failed-precondition",
      code: REFUND_REFUSAL.ALREADY_COMPLETED,
      message: "คำสั่งซื้อนี้เสร็จสิ้นแล้ว ไม่สามารถยกเลิกได้",
    };
  }

  if (actor === CANCEL_ACTOR.CUSTOMER && !CUSTOMER_CANCELLABLE_STATUSES.includes(status)) {
    return {
      ok: false,
      status: "failed-precondition",
      code: REFUND_REFUSAL.TOO_LATE_FOR_CUSTOMER,
      message:
        "ร้านเริ่มปรุงอาหารแล้ว จึงยกเลิกเองไม่ได้ กรุณาติดต่อร้านค้าโดยตรงหากมีปัญหา",
    };
  }

  return { ok: true };
}

/**
 * How much comes back.
 *
 * `finalAmountSatang` is the amount the order transaction actually debited —
 * after any coupon. Refunding `totalAmountSatang` would hand back the discount
 * as cash, so a ฿50 coupon on a ฿100 order would return ฿100 for ฿50 paid.
 *
 * Only a wallet-paid order refunds at all: DIRECT_ZERO_PAYMENT is settled at
 * the counter and the app never held the money.
 *
 * @returns {{refundSatang: number, reason: string}}
 */
export function computeRefund(order) {
  const o = order || {};

  if (o.paymentMode !== "CAMPUS_WALLET") {
    return { refundSatang: 0, reason: "NOT_WALLET_PAID" };
  }
  if (String(o.paymentStatus || "").toUpperCase() !== "PAID") {
    return { refundSatang: 0, reason: "NOT_PAID" };
  }
  if (o.refundedSatang > 0) {
    // The order carries its own refund record, so a retry cannot pay twice.
    return { refundSatang: 0, reason: "ALREADY_REFUNDED" };
  }

  const charged = Number(o.finalAmountSatang);
  if (!Number.isInteger(charged) || charged <= 0) {
    return { refundSatang: 0, reason: "NOTHING_CHARGED" };
  }

  return { refundSatang: charged, reason: "FULL_REFUND" };
}

/**
 * Whose wallet the money goes back to.
 *
 * The order stores `studentId` because a guardian may have placed it. The
 * wallet that was debited is the student's, so that is the one credited — never
 * the caller's.
 */
export function refundTargetStudentId(order) {
  const o = order || {};
  return typeof o.studentId === "string" && o.studentId ? o.studentId : null;
}

/** Human-readable Thai for a refusal, so the server and the client agree. */
export function describeRefundRefusal(code) {
  switch (code) {
    case REFUND_REFUSAL.ORDER_NOT_FOUND:
      return "ไม่พบคำสั่งซื้อนี้ในระบบ";
    case REFUND_REFUSAL.ALREADY_CANCELLED:
      return "คำสั่งซื้อนี้ถูกยกเลิกไปแล้ว";
    case REFUND_REFUSAL.ALREADY_COMPLETED:
      return "คำสั่งซื้อนี้เสร็จสิ้นแล้ว ไม่สามารถยกเลิกได้";
    case REFUND_REFUSAL.TOO_LATE_FOR_CUSTOMER:
      return "ร้านเริ่มปรุงอาหารแล้ว จึงยกเลิกเองไม่ได้";
    case REFUND_REFUSAL.NOT_YOUR_ORDER:
      return "คำสั่งซื้อนี้ไม่ใช่ของคุณ";
    default:
      return "ยกเลิกคำสั่งซื้อไม่สำเร็จ";
  }
}
