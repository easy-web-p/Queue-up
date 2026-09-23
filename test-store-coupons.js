/**
 * ============================================================================
 * STORE COUPON & SECURITY-CLAIM TEST SUITE
 * ============================================================================
 *
 * **A promotion that existed on one laptop.** The merchant dashboard's
 * "1-Click Deploy" button called `deployAICoupon`, which wrote the coupon to
 * `localStorage['queueup_merchant_coupons_<storeId>']`, and the dashboard then
 * announced "เปิดใช้งานคูปอง … เรียบร้อยแล้ว! ลูกค้าสามารถใช้ส่วนลดได้ทันที".
 * No customer could ever use it: the order transaction prices coupons from
 * `coupons/{code}` in Firestore, which is admin-write-only. Retiring one
 * flipped a boolean nobody else could see, and the "live" list read `isActive`
 * while the engine reads `active`.
 *
 * Two of the three suggested codes were HAPPY15 and STUDENT10 — the platform's
 * own built-ins. Made real without care, a stall deploying one would have
 * overwritten a campaign running across every stall in the school.
 *
 * **A security posture counted from localStorage.** Three screens reported one:
 * a footer badge on every page ("QueueUp AI Security Sentinel v2.5 / สถานะระบบ:
 * HEALTHY"), a profile card ("🛡️ เกราะป้องกันสมบูรณ์ 100%", "การเข้ารหัส PII:
 * AES-256-GCM"), and a merchant badge reading "Security Health: undefined/100"
 * — healthScore was never a field. The landing page claimed Salted SHA-256
 * password hashing and AES-256-GCM storage in five places. The app does
 * neither, and the hand-rolled crypto that once backed the claim was already
 * deleted for using one shared salt and a key in the client bundle.
 */

import { readFileSync } from 'node:fs';
import {
  RESERVED_CODES,
  MAX_STORE_DISCOUNT_SATANG,
  MAX_STORE_PERCENT,
  STORE_COUPON_REFUSAL,
  validateStoreCoupon,
  canStoreClaimCode,
} from './functions/storeCoupons.js';
import { evaluateCoupon, normalizeCouponCode, COUPON_REFUSAL } from './functions/couponRules.js';
import { BUILTIN_COUPONS } from './functions/builtinCoupons.js';

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

const read = (rel) => readFileSync(new URL(`./${rel}`, import.meta.url), 'utf8');
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ok = (over = {}) => ({
  code: 'SHOPAFTERNOON15',
  title: 'ลดบ่าย 15%',
  type: 'PERCENT',
  percent: 15,
  maxDiscountSatang: 5000,
  minSpendSatang: 5000,
  ...over,
});

console.log('\n🏪 A stall cannot take a code that is not theirs');

runTest("🚨 The platform's own codes are reserved", () => {
  // Deploying one would overwrite a campaign running across every stall.
  for (const builtin of BUILTIN_COUPONS) {
    assert(
      RESERVED_CODES.includes(builtin.id),
      `${builtin.id} is a built-in coupon a stall could overwrite`
    );
  }
  const r = validateStoreCoupon(ok({ code: 'HAPPY15' }), 'shop1');
  assert(!r.ok, 'a stall claimed a built-in code');
  assertEqual(r.code, STORE_COUPON_REFUSAL.CODE_RESERVED, 'wrong refusal');
});

runTest("🚨 The dashboard no longer suggests a reserved code", () => {
  // The suggestions were HAPPY15, STUDENT10 and VIPQUEUE. Two of those are the
  // platform's, so every merchant was being invited to collide.
  const svc = stripComments(read('src/services/aiMarketingService.js'));
  for (const reserved of RESERVED_CODES) {
    assert(
      !new RegExp(`code: ["']${reserved}["']`).test(svc),
      `the dashboard still suggests the reserved code ${reserved}`
    );
  }
});

runTest("🚨 A code another store holds is refused", () => {
  const r = canStoreClaimCode({ storeId: 'other_shop' }, 'shop1');
  assert(!r.ok, "one stall overwrote another's promotion");
  assertEqual(r.code, STORE_COUPON_REFUSAL.CODE_TAKEN, 'wrong refusal');
});

