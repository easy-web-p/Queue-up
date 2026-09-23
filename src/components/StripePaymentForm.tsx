/**
 * ============================================================================
 * 💳 STRIPE PAYMENT FORM
 * ============================================================================
 *
 * Stripe's Payment Element, mounted by hand.
 *
 * Card details are typed into an iframe served by Stripe, so nothing sensitive
 * ever reaches this bundle, this component's state, or the school's servers —
 * which is the whole reason the Element exists rather than an input of our own.
 *
 * What this component may claim is narrow: that Stripe took the money. It may
 * never claim the wallet was credited. Only `stripeTopupWebhook` knows that,
 * and it learns it from Stripe rather than from the browser.
 */

import { useEffect, useRef, useState } from 'react';
import type {
  Stripe,
  StripeElements,
  StripePaymentElement,
  Appearance,
} from '@stripe/stripe-js';
import { getStripe } from '../services/stripeTopupService';
import {
  describeIntentStatus,
  satangToBahtText,
  type ConfirmOutcome,
} from '../services/stripePaymentStatus';
import { errorMessage } from '../utils/errorMessage';

interface Props {
  /** From createTopupPaymentIntent. Identifies the payment to Stripe.js. */
  clientSecret: string;
  amountSatang: number;
  /** Where Stripe sends the payer back after PromptPay or a 3-D Secure step. */
  returnUrl: string;
  onOutcome: (outcome: ConfirmOutcome) => void;
  onCancel: () => void;
}

/** Stripe's own styling, matched to whichever theme the app is currently in. */
function appearanceForCurrentTheme(): Appearance {
  const dark = document.documentElement.classList.contains('dark');
  return {
    theme: dark ? 'night' : 'stripe',
    variables: {
      colorPrimary: '#FF7A1A',
      colorBackground: dark ? '#16100C' : '#FFFFFF',
      borderRadius: '12px',
      fontFamily: "'Kanit', system-ui, sans-serif",
    },
  };
}

export default function StripePaymentForm({
  clientSecret,
  amountSatang,
  returnUrl,
  onOutcome,
  onCancel,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // The effect can outlive the mount — a parent that closes the modal mid-load
    // would otherwise have Stripe.js write into a detached node.
    let cancelled = false;

    (async () => {
      try {
        const stripe = await getStripe();
        if (cancelled) return;
        if (!stripe) {
          setMountError('ระบบชำระเงินยังไม่ได้ตั้งค่า (ไม่พบ publishable key)');
          return;
        }
        if (!mountRef.current) return;

        const elements = stripe.elements({
          clientSecret,
          appearance: appearanceForCurrentTheme(),
        });
        const paymentElement = elements.create('payment', { layout: 'tabs' });
        paymentElement.mount(mountRef.current);
        paymentElement.on('ready', () => {
          if (!cancelled) setIsReady(true);
        });

        stripeRef.current = stripe;
        elementsRef.current = elements;
        paymentElementRef.current = paymentElement;
      } catch (err) {
        if (!cancelled) setMountError(errorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
      paymentElementRef.current?.destroy();
      paymentElementRef.current = null;
      elementsRef.current = null;
    };
  }, [clientSecret]);

  const handlePay = async () => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || isPaying) return;

    setIsPaying(true);
    setFormError(null);

    // `redirect: 'if_required'` keeps a card payment on this page and sends
    // PromptPay — which has to leave for the banking app — to returnUrl. Either
    // way the browser's report is not what credits the wallet.
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    if (error) {
      // A validation or card error means no money moved; the payer can retry in
      // the same Element, so this stays on screen rather than closing.
      setFormError(error.message || 'การชำระเงินไม่สำเร็จ');
      setIsPaying(false);
      return;
    }

    setIsPaying(false);
    if (paymentIntent) {
      onOutcome(describeIntentStatus(paymentIntent.status, paymentIntent.id));
    }
    // No error and no intent means Stripe is redirecting; the return URL picks
    // the story back up.
  };

  if (mountError) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-red-600 dark:text-red-400">{mountError}</p>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white text-xs font-semibold rounded-xl cursor-pointer"
        >
          ปิด
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
        ยอดชำระ{' '}
        <strong className="text-slate-900 dark:text-white font-['JetBrains_Mono']">
          ฿{satangToBahtText(amountSatang)}
        </strong>
      </p>

      <div ref={mountRef} className="min-h-[220px]" />

      {!isReady && (
        <p className="text-xs text-slate-400 dark:text-slate-500">กำลังโหลดแบบฟอร์มชำระเงิน…</p>
      )}
      {formError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {formError}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
        ยอดเงินจะเข้ากระเป๋าหลังจาก Stripe ยืนยันการชำระเงิน โดยปกติใช้เวลาไม่กี่วินาที
      </p>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPaying}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={handlePay}
          disabled={!isReady || isPaying}
          className="px-4 py-2 bg-[#FF7A1A] hover:bg-[#E6680D] text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
        >
          {isPaying ? 'กำลังชำระเงิน…' : 'ชำระเงิน'}
        </button>
      </div>
    </div>
  );
}
