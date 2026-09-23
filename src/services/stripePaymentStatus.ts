/**
 * ============================================================================
 * 💳 WHAT A STRIPE PAYMENT STATUS MEANS TO A PARENT
 * ============================================================================
 *
 * Stripe reports nine PaymentIntent statuses. A parent needs three answers:
 * the money left my account, it has not yet, or it did not.
 *
 * Kept in its own module with no imports so it can be tested for real rather
 * than modelled — the file the app runs is the file the suite calls.
 *
 * The distinction that matters most is the one this mapping CANNOT make:
 * `succeeded` means Stripe captured the money, never that the wallet was
 * credited. The credit happens in `stripeTopupWebhook`, in a transaction that
 * records the event id, and the browser does not get a say in it.
 */

/** What the browser may honestly say after a payment. */
export type ConfirmOutcome =
  /** Stripe has the money. The wallet is credited by the webhook, separately. */
  | { status: 'PAID'; paymentIntentId: string }
  /** Waiting on the payer — a PromptPay QR scanned but not yet approved. */
  | { status: 'PROCESSING'; paymentIntentId: string }
  /** No money moved, and the reason is worth showing. */
  | { status: 'FAILED'; message: string };

/**
 * A PaymentIntent status as one of the three things the UI may claim.
 *
 * Everything unrecognised is a failure rather than a success. A status this
 * code does not understand is not one it may credit a parent's trust against,
 * and Stripe adds statuses over time — defaulting the other way would turn a
 * future status into a false "paid".
 */
export function describeIntentStatus(status: string, paymentIntentId: string): ConfirmOutcome {
  switch (status) {
    case 'succeeded':
      return { status: 'PAID', paymentIntentId };
    case 'processing':
    case 'requires_action':
    case 'requires_confirmation':
    case 'requires_capture':
      return { status: 'PROCESSING', paymentIntentId };
    case 'requires_payment_method':
      return { status: 'FAILED', message: 'การชำระเงินไม่สำเร็จ กรุณาลองวิธีชำระเงินอื่น' };
    case 'canceled':
      return { status: 'FAILED', message: 'รายการชำระเงินถูกยกเลิก' };
    default:
      return { status: 'FAILED', message: `สถานะการชำระเงินไม่รู้จัก (${status})` };
  }
}

/**
 * Baht from satang, for display only.
 *
 * Satang is the integer the whole system stores and the minor unit Stripe uses
 * for THB, so this conversion exists at the screen and nowhere else. A ÷100
 * anywhere near the arithmetic is the bug this keeps out of it.
 */
export function satangToBahtText(satang: number): string {
  return (satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
