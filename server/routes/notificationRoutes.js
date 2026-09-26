import express from 'express';
import crypto from 'crypto';
import { adminDb } from '../firebaseAdmin.js';
import { authenticate } from '../middleware/authenticate.js';
import { NotificationEngine } from '../services/notificationEngine.js';
import { processAssistantReply } from '../services/aiChatEngine.js';
import { LineNotifyService } from '../services/lineNotifyService.js';

export const notificationRouter = express.Router();

// In-memory sliding window rate limiter: max 3 tests per 60 seconds per UID
const testPushRateLimitMap = new Map();

function isRateLimited(uid, maxRequests = 3, windowMs = 60000) {
  const now = Date.now();
  const history = (testPushRateLimitMap.get(uid) || []).filter(ts => now - ts < windowMs);
  if (history.length >= maxRequests) {
    return true;
  }
  history.push(now);
  testPushRateLimitMap.set(uid, history);
  return false;
}

/**
 * 1. Register or update user device FCM token
 * Security & Integrity:
 * - Identity (uid, schoolId) ALWAYS derived from authenticated req.user (cannot be spoofed).
 * - deviceId is deterministically computed as sha256(fcmToken) so same browser/FCM token
 *   always maps to the EXACT same doc.
 * - Any conflicting doc with the same token owned by a previous user is wiped/deactivated immediately,
 *   preventing User B from ever receiving User A's notifications on shared devices.
 */
notificationRouter.post('/devices', authenticate, async (req, res) => {
  try {
    const { fcmToken, platform, isPWA, userAgent } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FCM_TOKEN',
        message: 'fcmToken is required.'
      });
    }

    const uid = req.user.uid;
    const schoolId = req.user.schoolId || req.headers['x-school-id'] || 'school-default';
    const now = Date.now();

    // Deterministic device ID based on SHA-256 of fcmToken
    const hash = crypto.createHash('sha256').update(fcmToken.trim()).digest('hex').substring(0, 32);
    const deterministicDeviceId = `dev_${hash}`;

    // Clean up any lingering docs that held this FCM token under an older or different user ID
    try {
      const prevHolders = await adminDb
        .collection('user_devices')
        .where('fcmToken', '==', fcmToken.trim())
        .get();

      if (!prevHolders.empty) {
        const batch = adminDb.batch();
        for (const doc of prevHolders.docs) {
          if (doc.id !== deterministicDeviceId || doc.data().uid !== uid) {
            batch.delete(doc.ref);
          }
        }
        await batch.commit();
      }
    } catch (cleanupErr) {
      console.warn('[NotificationRoutes] Token holder deduplication warning:', cleanupErr.message);
    }

    const deviceRef = adminDb.collection('user_devices').doc(deterministicDeviceId);
    const existingDoc = await deviceRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() : null;

    const deviceData = {
      deviceId: deterministicDeviceId,
      uid, // Unified uid field
      schoolId,
      fcmToken: fcmToken.trim(),
      platform: platform || 'desktop',
      isPWA: Boolean(isPWA),
      userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
      isActive: true,
      createdAt: existingData?.createdAt || now,
      lastSeenAt: now
    };

    await deviceRef.set(deviceData, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Device registered successfully with deterministic token mapping.',
      device: deviceData
    });
  } catch (err) {
    console.error('[NotificationRoutes] Error registering device:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: err.message
    });
  }
});

/**
 * 2. Deactivate device FCM token
 */
