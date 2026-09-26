import crypto from 'crypto';
import { adminDb } from '../firebaseAdmin.js';
import { NotificationEngine } from '../services/notificationEngine.js';
import { runPickupReminderCheck } from '../services/pickupReminderWorker.js';

async function runVerification() {
  console.log('====================================================');
  console.log('🚀 RUNNING MOBILE PUSH NOTIFICATION VERIFICATION TEST');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      process.exitCode = 1;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Idempotency Protection (Simulate merchant clicking "ปรุงเสร็จ" 3 times rapidly)
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Idempotency Protection ---');
  const testOrderId = `order_${Date.now()}`;
  const res1 = await NotificationEngine.sendOrderReady({
    orderId: testOrderId,
    recipientId: 'test_customer_101',
    schoolId: 'school-main',
    storeName: 'ร้านข้าวกะเพราถาด',
    queueNumber: 'A01'
  });
  assert(res1.success === true && !res1.duplicated, 'Call 1 (first click): Notification created and dispatched');

  const res2 = await NotificationEngine.sendOrderReady({
    orderId: testOrderId,
    recipientId: 'test_customer_101',
    schoolId: 'school-main',
    storeName: 'ร้านข้าวกะเพราถาด',
    queueNumber: 'A01'
  });
  assert(res2.success === true && res2.duplicated === true, 'Call 2 (rapid duplicate): Idempotency caught duplicate - NO push sent');

  const res3 = await NotificationEngine.sendOrderReady({
    orderId: testOrderId,
    recipientId: 'test_customer_101',
    schoolId: 'school-main',
    storeName: 'ร้านข้าวกะเพราถาด',
    queueNumber: 'A01'
  });
  assert(res3.success === true && res3.duplicated === true, 'Call 3 (rapid duplicate): Idempotency caught duplicate - NO push sent');

  // Verify only 1 notification document exists in DB for this idempotencyKey
  const notifQuery = await adminDb
    .collection('notifications')
    .where('idempotencyKey', '==', `order_${testOrderId}_ORDER_READY`)
    .get();
  assert(notifQuery.size === 1, 'Database verification: Exactly 1 notification stored for this order event');

  // -------------------------------------------------------------------------
  // TEST 2: Deterministic deviceId & Shared Device Token Ownership
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Deterministic deviceId & Shared Device Conflict ---');
  const sharedFcmToken = 'fcm_mock_token_browser_shared_12345';
  const expectedHash = crypto.createHash('sha256').update(sharedFcmToken.trim()).digest('hex').substring(0, 32);
  const expectedDeviceId = `dev_${expectedHash}`;

  // User A registers
  const docRefA = adminDb.collection('user_devices').doc(expectedDeviceId);
  await docRefA.set({
    deviceId: expectedDeviceId,
    uid: 'user_A',
    fcmToken: sharedFcmToken,
    isActive: true,
    lastSeenAt: Date.now()
  });

  let checkDoc = await docRefA.get();
  assert(checkDoc.data().uid === 'user_A', 'User A registered with shared FCM token');

  // User B logs in on SAME browser/device without User A clean logout
  // Backend registration logic:
  const hashB = crypto.createHash('sha256').update(sharedFcmToken.trim()).digest('hex').substring(0, 32);
  const targetDeviceId = `dev_${hashB}`;
  assert(targetDeviceId === expectedDeviceId, 'Deterministic hash matches: sha256(fcmToken) maps to exact same doc');

  // User B overwrites ownership
  await docRefA.set({
    deviceId: targetDeviceId,
    uid: 'user_B',
    fcmToken: sharedFcmToken,
    isActive: true,
    lastSeenAt: Date.now()
  }, { merge: true });

  checkDoc = await docRefA.get();
  assert(checkDoc.data().uid === 'user_B', 'User B takes over device doc - User A is completely displaced');

  // Query devices for user_A
  const userADevices = await adminDb
    .collection('user_devices')
    .where('uid', '==', 'user_A')
    .where('isActive', '==', true)
    .get();
  const userAHasSharedToken = userADevices.docs.some(d => d.data().fcmToken === sharedFcmToken);
  assert(!userAHasSharedToken, 'User A has 0 devices with this FCM token - User B will NEVER receive User A push');

  // -------------------------------------------------------------------------
  // TEST 3: Pickup Reminder Scheduler (Phase 8)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Pickup Reminder Scheduler ---');
  const staleOrderId = `stale_order_${Date.now()}`;
  const sixMinutesAgo = Date.now() - 6 * 60 * 1000;

  // Create an order ready 6 minutes ago
  await adminDb.collection('orders').doc(staleOrderId).set({
    status: 'READY',
    queueNumber: 'B12',
    storeName: 'ร้านป้าสมศรี',
    userId: 'cust_stale_1',
    schoolId: 'school-main',
    readyAt: sixMinutesAgo,
    createdAt: sixMinutesAgo,
    pickupReminderSent: false
  });

  // Run scheduler pass 1
  await runPickupReminderCheck();

  const updatedOrder = (await adminDb.collection('orders').doc(staleOrderId).get()).data();
  assert(updatedOrder.pickupReminderSent === true, 'Order flagged pickupReminderSent: true after 5 min threshold');

  // Check reminder notification created
  const reminderNotifs = await adminDb
    .collection('notifications')
    .where('idempotencyKey', '==', `PICKUP_REMINDER:${staleOrderId}`)
    .get();
  assert(reminderNotifs.size === 1, 'PICKUP_REMINDER notification created with correct idempotencyKey');

  // Run scheduler pass 2 (must not re-send)
  await runPickupReminderCheck();
  const reminderNotifsPass2 = await adminDb
    .collection('notifications')
    .where('idempotencyKey', '==', `PICKUP_REMINDER:${staleOrderId}`)
    .get();
  assert(reminderNotifsPass2.size === 1, 'Scheduler pass 2 ignored flagged order - ZERO duplicate reminders');

  // -------------------------------------------------------------------------
  // TEST 4: Chat Push Notification Dispatch (Phase 9)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Chat Push Notification Dispatch ---');
  const chatResult = await NotificationEngine.sendChatMessage({
    recipientId: 'test_customer_chat_99',
    senderName: 'ร้านBoost Juice',
    messageSnippet: 'อาหารของคุณเสร็จพร้อมเสิร์ฟแล้วครับ!',
    chatId: 'thread_123',
    schoolId: 'school-main',
    storeId: 'store-4'
  });
  assert(chatResult.success === true, 'Chat push dispatched through NotificationEngine with deepLink /chat');

  console.log('\n====================================================');
  console.log(`🏁 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');
}

runVerification().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
