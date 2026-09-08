/**
 * ============================================================================
 * MENU SEEDING TEST SUITE
 * ============================================================================
 *
 * The products collection starts empty, and the app now says so instead of
 * papering over it with a hardcoded catalogue that looked like a stocked canteen
 * but could not be ordered. So a fresh school needs a way to put a real menu in.
 *
 * "Real" is the whole point, and two things decide it:
 *
 *   - a product with no storeId is refused by the ordering function
 *     ("STORE_ID_REQUIRED") and by the product page before that, so seeding the
 *     templates unchanged would store the same unorderable food permanently;
 *   - the templates ship `sales: "4.5k ครั้ง"`, `rating: 4.9` and an
 *     `originalPrice` inventing a discount. Placeholder decoration in a mock
 *     file; written to the database they become claims the canteen is making
 *     about dishes it has never sold.
 *
 * The shape the seeder writes is also exercised against the real rules engine in
 * test-firestore-rules-emulator.js — a seeder whose documents the rules refuse
 * would report success for a menu that never landed.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSeedProducts, FABRICATED_FIELDS } from './src/lib/seedCatalog.js';

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

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n       expected: ${expected}\n       actual:   ${actual}`);
  }
}

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(ROOT + f, 'utf8');

const TEMPLATES = [
  {
    id: 'm1',
    name: 'ชุดไก่บักเก็ตซอสเกาหลี',
    price: 69,
    originalPrice: 120,
    sales: '4.5k ครั้ง',
    salesCount: '1.2k ขายแล้ว',
    rating: 4.9,
    category: 'single_dish',
    image: '/crispy_fried_chicken.jpg',
  },
  { id: 'm2', name: 'ข้าวผัดกุ้ง', price: 45, rating: 4.7, category: 'single_dish' },
];

console.log('\n🌱 MENU SEEDING TEST SUITE\n');

// ===========================================================================
console.log('1. A seeded product is a product that can actually be ordered');
// ===========================================================================

runTest('🚨 Every seeded product carries a storeId', () => {
  // Without one the ordering function refuses with STORE_ID_REQUIRED, so the menu
  // would look stocked and be unorderable — the exact bug this seeding exists to
  // stop being papered over.
  for (const p of buildSeedProducts(TEMPLATES, 'shop_A')) {
    assertEqual(p.storeId, 'shop_A', `${p.name} must belong to a store`);
  }
});

runTest('🚨 Seeding without a store is refused, not silently skipped', () => {
  for (const missing of ['', '   ', null, undefined, 42]) {
    let threw = false;
    try { buildSeedProducts(TEMPLATES, missing); } catch { threw = true; }
    assert(threw, `storeId ${JSON.stringify(missing)} must be refused`);
  }
});

runTest('🚨 Product ids are namespaced by store', () => {
  // Unnamespaced, seeding a second canteen would overwrite the first's menu at
  // products/m1 — one school silently replacing another's food.
  const a = buildSeedProducts(TEMPLATES, 'shop_A');
  const b = buildSeedProducts(TEMPLATES, 'shop_B');
  assertEqual(a[0].id, 'shop_A_m1');
  assertEqual(b[0].id, 'shop_B_m1');
  assert(a[0].id !== b[0].id, 'two stores must not collide');
});

runTest('The price is carried in satang as well as baht', () => {
  // Satang is what the ordering function charges against.
  const [first] = buildSeedProducts(TEMPLATES, 'shop_A');
  assertEqual(first.price, 69);
  assertEqual(first.priceSatang, 6900);
});

runTest('🚨 An invalid price is refused rather than written', () => {
  for (const bad of [0, -10, 'ฟรี', null, undefined, NaN]) {
    let threw = false;
    try { buildSeedProducts([{ id: 'x', name: 'x', price: bad }], 'shop_A'); } catch { threw = true; }
    assert(threw, `price ${JSON.stringify(bad)} must be refused`);
  }
});

runTest('Seeded products start available and in stock', () => {
  const [first] = buildSeedProducts(TEMPLATES, 'shop_A');
  assertEqual(first.availability, true, 'a seeded dish must be orderable');
  assert(typeof first.stock === 'number' && first.stock > 0, 'and must have stock');
});

runTest('An explicit stock on the template is respected', () => {
  const [p] = buildSeedProducts([{ id: 'x', name: 'x', price: 10, stock: 3 }], 'shop_A');
  assertEqual(p.stock, 3);
  const [zero] = buildSeedProducts([{ id: 'y', name: 'y', price: 10, stock: 0 }], 'shop_A');
  assertEqual(zero.stock, 0, 'a deliberate 0 is not a missing value');
});

// ===========================================================================
console.log('\n2. Placeholder decoration does not become a claim');
// ===========================================================================

runTest('🚨 Fabricated sales figures never reach the database', () => {
  // "4.5k ครั้ง" and "1.2k ขายแล้ว" are mock dressing. Saved as product data they
  // are the canteen telling students it has sold dishes it has never made.
  for (const p of buildSeedProducts(TEMPLATES, 'shop_A')) {
    for (const field of FABRICATED_FIELDS) {
      assert(!(field in p), `"${field}" must be stripped before writing`);
    }
  }
});

runTest('🚨 An invented "was" price is stripped too', () => {
  const [first] = buildSeedProducts(TEMPLATES, 'shop_A');
  assert(!('originalPrice' in first), 'a discount nobody offered must not be shown');
});

runTest('Real product content survives', () => {
  const [first] = buildSeedProducts(TEMPLATES, 'shop_A');
  assertEqual(first.name, 'ชุดไก่บักเก็ตซอสเกาหลี');
  assertEqual(first.category, 'single_dish');
  assertEqual(first.image, '/crispy_fried_chicken.jpg');
});

runTest('Seeded rows are marked as such', () => {
  const [first] = buildSeedProducts(TEMPLATES, 'shop_A');
  assertEqual(first.seeded, true, 'so a real menu can be told from a seeded one later');
});

runTest('The templates themselves are not mutated', () => {
  const before = JSON.stringify(TEMPLATES);
  buildSeedProducts(TEMPLATES, 'shop_A');
  assertEqual(JSON.stringify(TEMPLATES), before, 'seeding twice must behave the same');
});

runTest('An empty template list is refused', () => {
  for (const empty of [[], null, undefined, 'nope']) {
    let threw = false;
    try { buildSeedProducts(empty, 'shop_A'); } catch { threw = true; }
    assert(threw, `${JSON.stringify(empty)} must be refused`);
  }
});

// ===========================================================================
console.log('\n3. The write reports what actually happened');
// ===========================================================================

const lib = read('src/lib/firebase.js');
const admin = read('src/pages/StoreAdminPage.tsx');

runTest('🚨 saveProductsToFirestore no longer swallows a refused write', () => {
  // It caught every failure and logged a warning, so an admin whose writes were
  // blocked by security rules was told nothing and assumed the menu had landed.
  const fn = lib.slice(lib.indexOf('export const saveProductsToFirestore'));
  const body = fn.slice(0, fn.indexOf('\n};'));
  assert(/throw error/.test(body), 'a refused write must reach the caller');
  assert(!/console\.warn\("Firestore saveProducts/.test(body), 'the swallow must be gone');
});

runTest('🚨 A partial write reports how far it got', () => {
  // "failed" when half the menu landed sends the admin looking for products that
  // are already there.
  const fn = lib.slice(lib.indexOf('export const saveProductsToFirestore'));
  const body = fn.slice(0, fn.indexOf('\n};'));
  assert(/written \+= 1/.test(body), 'successful writes must be counted');
  assert(/error\.written = written/.test(body), 'and reported on the failure');
  assert(admin.includes('written'), 'the admin page must use that count');
});

runTest('🚨 The admin confirms only after the write returns', () => {
  const handler = admin.slice(admin.indexOf('const handleSeedMenu'), admin.indexOf('const handleAddStaff'));
  const awaitIdx = handler.indexOf('await saveProductsToFirestore');
  const okIdx = handler.indexOf('toast.success');
  assert(awaitIdx !== -1, 'the write must be awaited');
  assert(okIdx > awaitIdx, 'success must not be claimed before it lands');
  assert(handler.includes('toast.error'), 'and a failure must be shown');
});

runTest('Seeding asks first, and says what it will do', () => {
  const handler = admin.slice(admin.indexOf('const handleSeedMenu'), admin.indexOf('const handleAddStaff'));
  assert(handler.includes('await toast.confirm'), 'writing a menu is not an accident');
  assert(handler.includes('นักเรียนสั่งได้ทันที'), 'the confirmation must say these become real');
});

runTest('🚨 Seeding is refused when there is no store to seed into', () => {
  const handler = admin.slice(admin.indexOf('const handleSeedMenu'), admin.indexOf('const handleAddStaff'));
  assert(/if \(!targetStoreId\)/.test(handler), 'no store means no menu');
  assert(handler.includes('toast.error'), 'and the admin must be told why');
});

runTest('The button cannot be fired twice while writing', () => {
  assert(admin.includes('disabled={isSeeding}'), 'a double seed would write the menu twice');
});

runTest('The button is offered only while the menu is empty', () => {
  // Next to the batch price tools on a stocked menu, it is an accident waiting.
  assert(admin.includes('menuItems.length === 0 && ('), 'it must be conditional');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
