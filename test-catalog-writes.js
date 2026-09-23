/**
 * ============================================================================
 * CATALOG WRITE TEST SUITE
 * ============================================================================
 *
 * `catalogService.ts` is 464 lines of careful product handling — a monetary
 * consistency guard, referential integrity on modifier groups, ownership checks
 * inside a transaction. MerchantDashboard imported three of its modifier
 * functions. The other eight had no caller at all, while StoreAdminPage wrote
 * `products` straight from the browser with `setDoc`.
 *
 * That gap was not cosmetic. Two of the bugs it hid:
 *
 *  1. **Editing a price changed nothing a customer paid.** The console wrote
 *     `{ price: newPrice }` with merge, leaving `priceSatang` at its old value.
 *     `orderPricing.js` charges `priceSatang ?? round(price * 100)`, and every
 *     seeded or console-added product has one — so the menu said ฿45 and the
 *     till took ฿40. The category-wide adjuster repeated it down a whole menu.
 *
 *  2. **Deleting a dish deleted nothing.** The bin icon called
 *     `setLocalMenuItems(prev => prev.filter(...))` and stopped there. The row
 *     disappeared, the product stayed in Firestore, and it came back on reload —
 *     orderable the whole time, by an admin who believed it was gone.
 *
 * Both are the same shape as the rest of this project's history: a screen
 * asserting something the system does not do.
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

/** Comments removed, trailing ones included, so a commented-out call cannot pass. */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const admin = stripComments(read('src/pages/StoreAdminPage.tsx'));
const service = stripComments(read('src/services/catalogService.ts'));

console.log('\n💸 A price change reaches the till');

runTest('🚨 The console never writes a bare price to a product', () => {
  // `{ price: newPrice }` with merge leaves priceSatang stale, and priceSatang
  // is what the order transaction charges.
  assert(
    !/setDoc\(\s*doc\(db,\s*["']products["'][^)]*\),\s*\{\s*price:/.test(admin),
    'the console still writes price without priceSatang'
  );
});

runTest('🚨 The price edit goes through updateStoreProduct', () => {
  const at = admin.indexOf('const handleUpdatePrice');
  assert(at > 0, 'the price handler is gone');
  const body = admin.slice(at, admin.indexOf('const handle', at + 10));
  assert(body.includes('updateStoreProduct('), 'the price edit bypasses the service');
});

runTest('🚨 updateStoreProduct writes both money fields from one number', () => {
  // The guarantee the call site depends on. Writing one without the other is
  // the drift the service exists to prevent.
  const at = service.indexOf('export async function updateStoreProduct');
  assert(at > 0, 'updateStoreProduct is gone');
  const body = service.slice(at, service.indexOf('export async function deleteStoreProduct', at));

  assert(body.includes('cleanUpdates.priceSatang = Math.round(p * 100)'), 'a baht edit sets no satang');
  assert(body.includes('cleanUpdates.price = p'), 'a baht edit sets no baht');
  assert(body.includes('cleanUpdates.price = updates.priceSatang / 100'), 'a satang edit sets no baht');
  assert(body.includes('MONETARY_DRIFT_ERROR'), 'conflicting price and priceSatang are accepted');
});

console.log('\n🗑️  Deleting a dish deletes it');

runTest('🚨 The bin icon reaches Firestore, not just React state', () => {
  const at = admin.indexOf('const handleDeleteItem');
  assert(at > 0, 'there is no delete handler — the bin icon only filters local state');
  const body = admin.slice(at, admin.indexOf('const handleAddNewItemSubmit', at));

  assert(body.includes('deleteStoreProduct('), 'the delete never touches the database');
  const deleteAt = body.indexOf('deleteStoreProduct(');
  const localAt = body.indexOf('setLocalMenuItems(');
  assert(localAt > deleteAt, 'the row is removed from the screen before the delete is known to work');
});

runTest('A permanent delete is confirmed first, and offers the reversible option', () => {
  const at = admin.indexOf('const handleDeleteItem');
  const body = admin.slice(at, admin.indexOf('const handleAddNewItemSubmit', at));
  assert(body.includes('toast.confirm'), 'a product is deleted permanently with no confirmation');
  assert(
    body.includes('ของหมดชั่วคราว'),
    'the dialog does not point at the reversible alternative'
  );
});

runTest('🚨 deleteStoreProduct refuses another store’s product', () => {
  const at = service.indexOf('export async function deleteStoreProduct');
  assert(at > 0, 'deleteStoreProduct is gone');
  const body = service.slice(at, at + 900);
  assert(body.includes('runTransaction'), 'the ownership check and the delete are not atomic');
  assert(
    body.includes('existingProduct.storeId !== storeId'),
    'any store could delete any product'
  );
});

console.log('\n🍲 A dish added is a dish orderable');

runTest('🚨 New products go through createStoreProduct', () => {
  const at = admin.indexOf('const handleAddNewItemSubmit');
  assert(at > 0, 'the add handler is gone');
  const body = admin.slice(at, admin.indexOf('const handleExportCSV', at));
  assert(body.includes('createStoreProduct('), 'a new dish is written straight to Firestore');
  assert(
    !/setDoc\(\s*doc\(db,\s*["']products["']/.test(body),
    'the add path still writes products directly'
  );
});

runTest('🚨 createStoreProduct refuses a product with no store', () => {
  // Without storeId, checkProductAvailability refuses the item with
  // CROSS_STORE_PRODUCT_VIOLATION: it shows on the menu and can never be bought.
  const at = service.indexOf('export async function createStoreProduct');
  assert(at > 0, 'createStoreProduct is gone');
  const body = service.slice(at, service.indexOf('export async function updateStoreProduct', at));
  assert(body.includes('storeId is required'), 'a product can be created with no store');
  assert(body.includes('storeId,'), 'storeId is not written onto the product');
});

runTest('The id is Firestore’s, not a truncated clock', () => {
  // `ITEM-${Date.now().toString().slice(-4)}` repeats every ten seconds, and
  // the old write used merge, so the second dish overwrote the first.
  assert(
    !/ITEM-\$\{Date\.now\(\)/.test(admin),
    'the console still mints ids from the last four digits of a clock'
  );
  const at = service.indexOf('export async function createStoreProduct');
  const body = service.slice(at, service.indexOf('export async function updateStoreProduct', at));
  assert(body.includes("doc(collection(db, 'products'))"), 'the service does not use a Firestore id');
});

runTest('🚨 A product cannot reference a modifier group that does not exist', () => {
  const at = service.indexOf('export async function createStoreProduct');
  const create = service.slice(at, service.indexOf('export async function updateStoreProduct', at));
  const up = service.indexOf('export async function updateStoreProduct');
  const update = service.slice(up, service.indexOf('export async function deleteStoreProduct', up));

  for (const [name, body] of [['create', create], ['update', update]]) {
    assert(
      body.includes('validateModifierReferentialIntegrity('),
      `${name} accepts a dangling modifier group reference`
    );
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
