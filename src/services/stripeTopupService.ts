/**
 * ============================================================================
 * 💳 STRIPE TOP-UP — CLIENT SIDE
 * ============================================================================
 *
 * The browser's half of the Stripe flow, and the shortest way to state what it
 * is allowed to do: start a payment and confirm it. It never credits anything.
 *
 * The balance moves in `stripeTopupWebhook`, on Stripe's word, in a transaction
 * that records the event id. Nothing here — not a successful `confirmPayment`,
 * not a `succeeded` status read back from Stripe — is evidence the wallet has
 * been credited, only that it is about to be. Code here that reported success
 * as a completed top-up would put a parent's child at the counter with money
 * that has not arrived.
 */

import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { db, functions } from '../firebase/config.js';
import { describeIntentStatus, type ConfirmOutcome } from './stripePaymentStatus';

export { describeIntentStatus, type ConfirmOutcome } from './stripePaymentStatus';

/**
 * The publishable key, which is meant to be public — it identifies the account
 * and can only create payments, never read or move money.
 *
 * Deliberately with no fallback. The secret key lives in a Cloud Functions
 * secret and never appears in this bundle; the publishable one is merely
 * public, which is not the same as belonging in source control. Unset, the
 * Stripe option is hidden rather than silently charging someone else's account.
 */
const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

/** Is the Stripe path available in this deployment? */
export function isStripeConfigured(): boolean {
  return typeof PUBLISHABLE_KEY === 'string' && PUBLISHABLE_KEY.startsWith('pk_');
}

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Stripe.js, loaded once and only when a payment actually starts.
 *
 * `loadStripe` injects a script from js.stripe.com, so calling it at module
 * scope would add a third-party request to every page load — including for the
 * students and staff who never top anything up.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!isStripeConfigured()) return Promise.resolve(null);
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY as string);
  return stripePromise;
}

export interface TopupIntent {
  success: boolean;
  requestId: string;
  paymentIntentId: string;
  clientSecret: string;
  amountSatang: number;
  currency: string;
  /** Always true. Nothing is credited until the webhook says so. */
  pending: boolean;
  message: string;
}

/**
 * Ask the server to start a payment.
 *
 * The amount is checked again server-side against the same ceiling as the cash
 * path — this call is the client asking, not the client deciding.
 *
 * @param amountSatang integer satang. Not baht, and not a string: satang is
 *   Stripe's minor unit for THB, so this number reaches `amount` unchanged.
 */
export async function createTopupPaymentIntent(
  studentId: string,
  amountSatang: number
): Promise<TopupIntent> {
  const callable = httpsCallable<{ studentId: string; amountSatang: number }, TopupIntent>(
    functions,
    'createTopupPaymentIntent'
  );
  const res = await callable({ studentId, amountSatang });
  return res.data;
}

/**
 * Read back what happened to a payment the browser was redirected away from.
 *
 * PromptPay and 3-D Secure both leave the page, and the return URL carries
 * `payment_intent_client_secret`. Without this a parent comes back to a screen
 * that has forgotten a payment it started.
 */
export async function readRedirectOutcome(clientSecret: string): Promise<ConfirmOutcome> {
  const stripe = await getStripe();
  if (!stripe) return { status: 'FAILED', message: 'ระบบชำระเงินยังไม่ได้ตั้งค่า' };

  const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret);
  if (error || !paymentIntent) {
    return { status: 'FAILED', message: error?.message || 'อ่านสถานะการชำระเงินไม่สำเร็จ' };
  }
  return describeIntentStatus(paymentIntent.status, paymentIntent.id);
}

/** The life of a top-up request, as the webhook and staff leave it. */
export type TopupRequestStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'FAILED';

/**
 * Has the webhook credited this top-up yet?
 *
 * The honest question to ask, and the reason the browser asks it rather than
 * watching the balance: a wallet's balance can move for a dozen reasons — a
 * second top-up, a refund, the child buying lunch — and comparing it before and
 * after would call any of them this payment. The request row is written by the
 * same transaction that moves the money, so CONFIRMED means this payment, and
 * nothing else, landed.
 *
 * Guardians may read their own requests (`requestedBy == uid` in the rules), so
 * this needs no privilege the parent does not already have.
 */
export async function readTopupRequestStatus(
  requestId: string
): Promise<TopupRequestStatus | null> {
  try {
    const snap = await getDoc(doc(db, 'wallet_topup_requests', requestId));
    if (!snap.exists()) return null;
    const status = snap.data().status;
    return typeof status === 'string' ? (status as TopupRequestStatus) : null;
  } catch (err) {
    // A read that fails is not a payment that failed. The caller polls this,
    // and throwing would leave the parent on "กำลังรอ…" forever after a dropped
    // connection; returning null lets the poll time out into the honest
    // "the money will appear shortly" message instead.
    console.error('[readTopupRequestStatus] Error:', err);
    return null;
  }
}
