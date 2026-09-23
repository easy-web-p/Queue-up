/**
 * ============================================================================
 * STRIPE TOP-UP TEST SUITE
 * ============================================================================
 *
 * topupCampusWallet wrote a number into balanceSatang and nothing captured a
 * payment. The interim was a request a member of staff confirms once cash
 * arrives at the office. This is the same flow with Stripe doing the capturing,
 * and it introduces three new ways to lose money:
 *
 *   1. crediting what the client asked for instead of what Stripe captured
 *   2. crediting twice, because a webhook is delivered at least once
 *   3. letting staff hand-confirm a Stripe request, which credits a wallet for
 *      a payment that may have failed
 *
 * Every rule below is one of those. What is NOT covered here is the wire format
 * — whether Stripe's API accepts these arguments and returns these shapes —
 * because api.stripe.com is unreachable from this container. That needs a real
 * round trip before this goes anywhere near live keys.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import {
  TOPUP_SOURCE,
  TOPUP_STATUS,
  STRIPE_CURRENCY,
  MIN_TOPUP_SATANG,
  validateTopupAmount,
  interpretStripeEvent,
  buildTopupMetadata,
  resolveTopupTarget,
  canConfirmManually,
} from './functions/stripeTopup.js';
import { MAX_TOPUP_SATANG } from './functions/walletAuthority.js';
// The browser's half, imported for real. stripePaymentStatus.ts has no imports
// and no import.meta.env precisely so this suite can call it rather than model it.
import { describeIntentStatus, satangToBahtText } from './src/services/stripePaymentStatus.ts';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}\n       ${err.message}`);
  }
}

const assert = (c, m) => { if (!c) throw new Error(m); };
const assertEqual = (a, e, m) => {
  if (a !== e) throw new Error(`${m}\n       expected: ${e}\n       actual:   ${a}`);
};

const intent = (over = {}) => ({
  id: 'pi_test_123',
  amount: 20000,
  amount_received: 20000,
  currency: 'thb',
  metadata: buildTopupMetadata({ studentId: 'STU1', requestId: 'REQ1', requestedBy: 'guardian1' }),
  ...over,
});
const event = (type, object, id = 'evt_1') => ({ id, type, data: { object } });

/**
 * Comments removed before a source assertion, trailing ones included.
 *
 * A check for `guard(` in the source is satisfied by `// guard(` otherwise, so
 * commenting a guard out would leave the test green. Line comments are matched
 * only when not preceded by `:`, so `https://` survives.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

console.log('\n💳 The amount is Stripe\'s, not the client\'s');

runTest('🚨 A credit uses amount_received, not the requested amount', () => {
  // The browser says what it wants to pay; Stripe says what arrived. Trusting
  // the first lets a caller ask for ฿20 and be credited ฿20,000.
  const v = interpretStripeEvent(
    event('payment_intent.succeeded', intent({ amount: 2000000, amount_received: 2000 }))
  );
  assertEqual(v.action, 'CREDIT', 'a succeeded payment must credit');
  assertEqual(v.creditSatang, 2000, 'the credit must be what Stripe captured');
});

runTest('A partial capture credits the partial amount', () => {
  const v = interpretStripeEvent(
    event('payment_intent.succeeded', intent({ amount: 20000, amount_received: 15000 }))
  );
  assertEqual(v.creditSatang, 15000, 'a partial capture credits what arrived');
});

runTest('🚨 Nothing is credited when no money arrived', () => {
  for (const bad of [0, null, undefined, -500, 'lots', NaN]) {
    const v = interpretStripeEvent(event('payment_intent.succeeded', intent({ amount_received: bad })));
    assertEqual(v.action, 'IGNORE', `amount_received=${String(bad)} must not credit`);
  }
});

runTest('🚨 A payment in another currency is not credited as satang', () => {
  const v = interpretStripeEvent(
    event('payment_intent.succeeded', intent({ currency: 'usd', amount_received: 20000 }))
  );
  assertEqual(v.action, 'IGNORE', 'USD 200.00 must not become ฿200');
  assertEqual(v.reason, 'UNEXPECTED_CURRENCY', 'and say why');
});

runTest('Satang maps to Stripe\'s minor unit with no conversion', () => {
  // The usual bug in this area is a stray ×100 or ÷100. ฿200 is 20000 satang
  // and 20000 in Stripe's `amount` — the same number.
  assertEqual(STRIPE_CURRENCY, 'thb', 'the currency must be THB');
  const v = interpretStripeEvent(event('payment_intent.succeeded', intent({ amount_received: 20000 })));
  assertEqual(v.creditSatang, 20000, 'no conversion may happen');
});

console.log('\n🔁 A webhook is delivered at least once');

runTest('🚨 The webhook records the event id in the crediting transaction', () => {
  const live = stripComments(readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8'));
  const at = live.indexOf('export const stripeTopupWebhook');
  assert(at > 0, 'the webhook does not exist');
  const body = live.slice(at, live.indexOf('\nexport const', at + 10));

  assert(body.includes('idempotency_keys'), 'no idempotency record is written');
  const readAt = body.indexOf('tx.get(eventRef)');
  const creditAt = body.indexOf('balanceSatang: newBal');
  assert(readAt > 0, 'the event id is never checked');
  assert(creditAt > 0, 'nothing is credited at all');
  assert(readAt < creditAt, 'the balance moves before the replay check');
  assert(body.includes('runTransaction'), 'the check and the credit are not atomic');
});

runTest('🚨 An unverified body is refused, not logged and accepted', () => {
  const live = readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8');
  const at = live.indexOf('export const stripeTopupWebhook');
  const body = live.slice(at, live.indexOf('\nexport const', at + 10));
  assert(body.includes('constructEvent'), 'the signature is never verified');
  assert(body.includes('rawBody'), 'verification uses the parsed body, which cannot match the signature');
  assert(/res\.status\(400\)/.test(body), 'a bad signature does not get rejected');
});

runTest('An unhandled event type is accepted, not retried forever', () => {
  // A non-2xx makes Stripe retry, and retrying an event nobody handles
  // eventually disables the endpoint — taking the ones that matter with it.
  const v = interpretStripeEvent(event('charge.dispute.created', intent()));
  assertEqual(v.action, 'IGNORE', 'an unrelated type must be ignored');
  assert(v.reason.startsWith('UNHANDLED_TYPE'), 'and say which');
});

runTest('A malformed event does not throw', () => {
  for (const bad of [null, undefined, {}, { type: 'x' }, { data: {} }]) {
    const v = interpretStripeEvent(bad);
    assertEqual(v.action, 'IGNORE', `${JSON.stringify(bad)} must be ignored, not crash`);
  }
});

console.log('\n🎯 Only our own payments move a wallet');

runTest('🚨 An unrelated payment on the same account credits nobody', () => {
  // The endpoint receives every event the Stripe account emits.
  for (const meta of [{}, { queueup_purpose: 'SOMETHING_ELSE' }, { foo: 'bar' }]) {
    const r = resolveTopupTarget(meta);
    assert(!r.ok, `${JSON.stringify(meta)} must not resolve to a wallet`);
  }
});

runTest('🚨 A top-up missing its student or request is refused', () => {
  assert(!resolveTopupTarget({ queueup_purpose: 'WALLET_TOPUP' }).ok, 'no student, no credit');
  assert(
    !resolveTopupTarget({ queueup_purpose: 'WALLET_TOPUP', queueup_student_id: 'S1' }).ok,
    'no request id, no credit'
  );
});

runTest('A well-formed top-up resolves to its student and request', () => {
  const r = resolveTopupTarget(buildTopupMetadata({ studentId: 'STU1', requestId: 'REQ1', requestedBy: 'g1' }));
  assert(r.ok, 'a real top-up must resolve');
  assertEqual(r.studentId, 'STU1', 'student');
  assertEqual(r.requestId, 'REQ1', 'request');
});

console.log('\n✋ A Stripe payment cannot be confirmed by hand');

runTest('🚨 Staff cannot hand-confirm a Stripe request', () => {
  // Staff confirming a cash request IS the capture — they hold the money.
  // Confirming a Stripe one credits a wallet for a payment that may have
  // failed, which is the original hole reopened from the other side.
  const r = canConfirmManually({ source: TOPUP_SOURCE.STRIPE });
  assert(!r.ok, 'a Stripe request must not be manually confirmable');
  assertEqual(r.code, 'TOPUP_IS_STRIPE_PAID', 'and say why');
});

runTest('Staff can still confirm a cash request', () => {
  assert(canConfirmManually({ source: TOPUP_SOURCE.MANUAL }).ok, 'the cash path must keep working');
  // Rows written before `source` existed are cash — that is all there was.
  assert(canConfirmManually({}).ok, 'a legacy request with no source is manual');
});

runTest('🚨 reviewWalletTopupRequest enforces it', () => {
  const live = stripComments(readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8'));
  const at = live.indexOf('export const reviewWalletTopupRequest');
  const body = live.slice(at, live.indexOf('\nexport const', at + 10));
  assert(body.includes('canConfirmManually('), 'the manual-confirm guard is not wired in');
});

console.log('\n💵 Amount validation');

runTest('An amount below Stripe\'s THB minimum is refused here, not upstream', () => {
  const r = validateTopupAmount(500, MAX_TOPUP_SATANG);
  assert(!r.ok && r.code === 'TOPUP_AMOUNT_TOO_SMALL', '฿5 is below the ฿10 minimum');
  assert(validateTopupAmount(MIN_TOPUP_SATANG, MAX_TOPUP_SATANG).ok, 'exactly the minimum is fine');
});

runTest('🚨 The per-transaction ceiling still applies', () => {
  const r = validateTopupAmount(MAX_TOPUP_SATANG + 1, MAX_TOPUP_SATANG);
  assert(!r.ok && r.code === 'TOPUP_AMOUNT_TOO_LARGE', 'over the ceiling must be refused');
  assert(validateTopupAmount(MAX_TOPUP_SATANG, MAX_TOPUP_SATANG).ok, 'exactly the ceiling is fine');
});

runTest('A non-integer amount is refused', () => {
  for (const bad of [1500.5, '2000', null, undefined, NaN, Infinity, {}]) {
    assert(!validateTopupAmount(bad, MAX_TOPUP_SATANG).ok, `${String(bad)} is not a satang amount`);
  }
});

console.log('\n🔐 Keys and wiring');

runTest('🚨 The secret key never reaches the client bundle', () => {
  const live = readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8');
  assert(/defineSecret\("STRIPE_SECRET_KEY"\)/.test(live), 'the secret key is not a Cloud Functions secret');
  assert(/defineSecret\("STRIPE_WEBHOOK_SECRET"\)/.test(live), 'the signing secret is not a secret either');

  // Vite inlines every VITE_* variable into the client bundle — the mistake
  // this project already made once with VITE_OPENAI_API_KEY.
  assert(!/VITE_STRIPE_SECRET/.test(live), 'the secret key is exposed through a VITE_ variable');
});

runTest('🚨 No Stripe key is hardcoded anywhere in the repo', () => {
  const files = ['functions/index.js', 'functions/stripeTopup.js', 'src/main.jsx'];
  for (const f of files) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert(!/sk_(test|live)_[A-Za-z0-9]{20}/.test(src), `${f} contains a hardcoded secret key`);
    assert(!/whsec_[A-Za-z0-9]{20}/.test(src), `${f} contains a hardcoded signing secret`);
  }
});

runTest('The functions declare the secrets they need', () => {
  const live = readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8');
  for (const fn of ['createTopupPaymentIntent', 'stripeTopupWebhook']) {
    const at = live.indexOf(`export const ${fn}`);
    assert(at > 0, `${fn} is missing`);
    const head = live.slice(at, at + 300);
    assert(/secrets:\s*\[/.test(head), `${fn} does not declare its secrets and would read undefined at runtime`);
  }
});

runTest('A Stripe-created wallet is spendable', () => {
  // Spending is fail-closed on limits; a wallet born from a top-up would
  // otherwise be credited and then refuse every order.
  const live = readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8');
  const at = live.indexOf('export const stripeTopupWebhook');
  const body = live.slice(at, live.indexOf('\nexport const', at + 10));
  assert(body.includes('resolveMissingLimitDefaults'), 'a wallet created here would be unspendable');
});

console.log('\n🖥️  What the browser is allowed to claim');

runTest('🚨 succeeded means Stripe has the money, and nothing more', () => {
  const o = describeIntentStatus('succeeded', 'pi_1');
  assertEqual(o.status, 'PAID', 'a captured payment is PAID');
  // PAID is deliberately not "credited". The wallet moves in the webhook, and
  // the dashboard waits for the balance before saying the money arrived.
  assert(!('creditSatang' in o), 'the browser must not carry a credit amount');
});

runTest('🚨 An unknown status is a failure, not a success', () => {
  // Stripe adds statuses over time. Defaulting the other way turns a status
  // this code has never seen into a false "paid".
  for (const s of ['some_future_status', '', 'SUCCEEDED', 'paid']) {
    assertEqual(describeIntentStatus(s, 'pi_1').status, 'FAILED', `${s} must not read as paid`);
  }
});

runTest('A payment still in flight reads as processing', () => {
  for (const s of ['processing', 'requires_action', 'requires_confirmation', 'requires_capture']) {
    assertEqual(describeIntentStatus(s, 'pi_1').status, 'PROCESSING', `${s} is not settled yet`);
  }
  assertEqual(describeIntentStatus('canceled', 'pi_1').status, 'FAILED', 'canceled took no money');
  assertEqual(
    describeIntentStatus('requires_payment_method', 'pi_1').status,
    'FAILED',
    'a declined card took no money'
  );
});

runTest('Satang reaches the screen as baht exactly once', () => {
  assertEqual(satangToBahtText(2000), '20.00', '2000 satang is ฿20.00');
  assertEqual(satangToBahtText(1), '0.01', 'one satang is ฿0.01');
  assertEqual(satangToBahtText(123456), '1,234.56', 'thousands are grouped');
});

runTest('🚨 No Stripe key is hardcoded in the client source', () => {
  // The publishable key is public by design, which is not the same as belonging
  // in source control — a key committed here bills a Stripe account the school
  // may no longer own.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx|js|jsx)$/.test(entry)) continue;
      const src = readFileSync(full, 'utf8');
      if (/pk_(test|live)_[A-Za-z0-9]{20}/.test(src)) offenders.push(`${full} (publishable)`);
      if (/sk_(test|live)_[A-Za-z0-9]{20}/.test(src)) offenders.push(`${full} (SECRET)`);
      if (/whsec_[A-Za-z0-9]{20}/.test(src)) offenders.push(`${full} (signing secret)`);
    }
  };
  walk(new URL('./src', import.meta.url).pathname);
  assertEqual(offenders.join(', '), '', 'a Stripe key is committed in the client source');
});

runTest('🚨 The publishable key comes from the environment, with no fallback', () => {
  const src = readFileSync(new URL('./src/services/stripeTopupService.ts', import.meta.url), 'utf8');
  assert(
    /import\.meta\.env\.VITE_STRIPE_PUBLISHABLE_KEY/.test(src),
    'the key is not read from the environment'
  );
  // A `|| 'pk_...'` fallback is how the Firebase config ended up with a literal
  // in it; here it would silently charge whoever owns that key.
  assert(
    !/VITE_STRIPE_PUBLISHABLE_KEY[^\n]*\|\|\s*['"`]/.test(src),
    'the key has a hardcoded fallback'
  );
  assert(/startsWith\('pk_'\)/.test(src), 'a secret key pasted here would be used as-is');
});

runTest('🚨 The dashboard waits for the balance before saying the money arrived', () => {
  const live = stripComments(
    readFileSync(new URL('./src/pages/GuardianDashboard.tsx', import.meta.url), 'utf8')
  );
  const at = live.indexOf('const handleStripeOutcome');
  assert(at > 0, 'the Stripe outcome handler is gone');
  const body = live.slice(at, live.indexOf('const handleStartStripeTopup', at));

  const waitAt = body.indexOf('waitForCredit');
  const successAt = body.indexOf('toast.success');
  assert(waitAt > 0, 'nothing waits for the credit to land');
  assert(successAt > 0, 'the parent is never told it worked');
  assert(waitAt < successAt, 'success is announced before the balance moves');
  assert(
    body.includes('credited'),
    'the success message is not conditional on the credit arriving'
  );
});

runTest('🚨 The browser never credits a wallet itself', () => {
  const live = readFileSync(new URL('./src/pages/GuardianDashboard.tsx', import.meta.url), 'utf8');
  assert(!/balanceSatang\s*:/.test(live), 'the dashboard writes a balance');
  assert(
    !/(setDoc|updateDoc|addDoc)\s*\(\s*doc\(\s*db\s*,\s*['"]wallets['"]/.test(live),
    'the dashboard writes the wallets collection directly'
  );
});

runTest('A redirected payment can find its way back', () => {
  // PromptPay leaves the page. Without the student id on the return URL the
  // dashboard cannot tell whose wallet to watch when the parent comes back.
  const live = readFileSync(new URL('./src/pages/GuardianDashboard.tsx', import.meta.url), 'utf8');
  assert(/returnUrl=\{/.test(live), 'no return URL is given to Stripe');
  assert(live.includes('topup_student='), 'the return URL forgets which child it was for');
  assert(live.includes('topup_request='), 'the return URL forgets which payment it was');
  assert(
    live.includes('payment_intent_client_secret'),
    'the return is never read back from Stripe'
  );
});

runTest('🚨 The credit is confirmed by the request row, not by the balance moving', () => {
  // A balance moves for a second top-up, a refund, or the child buying lunch.
  // Comparing it before and after would call any of those this payment. The
  // request row is written by the transaction that moves the money.
  const live = stripComments(
    readFileSync(new URL('./src/pages/GuardianDashboard.tsx', import.meta.url), 'utf8')
  );
  const at = live.indexOf('const waitForCredit');
  assert(at > 0, 'nothing waits for the credit');
  const body = live.slice(at, live.indexOf('const handleStripeOutcome', at));

  assert(body.includes('readTopupRequestStatus'), 'the request row is never read');
  assert(body.includes("'CONFIRMED'"), 'nothing checks that the top-up was confirmed');
  assert(
    !/balanceSatang/.test(body),
    'the credit is inferred from the balance, which moves for other reasons too'
  );
});

runTest('🚨 A credit is painted under the child it belongs to', () => {
  // A parent with two children is returned by Stripe to a dashboard that
  // reopens on whichever child sorts first. Painting the paid child's balance
  // there would show one child's money under the other's name.
  const live = stripComments(
    readFileSync(new URL('./src/pages/GuardianDashboard.tsx', import.meta.url), 'utf8')
  );
  const at = live.indexOf('const refreshWallet');
  assert(at > 0, 'the wallet refresh is gone');
  const body = live.slice(at, live.indexOf('const waitForCredit', at));
  const guardAt = body.indexOf('selectedChildRef.current?.studentId !== studentId');
  const paintAt = body.indexOf('setWallet(');
  assert(guardAt > 0, 'nothing checks whose wallet this is');
  assert(paintAt > 0, 'the wallet is never painted at all');
  assert(guardAt < paintAt, 'the wallet is painted before the child is checked');
});

runTest('🚨 The setup guide names only secrets and endpoints that exist', () => {
  // This file used to walk an operator through setting OPN_SECRET_KEY and
  // deploying opnWebhook. Neither was ever in functions/index.js: the secret
  // was read by nothing and the endpoint did not exist, so anyone following it
  // finished convinced online payment was live. Mechanical, so it stays true.
  const doc = readFileSync(new URL('./PAYMENT_SETUP.md', import.meta.url), 'utf8');
  const live = readFileSync(new URL('./functions/index.js', import.meta.url), 'utf8');

  const secrets = [...doc.matchAll(/functions:secrets:set\s+([A-Z0-9_]+)/g)].map((m) => m[1]);
  assert(secrets.length > 0, 'the guide sets no secrets at all');
  for (const name of secrets) {
    assert(
      live.includes(`defineSecret("${name}")`),
      `the guide sets ${name}, which no function reads`
    );
  }

  const endpoints = [...doc.matchAll(/cloudfunctions\.net\/([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  assert(endpoints.length > 0, 'the guide gives no endpoint URL');
  for (const name of endpoints) {
    assert(
      new RegExp(`export const ${name} = onRequest`).test(live),
      `the guide points Stripe at ${name}, which is not a deployed endpoint`
    );
  }
});

runTest('.env.example documents the publishable key and only that', () => {
  const env = readFileSync(new URL('./.env.example', import.meta.url), 'utf8');
  assert(env.includes('VITE_STRIPE_PUBLISHABLE_KEY'), 'the key is undocumented');
  assert(!/pk_(test|live)_[A-Za-z0-9]{20}/.test(env), 'a real publishable key is committed');
  assert(
    /STRIPE_SECRET_KEY/.test(env) && /functions:secrets:set/.test(env),
    'nothing tells the operator where the secret key goes'
  );
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
