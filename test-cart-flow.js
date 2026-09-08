/**
 * ============================================================================
 * CART FLOW TEST SUITE
 * ============================================================================
 *
 * The reported symptom: press "เพิ่มลงตะกร้า", then press the button labelled
 * "สั่งซื้อ / ไปที่ตะกร้า", and the item that was just added is not there.
 *
 * The cause was two sources of truth. The product page handed one item to the
 * booking page through router state instead of adding it to the cart, and the
 * booking page preferred that router state over the real cart — so the cart's
 * contents were invisible on the one screen that ordered them. The order that
 * followed then called clearCart(), deleting items that had never been ordered.
 *
 * A second, quieter one: the cart totalled `menuItem.price * quantity` while the
 * booking page added the paid options, so a customer who chose extra toppings saw
 * one price in the cart and a higher one at checkout.
 *
 * These are wiring properties — which module owns the data, and which arithmetic
 * each screen uses — so they are checked at that level.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calculateCartItemUnitPrice } from './src/store/cartPricing.js';

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

const productDetail = read('src/pages/ProductDetail.jsx');
const foodBooking = read('src/pages/FoodBooking.tsx');
const cartModal = read('src/components/ClientCartModal.jsx');
const searchBar = read('src/components/ShopeeSearchBar.jsx');

console.log('\n🛒 CART FLOW TEST SUITE\n');

// ===========================================================================
console.log('1. One cart, one source of truth');
// ===========================================================================

runTest('🚨 "สั่งซื้อ / ไปที่ตะกร้า" puts the item in the cart', () => {
  // The button says "go to the cart". If it does not add to the cart, the customer
  // arrives at a screen that is not their cart.
  const handler = productDetail.slice(
    productDetail.indexOf('const handleNextBooking'),
    productDetail.indexOf('return (', productDetail.indexOf('const handleNextBooking'))
  );
  assert(handler.length > 0, 'handleNextBooking must be locatable');
  assert(/dispatch\(addItem\(/.test(handler), 'the item must be added to the cart');
});

runTest('🚨 The booking page is not handed a separate item list', () => {
  const handler = productDetail.slice(
    productDetail.indexOf('const handleNextBooking'),
    productDetail.indexOf('return (', productDetail.indexOf('const handleNextBooking'))
  );
  assert(
    !/cartItems:\s*\[/.test(handler),
    'router state carrying its own items is what hid the real cart'
  );
});

runTest('🚨 The booking page reads the cart, not router state', () => {
  assert(
    /const cartItems = reduxCartItems/.test(foodBooking),
    'the booking page must render the real cart'
  );
  assert(
    !/locationState\?\.cartItems/.test(foodBooking),
    'a router-state override reintroduces the bug'
  );
  assert(
    !/propCartItems/.test(foodBooking),
    'a prop override does the same'
  );
});

runTest('The pickup context still travels with the customer', () => {
  // Only the items moved to the cart; the time, date and store chosen on the
  // product page must still arrive, or the booking page starts blank.
  const handler = productDetail.slice(
    productDetail.indexOf('const handleNextBooking'),
    productDetail.indexOf('return (', productDetail.indexOf('const handleNextBooking'))
  );
  for (const key of ['pickupTime', 'bookingDate', 'storeId', 'storeName']) {
    assert(handler.includes(`${key}:`), `${key} must still be passed`);
  }
  assert(foodBooking.includes('locationState?.pickupTime'), 'and must still be read');
});

runTest('🚨 A successful order clears the cart it actually ordered', () => {
  // clearCart() always emptied the redux cart. When the order came from router
  // state that cart held different items, so ordering one dish deleted the rest
  // without ordering them. With one source of truth the two are the same list.
  assert(foodBooking.includes('dispatch(clearCart())'), 'the cart must be emptied on success');
  const submit = foodBooking.slice(foodBooking.indexOf('const handleConfirmOrder'));
  const clearIdx = submit.indexOf('dispatch(clearCart())');
  const createIdx = submit.indexOf('createAuthoritativeStoreOrder');
  assert(createIdx !== -1 && clearIdx > createIdx, 'and only after the order is created');
});

// ===========================================================================
console.log('\n2. One price, on every screen');
// ===========================================================================

const plainItem = { menuItem: { id: 'p1', name: 'ข้าวมันไก่', price: 40 }, quantity: 2 };
const itemWithPaidOptions = {
  menuItem: { id: 'p2', name: 'ก๋วยเตี๋ยว', price: 45 },
  quantity: 1,
  selectedModifiers: [
    { modifierGroupId: 'g1', optionId: 'o1', name: 'ไข่ดาว', priceModifier: 10 },
    { modifierGroupId: 'g2', optionId: 'o2', name: 'พิเศษ', priceModifier: 5 },
  ],
};

runTest('A plain item costs its menu price', () => {
  assertEqual(calculateCartItemUnitPrice(plainItem), 40);
});

runTest('🚨 Paid options are included in the unit price', () => {
  // The cart used to show 45 while checkout charged 60.
  assertEqual(calculateCartItemUnitPrice(itemWithPaidOptions), 60, '45 + 10 + 5');
});

runTest('A modifier priced in satang is read, and not double-counted', () => {
  const satangOnly = {
    menuItem: { price: 45 },
    quantity: 1,
    selectedModifiers: [{ name: 'ไข่ดาว', priceModifierSatang: 1000 }],
  };
  assertEqual(calculateCartItemUnitPrice(satangOnly), 55, 'satang must be converted');

  const both = {
    menuItem: { price: 45 },
    quantity: 1,
    selectedModifiers: [{ name: 'ไข่ดาว', priceModifier: 10, priceModifierSatang: 1000 }],
  };
  assertEqual(calculateCartItemUnitPrice(both), 55, 'baht wins; satang must not be added again');
});

runTest('An item with no modifiers or a malformed list still prices', () => {
  assertEqual(calculateCartItemUnitPrice({ menuItem: { price: 30 }, quantity: 1 }), 30);
  assertEqual(
    calculateCartItemUnitPrice({ menuItem: { price: 30 }, quantity: 1, selectedModifiers: 'oops' }),
    30
  );
  assertEqual(calculateCartItemUnitPrice({ quantity: 1 }), 0, 'a line with no menu item is free, not NaN');
});

runTest('🚨 The cart totals with the same function the checkout uses', () => {
  assert(
    cartModal.includes('calculateCartItemUnitPrice'),
    'the cart must not carry its own price arithmetic'
  );
  assert(
    !/menuItem\?\.price \|\| 0\) \* item\.quantity/.test(cartModal),
    'the base-price-only total must be gone'
  );
});

runTest('🚨 The booking page shares that function rather than copying it', () => {
  assert(
    foodBooking.includes('calculateCartItemUnitPrice'),
    'two copies of one rule is how they came to disagree'
  );
  assert(
    !/const modTotal = mods\.reduce/.test(foodBooking),
    'the duplicated arithmetic must be gone'
  );
});

// ===========================================================================
console.log('\n3. What the cart shows the customer');
// ===========================================================================

runTest('Each line shows its own subtotal, not just a unit price', () => {
  assert(/unitPrice \* quantity/.test(cartModal), 'the quantity buttons must change a visible number');
});

runTest('The item image the customer picked is shown', () => {
  assert(/item\.menuItem\?\.image/.test(cartModal), 'four text rows look identical without it');
});

runTest('Chosen options are listed rather than buried in a note string', () => {
  assert(/selectedModifiers/.test(cartModal), 'the cart must show what was chosen');
});

runTest('🚨 A cart holding two stores is flagged before checkout', () => {
  // One order goes to one store. Without this the customer finds out when the
  // order is refused, with the reason on the wrong screen.
  assert(cartModal.includes('hasMixedStores'), 'mixed stores must be detected');
  assert(/disabled=\{hasMixedStores\}/.test(cartModal), 'and must block checkout');
  assert(cartModal.includes('role="alert"'), 'and be announced, not just coloured');
});

runTest('The empty-cart button goes somewhere', () => {
  // It used to only close the modal, leaving the customer where they already were.
  assert(cartModal.includes('onBrowseMenu'), 'the empty state needs a way forward');
  assert(searchBar.includes('onBrowseMenu={'), 'and it must be wired');
});

runTest('Every control in the cart has an accessible name', () => {
  for (const label of ['ปิดตะกร้า', 'เพิ่มจำนวน', 'ออกจากตะกร้า']) {
    assert(cartModal.includes(label), `an aria-label mentioning "${label}" must exist`);
  }
});

runTest('The cart dialog is announced as a dialog', () => {
  assert(cartModal.includes('role="dialog"'), 'a modal must say so');
  assert(cartModal.includes('aria-modal="true"'), 'and trap the reader inside it');
  assert(cartModal.includes('aria-labelledby'), 'and be named');
});

runTest('The cart badge counts pieces, not lines', () => {
  assert(searchBar.includes('selectCartTotalCount'), 'two of one dish is two pieces');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
