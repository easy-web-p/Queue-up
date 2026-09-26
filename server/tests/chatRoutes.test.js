process.env.ALLOW_MOCK_AUTH = 'true';

import assert from 'assert';
import http from 'http';
import express from 'express';
import { chatRouter } from '../routes/chatRoutes.js';
import { adminDb } from '../firebaseAdmin.js';

console.log('===============================================================');
console.log('💬 QUEUEUP CHAT & REALTIME SYNCHRONIZATION INTEGRATION TESTS');
console.log('===============================================================');

// Setup test server
const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);

const server = http.createServer(app);

async function startServer() {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function request(baseUrl, path, method = 'GET', body = null, headers = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

let totalPassed = 0;
let totalChecks = 0;
function pass(testName, detail = '') {
  totalChecks++;
  console.log(`  ✅ [PASS] ${testName} ${detail ? `(${detail})` : ''}`);
  totalPassed++;
}

async function runTests() {
  const baseUrl = await startServer();
  const uniqueSuffix = Date.now();
  const testStoreId = `store-test-chat-${uniqueSuffix}`;
  const testCustomerId = `user-customer-${uniqueSuffix}`;
  const testChatId = `chat_${testStoreId}_${testCustomerId}`;

  try {
    // 0. Seed test store in DB
    await adminDb.collection('stores').doc(testStoreId).set({
      id: testStoreId,
      name: 'ร้านข้าวมันไก่โกฮับ',
      ownerId: 'merchant-admin-1',
      isOpen: true,
      currentQueueCount: 3,
      averageWaitMinutes: 10
    });

    // -------------------------------------------------------------
    // TEST 1: Customer sends inquiry to store -> Message stored & AI bot replies
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Customer sends message to Store -> Persisted with AI Bot Reply ---');
    const sendRes1 = await request(
      baseUrl,
      '/api/chat/messages',
      'POST',
      {
        storeId: testStoreId,
        customerId: testCustomerId,
        customerName: 'สมชาย รักเรียน',
        senderRole: 'customer',
        message: 'ร้านเปิดกี่โมงครับ เปิดอยู่ไหม'
      },
      {
        'x-mock-user-id': testCustomerId,
        'x-mock-user-name': encodeURIComponent('สมชาย รักเรียน')
      }
    );

    assert.strictEqual(sendRes1.status, 200, 'POST /messages returned 200');
    assert.strictEqual(sendRes1.data.success, true, 'success is true');
    assert.ok(sendRes1.data.message, 'userMessage returned');
    assert.strictEqual(sendRes1.data.message.senderRole, 'customer');
    assert.strictEqual(sendRes1.data.message.message, 'ร้านเปิดกี่โมงครับ เปิดอยู่ไหม');
    pass('Customer message persisted to database with senderRole customer');

    // Verify AI replied
    assert.ok(sendRes1.data.aiReply, 'AI auto-replied to store opening question');
    assert.strictEqual(sendRes1.data.aiReply.senderRole, 'ai_assistant');
    assert.ok(sendRes1.data.aiReply.message.includes('เปิดให้บริการ'), 'AI reply text has opening hours info');
    pass('AI Assistant automatically replied with store opening hours', sendRes1.data.aiReply.message.slice(0, 30));

    // -------------------------------------------------------------
    // TEST 2: Merchant queries customer threads -> Real customer thread appears!
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Merchant fetches store chat threads -> Real customer visible at top ---');
    const threadsRes = await request(
      baseUrl,
      `/api/chat/threads/${testStoreId}`,
      'GET',
      null,
      {
        'x-mock-user-id': 'merchant-admin-1',
        'x-mock-user-role': 'merchant'
      }
    );

    assert.strictEqual(threadsRes.status, 200, 'GET /threads returned 200');
    assert.strictEqual(threadsRes.data.success, true);
    assert.ok(Array.isArray(threadsRes.data.threads), 'threads is an array');

    const matchedThread = threadsRes.data.threads.find(t => t.customerId === testCustomerId);
    assert.ok(matchedThread, 'Customer สมชาย รักเรียน appears in merchant thread list!');
    assert.strictEqual(matchedThread.customerName, 'สมชาย รักเรียน');
    assert.ok(matchedThread.unreadCountMerchant >= 1, `Unread count for merchant is ${matchedThread.unreadCountMerchant}`);
    assert.strictEqual(matchedThread.messages.length, 2, 'Contains both customer message and AI bot reply');
    pass('Merchant sees real customer thread with unread badge and full message history');

    // -------------------------------------------------------------
    // TEST 3: Merchant replies to customer -> Persisted & silences AI
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Merchant sends direct reply to customer ---');
    const merchantReplyRes = await request(
      baseUrl,
      '/api/chat/messages',
      'POST',
      {
        storeId: testStoreId,
        customerId: testCustomerId,
        chatId: testChatId,
        senderRole: 'merchant',
        senderName: 'ร้านข้าวมันไก่โกฮับ',
        message: 'สวัสดีครับคุณสมชาย ร้านเปิดถึง 16:30 น. แวะมาสั่งได้เลยครับ'
      },
      {
        'x-mock-user-id': 'merchant-admin-1',
        'x-mock-user-role': 'merchant'
      }
    );

    assert.strictEqual(merchantReplyRes.status, 200);
    assert.strictEqual(merchantReplyRes.data.success, true);
    assert.strictEqual(merchantReplyRes.data.message.senderRole, 'merchant');
    assert.strictEqual(merchantReplyRes.data.thread.unreadCountMerchant, 0, 'Merchant unreadCount reset to 0');
    assert.ok(merchantReplyRes.data.thread.unreadCountCustomer >= 1, 'Customer unreadCount incremented');
    pass('Merchant reply successfully committed and customer unread badge updated');

    // -------------------------------------------------------------
    // TEST 4: Fetch message stream for thread
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Stream messages for thread ---');
    const msgsRes = await request(
      baseUrl,
      `/api/chat/messages/${testChatId}`,
      'GET',
      null,
      {
        'x-mock-user-id': 'merchant-admin-1',
        'x-mock-user-role': 'merchant'
      }
    );

    assert.strictEqual(msgsRes.status, 200);
    assert.strictEqual(msgsRes.data.success, true);
    assert.strictEqual(msgsRes.data.messages.length, 3, 'All 3 messages in correct chronological order');
    assert.strictEqual(msgsRes.data.messages[0].senderRole, 'customer');
    assert.strictEqual(msgsRes.data.messages[1].senderRole, 'ai_assistant');
    assert.strictEqual(msgsRes.data.messages[2].senderRole, 'merchant');
    pass('Message thread preserves sequence: Customer -> AI Assistant -> Human Merchant');

    // -------------------------------------------------------------
    // TEST 5: Mark Thread as Read
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Merchant marks thread as read ---');
    const readRes = await request(
      baseUrl,
      '/api/chat/mark-read',
      'POST',
      {
        chatId: testChatId,
        role: 'merchant'
      },
      {
        'x-mock-user-id': 'merchant-admin-1',
        'x-mock-user-role': 'merchant'
      }
    );
    assert.strictEqual(readRes.status, 200);
    assert.strictEqual(readRes.data.success, true);
    pass('Thread marked as read');

    console.log('\n===============================================================');
    console.log(`📊 CHAT INTEGRATION TEST RESULTS: ${totalPassed}/${totalChecks} Passed (ALL PASSED)`);
    console.log('===============================================================');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
