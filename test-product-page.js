/**
 * ============================================================================
 * PRODUCT PAGE TEST SUITE
 * ============================================================================
 *
 * The product page priced a dish for the customer, and priced it wrong.
 *
 * Each pickup slot carried an invented discount — -50% before noon, -20% at
 * 12:30, -10% after — and the page computed `discountedUnitPrice` from it,
 * showed a struck-through `basePrice + 40` beside it so the number looked like
 * a saving, and put a "-50% QueueUp Early Bird" badge above the lot.
 *
 * None of it existed. `orderPricing.js` prices from the product's own
 * priceSatang and never looks at the pickup time, and `createCurrentCartItem`
 * correctly put the FULL price into the cart. So a student saw ฿27, tapped add,
 * and found ฿55 in their basket — the one thing a menu must never do.
 *
 * Beside it: four influencer video reviews written into the file, with view
 * counts and hashtags, whose play button opened a modal showing the same still
 * image and played nothing.
 */

import { readFileSync } from 'node:fs';

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

const read = (rel) => readFileSync(new URL(`./${rel}`, import.meta.url), 'utf8');
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const page = stripComments(read('src/pages/ProductDetail.jsx'));

console.log('\n💸 The price shown is the price charged');

runTest('🚨 No pickup slot carries a discount', () => {
  // Nothing anywhere applies one. A label that promises a price the server will
  // not honour is worse than no label.
  const at = page.indexOf('const BASE_TIME_SLOTS');
  assert(at > 0, 'the slot list is gone');
  const slots = page.slice(at, page.indexOf('];', at));
  assert(!/discount:/.test(slots), 'the slots advertise a discount again');
});

runTest('🚨 The unit price is the base price plus its modifiers, and nothing else', () => {
  assert(!/discountedUnitPrice/.test(page), 'a discounted price is computed again');
  assert(!/discountPercent/.test(page), 'a discount percentage is derived again');
  assert(
    /const unitPrice = basePrice \+ dynamicModifiersPrice;/.test(page),
    'the displayed unit price is no longer the plain sum'
  );
  assert(
    /const totalCalculatedPrice = unitPrice \* quantity;/.test(page),
    'the total is not the unit price times the quantity'
  );
});

runTest('🚨 There is no invented "before" price to strike through', () => {
  // `basePrice + 40` — ฿40 added to the real price purely so the number beside
  // it looked like a saving.
  assert(!/basePrice \+ 40/.test(page), 'the fabricated original price is back');
  assert(
    !/text-decoration-line-through/.test(page),
    'something is struck through, and there is no earlier price to strike'
  );
});

runTest('🚨 The Early Bird badge is gone', () => {
  assert(!page.includes('QueueUp Early Bird'), 'the page advertises a discount that does not exist');
  assert(!page.includes('-50%'), 'a -50% claim survives somewhere on the page');
});

runTest('The points claim matches what an order actually earns', () => {
  // "รับแต้มสะสมฟรี 2 เท่า" was there. The order transaction writes a flat
  // `Math.floor(finalAmountSatang / 1000)` — one point per ฿10, never doubled.
  assert(!page.includes('แต้มสะสมฟรี 2 เท่า'), 'the page still promises double points');
  const live = read('functions/index.js');
  assert(
    /pointsEarned: Math\.floor\(finalAmountSatang \/ 1000\)/.test(live),
    'the earn rate changed and the page copy was not rechecked'
  );
});

runTest('🚨 What goes in the cart is what the page showed', () => {
  // The cart was always right; the display was not. This is the invariant that
  // was broken — the two must come from one number.
  const at = page.indexOf('const createCurrentCartItem');
  assert(at > 0, 'the cart item builder is gone');
  const body = page.slice(at, page.indexOf('const handleAddToCart', at));
  // Anchored to the end of the value: `/price: basePrice/` alone still matches
  // `price: basePrice * 0.5`, which is exactly the bug.
  assert(/price: basePrice,/.test(body), 'the cart no longer carries the plain base price');
  assert(
    !/price: basePrice\s*[*+\-/]/.test(body),
    'the cart price has arithmetic on it, so it is no longer the catalogue price'
  );
  assert(!/discounted/i.test(body), 'a discounted price leaks into the cart');
});

console.log('\n🎬 Nothing claims to be a review that is not one');

runTest('🚨 The invented video reviews are gone', () => {
  assert(!page.includes('VIDEO_REVIEWS'), 'the hardcoded review list is back');
  for (const ghost of ['@FoodieCampus', '@เด็กหอพาชิม', 'ไวรัลสัปดาห์นี้']) {
    assert(!page.includes(ghost), `the page still invents "${ghost}"`);
  }
});

runTest('The player that played nothing is gone with them', () => {
  assert(!page.includes('activeVideo'), 'a video modal survives with no video to play');
});

runTest('Real reviews are still read from the collection', () => {
  // The point is not to remove the section — it is that a review must be one.
  assert(
    /collection\(db, "reviews"\)/.test(page),
    'the page no longer reads real reviews at all'
  );
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