runTest('A store may retune its own coupon, and claim a free code', () => {
  assert(canStoreClaimCode({ storeId: 'shop1' }, 'shop1').ok, 'a store cannot edit its own');
  assert(canStoreClaimCode(null, 'shop1').ok, 'an unused code is refused');
});

console.log('\n💸 The discount is one a stall can survive');

runTest('🚨 A mistyped discount is refused, not deployed', () => {
  for (const bad of [
    { type: 'FIXED', amountSatang: 0 },
    { type: 'FIXED', amountSatang: -100 },
    { type: 'FIXED', amountSatang: MAX_STORE_DISCOUNT_SATANG + 1 },
    { type: 'FIXED', amountSatang: 'abc' },
  ]) {
    const r = validateStoreCoupon(ok({ ...bad, percent: undefined }), 'shop1');
    assert(!r.ok, `${JSON.stringify(bad)} was accepted`);
  }
  for (const percent of [0, -5, MAX_STORE_PERCENT + 1, 'x']) {
    const r = validateStoreCoupon(ok({ percent }), 'shop1');
    assert(!r.ok, `${percent}% was accepted`);
  }
});

runTest('🚨 A malformed code is refused', () => {
  for (const code of ['', 'ab', 'a'.repeat(33), 'มีไทย', 'HAS SPACE', 'lower!']) {
    const r = validateStoreCoupon(ok({ code }), 'shop1');
    assert(!r.ok, `"${code}" was accepted as a coupon code`);
  }
});

runTest('An accepted code is one a customer can type', () => {
  const r = validateStoreCoupon(ok({ code: 'shopafternoon15' }), 'shop1');
  assert(r.ok, 'a valid lowercase code was refused');
  assertEqual(r.coupon.id, 'SHOPAFTERNOON15', 'the code was not normalised');
  assertEqual(normalizeCouponCode(r.coupon.id), r.coupon.id, 'the stored id is not a typeable code');
});

console.log('\n🎯 A deployed coupon is priced by the one engine');

runTest('🚨 It is confined to the store that deployed it', () => {
  // A discount funded by one stall must not be spendable at another.
  const { coupon } = validateStoreCoupon(ok(), 'shop1');
  assertEqual(coupon.storeId, 'shop1', 'the coupon names no store');

  const elsewhere = evaluateCoupon(coupon, {
    subtotalSatang: 100000,
    nowYmd: '2026-01-01',
    nowHhmm: '12:00',
    timesUsedByUser: 0,
    userRoles: ['customer'],
    storeId: 'shop2',
    userId: 'u1',
  });
  assert(!elsewhere.ok, "the coupon priced an order at another stall");
  assertEqual(elsewhere.reason, COUPON_REFUSAL.STORE_MISMATCH, 'wrong refusal');
});

runTest('🚨 evaluateCoupon can price what validateStoreCoupon produces', () => {
  // The old local copy stored {discountType, discountValue, minSpend}; the
  // engine reads {type, percent/amountSatang, minSpendSatang}. They shared no
  // field, so a deployed coupon would have been worth ฿0 had it ever been read.
  for (const input of [ok(), ok({ type: 'FIXED', amountSatang: 1500, percent: undefined })]) {
    const { ok: valid, coupon } = validateStoreCoupon(input, 'shop1');
    assert(valid, 'a well-formed coupon was refused');
    const verdict = evaluateCoupon(coupon, {
      subtotalSatang: 20000,
      nowYmd: '2026-01-01',
      nowHhmm: '12:00',
      timesUsedByUser: 0,
      userRoles: ['customer'],
      storeId: 'shop1',
      userId: 'u1',
    });
    assert(verdict.ok, `the engine refused it: ${verdict.reason}`);
    assert(verdict.discountSatang > 0, 'the coupon is worth nothing');
  }
});

runTest('A percentage discount respects its cap', () => {
  const { coupon } = validateStoreCoupon(ok({ percent: 50, maxDiscountSatang: 2000 }), 'shop1');
  const verdict = evaluateCoupon(coupon, {
    subtotalSatang: 100000,
    nowYmd: '2026-01-01',
    nowHhmm: '12:00',
    timesUsedByUser: 0,
    userRoles: ['customer'],
    storeId: 'shop1',
    userId: 'u1',
  });
  assertEqual(verdict.discountSatang, 2000, '50% of ฿1000 was not capped at ฿20');
});

