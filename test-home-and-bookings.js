/**
 * ============================================================================
 * HOME PAGE & BOOKING CALENDAR TEST SUITE
 * ============================================================================
 *
 * Three more places the app showed things that were not there.
 *
 * **The home page** mounted two sections of pure fiction. DailyMenuBoard listed
 * "ประกาศประจำวัน" from ร้านป้าแดง ตามสั่ง, ร้านก๋วยเตี๋ยวเรือเสือร้องไห้ and
 * ร้านสเต็กพี่ตั้ม, over a Mon–Fri grid of daily specials nothing schedules.
 * ShopReelsFeed showed cooking videos with like counts, each linked to a
 * productId that resolves to nothing — there is no video upload and no storage
 * for one. Both sat directly above the real catalogue.
 *
 * **The booking calendar** listed three invented bookings (BK-8091 at ร้านป้าแดง,
 * dated 2026-08-17) and its capacity heatmap counted orders whose `o.time` or
 * `o.timeSlot` equalled "11:45 - 12:00 น.". An order has neither field — it has
 * `pickupTime`, holding "11:45", not a range. So every slot counted zero and
 * read "low", on every day, through the busiest lunch hour. A merchant planning
 * staff saw an empty canteen at peak.
 *
 * **The staff tab** listed two invented colleagues with phone numbers, shown to
 * every merchant as their own; add and remove only touched React state, so
 * revoking someone's access lasted until the next reload.
 */

import { existsSync, readFileSync } from 'node:fs';

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
const exists = (rel) => existsSync(new URL(`./${rel}`, import.meta.url).pathname);
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

console.log('\n🏠 The home page shows only what exists');

const home = stripComments(read('src/pages/Home.jsx'));

runTest('🚨 The invented announcement board is gone', () => {
  assert(!exists('src/components/DailyMenuBoard.jsx'), 'the component is back');
  assert(!home.includes('DailyMenuBoard'), 'the home page still mounts it');
});

runTest('🚨 The invented reels feed is gone', () => {
  assert(!exists('src/components/ShopReelsFeed.jsx'), 'the component is back');
  assert(!home.includes('ShopReelsFeed'), 'the home page still mounts it');
});

runTest('🚨 No invented shop names survive on the home page', () => {
  for (const ghost of [
    'ร้านป้าแดง',
    'ร้านก๋วยเตี๋ยวเรือเสือ',
    'ร้านสเต็กพี่ตั้ม',
  ]) {
    assert(!home.includes(ghost), `the home page still names "${ghost}"`);
  }
});

runTest('🚨 The "AI smart search" ranking shows real shops', () => {
  // Three invented shops were ranked with invented ratings and serve times:
  // "อร่อยอันดับ 1 ใกล้คุณ" 4.9/5 in 8 minutes, beside "ตำแหน่งของคุณ: อาคารเรียน 2".
  // Nothing measures a serve time, no rating was collected, and the app knows
  // nobody's location.
  assert(!home.includes('อร่อยอันดับ 1 ใกล้คุณ'), 'the invented ranking is back');
  assert(!home.includes('เสิร์ฟไวเฉลี่ย'), 'an invented serve time is back');
  assert(!home.includes('ตำแหน่งของคุณ:'), 'the page claims to know where the visitor is');
  assert(home.includes('openShops.map('), 'the shop cards are not rendered from real shops');
  assert(home.includes('fetchShopsFromFirestore'), 'shops are never read');
});

runTest('🚨 Nothing links to a product id that cannot exist', () => {
  // A banner linked to /product/m1 — the mock catalogue's own id.
  assert(!/\/product\/m1/.test(home), 'a link to the mock catalogue survives');
});

runTest('The real catalogue section is still there', () => {
  // The point is not to empty the page — it is that what it shows is real.
  assert(home.includes('อาหารทั้งหมดในโรงอาหาร'), 'the real menu section went with them');
});

console.log('\n📅 The booking calendar counts real orders');

const cal = stripComments(read('src/components/BookingCalendar.jsx'));

runTest('🚨 The invented bookings are gone', () => {
  assert(!cal.includes('MOCK_USER_BOOKINGS'), 'the mock bookings are back');
  assert(!cal.includes('BK-8091'), 'an invented booking id survives');
  assert(cal.includes('bookingsForDay'), 'the list is not derived from real orders');
});

