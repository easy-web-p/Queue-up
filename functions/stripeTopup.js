/**
 * ============================================================================
 * 💳 STRIPE TOP-UP RULES
 * ============================================================================
 *
 * Deciding what a Stripe event means for a student's wallet, without touching
 * Stripe or Firestore. index.js does the awaiting; these rules are what can go
 * wrong, so they are what is tested.
 *
 * Three properties matter here, and each of them is a way to lose money:
 *
 *  1. **The credit comes from Stripe, never from the client.** The browser says
 *     how much it wants to pay; Stripe says how much actually arrived. Crediting
 *     the requested amount rather than `amount_received` would let a caller ask
 *     for ฿20 and be credited ฿20,000.
 *
 *  2. **A webhook is delivered at least once.** Stripe retries on any non-2xx
 *     and can deliver the same event twice on its own. Without a recorded
 *     event id, a redelivery credits the wallet again.
 *
 *  3. **A Stripe request is never confirmable by hand.** The manual path exists
 *     for cash at the office, where a member of staff confirming IS the capture.
 *     Letting staff confirm a Stripe request would credit a wallet for a payment
 *     that may have failed — the exact hole the manual flow was built to close,
 *     reopened from the other side.
 *
 * Satang is Stripe's minor unit for THB, so the amount needs no conversion at
 * all — 2000 satang is `amount: 2000, currency: 'thb'`. That is worth stating
 * because the usual bug in this area is a stray ×100 or ÷100.
 */

/** Where a top-up request came from, which decides who may complete it. */
export const TOPUP_SOURCE = Object.freeze({
  /** Cash or a transfer slip handed to staff. Staff confirming is the capture. */
  MANUAL: "MANUAL",
  /** Paid through Stripe. Only a verified webhook may complete it. */
  STRIPE: "STRIPE",
});

export const TOPUP_STATUS = Object.freeze({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  FAILED: "FAILED",
});

/** Thailand. Stripe's minor unit for THB is the satang, which is what we store. */
export const STRIPE_CURRENCY = "thb";

/**
 * Stripe's own minimum charge for THB (฿10). A PaymentIntent below it is
 * rejected by the API, so catching it here turns a confusing upstream error
 * into a sentence the parent can act on.
 */
export const MIN_TOPUP_SATANG = 1000;

/**
 * Validates a top-up request before a PaymentIntent is created.
 *
 * @param {unknown} amountSatang
 * @param {number} maxSatang - MAX_TOPUP_SATANG, the per-transaction ceiling
 * @returns {{ok: true, amountSatang: number} | {ok: false, code: string, message: string}}
 */
export function validateTopupAmount(amountSatang, maxSatang) {
  // No coercion. `Number('2000')` is a perfectly good integer, which is exactly
  // why a string must not get this far: a numeric string reaching Stripe's
  // `amount` field is a type confusion at a money boundary, and the same string
  // arriving from JSON is how a client smuggles one in.
  const amount = amountSatang;

  if (typeof amount !== "number" || !Number.isInteger(amount)) {
    return {
      ok: false,
      code: "TOPUP_AMOUNT_INVALID",
      message: "จำนวนเงินต้องเป็นจำนวนเต็ม (หน่วยสตางค์)",
    };
  }
  if (amount < MIN_TOPUP_SATANG) {
    return {
      ok: false,
      code: "TOPUP_AMOUNT_TOO_SMALL",
      message: `เติมเงินขั้นต่ำ ${MIN_TOPUP_SATANG / 100} บาทต่อรายการ`,
    };
  }
  if (amount > maxSatang) {
    return {
      ok: false,
      code: "TOPUP_AMOUNT_TOO_LARGE",
      message: `เติมเงินได้สูงสุด ${maxSatang / 100} บาทต่อรายการ`,
    };
  }

  return { ok: true, amountSatang: amount };
}

