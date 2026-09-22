/**
 * ============================================================================
 * ORDER RULE TEST SUITE
 * ============================================================================
 *
 * createOrderAuthoritative had grown to 700 lines holding the validation,
 * pricing, modifier, coupon, wallet, allergen, capacity and queue rules inline,
 * all inside one transaction touching ten collections. None of it could be
 * exercised without the Firestore emulator, which made the rules deciding
 * whether an order is accepted the least tested code in the project.
 *
 * Worse, the suite that appeared to cover it — test-transaction-e2e.js — was a
 * 1,258-line hand-written copy of the same logic. Its 24 passing scenarios said
 * nothing about the code that ships. It now imports these modules instead, and
 * this file covers what those scenarios never reached.
 */

import {
  validateOrderRequest,
  checkStoreAvailability,
  checkSlotCapacity,
  nextQueueNumber,
  isValidCalendarDate,
} from './functions/orderRequest.js';
import { checkProductAvailability, priceOrder } from './functions/orderPricing.js';

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

const NOW = { ymd: '2026-09-22', ymdClean: '20260922', hhmm: '10:00', dayOfWeekIndex: 2 };

const req = (over = {}) => ({
  storeId: 'shop_1',
  customerPhone: '0812345678',
  items: [{ productId: 'p1', quantity: 1 }],
  pickupTime: '12:00',
  ...over,
});

console.log('\n🧾 Request validation');

runTest('A well-formed request is accepted', () => {
  const r = validateOrderRequest(req(), NOW);
  assert(r.ok, `a valid request was refused: ${r.message}`);
  assertEqual(r.targetYmd, NOW.ymd, 'no pickupDate means today');
  assertEqual(r.totalOrderItemsCount, 1, 'one item');
});

runTest('🚨 Two cart lines for the same dish are aggregated', () => {
  // Checked separately, each passes a stock check the pair would fail — and the
  // last portion is sold twice.
  const r = validateOrderRequest(
    req({ items: [{ productId: 'p1', quantity: 2 }, { productId: 'p1', quantity: 3 }] }),
    NOW
  );
  assert(r.ok, 'must be accepted');
  assertEqual(r.productTotalQuantityMap.get('p1'), 5, 'the two lines must add up');
  assertEqual(r.totalOrderItemsCount, 5, 'the item count must add up too');
});

runTest('Missing fields are each refused with their own code', () => {
  const cases = [
    [{ storeId: '' }, 'STORE_ID_REQUIRED'],
    [{ customerPhone: '  ' }, 'CUSTOMER_PHONE_REQUIRED'],
    [{ items: [] }, 'ORDER_ITEMS_EMPTY'],
    [{ pickupTime: '25:00' }, 'INVALID_PICKUP_TIME_FORMAT'],
    [{ pickupTime: '9:00' }, 'INVALID_PICKUP_TIME_FORMAT'],
    [{ items: [{ quantity: 1 }] }, 'PRODUCT_ID_REQUIRED'],
    [{ items: [{ productId: 'p1', quantity: 0 }] }, 'INVALID_QUANTITY'],
    [{ items: [{ productId: 'p1', quantity: 1.5 }] }, 'INVALID_QUANTITY'],
    [{ items: [{ productId: 'p1', quantity: -2 }] }, 'INVALID_QUANTITY'],
  ];
  for (const [over, code] of cases) {
    const r = validateOrderRequest(req(over), NOW);
    assert(!r.ok, `${JSON.stringify(over)} should be refused`);
    assertEqual(r.code, code, `wrong refusal for ${JSON.stringify(over)}`);
  }
});

runTest('🚨 A past date cannot be ordered for', () => {
  const r = validateOrderRequest(req({ pickupDate: '2026-09-21' }), NOW);
  assert(!r.ok && r.code === 'PAST_DATE_NOT_ALLOWED', 'yesterday must be refused');
});

runTest('🚨 A pickup time already past today is refused', () => {
  const r = validateOrderRequest(req({ pickupTime: '09:00' }), NOW);
  assert(!r.ok && r.code === 'PAST_PICKUP_TIME_NOT_ALLOWED', '09:00 has passed at 10:00');
});

runTest('The same time is fine for tomorrow', () => {
  // The past-time check must be same-day only, or every morning slot booked in
  // advance would be refused.
  const r = validateOrderRequest(req({ pickupTime: '09:00', pickupDate: '2026-09-23' }), NOW);
  assert(r.ok, `tomorrow at 09:00 was refused: ${r.message}`);
});