console.log('\n🖥️  The dashboard deploys to the database');

const live = stripComments(read('functions/index.js'));
const dash = stripComments(read('src/pages/MerchantDashboard.jsx'));
const svc = stripComments(read('src/services/aiMarketingService.js'));

runTest('🚨 Deploying writes a coupon document, not localStorage', () => {
  assert(
    !/localStorage\.setItem\(\s*`queueup_merchant_coupons/.test(svc),
    'the promotion is written to one laptop again'
  );
  assert(svc.includes("httpsCallable(functions, 'deployStoreCoupon')"), 'nothing calls the server');
  assert(live.includes('export const deployStoreCoupon'), 'the function does not exist');
});

runTest('🚨 Only the stall owner may deploy against a stall', () => {
  // Without this, any signed-in student could publish a 90%-off coupon against
  // any stall in the school.
  const at = live.indexOf('export const deployStoreCoupon');
  const body = live.slice(at, live.indexOf('\nexport const', at + 10));
  assert(body.includes('ownerUid === uid'), 'store ownership is never checked');
  assert(body.includes('permission-denied'), 'a non-owner is not refused');

  const checkAt = body.indexOf('ownerUid === uid');
  const writeAt = body.indexOf('tx.set(');
  assert(checkAt < writeAt, 'the coupon is written before ownership is checked');
});

runTest('🚨 The claim check and the write are one transaction', () => {
  // Two stalls deploying the same code at the same moment would both see it
  // free, and the second would overwrite the first.
  const at = live.indexOf('export const deployStoreCoupon');
  const body = live.slice(at, live.indexOf('\nexport const', at + 10));
  assert(body.includes('runTransaction'), 'the read and the write are not atomic');
  assert(body.includes('canStoreClaimCode('), 'nothing checks whether the code is taken');
});

runTest('🚨 Retiring a coupon retires it for everyone', () => {
  assert(live.includes('export const setStoreCouponActive'), 'the toggle has no server side');
  assert(!svc.includes('toggleCouponState'), 'the localStorage toggle is back');
  const at = live.indexOf('export const setStoreCouponActive');
  const body = live.slice(at, live.indexOf('\nexport const', at + 10));
  assert(
    body.includes('snap.data().storeId !== String(storeId)'),
    "a stall can switch off another stall's coupon, or a platform one"
  );
});

runTest('🚨 The live list reads the field the engine reads', () => {
  // The local copy used `isActive`; evaluateCoupon reads `active`. A coupon
  // shown as live here would have been refused at the counter.
  assert(!/cp\.isActive/.test(dash), 'the dashboard reads isActive again');
  assert(/cp\.active/.test(dash), 'the dashboard does not read active');
  assert(svc.includes("where('storeId', '==', storeId)"), 'the live list is not read from Firestore');
});

runTest('🚨 A refused deploy is not reported as a live promotion', () => {
  const at = dash.indexOf('const handleDeployCoupon');
  assert(at > 0, 'the deploy handler is gone');
  const body = dash.slice(at, dash.indexOf('const handleToggleCoupon', at));
  assert(body.includes('toast.error('), 'a refusal never reaches the merchant');
  assert(
    !body.includes('ลูกค้าสามารถใช้ส่วนลดได้ทันที'),
    'the message still promises customers a discount before the server agrees'
  );
});

runTest('The fourth copy of the discount maths is gone', () => {
  // applyCouponToOrder read the same local array and computed its own
  // percentage and cap. Nothing called it.
  assert(!svc.includes('export function applyCouponToOrder'), 'a second engine is back');
});

console.log('\n🛡️  No screen reports a security posture it cannot measure');

runTest('🚨 getSecurityHealthReport is gone, and nothing reads it', () => {
  const shield = read('src/services/aiSecurityShield.js');
  assert(
    !/export function getSecurityHealthReport/.test(shield),
    'the localStorage security report is back'
  );
  for (const f of [
    'src/components/Footer.jsx',
    'src/pages/UserProfile.jsx',
    'src/pages/MerchantDashboard.jsx',
  ]) {
    assert(!read(f).includes('getSecurityHealthReport'), `${f} still reports it`);
  }
});

runTest('🚨 No screen claims encryption the app does not do', () => {
  // The hand-rolled crypto was deleted from utils/security.js for using one
  // shared salt and a key in the client bundle. The claims outlived it.
  for (const f of [
    'src/pages/UserProfile.jsx',
    'src/pages/Queueup.jsx',
    'src/components/Footer.jsx',
  ]) {
    const src = stripComments(read(f));
    assert(!/AES-256/.test(src), `${f} still claims AES-256 encryption`);
    assert(!/Salted SHA-256/.test(src), `${f} still claims salted SHA-256 hashing`);
    assert(!/Encrypted End-to-End/.test(src), `${f} still claims end-to-end encryption`);
  }
});

runTest('🚨 Nothing in the codebase actually encrypts, so nothing may say it does', () => {
  // The assertion above is only meaningful while this stays true. If real
  // encryption is ever added, this test is the place that notices.
  const shield = read('src/services/aiSecurityShield.js');
  const util = read('src/utils/security.js');
  for (const [name, src] of [['aiSecurityShield', shield], ['utils/security', util]]) {
    assert(!/crypto\.subtle/.test(src), `${name} encrypts now — update the UI claims to match`);
  }
});

runTest('What the security section claims instead is checkable', () => {
  const landing = read('src/pages/Queueup.jsx');
  assert(landing.includes('Firebase Authentication'), 'the real credential story is not stated');
  assert(landing.includes('Firestore Security Rules'), 'the real access boundary is not stated');
  assert(landing.includes('Cloud Functions'), 'the real money boundary is not stated');
});

console.log('\n📣 Two screens do not contradict each other');

runTest('🚨 The broadcast box does not claim to have broadcast', () => {
  // The CRM tab showed "กระจายข้อความไปยังหน้าเว็บฝั่งลูกค้าเรียบร้อยแล้ว!" directly
  // beside its host's honest "(ยังไม่ได้เชื่อมระบบส่งข้อความจริง)". There is no
  // broadcast transport; of the two contradictory notices the green one was the
  // false one.
  const crm = stripComments(read('src/components/MerchantCRMAnalytics.tsx'));
  assert(
    !crm.includes('กระจายข้อความไปยังหน้าเว็บฝั่งลูกค้าเรียบร้อยแล้ว'),
    'the component claims a broadcast that never happens'
  );
  const host = stripComments(read('src/pages/MerchantDashboard.jsx'));
  assert(
    host.includes('ยังไม่ได้เชื่อมระบบส่งข้อความจริง'),
    'the honest message about there being no transport is gone too'
  );
});

console.log('\n📊 The landing page counts what it can count');

runTest('🚨 The invented business metrics are gone', () => {
  // "50,000+ คิวที่ให้บริการสำเร็จ", "500+ ร้านค้าพันธมิตรไว้วางใจ", "99.9% Uptime"
  // and "< 2 นาที เวลาการรอคิวเฉลี่ย". Nothing served fifty thousand queues, no
  // five hundred shops signed up, and nothing measures uptime or a wait.
  const landing = stripComments(read('src/pages/Queueup.jsx'));
  for (const ghost of ['50,000+', '500+', '99.9%', '< 2 นาที']) {
    assert(!landing.includes(ghost), `the stats bar still claims "${ghost}"`);
  }
  assert(landing.includes('catalogueStats'), 'the bar is not derived from real data');
  assert(
    landing.includes('fetchShopsFromFirestore') && landing.includes('fetchProductsFromFirestore'),
    'the counts are not read from the collections'
  );
});

runTest('A failed read shows no number rather than a plausible one', () => {
  const landing = read('src/pages/Queueup.jsx');
  assert(/catalogueStats \? catalogueStats\.shops/.test(landing), 'the shop count has no empty state');
  assert(landing.includes('"—"'), 'an unknown count renders as something other than unknown');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
