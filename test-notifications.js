/**
 * ============================================================================
 * NOTIFICATION & HEADER TEST SUITE
 * ============================================================================
 *
 * The header bell showed four notifications written into ShopeeSearchBar.jsx:
 *
 *   ร้านครัวโรงเรียน QueueUp Canteen  — คิวพร้อมรับ A05, รับ 12:15 เคาน์เตอร์ 1
 *   ร้านสเต็กพี่ตั้ม School Food      — กำลังปรุง, รับ 12:30 เคาน์เตอร์ 3
 *   ร้านป้าแดง ตามสั่ง (ร้านที่ติดตาม) — แจกโค้ดส่วนลด 15%
 *   …and a fourth
 *
 * with a badge reading 4. Every visitor saw the same four, signed in or not, on
 * every page the header appears on — and tapping one opened their bookings tab,
 * which showed something else entirely. None of those shops exist, no order had
 * queue number A05, and nobody was collecting anything at 12:15.
 *
 * Beside it, the search box suggested from a ten-item MOCK_PRODUCTS array, so
 * typing "ก๋วยเตี๋ยว" offered a dish no stall might sell, and the floating chat
 * button carried a hardcoded "3" unread on four pages.
 *
 * A notification is a claim that something happened to you. What is tested here
 * is that every one of them now comes from this person's own orders, that the
 * badge can reach zero, and that nothing is shown to someone signed out.
 */

import { readFileSync } from 'node:fs';
import {
  NOTIFIABLE_STATUSES,
  orderToNotification,
} from './src/services/orderNotification.ts';

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

const order = (over = {}) => ({
  id: 'ord1',
  storeName: 'ร้านข้าวมันไก่',
  queueNumber: 'A12',
  status: 'READY',
  pickupTime: '12:15',
  items: [{ name: 'ข้าวมันไก่' }, { name: 'น้ำเก๊กฮวย' }],
  ...over,
});

console.log('\n🔔 A notification is about your own order');

runTest('🚨 Every field comes from the order, not from the component', () => {
  const n = orderToNotification(order());
  assertEqual(n.storeName, 'ร้านข้าวมันไก่', 'the shop is not the one on the order');
  assertEqual(n.queueNumber, 'A12', 'the queue number is not the one on the order');
  assertEqual(n.pickupTime, '12:15', 'the pickup time is not the one on the order');
  assertEqual(n.itemsLabel, 'ข้าวมันไก่, น้ำเก๊กฮวย', 'the dishes are not the ones ordered');
});

runTest('🚨 A finished order is not news', () => {
  // The old list never changed, so it could never stop being shown.
  for (const status of ['COMPLETED', 'CANCELLED', 'REFUNDED', '']) {
    assertEqual(orderToNotification(order({ status })), null, `${status} must not notify`);
  }
});

runTest('Each live state gets its own tone', () => {
  assertEqual(orderToNotification(order({ status: 'READY' })).tone, 'READY', 'ready');
  assertEqual(orderToNotification(order({ status: 'PREPARING' })).tone, 'COOKING', 'cooking');
  assertEqual(orderToNotification(order({ status: 'PENDING' })).tone, 'WAITING', 'waiting');
  assertEqual(orderToNotification(order({ status: 'CONFIRMED' })).tone, 'WAITING', 'confirmed');
});

runTest('🚨 Only a collectable order is actionable', () => {
  // The badge counts these. A badge that cannot reach zero is decoration.
  assertEqual(orderToNotification(order({ status: 'READY' })).actionable, true, 'ready');
  for (const status of ['PENDING', 'CONFIRMED', 'PREPARING']) {
    assertEqual(
      orderToNotification(order({ status })).actionable,
      false,
      `${status} does not need anyone to stand up`
    );
  }
});

runTest('A missing field reads as missing, not as something plausible', () => {
  // "ร้านป้าแดง ตามสั่ง" is how a placeholder stops looking like one.
  const n = orderToNotification({ status: 'READY', storeId: 'shop_9' });
  assertEqual(n.storeName, 'shop_9', 'the store id is the honest fallback');
  assertEqual(n.queueNumber, '—', 'a missing queue number was invented');
  assertEqual(n.pickupTime, '—', 'a missing pickup time was invented');
  assertEqual(n.itemsLabel, '0 รายการ', 'an empty order claims dishes');
});

runTest('An order item stored in either shape is named', () => {
  // Stored items carry `name`; a cart line carries `menuItem.name`. The admin
  // orders tab crashed on this exact difference once already.
  const n = orderToNotification(order({ items: [{ menuItem: { name: 'ผัดกะเพรา' } }] }));
  assertEqual(n.itemsLabel, 'ผัดกะเพรา', 'a nested item name is dropped');
});