runTest('🚨 The heatmap matches a field orders actually have', () => {
  // `o.time` and `o.timeSlot` do not exist on an order. Matching them counted
  // zero for every slot, forever, with no error.
  assert(!/o\.time ===/.test(cal), 'the heatmap matches o.time again');
  assert(!/o\.timeSlot ===/.test(cal), 'the heatmap matches o.timeSlot again');
  assert(/o\.pickupTime === slot/.test(cal), 'the heatmap does not match pickupTime');
});

runTest('🚨 The slots are the times a customer can actually pick', () => {
  // They were eight fifteen-minute ranges; a customer picks from eight
  // half-hourly times, so no order could ever match one.
  const at = cal.indexOf('const timeSlots = [');
  assert(at > 0, 'the slot list is gone');
  const slots = cal.slice(at, cal.indexOf('];', at));
  assert(!slots.includes(' - '), 'the slots are ranges again, which no order matches');
  for (const t of ['"11:00"', '"12:30"', '"14:30"']) {
    assert(slots.includes(t), `the bookable time ${t} is missing from the heatmap`);
  }

  const product = read('src/pages/ProductDetail.jsx');
  for (const t of ['11:00', '12:30', '14:30']) {
    assert(
      product.includes(`{ time: "${t}"`),
      `${t} is in the heatmap but is no longer bookable — the two lists drifted`
    );
  }
});

runTest('🚨 Only the selected day, and not a cancelled order, counts', () => {
  const at = cal.indexOf('const relevantOrders');
  assert(at > 0, 'the order filter is gone');
  const body = cal.slice(at, cal.indexOf('return timeSlots.map', at));
  assert(body.includes('o.pickupDate !== selectedDate'), 'every order ever placed counts as today');
  assert(body.includes('CANCELLED'), 'a cancelled order still fills a slot');
});

runTest('The capacity comes from the store, not from a constant', () => {
  assert(!/const capacity = 20;/.test(cal), 'every stall is assumed to take 20 an hour');
  assert(cal.includes('maxOrdersPerSlot'), 'the store’s own limit is ignored');
});

runTest('🚨 A cooking order is not badged as finished', () => {
  // The cases were READY, COOKING and PENDING — the mock bookings' own words. A
  // real order is PREPARING, which fell through to "เสร็จสิ้น".
  assert(cal.includes('case "PREPARING"'), 'PREPARING is not handled');
  assert(cal.includes('case "CONFIRMED"'), 'CONFIRMED is not handled');
  assert(cal.includes('case "CANCELLED"'), 'a cancelled order is badged as finished');
});

console.log('\n👥 The staff list is the store’s own');

const dash = stripComments(read('src/pages/MerchantDashboard.jsx'));

runTest('🚨 The two invented colleagues are gone', () => {
  for (const ghost of ['นางสาวมยุรี ใจดี', 'นายประสิทธิ์ ขยันทำงาน', '089-XXX-XXXX']) {
    assert(!dash.includes(ghost), `the staff tab still invents "${ghost}"`);
  }
  assert(
    /const \[staffList, setStaffList\] = useState\(\[\]\)/.test(dash),
    'the list still opens with people in it'
  );
});

runTest('🚨 Staff are read from the store’s own subcollection', () => {
  assert(
    /collection\(db, 'shops', currentStoreId, 'staff'\)/.test(dash),
    'the staff list is not read from shops/{id}/staff'
  );
});

runTest('🚨 Adding and removing reach the database', () => {
  const addAt = dash.indexOf('const handleAddStaff');
  assert(addAt > 0, 'the add handler is gone');
  const add = dash.slice(addAt, dash.indexOf('const handleRemoveStaff', addAt));
  assert(add.includes('await setDoc('), 'a new staff member is only added to React state');
  assert(!/STF0\$\{staffList\.length/.test(add), 'the colliding id scheme is back');

  const removeAt = dash.indexOf('const handleRemoveStaff');
  assert(removeAt > 0, 'the remove handler is gone');
  const remove = dash.slice(removeAt, removeAt + 1200);
  assert(remove.includes('deleteDoc('), 'revoking access lasts until the next reload');
  assert(remove.includes('toast.confirm'), 'access is revoked with no confirmation');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
