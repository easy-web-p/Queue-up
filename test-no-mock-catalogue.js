/**
 * ============================================================================
 * NO-MOCK-CATALOGUE TEST SUITE
 * ============================================================================
 *
 * `src/data/mockProducts.js` held a 440-line invented canteen — dishes, shops,
 * ratings, sales counts, street addresses — and two screens fell back to it.
 *
 * ProductDetail's `resolveProductByParam` returned `PRODUCTS_BY_ID.m1` for any
 * id Firestore did not have. A deleted dish, a mistyped link and a permissions
 * failure therefore all opened a real-looking page for "ชุดไก่บักเก็ตซอสเกาหลี"
 * at ฿69, rating 4.9 — orderable, with an add-to-cart button. Its companion
 * `resolveStoreByStoreId` invented "ร้านป้าแดง ตามสั่ง & ไก่ทอด" with 1,840
 * reviews and a Bangkok street address, and the page drew a floor plan with
 * "ล็อค 04: ป้าแดง" as the destination whichever shop you were actually viewing.
 *
 * MerchantDashboard seeded its menu manager from the same file when localStorage
 * was empty — so a merchant managed dishes they do not sell — and every edit
 * only called `setMenuItems`. Marking something out of stock changed the screen
 * and nothing else; students kept ordering it. A declared allergen never reached
 * the allergen guard.
 *
 * The file is deleted. This suite is what keeps it from coming back.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import {
  averageRating,
  ratingDistribution,
  ratedCount,
} from './src/services/reviewStats.ts';

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

console.log('\n🗑️  The invented canteen is gone');

runTest('🚨 mockProducts.js does not exist', () => {
  assert(
    !existsSync(new URL('./src/data/mockProducts.js', import.meta.url).pathname),
    'the mock catalogue is back'
  );
});

runTest('🚨 Nothing imports a mock catalogue', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx|js|jsx)$/.test(entry)) continue;
      const src = stripComments(readFileSync(full, 'utf8'));
      if (/from ['"].*mockProducts/.test(src)) offenders.push(full);
      if (/\bSHARED_PRODUCTS\b|\bPRODUCTS_BY_ID\b|\bSHARED_SHOPS\b/.test(src)) offenders.push(full);
    }
  };
  walk(new URL('./src', import.meta.url).pathname);
  assert(offenders.length === 0, `still importing invented data: ${offenders.join(', ')}`);
});

console.log('\n🍽️  A missing dish looks missing');

const page = stripComments(read('src/pages/ProductDetail.jsx'));

runTest('🚨 There is no fallback product', () => {
  assert(!page.includes('resolveProductByParam'), 'the mock resolver is back');
  assert(!page.includes('resolveStoreByStoreId'), 'the mock store resolver is back');
});

runTest('🚨 A document Firestore does not have sets the not-found state', () => {
  // Checking that the string 'notfound' appears somewhere is not enough: with
  // the `if (!docData)` branch disabled the page falls through to ready with no
  // product and renders a blank screen, and every string is still present.
  const at = page.indexOf('if (!docData)');
  assert(at > 0, 'nothing checks whether the product was found');
  const branch = page.slice(at, page.indexOf('}', page.indexOf('setLoadState', at)));
  assert(branch.includes("setLoadState('notfound')"), 'a missing product does not set the state');
  assert(branch.includes('return'), 'the loader carries on after finding nothing');
});

runTest('🚨 Loading, missing and failed are three different screens', () => {
  assert(/const \[loadState, setLoadState\]/.test(page), 'the page has no load state');
  for (const state of ["'loading'", "'notfound'", "'error'", "'ready'"]) {
    assert(page.includes(state), `the page cannot be in state ${state}`);
  }
  assert(page.includes('ไม่พบเมนูนี้ในระบบ'), 'a missing dish is not reported as missing');
  assert(page.includes('EmptyState'), 'the not-found state has no presentation');
  assert(page.includes('ErrorState'), 'a failed read has no presentation');
});

runTest('🚨 The page renders nothing orderable until the read succeeds', () => {
  // The add-to-cart button used to be live over a dish from the mock catalogue
  // while the real read was still in flight.
  assert(
    /if \(loadState !== 'ready' \|\| !product\)/.test(page),
    'the full product page can render without a loaded product'
  );
  assert(/const \[product, setProduct\] = useState\(null\)/.test(page), 'the page opens on a guess');
});

runTest('🚨 A store with no document invents nothing', () => {
  assert(!/store\.rating \|\| 4\.8/.test(page), 'a shop with no ratings shows 4.8 stars');
  assert(!/reviewsCount \|\| "1\.8k"/.test(page), 'a shop with no reviews shows 1,800 of them');
  assert(!page.includes('1,840'), 'the invented review count survives in the copy');
  assert(
    /setStore\(storeData \|\| \{ id: docData\.storeId \}\)/.test(page),
    'a missing store is filled in with something plausible'
  );
});

runTest('🚨 The invented floor plan is gone', () => {
  for (const ghost of ['ล็อค 04: ป้าแดง', 'เดิน 40 วินาที', 'QueueUp Locker', 'เสาอาคาร C3']) {
    assert(!page.includes(ghost), `the wayfinding section still invents "${ghost}"`);
  }
  assert(!page.includes('isMapModalOpen'), 'the modal that drew the same fake map survives');
});

runTest('🚨 The rating card counts real reviews', () => {
  // 4.8 overall, "98% ของผู้ทานแนะนำร้านนี้", and four sub-scores, hardcoded on
  // every dish including ones with no reviews at all.
  assert(!page.includes('98% ของผู้ทานแนะนำ'), 'the invented recommend rate is back');
  assert(!page.includes('ประเด็นที่พูดถึงบ่อย'), 'the invented topic chips are back');
  assert(
    /const averageRating = useMemo\(\(\) => computeAverageRating\(reviews\)/.test(page),
    'the average is not computed from the reviews'
  );
  assert(
    /const ratingCounts = useMemo\(\(\) => ratingDistribution\(reviews\)/.test(page),
    'the distribution is not computed from the reviews'
  );
});

console.log('\n⭐ The rating arithmetic, called rather than read');

runTest('🚨 No reviews means no rating, not a default one', () => {
  assertEqual(averageRating([]), 0, 'an unrated dish has an average');
  assertEqual(averageRating(null), 0, 'missing input produces a rating');
  assertEqual(ratedCount([]), 0, 'an unrated dish counts reviews');
});

runTest('The average is the mean of the scores left', () => {
  assertEqual(averageRating([{ rating: 5 }, { rating: 4 }]), 4.5, 'two reviews');
  assertEqual(averageRating([{ rating: 3 }]), 3, 'one review');
});

runTest('A malformed row is not a zero-star review', () => {
  // Counted as 0 it would drag a perfect dish down to 2.5 stars.
  assertEqual(averageRating([{ rating: 5 }, { rating: 'x' }, {}, { rating: 9 }]), 5, 'mean');
  assertEqual(ratedCount([{ rating: 5 }, { rating: 'x' }, { rating: 0 }]), 1, 'count');
});

runTest('The distribution buckets by star', () => {
  const d = ratingDistribution([{ rating: 5 }, { rating: 5 }, { rating: 3 }]);
  assertEqual(d[5], 2, 'five-star count');
  assertEqual(d[3], 1, 'three-star count');
  assertEqual(d[1], undefined, 'a star nobody gave must not appear as zero');
});

runTest('Other dishes from this store are that store’s real dishes', () => {
  assert(page.includes('fetchProductsFromFirestore'), 'the recommendation strip reads nothing');
  const at = page.indexOf('const [storeMenu, setStoreMenu]');
  assert(at > 0, 'the store menu state is gone');
});

console.log('\n🏪 A merchant edit reaches the customer');

const dash = stripComments(read('src/pages/MerchantDashboard.jsx'));

runTest('🚨 The menu is read from the products collection', () => {
  assert(dash.includes('fetchStoreProducts('), 'the menu is not loaded from Firestore');
  assert(
    !/localStorage\.getItem\(`queueup_merchant_menu_/.test(dash),
    'the menu is seeded from localStorage again'
  );
  assert(/const \[menuItems, setMenuItems\] = useState\(\[\]\)/.test(dash), 'the menu opens on a guess');
});

runTest('🚨 Every edit writes to Firestore before the screen changes', () => {
  const at = dash.indexOf('const applyMenuEdit');
  assert(at > 0, 'menu edits no longer go through one write path');
  const body = dash.slice(at, dash.indexOf('const handleToggleProductStatus', at));
  assert(body.includes('updateStoreProduct('), 'the edit never reaches the database');

  const writeAt = body.indexOf('await updateStoreProduct(');
  const paintAt = body.indexOf('setMenuItems(');
  assert(writeAt < paintAt, 'the screen is updated before the write is known to have worked');
  assert(body.includes('loadMenu()'), 'a failed write leaves the screen out of step with the database');
});

runTest('🚨 Each of the four edits uses that path', () => {
  for (const [handler, next] of [
    ['handleToggleProductStatus', 'handleUpdateStock'],
    ['handleUpdateStock', 'handleUpdatePrice'],
    ['handleUpdatePrice', 'handleUpdateAllergens'],
    ['handleUpdateAllergens', 'handleAddNewItem'],
  ]) {
    const at = dash.indexOf(`const ${handler}`);
    assert(at > 0, `${handler} is gone`);
    const body = dash.slice(at, dash.indexOf(`const ${next}`, at));
    assert(body.includes('applyMenuEdit('), `${handler} still only changes local state`);
  }
});

runTest('🚨 A new dish is created through the service', () => {
  const at = dash.indexOf('const handleAddNewItem');
  assert(at > 0, 'the add handler is gone');
  const body = dash.slice(at, at + 900);
  assert(body.includes('createStoreProduct('), 'a new dish is only added to React state');
  assert(!/local_\$\{Date\.now\(\)/.test(body), 'the local-only id scheme is back');
});

runTest('An empty menu is told apart from a failed read', () => {
  assert(dash.includes("menuStatus === \"loading\""), 'no loading state');
  assert(dash.includes("menuStatus === \"error\""), 'a failed read looks like an empty menu');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
