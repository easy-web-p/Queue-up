# QueueUp payments

Money enters this system in exactly one place — a wallet top-up — and leaves it
in exactly one — an order paid from a wallet balance. Nothing charges a card for
an order, and no part of the app moves a balance from the browser.

This file previously described an Opn/Omise `opnWebhook` function and an
`OPN_SECRET_KEY` secret. Neither exists in `functions/index.js`; following those
steps set a secret nothing reads and deployed a function that was never written.
What follows is what the code actually does.

## The two ways money arrives

| Path | Who starts it | Who says the money is real | Where |
| --- | --- | --- | --- |
| **Stripe** | a guardian, in the app | `stripeTopupWebhook`, on a signed event from Stripe | `createTopupPaymentIntent` → Payment Element → webhook |
| **Cash** | a guardian, in the app | a member of staff, who was handed the notes | `topupCampusWallet` → `reviewWalletTopupRequest` |

Both create a row in `wallet_topup_requests` with status `PENDING`, and both
credit only when something outside the browser confirms the money exists. The
row records which path it came from, and `canConfirmManually` refuses to let
staff hand-confirm a Stripe request — that would credit a wallet for a payment
that may have failed, which is the hole the cash flow exists to close.

## The one way money leaves

`createOrderAuthoritative` debits the wallet in the same transaction that
creates the order, when `paymentMode === 'CAMPUS_WALLET'`. Prices are recomputed
server-side from the `products` collection; the cart's own totals are never
trusted. `DIRECT_ZERO_PAYMENT` orders are paid at the counter and touch no
balance at all.

## Setting up Stripe

1. **Create the account** and turn on the payment methods you want. PromptPay
   and cards are what the code requests, in that order — PromptPay is how most
   people in Thailand pay.

2. **Set the server secrets.** These never go in `.env`: Vite inlines every
   `VITE_*` variable into the bundle every visitor downloads.

   ```sh
   firebase functions:secrets:set STRIPE_SECRET_KEY      # sk_test_… / sk_live_…
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET  # whsec_… (step 4)
   ```

3. **Set the publishable key** in `.env` (and in your host's environment —
   Vercel, for this project):

   ```sh
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_…
   ```

   Unset, the app hides the card/PromptPay option and offers only the
   cash-at-the-office path. It does not fall back to a hardcoded key, so a
   deployment cannot accidentally bill someone else's account.

4. **Add the webhook** in Stripe Dashboard → Developers → Webhooks:

   ```
   URL     https://asia-southeast1-<project>.cloudfunctions.net/stripeTopupWebhook
   events  payment_intent.succeeded
           payment_intent.payment_failed
           payment_intent.canceled
   ```

   Copy the signing secret it shows into `STRIPE_WEBHOOK_SECRET`. Until you do,
   every delivery is rejected with a 400 and no wallet is ever credited — which
   is the correct way round: an endpoint that cannot verify a signature must
   refuse rather than guess.

5. **Deploy.**

   ```sh
   firebase deploy --only functions,firestore:rules
   ```

## What the webhook guarantees, and why

- **Signature first.** An unverified endpoint is a URL that credits wallets to
  anyone who can guess it. Verification uses `req.rawBody`, not `req.body`:
  Express re-serialises the JSON, which changes bytes, and the signature is over
  the original ones.
- **`amount_received`, not `amount`.** The browser says what it wants to pay;
  Stripe says what arrived. A partial capture credits the partial amount.
- **The event id is recorded in the crediting transaction.** Stripe retries on
  any non-2xx and can redeliver unprompted; the second delivery finds
  `idempotency_keys/stripe_<event.id>` already there and credits nothing.
- **200 on anything it ignores.** A non-2xx makes Stripe retry, and retrying an
  event nobody handles eventually gets the endpoint disabled, taking the events
  that matter down with it.

## Testing

`npm run test:stripe` covers the decision logic offline — amount validation,
event-to-state mapping, replay defence, and what the browser is allowed to claim.
It does **not** cover the wire format: whether Stripe's API accepts these
arguments and returns these shapes needs one real round trip in test mode, with
`stripe listen --forward-to` pointed at the deployed function, before this goes
anywhere near live keys.