/**
 * What a Stripe event means for the wallet.
 *
 * Only `payment_intent.succeeded` credits, and it credits `amount_received` —
 * the amount Stripe actually captured — not anything the client asked for.
 * A partial capture therefore credits the partial amount rather than the
 * requested one.
 *
 * Everything unrecognised is `IGNORE` rather than an error: Stripe sends event
 * types this endpoint never asked for, and failing them would make Stripe retry
 * forever and eventually disable the endpoint.
 *
 * @param {object} event - the verified Stripe event
 * @returns {{action: 'CREDIT', creditSatang: number, paymentIntentId: string, metadata: object}
 *          |{action: 'FAIL', paymentIntentId: string, reason: string, metadata: object}
 *          |{action: 'IGNORE', reason: string}}
 */
export function interpretStripeEvent(event) {
  const type = event && event.type;
  const object = event && event.data && event.data.object;

  if (!type || !object) {
    return { action: "IGNORE", reason: "MALFORMED_EVENT" };
  }

  const metadata = object.metadata || {};

  if (type === "payment_intent.succeeded") {
    // amount_received is what Stripe captured. `amount` is what was requested,
    // and the two differ on a partial capture.
    const received = Number(object.amount_received);
    if (!Number.isInteger(received) || received <= 0) {
      return { action: "IGNORE", reason: "NO_AMOUNT_RECEIVED" };
    }
    if (object.currency && object.currency.toLowerCase() !== STRIPE_CURRENCY) {
      // A payment in another currency cannot be credited as satang.
      return { action: "IGNORE", reason: "UNEXPECTED_CURRENCY" };
    }
    return {
      action: "CREDIT",
      creditSatang: received,
      paymentIntentId: String(object.id || ""),
      metadata,
    };
  }

  if (type === "payment_intent.payment_failed" || type === "payment_intent.canceled") {
    return {
      action: "FAIL",
      paymentIntentId: String(object.id || ""),
      reason: (object.last_payment_error && object.last_payment_error.message) || type,
      metadata,
    };
  }

  return { action: "IGNORE", reason: `UNHANDLED_TYPE:${type}` };
}

/**
 * The metadata a PaymentIntent must carry to be creditable.
 *
 * A webhook arrives with no memory of the call that started it. Everything
 * needed to decide whose wallet moves has to be on the PaymentIntent itself —
 * and read back from Stripe's copy, which the client cannot alter after the
 * fact.
 */
export function buildTopupMetadata({ studentId, requestId, requestedBy }) {
  return {
    queueup_purpose: "WALLET_TOPUP",
    queueup_student_id: String(studentId),
    queueup_request_id: String(requestId),
    queueup_requested_by: String(requestedBy),
  };
}

/**
 * Is this event one of ours, and which request does it complete?
 *
 * The endpoint receives every event the account emits, including from other
 * integrations on the same account. Crediting on anything that merely looks
 * like a top-up is how an unrelated charge moves a student's balance.
 */
export function resolveTopupTarget(metadata) {
  const meta = metadata || {};
  if (meta.queueup_purpose !== "WALLET_TOPUP") {
    return { ok: false, reason: "NOT_A_TOPUP" };
  }
  const studentId = meta.queueup_student_id;
  const requestId = meta.queueup_request_id;
  if (!studentId || !requestId) {
    return { ok: false, reason: "MISSING_METADATA" };
  }
  return { ok: true, studentId: String(studentId), requestId: String(requestId) };
}

/**
 * May this top-up request be completed by hand?
 *
 * Only a MANUAL one. A STRIPE request is completed by a verified webhook or not
 * at all — staff confirming it would credit a wallet for a payment that might
 * have failed, which is the hole the manual flow exists to close, reopened from
 * the other side.
 */
export function canConfirmManually(request) {
  const source = (request && request.source) || TOPUP_SOURCE.MANUAL;
  if (source !== TOPUP_SOURCE.MANUAL) {
    return {
      ok: false,
      code: "TOPUP_IS_STRIPE_PAID",
      message:
        "คำขอนี้ชำระผ่าน Stripe ระบบจะเติมเงินให้อัตโนมัติเมื่อชำระเงินสำเร็จ เจ้าหน้าที่ยืนยันด้วยตนเองไม่ได้",
    };
  }
  return { ok: true };
}
