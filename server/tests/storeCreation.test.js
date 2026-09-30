/**
 * Store Creation Suite
 *
 * The create-store form built the shop in the browser and asked the client SDK
 * to write it to Firestore. Rules reserve store creation for the server, and the
 * client swallowed the refusal with a console.warn — so the form reported
 * success while the shop existed only in that one browser: invisible to the API,
 * impossible to order from, gone on the next device.
 *
 * Creation is now an endpoint, and these tests pin what the request body is not
 * allowed to decide.
 */

process.env.ALLOW_MOCK_AUTH = 'true';

import http from 'http';
import express from 'express';
import { storeRouter } from '../routes/storeRoutes.js';
import { orderRouter } from '../routes/orderRoutes.js';
import { adminDb } from '../firebaseAdmin.js';

console.log('===============================================================');
console.log('🏪 QUEUEUP STORE CREATION SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api/stores', storeRouter);
app.use('/api/orders', orderRouter);
const server = http.createServer(app);

let total = 0;
let passed = 0;

function check(condition, message, detail = '') {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}${detail ? ` (${detail})` : ''}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}${detail ? ` (${detail})` : ''}`);
    process.exitCode = 1;
  }
}

const suffix = Date.now();
const FOUNDER = `uid-founder-${suffix}`;
const OTHER = `uid-other-${suffix}`;
let baseUrl = '';

function as(uid, { schoolId = 'KKU', role = 'customer' } = {}) {
  return {
    'x-mock-user-id': uid,
    'x-mock-user-role': role,
    'x-mock-user-email': `${uid}@kku.ac.th`,
    'x-mock-school-id': schoolId
  };
}

async function api(path, method = 'GET', body = null, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

async function runTests() {
  baseUrl = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });

  try {
    // --- Opening a shop ---
    console.log('\n--- Opening a shop ---');
    let res = await api('/api/stores', 'POST', { name: 'ร้านไก่ทอดหาดใหญ่' });
    check(res.status === 401, 'An anonymous caller cannot open a shop', `status ${res.status}`);

    res = await api('/api/stores', 'POST', { name: '   ' }, as(FOUNDER));
    check(res.status === 400 && res.data?.error === 'STORE_NAME_REQUIRED',
      'A shop needs a name', `error ${res.data?.error}`);

    res = await api('/api/stores', 'POST', {
      name: '  ร้านไก่ทอดหาดใหญ่  ',
      category: 'rice',
      address: 'โรงอาหาร อาคาร 50 ปี',
      averageWaitMinutes: 12,
      tags: ['ไก่ทอด', 'ข้าวมันไก่'],
      logo: 'https://images.example.com/logo.png',
      initialMenuItems: [
        { name: 'ไก่ทอดหาดใหญ่', price: 45, preparationMinutes: 8 },
        { name: 'ข้าวเหนียว', price: 10 }
      ]
    }, as(FOUNDER));
    const store = res.data?.store;
    const menu = res.data?.menuItems || [];
    check(res.status === 201 && Boolean(store?.id), 'A signed-in account opens one', `status ${res.status}`);
    check(store?.name === 'ร้านไก่ทอดหาดใหญ่', 'The name is trimmed', `"${store?.name}"`);
    check(store?.ownerId === FOUNDER,
      'The owner is the caller', `ownerId ${store?.ownerId}`);
    check(store?.schoolId === 'KKU',
      'The institution comes from their account', `schoolId ${store?.schoolId}`);

    // --- It exists where the rest of the system looks ---
    console.log('\n--- Where the rest of the system looks ---');
    const persisted = (await adminDb.collection('stores').doc(store.id).get()).data();
    check(Boolean(persisted), 'The shop is in Firestore, not only in a browser');
    check(menu.length === 2, 'Both menu items were created', `${menu.length} item(s)`);
    const persistedMenu = (await adminDb.collection('menu_items').doc(menu[0].id).get()).data();
    check(persistedMenu?.storeId === store.id,
      'And each is bound to the shop', `storeId ${persistedMenu?.storeId}`);

    res = await api('/api/orders', 'POST', {
      storeId: store.id,
      items: [{ menuItemId: menu[0].id, quantity: 2 }],
      paymentMethod: 'cash',
      idempotencyKey: `store-create-order-${suffix}`
    }, as(`customer-${suffix}`));
    check(res.status === 201,
      'A customer can actually order from the new shop', `status ${res.status}`);
    check(res.data?.order?.totalSatang === 9000,
      'At the price the shop set, in satang', `${res.data?.order?.totalSatang}`);

    // --- What the body may not decide ---
    console.log('\n--- What the request body may not decide ---');
    res = await api('/api/stores', 'POST', {
      name: 'ร้านแอบอ้าง',
      ownerId: OTHER,
      schoolId: 'CHULA',
      id: 'store-i-picked-this',
      rating: 5,
      currentQueueCount: 999
    }, as(FOUNDER));
    const planted = res.data?.store;
    check(planted?.ownerId === FOUNDER,
      'A shop cannot be registered under somebody else\'s name', `ownerId ${planted?.ownerId}`);
    check(planted?.schoolId === 'KKU',
      'Nor planted in another campus', `schoolId ${planted?.schoolId}`);
    check(planted?.id !== 'store-i-picked-this',
      'Nor claim an id of its own choosing', `id ${planted?.id}`);
    check(planted?.currentQueueCount === 0,
      'And it starts with an empty queue', `queue ${planted?.currentQueueCount}`);

    res = await api('/api/stores', 'POST', {
      name: 'ร้านสคริปต์',
      logo: 'javascript:alert(1)',
      category: 'not-a-real-category',
      initialMenuItems: [{ name: 'ของฟรี', price: -50 }, { name: '', price: 20 }]
    }, as(FOUNDER));
    check(res.data?.store?.logo === null,
      'A javascript: image URL is dropped', `logo ${res.data?.store?.logo}`);
    check(res.data?.store?.category === 'rice',
      'An unknown category falls back rather than being stored', `category ${res.data?.store?.category}`);
    check((res.data?.menuItems || []).length === 0,
      'A negative price and a nameless dish create nothing',
      `${(res.data?.menuItems || []).length} item(s)`);

    // --- Listing what you own ---
    console.log('\n--- The shops an account owns ---');
    res = await api('/api/stores/mine', 'GET', null, as(FOUNDER));
    check(res.status === 200 && res.data?.stores?.length === 3,
      'The founder sees their own shops', `${res.data?.stores?.length} shop(s)`);

    res = await api('/api/stores/mine', 'GET', null, as(OTHER));
    check(res.status === 200 && res.data?.stores?.length === 0,
      'Somebody else sees none of them', `${res.data?.stores?.length} shop(s)`);

    // --- A ceiling on how many ---
    console.log('\n--- A ceiling ---');
    for (let i = 0; i < 3; i++) {
      await api('/api/stores', 'POST', { name: `ร้านที่ ${i + 4}` }, as(FOUNDER));
    }
    res = await api('/api/stores', 'POST', { name: 'ร้านเกินโควตา' }, as(FOUNDER));
    check(res.status === 409 && res.data?.error === 'STORE_LIMIT_REACHED',
      'One account cannot open shops without end', `${res.status} ${res.data?.error}`);

    // --- Editing a shop ---
    console.log('\n--- Editing a shop ---');
    res = await api(`/api/stores/${store.id}`, 'PATCH', { name: 'ร้านไก่ทอดหาดใหญ่ สาขา 2' },
      as(FOUNDER, { role: 'merchant' }));
    check(res.status === 200 && res.data?.store?.name === 'ร้านไก่ทอดหาดใหญ่ สาขา 2',
      'The owner renames their shop and it persists', `status ${res.status}`);

    let saved = (await adminDb.collection('stores').doc(store.id).get()).data();
    check(saved.name === 'ร้านไก่ทอดหาดใหญ่ สาขา 2',
      'The database holds the new name, not just the screen', `"${saved.name}"`);

    res = await api(`/api/stores/${store.id}`, 'PATCH', {
      ownerId: OTHER, schoolId: 'CHULA', id: 'something-else', rating: 5
    }, as(FOUNDER, { role: 'merchant' }));
    saved = (await adminDb.collection('stores').doc(store.id).get()).data();
    check(saved.ownerId === FOUNDER && saved.schoolId === 'KKU',
      'An edit cannot hand the shop to someone else or move it to another campus',
      `owner ${saved.ownerId}, school ${saved.schoolId}`);

    res = await api(`/api/stores/${store.id}`, 'PATCH', { name: '   ' },
      as(FOUNDER, { role: 'merchant' }));
    check(res.status === 400, 'It cannot be renamed to nothing', `status ${res.status}`);

    res = await api(`/api/stores/${store.id}`, 'PATCH', { name: 'ยึดร้าน' }, as(OTHER));
    check(res.status === 403, 'Somebody else cannot edit it', `status ${res.status}`);

    res = await api(`/api/stores/${store.id}`, 'PATCH', { isOpen: false },
      as(FOUNDER, { role: 'merchant' }));
    saved = (await adminDb.collection('stores').doc(store.id).get()).data();
    check(res.status === 200 && saved.isOpen === false,
      'A shop can close itself', `isOpen ${saved.isOpen}`);

    // --- Deleting a shop ---
    console.log('\n--- Deleting a shop ---');
    res = await api(`/api/stores/${store.id}`, 'DELETE', null, as(FOUNDER, { role: 'merchant' }));
    check(res.status === 403,
      'A shop owner cannot delete their own shop', `status ${res.status}`);

    // store.id has the order placed earlier in this suite.
    res = await api(`/api/stores/${store.id}`, 'DELETE', null,
      as(`root-${suffix}`, { role: 'super_admin' }));
    check(res.status === 409 && res.data?.error === 'STORE_HAS_ORDERS',
      'Not even an administrator erases a shop with order history',
      `${res.status} ${res.data?.error}`);
    check(Boolean((await adminDb.collection('stores').doc(store.id).get()).exists),
      'So the shop is still there — a delete that deletes nothing must not say it did');

    const emptyRes = await api('/api/stores', 'POST', {
      name: 'ร้านไม่มีออเดอร์',
      initialMenuItems: [{ name: 'เมนูเดียว', price: 20 }]
    }, as(`solo-${suffix}`));
    const emptyStore = emptyRes.data?.store;
    const emptyMenuId = emptyRes.data?.menuItems?.[0]?.id;

    res = await api(`/api/stores/${emptyStore.id}`, 'DELETE', null,
      as(`root-${suffix}`, { role: 'super_admin' }));
    check(res.status === 200 && res.data?.deletedMenuItems === 1,
      'A shop with no orders is deleted, menu and all', `status ${res.status}`);
    check(!(await adminDb.collection('stores').doc(emptyStore.id).get()).exists,
      'And it is really gone from the database');
    check(!(await adminDb.collection('menu_items').doc(emptyMenuId).get()).exists,
      'Its menu items go with it rather than being orphaned');

    res = await api(`/api/stores/does-not-exist`, 'DELETE', null,
      as(`root-${suffix}`, { role: 'super_admin' }));
    check(res.status === 404, 'Deleting a shop that never existed is a 404', `status ${res.status}`);

    // --- A shop that does not exist is not a shop ---
    // The local store used to invent a store document on any read of a missing
    // one, so `exists` was never false: every not-found path passed against any
    // id, and none of them was really being tested.
    console.log('\n--- An order against a shop that does not exist ---');
    res = await api('/api/orders', 'POST', {
      storeId: 'store-never-created',
      items: [{ menuItemId: 'menu-imaginary', quantity: 1 }],
      paymentMethod: 'cash',
      idempotencyKey: `ghost-store-${suffix}`
    }, as(`customer-ghost-${suffix}`));
    check(res.status === 400 && /STORE_NOT_FOUND/.test(res.data?.message || ''),
      'Ordering from a shop that was never created is refused',
      `${res.status} ${(res.data?.message || '').slice(0, 40)}`);

    res = await api(`/api/stores/${emptyStore.id}`, 'PATCH', { name: 'ผีร้าน' },
      as(`root-${suffix}`, { role: 'super_admin' }));
    check(res.status === 404,
      'And the shop just deleted cannot be edited back into existence',
      `status ${res.status}`);

    console.log('\n===============================================================');
    console.log(`📊 STORE CREATION RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Store creation suite crashed:', err);
  process.exit(1);
});
