/**
 * Chat Isolation Suite
 *
 * The sender's *role* is derived from the verified identity — that hole was
 * closed. The chat *room* was not: both the message endpoint and the assistant
 * endpoint took chatId straight from the request body, so a signed-in stranger
 * could post into somebody else's conversation with a shop, and could hand the
 * assistant another customer's order id to talk about.
 */

process.env.ALLOW_MOCK_AUTH = 'true';

import http from 'http';
import express from 'express';
import { chatRouter } from '../routes/chatRoutes.js';
import { notificationRouter } from '../routes/notificationRoutes.js';
import { orderRouter } from '../routes/orderRoutes.js';
import { adminDb } from '../firebaseAdmin.js';

console.log('===============================================================');
console.log('💬 QUEUEUP CHAT ISOLATION SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);
app.use('/api', notificationRouter);
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

const SCHOOL = 'KKU';
const suffix = Date.now();
const STORE = `store-chat-${suffix}`;
const OWNER = `owner-chat-${suffix}`;
const RIVAL_STORE = `store-rival-${suffix}`;
const RIVAL_OWNER = `owner-rival-${suffix}`;
const ALICE = `uid-alice-${suffix}`;
const BOB = `uid-bob-${suffix}`;
const MENU = `menu-chat-${suffix}`;
let baseUrl = '';

function as(uid, role = 'customer') {
  return {
    'x-mock-user-id': uid,
    'x-mock-user-role': role,
    'x-mock-user-email': `${uid}@kku.ac.th`,
    'x-mock-school-id': SCHOOL
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

async function messagesIn(chatId) {
  const snap = await adminDb.collection('chats').doc(chatId).collection('messages').get();
  return snap.docs.map((d) => d.data());
}

async function seed() {
  for (const [storeId, ownerId, name] of [
    [STORE, OWNER, 'ร้านลาบอุดร'],
    [RIVAL_STORE, RIVAL_OWNER, 'ร้านคู่แข่ง']
  ]) {
    await adminDb.collection('stores').doc(storeId).set({
      id: storeId, name, ownerId, isOpen: true, schoolId: SCHOOL, currentQueueCount: 0
    });
  }
  await adminDb.collection('menu_items').doc(MENU).set({
    id: MENU, storeId: STORE, name: 'ลาบหมู', price: 60, isAvailable: true
  });
}

async function runTests() {
  baseUrl = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });

  try {
    await seed();

    // --- Alice opens a conversation with the shop ---
    console.log('\n--- Alice talks to the shop ---');
    let res = await api('/api/chat/messages', 'POST', {
      storeId: STORE,
      message: 'ร้านเปิดถึงกี่โมงคะ'
    }, as(ALICE));
    check(res.status === 200 || res.status === 201,
      'Alice can message the shop', `status ${res.status}`);

    const aliceThread = `chat_${STORE}_${ALICE}`;
    let msgs = await messagesIn(aliceThread);
    check(msgs.some((m) => m.senderId === ALICE),
      'Her message lands in her own thread', `${msgs.length} message(s)`);
    const aliceCountBefore = msgs.length;

    // --- Bob tries to post into Alice's thread ---
    console.log('\n--- Bob aims at Alice\'s thread ---');
    res = await api('/api/chat/messages', 'POST', {
      storeId: STORE,
      chatId: aliceThread,
      message: 'ข้อความแปลกปลอมจากคนอื่น'
    }, as(BOB));
    check(res.status === 403,
      'Bob cannot post into a thread he is not part of', `status ${res.status}`);
    msgs = await messagesIn(aliceThread);
    check(msgs.length === aliceCountBefore,
      'Alice\'s thread is untouched', `${msgs.length} message(s)`);

    res = await api(`/api/chat/messages/${aliceThread}`, 'GET', null, as(BOB));
    check(res.status === 403, 'Nor can he read it', `status ${res.status}`);

    // --- Bob aims the assistant at Alice's thread ---
    console.log('\n--- Bob aims the assistant at Alice\'s thread ---');
    res = await api('/api/chat/assistant-reply', 'POST', {
      storeId: STORE,
      chatId: aliceThread,
      message: 'ร้านเปิดกี่โมง'
    }, as(BOB));
    check(res.status === 403,
      'The assistant refuses to write into a stranger\'s thread', `status ${res.status}`);
    msgs = await messagesIn(aliceThread);
    check(msgs.length === aliceCountBefore,
      'Still untouched', `${msgs.length} message(s)`);

    // --- Bob asks the assistant about Alice's order ---
    console.log('\n--- Bob asks about Alice\'s order ---');
    res = await api('/api/orders', 'POST', {
      storeId: STORE,
      items: [{ menuItemId: MENU, quantity: 1 }],
      paymentMethod: 'cash',
      idempotencyKey: `chat-order-${suffix}`
    }, as(ALICE));
    const aliceOrder = res.data?.orderId;
    check(Boolean(aliceOrder), 'Alice has an order', `${aliceOrder}`);

    // Marked distinctively, so anything the assistant says about it is visible.
    await adminDb.collection('orders').doc(aliceOrder).set({
      orderNumber: 'ZQ-LEAK-7788'
    }, { merge: true });

    const withAlicesOrder = await api('/api/chat/assistant-reply', 'POST', {
      storeId: STORE,
      orderId: aliceOrder,
      message: 'ออเดอร์ของฉันถึงไหนแล้ว'
    }, as(BOB));
    const withNoOrder = await api('/api/chat/assistant-reply', 'POST', {
      storeId: STORE,
      message: 'ออเดอร์ของฉันถึงไหนแล้ว'
    }, as(BOB));

    const leaked = JSON.stringify(withAlicesOrder.data || {});
    const replyWithOrder = withAlicesOrder.data?.result?.replyText || '';
    const replyWithout = withNoOrder.data?.result?.replyText || '';

    check(replyWithout.length > 0,
      'The assistant does answer this question, so the comparison below means something',
      `${replyWithout.length} chars`);
    check(!leaked.includes('ZQ-LEAK-7788') && !leaked.includes(aliceOrder),
      'The assistant never repeats another customer\'s order back',
      `status ${withAlicesOrder.status}`);
    check(replyWithOrder === replyWithout,
      'Passing a stranger\'s order id changes nothing — it is ignored, not used');

    // --- A rival shop owner aims at this shop's thread ---
    console.log('\n--- A rival shop aiming at this shop\'s thread ---');
    res = await api('/api/chat/messages', 'POST', {
      storeId: RIVAL_STORE,
      chatId: aliceThread,
      message: 'ร้านเราถูกกว่านะครับ',
      senderName: 'ร้านคู่แข่ง'
    }, as(RIVAL_OWNER, 'merchant'));
    check(res.status === 403,
      'Operating one shop does not grant another shop\'s conversations',
      `status ${res.status}`);
    msgs = await messagesIn(aliceThread);
    check(!msgs.some((m) => m.senderId === RIVAL_OWNER),
      'No rival message appears in the thread');

    // --- The people who belong there still work ---
    console.log('\n--- The participants themselves ---');
    res = await api('/api/chat/messages', 'POST', {
      storeId: STORE,
      chatId: aliceThread,
      customerId: ALICE,
      message: 'เปิดถึง 20:00 ค่ะ',
      senderName: 'ร้านลาบอุดร'
    }, as(OWNER, 'merchant'));
    check(res.status === 200 || res.status === 201,
      'The shop can reply in its own customer\'s thread', `status ${res.status}`);
    msgs = await messagesIn(aliceThread);
    check(msgs.some((m) => m.senderRole === 'merchant'),
      'The reply is recorded as the merchant');

    res = await api('/api/chat/messages', 'POST', {
      storeId: STORE,
      chatId: aliceThread,
      message: 'ขอบคุณค่ะ'
    }, as(ALICE));
    check(res.status === 200 || res.status === 201,
      'Alice can keep using her own thread by id', `status ${res.status}`);

    res = await api(`/api/chat/messages/${aliceThread}`, 'GET', null, as(ALICE));
    check(res.status === 200 && (res.data?.messages?.length || 0) >= 3,
      'And read it back', `${res.data?.messages?.length} message(s)`);

    res = await api(`/api/chat/messages/${aliceThread}`, 'GET', null, as(OWNER, 'merchant'));
    check(res.status === 200, 'So can the shop that owns it', `status ${res.status}`);

    // --- The assistant must not take the thread over ---
    console.log('\n--- The shop triggering the assistant in a customer thread ---');
    res = await api('/api/chat/assistant-reply', 'POST', {
      storeId: STORE,
      chatId: aliceThread,
      message: 'ร้านเปิดกี่โมง'
    }, as(OWNER, 'merchant'));
    check(res.status === 200, 'The shop may use the assistant in its own thread', `status ${res.status}`);

    const threadDoc = (await adminDb.collection('chats').doc(aliceThread).get()).data();
    check(threadDoc?.customerId === ALICE,
      'The thread still belongs to Alice — writing the caller\'s uid here locked her out',
      `customerId ${threadDoc?.customerId}`);
    res = await api(`/api/chat/messages/${aliceThread}`, 'GET', null, as(ALICE));
    check(res.status === 200, 'And she can still read her own conversation', `status ${res.status}`);

    // --- Bob's own new thread ---
    console.log('\n--- Bob\'s own conversation ---');
    res = await api('/api/chat/assistant-reply', 'POST', {
      storeId: STORE,
      message: 'ร้านเปิดกี่โมง'
    }, as(BOB));
    check(res.status === 200,
      'Bob can still start his own conversation with the assistant', `status ${res.status}`);

    console.log('\n===============================================================');
    console.log(`📊 CHAT ISOLATION RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Chat isolation suite crashed:', err);
  process.exit(1);
});