runTest('The notifiable states match the order lifecycle', () => {
  for (const s of ['PENDING', 'CONFIRMED', 'PREPARING', 'READY']) {
    assert(NOTIFIABLE_STATUSES.includes(s), `${s} is a live order and is never shown`);
  }
  for (const s of ['COMPLETED', 'CANCELLED']) {
    assert(!NOTIFIABLE_STATUSES.includes(s), `${s} is finished and must not be shown`);
  }
});

console.log('\n🖥️  The header stops inventing');

const bar = stripComments(read('src/components/ShopeeSearchBar.jsx'));

runTest('🚨 The four invented notifications are gone', () => {
  for (const ghost of [
    'ร้านสเต็กพี่ตั้ม School Food',
    'ร้านป้าแดง ตามสั่ง',
    'คิวพร้อมรับ A05',
    'เคาน์เตอร์ 1 อาคารโรงอาหาร 1',
    'สเต็กหมูพริกไทยดำ + เฟรนช์ฟรายส์กรอบ',
    '5 นาทีที่แล้ว',
  ]) {
    assert(!bar.includes(ghost), `the header still invents "${ghost}"`);
  }
});

runTest('🚨 Notifications come from a subscription to this person’s orders', () => {
  assert(bar.includes('subscribeToMyNotifications'), 'nothing reads the order collection');
  assert(bar.includes('notifications.map('), 'the list is not rendered from that read');
  assert(/user\?\.uid/.test(bar), 'the subscription is not scoped to the signed-in person');
});

runTest('🚨 The badge can reach zero', () => {
  // It read "4" unconditionally. A count that is always the same is not a count.
  assert(!/shopee-badge-icon">4</.test(bar), 'the badge is still hardcoded');
  assert(/actionableCount > 0 &&/.test(bar), 'the badge renders even with nothing to collect');
  assert(
    /filter\(\(n\) => n\.actionable\)/.test(bar),
    'the badge counts every notification, not the ones needing action'
  );
});

runTest('🚨 Nothing of anyone’s is shown to a signed-out visitor', () => {
  // The old four appeared before sign-in, to everybody.
  assert(
    /const notifications = user\?\.uid \? liveNotifications : \[\]/.test(bar),
    'a stale list could outlive the session that fetched it'
  );
  assert(bar.includes('เข้าสู่ระบบเพื่อดูสถานะคำสั่งซื้อ'), 'a signed-out visitor is told nothing');
});

runTest('Empty is a state the dropdown can be in', () => {
  // It could not be, before: four notifications were in the markup.
  assert(bar.includes('ยังไม่มีคำสั่งซื้อที่กำลังดำเนินการ'), 'no empty state');
  const css = read('src/components/ShopeeSearchBar.css');
  assert(css.includes('.shopee-notif-empty'), 'the empty state is unstyled');
});

console.log('\n🔍 Search suggests dishes that exist');

runTest('🚨 MOCK_PRODUCTS is gone', () => {
  assert(!bar.includes('MOCK_PRODUCTS'), 'the hardcoded dish list is back');
  for (const ghost of ['ชานมไข่มุกบราวน์ชูการ์', 'บิงซูสตรอว์เบอร์รีนมสด']) {
    assert(!bar.includes(ghost), `the search still suggests "${ghost}" from nowhere`);
  }
});

runTest('🚨 Suggestions are filtered from the products collection', () => {
  assert(bar.includes('fetchProductsFromFirestore'), 'the catalogue is never read');
  assert(bar.includes('catalogueNames'), 'suggestions do not come from the catalogue');
  const at = bar.indexOf('const suggestions = useMemo');
  assert(at > 0, 'the suggestion list is gone');
  const body = bar.slice(at, bar.indexOf('}, [', at));
  assert(body.includes('catalogueNames'), 'the filter still runs over a hardcoded list');
});

console.log('\n💬 The chat button counts nothing, and says nothing');

runTest('🚨 The hardcoded "3" unread is gone from every page', () => {
  // Nothing in the chat records what has been read, so there was no number to
  // show — and it showed the same one to everybody on four separate pages.
  for (const f of [
    'src/pages/ProductDetail.jsx',
    'src/pages/SearchResults.jsx',
    'src/pages/UserProfile.jsx',
    'src/pages/Home.jsx',
  ]) {
    assert(!read(f).includes('queue-chat-badge'), `${f} still shows an invented unread count`);
  }
  assert(
    !read('src/pages/Home.css').includes('.queue-chat-badge'),
    'the badge style outlived the badge'
  );
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