runTest('🚨 A date that does not exist is refused', () => {
  for (const bad of ['2026-02-30', '2026-13-01', '2027-02-29']) {
    const r = validateOrderRequest(req({ pickupDate: bad }), NOW);
    assert(!r.ok && r.code === 'INVALID_CALENDAR_DATE', `${bad} must be refused`);
  }
  assert(isValidCalendarDate(2028, 2, 29), '2028 is a leap year');
  assert(!isValidCalendarDate(2027, 2, 29), '2027 is not');
});

runTest('Both date formats resolve to the same day', () => {
  const iso = validateOrderRequest(req({ pickupDate: '2026-09-23' }), NOW);
  const clean = validateOrderRequest(req({ pickupDate: '20260923' }), NOW);
  assertEqual(iso.targetYmd, clean.targetYmd, 'YYYY-MM-DD and YYYYMMDD must agree');
  assertEqual(iso.targetYmdClean, clean.targetYmdClean, 'and so must their clean forms');
});

console.log('\n🏪 Store availability');

const openShop = {
  isOpen: true,
  maxOrdersPerSlot: 10,
  operatingHours: { tuesday: { isOpen: true, open: '08:00', close: '16:00' } },
};

runTest('An open shop within hours accepts the order', () => {
  assert(checkStoreAvailability(openShop, NOW, NOW.ymd, '12:00').ok, 'noon is inside 08:00–16:00');
});

runTest('A closed or paused shop is refused', () => {
  assertEqual(checkStoreAvailability({ isOpen: false }, NOW, NOW.ymd, '12:00').code, 'STORE_CLOSED', 'isOpen false');
  assertEqual(checkStoreAvailability({ status: 'closed' }, NOW, NOW.ymd, '12:00').code, 'STORE_CLOSED', 'status closed');
  for (const override of ['FORCE_CLOSE', 'EMERGENCY_STOP']) {
    assertEqual(
      checkStoreAvailability({ isOpen: true, operationalOverride: override }, NOW, NOW.ymd, '12:00').code,
      'STORE_PAUSED',
      `${override} must pause orders`
    );
  }
});

runTest('A day marked closed refuses that day only', () => {
  const shop = { isOpen: true, operatingHours: { tuesday: { isOpen: false } } };
  assertEqual(checkStoreAvailability(shop, NOW, NOW.ymd, '12:00').code, 'STORE_CLOSED_ON_DATE', 'Tuesday is closed');
  const wednesday = { ...NOW, dayOfWeekIndex: 3 };
  assert(checkStoreAvailability(shop, wednesday, NOW.ymd, '12:00').ok, 'Wednesday has no schedule, so it is open');
});

runTest('A time outside opening hours is refused', () => {
  assertEqual(
    checkStoreAvailability(openShop, NOW, NOW.ymd, '17:30').code,
    'INVALID_PICKUP_TIME',
    '17:30 is after close'
  );
  assertEqual(
    checkStoreAvailability(openShop, NOW, NOW.ymd, '07:00').code,
    'INVALID_PICKUP_TIME',
    '07:00 is before open'
  );
});

runTest('🚨 A shop trading past midnight is open, not closed all night', () => {
  // open > close. Compared naively, every hour of this shop's actual trading is
  // rejected — and no scenario in the previous suite had such a shop, so the
  // wraparound branch was never executed by any test.
  const lateShop = {
    isOpen: true,
    maxOrdersPerSlot: 5,
    operatingHours: { tuesday: { isOpen: true, open: '18:00', close: '02:00' } },
  };
  assert(checkStoreAvailability(lateShop, NOW, NOW.ymd, '23:30').ok, '23:30 is inside 18:00–02:00');
  assert(checkStoreAvailability(lateShop, NOW, NOW.ymd, '01:00').ok, '01:00 is inside 18:00–02:00');
  assert(checkStoreAvailability(lateShop, NOW, NOW.ymd, '18:00').ok, 'the opening minute counts');
  assert(checkStoreAvailability(lateShop, NOW, NOW.ymd, '02:00').ok, 'the closing minute counts');
  assert(!checkStoreAvailability(lateShop, NOW, NOW.ymd, '12:00').ok, 'noon is outside it');
  assert(!checkStoreAvailability(lateShop, NOW, NOW.ymd, '03:00').ok, '03:00 is after close');
});

console.log('\n🎟️  Slot capacity and queue numbers');