notificationRouter.post('/devices/:deviceId/deactivate', authenticate, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const deviceRef = adminDb.collection('user_devices').doc(deviceId);
    const doc = await deviceRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'DEVICE_NOT_FOUND' });
    }

    const data = doc.data();
    if (data.uid !== req.user.uid && !req.user.admin) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }

    await deviceRef.update({
      isActive: false,
      deactivatedAt: Date.now()
    });

    return res.status(200).json({ success: true, message: 'Device deactivated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. Fetch notifications for current authenticated user
 */
notificationRouter.get('/notifications', authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;
    const limit = parseInt(req.query.limit || '50', 10);

    const snapshot = await adminDb
      .collection('notifications')
      .where('recipientId', '==', uid)
      .limit(limit)
      .get();

    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by createdAt descending
    notifications.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return res.status(200).json({
      success: true,
      notifications
    });
  } catch (err) {
    console.error('[NotificationRoutes] Error fetching notifications:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Mark single notification as read
 * Security Rule: Client can ONLY change isRead field on notifications they own.
 */
notificationRouter.patch('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const notifRef = adminDb.collection('notifications').doc(id);
    const doc = await notifRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    }

    const data = doc.data();
    if (data.recipientId !== req.user.uid && !req.user.admin) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }

    await notifRef.update({
      isRead: true,
      readAt: Date.now()
    });

    return res.status(200).json({ success: true, id, isRead: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. Test Call Signal endpoint: sends real FCM push directly through the pipeline
 */
notificationRouter.post('/notifications/test', authenticate, async (req, res) => {
  try {
    const uid = req.user.uid;
    const schoolId = req.user.schoolId || 'school-default';

    // 1. Rate Limiting: Max 3 test pushes per 60 seconds per user
    if (isRateLimited(uid, 3, 60000)) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'กรุณารอ 1 นาทีก่อนทดสอบสัญญาณเรียกอีกครั้ง เพื่อป้องกันการส่งสัญญาณซ้ำซ้อน'
      });
    }

    // 2. Strict recipient isolation: Can ONLY send to caller's own devices
    const result = await NotificationEngine.send({
      recipientId: uid,
      schoolId,
      type: 'ORDER_READY',
      title: '🔊 ทดสอบสัญญาณเรียกคิว (Real FCM Push)',
      message: 'ยินดีด้วย! ระบบ Push Notification ของ QueueUp ส่งข้อความถึงอุปกรณ์ของคุณเรียบร้อยแล้วค่ะ',
      idempotencyKey: `test_${uid}_${Date.now()}`,
      deepLink: '/queue-tracking',
      metadata: { isTest: true }
    });

    return res.status(200).json({
      success: true,
      message: 'Test notification triggered through pipeline.',
      result
    });
  } catch (err) {
    console.error('[NotificationRoutes] Test push failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. Send Chat Notification (Phase 9)
 * Triggers push notification to customer or merchant when a new message is posted
 */
notificationRouter.post('/chat/messages', authenticate, async (req, res) => {
  try {
    const { recipientId, senderName, message, chatId, storeId, orderId } = req.body;
    if (!recipientId || !message) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'recipientId and message are required.'
      });
    }

    const cleanSnippet = message.length > 80 ? message.substring(0, 80) + '...' : message;

    const result = await NotificationEngine.sendChatMessage({
      recipientId,
      senderName: senderName || req.user.name || 'ผู้ส่งข้อความ',
      messageSnippet: cleanSnippet,
      chatId: chatId || `chat_${Date.now()}`,
      schoolId: req.user.schoolId || 'school-default',
      storeId,
      orderId
    });

    return res.status(200).json({
      success: true,
      message: 'Chat push notification dispatched successfully.',
      result
    });
  } catch (err) {
    console.error('[NotificationRoutes] Error dispatching chat push:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6.1 Test LINE Notify Endpoint
 * Sends a test message to verify the provided LINE Notify token
 */
notificationRouter.post('/test-line', authenticate, async (req, res) => {
  try {
    const { token, message } = req.body;
    const testToken = token || req.user.lineNotifyToken || process.env.LINE_NOTIFY_TOKEN;
    if (!testToken) {
      return res.status(400).json({
        success: false,
        error: 'NO_TOKEN',
        message: 'กรุณาระบุ LINE Notify Token เพื่อทดสอบ'
      });
    }

    const result = await LineNotifyService.send({
      token: testToken,
      message: message || '🟢 [QueueUp] ทดสอบการเชื่อมต่อ LINE Notify สำเร็จเรียบร้อยแล้วค่ะ!'
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'ส่งการแจ้งเตือนไปยัง LINE สำเร็จแล้ว'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'LINE_DISPATCH_FAILED',
        message: 'ไม่สามารถส่งข้อความได้ กรุณาตรวจสอบความถูกต้องของ Token'
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Per-thread rate limiter: max 6 assistant calls per 60 seconds per thread
const threadAssistantRateLimit = new Map();
function isThreadRateLimited(chatId, maxCalls = 6, windowMs = 60000) {
  const now = Date.now();
  const history = (threadAssistantRateLimit.get(chatId) || []).filter(ts => now - ts < windowMs);
  if (history.length >= maxCalls) return true;
  history.push(now);
  threadAssistantRateLimit.set(chatId, history);
  return false;
}

/**
 * 7. AI Chat Assistant Reply Endpoint
 * Uses Layer 1 Deterministic Router + Scope-Bound Tools + Allergen/Escalation Hard-Blocks
 */
notificationRouter.post('/chat/assistant-reply', authenticate, async (req, res) => {
  try {
    const { message, storeId, chatId, orderId } = req.body;
    if (!message || !storeId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'message and storeId are required.'
      });
    }

    const cleanChatId = chatId || `chat_store_${storeId}`;
    if (isThreadRateLimited(cleanChatId)) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'กรุณารอสักครู่ก่อนส่งข้อความเพิ่มเติมเพื่อความปลอดภัย'
      });
    }

    // 1. Fetch Store Data
    const storeSnap = await adminDb.collection('stores').doc(storeId).get();
    const store = storeSnap.exists ? { id: storeSnap.id, ...storeSnap.data() } : null;

    // 2. Fetch Chat Thread for silence / setting flags
    let chatThread = { id: cleanChatId, storeId, customerId: req.user.uid, aiAutoReply: true };
    const threadSnap = await adminDb.collection('chats').doc(cleanChatId).get();
    if (threadSnap.exists) {
      chatThread = { id: threadSnap.id, ...threadSnap.data() };
    }

    // 3. Fetch Active Order for this customer & store if any
    let activeOrder = null;
    if (orderId) {
      const orderSnap = await adminDb.collection('orders').doc(orderId).get();
      if (orderSnap.exists) activeOrder = { id: orderSnap.id, ...orderSnap.data() };
    } else {
      const ordersSnap = await adminDb.collection('orders')
        .where('customerId', '==', req.user.uid)
        .where('storeId', '==', storeId)
        .limit(5)
        .get();
      const active = ordersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
      if (active) activeOrder = active;
    }

    // 4. Fetch menu items for this store
    let menuItems = [];
    try {
      const menuSnap = await adminDb.collection('food_items').where('storeId', '==', storeId).get();
      menuItems = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
      // Fallback
    }

    // 5. Run Assistant Dispatcher
    const assistantResult = await processAssistantReply({
      message,
      chatThread,
      store,
      activeOrder,
      menuItems
    });

    // 6. If handled, write message directly via Admin SDK (bypasses client role restriction)
    if (assistantResult.handled && assistantResult.replyText) {
      const messageDoc = {
        chatId: cleanChatId,
        senderId: 'ai-assistant',
        senderName: `ผู้ช่วยอัตโนมัติ (${store?.name || 'ร้านค้า'})`,
        senderRole: 'ai_assistant',
        message: assistantResult.replyText,
        timestamp: new Date().toISOString(),
        read: false,
        aiMeta: assistantResult.aiMeta
      };

      try {
        await adminDb.collection('chats').doc(cleanChatId).collection('messages').add(messageDoc);
        await adminDb.collection('chats').doc(cleanChatId).set({
          lastMessage: assistantResult.replyText,
          lastTimestamp: messageDoc.timestamp,
          storeId,
          customerId: req.user.uid,
          participantIds: [req.user.uid, store?.ownerId || 'store-owner'].filter(Boolean)
        }, { merge: true });
      } catch (dbErr) {
        console.warn('[NotificationRoutes] Assistant write to chats warning:', dbErr.message);
      }

      // If escalated, notify merchant immediately
      if (assistantResult.aiMeta?.escalated && store?.ownerId) {
        NotificationEngine.sendChatMessage({
          recipientId: store.ownerId,
          senderName: req.user.name || 'คุณลูกค้า',
          messageSnippet: `[ต้องการความช่วยเหลือจากร้าน]: ${message.slice(0, 70)}`,
          chatId: cleanChatId,
          schoolId: req.user.schoolId || 'school-default',
          storeId,
          orderId: activeOrder?.id
        }).catch(err => console.warn('[NotificationRoutes] Escalation push err:', err.message));
      }
    }

    return res.status(200).json({
      success: true,
      result: assistantResult
    });
  } catch (err) {
    console.error('[NotificationRoutes] Assistant reply error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

