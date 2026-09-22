/**
 * ============================================================================
 * ORDER ITEM SHAPE TEST SUITE
 * ============================================================================
 *
 * A stored order line and a cart line are different shapes, and conflating them
 * crashes screens.
 *
 * `Order.items` was typed as `CartItem[]` — which holds a whole `menuItem`
 * object the browser assembled. What createOrderAuthoritative actually stores
 * is a flat snapshot priced from the product document: name, quantity,
 * unitPriceSatang, subtotalSatang. The snapshot exists so that what the kitchen
 * cooks and what the customer was charged cannot drift from each other, or be
 * changed by editing the product afterwards.
 *
 * Because the type was wrong, MerchantKDS reached its fields through
 * `(it as any).name`, and StoreAdminPage rendered `it.menuItem.name` — which is
 * undefined on a real order document, so the orders tab threw a TypeError as
 * soon as the shop had a single order.
 */

import { readFileSync } from 'node:fs';
import { priceOrder } from './functions/orderPricing.js';

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
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n📦 What the server actually stores on an order line');

const products = new Map([
  ['p1', { storeId: 'shop_1', name: 'ข้าวมันไก่', priceSatang: 5000, stock: 10, category: 'Rice' }],
]);

const priced = priceOrder([{ productId: 'p1', quantity: 2 }], products, new Map(), 'shop_1');
const line = priced.validatedOrderItems[0];

runTest('🚨 An order line carries its own name and price, not a menuItem', () => {
  assert(priced.ok, `pricing failed: ${priced.message}`);
  assert(line.menuItem === undefined, 'an order line must NOT carry a menuItem — that is the cart shape');
  assert(typeof line.name === 'string' && line.name.length > 0, 'the dish name must be on the line itself');
  assert(typeof line.quantity === 'number', 'the quantity must be on the line');
});

runTest('The line carries both satang and baht, and they agree', () => {
  assert(Number.isInteger(line.unitPriceSatang), 'unitPriceSatang must be a whole number of satang');
  assert(Number.isInteger(line.subtotalSatang), 'subtotalSatang must be a whole number of satang');
  assert(line.unitPrice === line.unitPriceSatang / 100, 'the baht unit price must be derived from satang');
  assert(line.subtotal === line.subtotalSatang / 100, 'the baht subtotal must be derived from satang');
  assert(line.subtotalSatang === line.unitPriceSatang * line.quantity, 'subtotal must be unit × quantity');
});

console.log('\n🖥️  Screens read the line, not a cart item');

const admin = strip(read('src/pages/StoreAdminPage.tsx'));
const kds = strip(read('src/components/MerchantKDS.tsx'));

runTest('🚨 No screen reaches for menuItem on an order line', () => {
  // `it.menuItem.name` on a stored order throws, and takes the tab with it.
  for (const [label, src] of [['StoreAdminPage', admin], ['MerchantKDS', kds]]) {
    assert(
      !/\bit\.menuItem\b|\border\.items\[\d+\]\.menuItem\b/.test(src),
      `${label} still reads menuItem off an order line — that field does not exist and the read throws`
    );
  }
});

runTest('🚨 No screen casts an order line to any to reach its fields', () => {
  // The cast was the symptom of the type being wrong; removing the cast without
  // fixing the type would just move the error.
  for (const [label, src] of [['StoreAdminPage', admin], ['MerchantKDS', kds]]) {
    assert(
      !/\(it as any\)|\(order as any\)|\(it: any\)/.test(src),
      `${label} still casts an order or its lines to any`
    );
  }
});

runTest('🚨 The declared type matches what the server writes', () => {
  // The whole point. If OrderItem drifts from validatedOrderItems, the screens
  // go back to casting.
  const types = read('src/types.ts');
  const at = types.indexOf('export interface OrderItem {');
  assert(at > 0, 'OrderItem is not declared');
  const block = types.slice(at, types.indexOf('}', at));
  for (const field of Object.keys(line)) {
    assert(block.includes(`${field}`), `OrderItem does not declare "${field}", which the server writes`);
  }
});

runTest('Order.items is typed as OrderItem, not CartItem', () => {
  const types = read('src/types.ts');
  const at = types.indexOf('export interface Order {');
  const block = types.slice(at, types.indexOf('\n}', at));
  assert(/items:\s*OrderItem\[\]/.test(block), 'Order.items must be OrderItem[]');
  assert(!/items:\s*CartItem\[\]/.test(block), 'Order.items must not be CartItem[]');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