runTest('🚨 An unconfigured capacity refuses, it does not mean unlimited', () => {
  for (const shop of [{}, { maxOrdersPerSlot: 0 }, { maxOrdersPerSlot: -1 }, { maxOrdersPerSlot: 'ten' }]) {
    const r = checkSlotCapacity(shop, null, NOW.ymd, '12:00');
    assert(!r.ok && r.code === 'STORE_CAPACITY_NOT_CONFIGURED', `${JSON.stringify(shop)} must fail closed`);
  }
});

runTest('A full slot is refused, the last place is not', () => {
  assert(checkSlotCapacity({ maxOrdersPerSlot: 3 }, { currentOrders: 2 }, NOW.ymd, '12:00').ok, 'the third order fits');
  const full = checkSlotCapacity({ maxOrdersPerSlot: 3 }, { currentOrders: 3 }, NOW.ymd, '12:00');
  assert(!full.ok && full.code === 'SLOT_CAPACITY_EXCEEDED', 'the fourth does not');
});

runTest('An empty slot starts at zero', () => {
  const r = checkSlotCapacity({ maxOrdersPerSlot: 5 }, null, NOW.ymd, '12:00');
  assert(r.ok && r.currentSlotOrders === 0, 'a slot with no document holds no orders');
});

runTest('Queue numbers increment and stay padded', () => {
  assertEqual(nextQueueNumber(null).queueNumber, 'Q001', 'the first order of the day');
  assertEqual(nextQueueNumber({ lastSequence: 7 }).queueNumber, 'Q008', 'the eighth');
  assertEqual(nextQueueNumber({ lastSequence: 99 }).queueNumber, 'Q100', 'three digits hold');
  assertEqual(nextQueueNumber({ lastSequence: 'x' }).queueNumber, 'Q001', 'a corrupt counter restarts rather than crashing');
});

console.log('\n💵 Pricing');

const products = new Map([
  ['p1', { storeId: 'shop_1', name: 'ข้าวผัด', priceSatang: 5000, stock: 10, category: 'Rice' }],
  ['p2', { storeId: 'shop_1', name: 'ชาเย็น', price: 25, stock: 4, category: 'Drinks' }],
]);
const groups = new Map([
  ['g1', {
    storeId: 'shop_1',
    name: 'ไข่ดาว',
    selectionType: 'single',
    minSelections: 1,
    options: [
      { id: 'o1', name: 'ไม่ใส่', priceModifierSatang: 0 },
      { id: 'o2', name: 'ใส่', priceModifierSatang: 1000 },
      { id: 'o3', name: 'หมด', priceModifierSatang: 1000, isOutOfStock: true },
    ],
  }],
]);

runTest('Price comes from the product document, never the request', () => {
  // The cart claiming a different price must be ignored entirely.
  const r = priceOrder(
    [{ productId: 'p1', quantity: 2, unitPrice: 1, price: 1, subtotalSatang: 2 }],
    products, groups, 'shop_1'
  );
  assert(r.ok, `pricing failed: ${r.message}`);
  assertEqual(r.calculatedTotalSatang, 10000, '฿50 × 2, not the ฿0.01 the caller sent');
});

runTest('A baht-only product is converted to satang without drift', () => {
  const r = priceOrder([{ productId: 'p2', quantity: 3 }], products, groups, 'shop_1');
  assertEqual(r.calculatedTotalSatang, 7500, '฿25 × 3');
  assert(Number.isInteger(r.calculatedTotalSatang), 'satang must stay integral');
});

runTest('Option prices are added from the group document', () => {
  const withEgg = new Map(products);
  withEgg.set('p1', { ...products.get('p1'), modifierGroupIds: ['g1'] });
  const r = priceOrder(
    [{ productId: 'p1', quantity: 1, selectedModifiers: [{ modifierGroupId: 'g1', optionId: 'o2' }] }],
    withEgg, groups, 'shop_1'
  );
  assert(r.ok, `pricing failed: ${r.message}`);
  assertEqual(r.calculatedTotalSatang, 6000, '฿50 + ฿10');
});

runTest('🚨 A required option group cannot be skipped', () => {
  const withEgg = new Map(products);
  withEgg.set('p1', { ...products.get('p1'), modifierGroupIds: ['g1'] });
  const r = priceOrder([{ productId: 'p1', quantity: 1 }], withEgg, groups, 'shop_1');
  assert(!r.ok && r.code === 'REQUIRED_MODIFIER_MISSING', 'the required group must be enforced');
});

runTest('🚨 A single-choice group cannot take two choices', () => {
  const withEgg = new Map(products);
  withEgg.set('p1', { ...products.get('p1'), modifierGroupIds: ['g1'] });
  const r = priceOrder(
    [{ productId: 'p1', quantity: 1, selectedModifiers: [
      { modifierGroupId: 'g1', optionId: 'o1' },
      { modifierGroupId: 'g1', optionId: 'o2' },
    ] }],
    withEgg, groups, 'shop_1'
  );
  assert(!r.ok, 'two choices in a single-choice group must be refused');
  assert(
    ['MAX_SELECTIONS_EXCEEDED', 'SINGLE_SELECTION_VIOLATED'].includes(r.code),
    `unexpected refusal: ${r.code}`
  );
});

runTest('🚨 The same option twice is refused, not charged twice', () => {
  const g = new Map([['g1', { ...groups.get('g1'), selectionType: 'multi', minSelections: 0, maxSelections: 5 }]]);
  const withEgg = new Map(products);
  withEgg.set('p1', { ...products.get('p1'), modifierGroupIds: ['g1'] });
  const r = priceOrder(
    [{ productId: 'p1', quantity: 1, selectedModifiers: [
      { modifierGroupId: 'g1', optionId: 'o2' },
      { modifierGroupId: 'g1', optionId: 'o2' },
    ] }],
    withEgg, g, 'shop_1'
  );
  assert(!r.ok && r.code === 'DUPLICATE_MODIFIER_OPTION', 'a duplicate would be charged twice and cooked once');
});

runTest('An option that is out of stock is refused', () => {
  const withEgg = new Map(products);
  withEgg.set('p1', { ...products.get('p1'), modifierGroupIds: ['g1'] });
  const r = priceOrder(
    [{ productId: 'p1', quantity: 1, selectedModifiers: [{ modifierGroupId: 'g1', optionId: 'o3' }] }],
    withEgg, groups, 'shop_1'
  );
  assert(!r.ok && r.code === 'OPTION_OUT_OF_STOCK', 'a sold-out option must not be orderable');
});

runTest('🚨 A product from another store cannot be ordered here', () => {
  // It would be charged at this store's checkout and cooked by a kitchen that
  // never saw the order.
  const foreign = new Map([['p9', { storeId: 'shop_2', name: 'ของร้านอื่น', stock: 5, priceSatang: 100 }]]);
  const avail = checkProductAvailability(new Map([['p9', 1]]), foreign, 'shop_1');
  assert(!avail.ok && avail.code === 'CROSS_STORE_PRODUCT_VIOLATION', 'cross-store must be refused');
});

runTest('🚨 Stock is checked against the aggregated quantity', () => {
  // 4 in stock, 5 requested across two cart lines.
  const r = checkProductAvailability(new Map([['p2', 5]]), products, 'shop_1');
  assert(!r.ok && r.code === 'INSUFFICIENT_STOCK', 'overselling must be refused');
  assert(checkProductAvailability(new Map([['p2', 4]]), products, 'shop_1').ok, 'exactly the stock is fine');
});

runTest('A product with no stock field counts as zero, not unlimited', () => {
  const vague = new Map([['p3', { storeId: 'shop_1', name: 'ไม่ระบุสต็อก' }]]);
  const r = checkProductAvailability(new Map([['p3', 1]]), vague, 'shop_1');
  assert(!r.ok && r.code === 'INSUFFICIENT_STOCK', 'a missing stock field must not mean infinite');
});

runTest('An unavailable product is refused even when in stock', () => {
  const paused = new Map([['p4', { storeId: 'shop_1', name: 'พักขาย', stock: 99, isAvailable: false }]]);
  const r = checkProductAvailability(new Map([['p4', 1]]), paused, 'shop_1');
  assert(!r.ok && r.code === 'PRODUCT_UNAVAILABLE', 'a paused dish must not be orderable');
});

runTest('Allergen scan data is built from the product, not the request', () => {
  // A caller clearing the tags on the way in must not clear the check.
  const tagged = new Map([['p5', {
    storeId: 'shop_1', name: 'ผัดไทยกุ้ง', stock: 5, priceSatang: 6000,
    allergens: ['shrimp', 'peanut'], description: 'ใส่ถั่วลิสง',
  }]]);
  const r = priceOrder([{ productId: 'p5', quantity: 1, allergens: [] }], tagged, groups, 'shop_1');
  assert(r.ok, `pricing failed: ${r.message}`);
  assertEqual(r.allergenScanItems[0].declaredAllergens.join(','), 'shrimp,peanut', 'the store declaration must survive');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
