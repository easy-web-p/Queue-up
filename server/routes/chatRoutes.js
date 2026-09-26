import { Router } from 'express';
import { adminDb } from '../firebaseAdmin.js';
import { authenticate, isStoreOperator } from '../middleware/authenticate.js';
import { inspectMessage } from '../services/inputShield.js';
import { NotificationEngine } from '../services/notificationEngine.js';
import { processAssistantReply } from '../services/aiChatEngine.js';

export const chatRouter = Router();

/**
 * Helper: Resolve active order for customer & store
 */
async function resolveActiveOrder(customerId, storeId, orderId) {
  if (orderId) {
    try {
      const snap = await adminDb.collection('orders').doc(orderId).get();
      if (snap.exists) {
        const data = snap.data();
        return { id: snap.id, ...data };
      }
    } catch (e) {
      console.warn('[ChatRoutes] Error fetching order by ID:', e.message);
    }
  }

  if (customerId && storeId) {
    try {
      const snap = await adminDb.collection('orders')
        .where('customerId', '==', customerId)
        .where('storeId', '==', storeId)
        .limit(10)
        .get();

      const active = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
      return active || null;
    } catch (e) {
      console.warn('[ChatRoutes] Error finding active order:', e.message);
    }
  }
  return null;
}

/**
 * Helper: authorise a caller against a chat thread.
 * A thread is readable by its participants and by operators of its store.
 */
async function canAccessThread(user, chatId) {
  const snap = await adminDb.collection('chats').doc(chatId).get();
  if (!snap.exists) return { allowed: false, notFound: true };

  const thread = snap.data() || {};
  const isParticipant = Array.isArray(thread.participantIds) && thread.participantIds.includes(user.uid);
  const isCustomer = thread.customerId === user.uid;
  if (isParticipant || isCustomer) return { allowed: true, thread };

  const operatesStore = await isStoreOperator(user, thread.storeId);
  return { allowed: operatesStore, thread };
}

/**
 * 1. GET /api/chat/threads/:storeId
 * Returns all real customer chat threads for a specific store.
 */
chatRouter.get('/threads/:storeId', authenticate, async (req, res) => {
  try {
    const { storeId } = req.params;
    if (!storeId) {
      return res.status(400).json({ success: false, error: 'MISSING_STORE_ID' });
    }

    if (!(await isStoreOperator(req.user, storeId))) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You do not operate this store.'
      });
    }

    const threadsSnap = await adminDb.collection('chats')
      .where('storeId', '==', storeId)
      .get();

    const threads = [];

    for (const doc of threadsSnap.docs) {
      const data = doc.data() || {};
      const chatId = doc.id;

      // Fetch messages for this thread
      let messages = [];
      try {
        const msgSnap = await adminDb.collection('chats').doc(chatId).collection('messages').get();
        messages = msgSnap.docs.map(m => ({ id: m.id, ...m.data() }));
        messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      } catch (err) {
        console.warn(`[ChatRoutes] Error fetching messages for thread ${chatId}:`, err.message);
      }

      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

      threads.push({
        id: chatId,
        storeId: data.storeId || storeId,
        customerId: data.customerId || '',
        customerName: data.customerName || 'ลูกค้า',
        customerPhone: data.customerPhone || '',
        customerAvatar: data.customerAvatar || '',
        queueId: data.queueId || data.orderId || '',
        queueNumber: data.queueNumber || '',
        orderSummary: data.orderSummary || '',
        orderTotal: data.orderTotal || 0,
        orderStatus: data.orderStatus || '',
        lastMessage: lastMsg?.message || data.lastMessage || '',
        lastTimestamp: lastMsg?.timestamp || data.lastTimestamp || data.updatedAt || new Date().toISOString(),
        unreadCount: typeof data.unreadCountMerchant === 'number' ? data.unreadCountMerchant : (data.unreadCount || 0),
        unreadCountMerchant: typeof data.unreadCountMerchant === 'number' ? data.unreadCountMerchant : (data.unreadCount || 0),
        unreadCountCustomer: data.unreadCountCustomer || 0,
        aiAutoReply: data.aiAutoReply !== false,
        aiSilencedUntil: data.aiSilencedUntil || null,
        messages
      });
    }

    // Sort by latest message/timestamp descending
    threads.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());

    return res.status(200).json({
      success: true,
      threads
    });
  } catch (err) {
    console.error('[ChatRoutes] Error fetching store threads:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. GET /api/chat/messages/:chatId
 * Returns the message stream for a specific chat room.
 */
chatRouter.get('/messages/:chatId', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'MISSING_CHAT_ID' });
    }

    const access = await canAccessThread(req.user, chatId);
    if (access.notFound) {
      return res.status(404).json({ success: false, error: 'CHAT_NOT_FOUND' });
    }
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }

    const msgSnap = await adminDb.collection('chats').doc(chatId).collection('messages').get();
    const messages = msgSnap.docs.map(m => ({ id: m.id, ...m.data() }));
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return res.status(200).json({
      success: true,
      messages
    });
  } catch (err) {
    console.error('[ChatRoutes] Error fetching messages:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. POST /api/chat/messages
 * Sends a message from customer or merchant with persistence & AI dispatcher
 */
chatRouter.post('/messages', authenticate, async (req, res) => {
  try {
    const {
      storeId,
      customerId: rawCustomerId,
      senderName,
      message,
      orderId,
      customerName,
      customerAvatar,
      customerPhone,
      chatId: customChatId
    } = req.body;

    if (!storeId || !message) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'storeId and message are required.'
      });
    }

    const inspection = inspectMessage(message);
    if (!inspection.ok) {
      return res.status(400).json({
        success: false,
        error: inspection.threatType,
        message: inspection.message
      });
    }
    const safeMessage = inspection.value;

    // The sender's role is derived from the verified identity, never from the
    // request body: the Admin SDK bypasses firestore.rules, so a body-supplied
    // senderRole would let any customer post as the store.
    const isMerchant = await isStoreOperator(req.user, storeId);
    const customerId = isMerchant
      ? (rawCustomerId || 'guest-customer')
      : req.user.uid;

    const chatId = customChatId || `chat_${storeId}_${customerId}`;

    // 1. Fetch Store Data
    const storeSnap = await adminDb.collection('stores').doc(storeId).get();
    const storeData = storeSnap.exists ? { id: storeSnap.id, ...storeSnap.data() } : { id: storeId, name: 'ร้านค้า' };

    // 2. Fetch Customer Info if missing
    let finalCustomerName = customerName || (req.user?.name || req.user?.fullName);
    let finalCustomerAvatar = customerAvatar || req.user?.avatar;
    let finalCustomerPhone = customerPhone || req.user?.phone;

    if (!finalCustomerName && !isMerchant && req.user?.uid) {
      try {
        const uSnap = await adminDb.collection('users').doc(req.user.uid).get();
        if (uSnap.exists) {
          const u = uSnap.data();
          finalCustomerName = u.fullName || u.name || u.email?.split('@')[0];
          finalCustomerAvatar = finalCustomerAvatar || u.avatar;
          finalCustomerPhone = finalCustomerPhone || u.phone;
        }
      } catch (err) {
        console.warn('[ChatRoutes] User lookup warning:', err.message);
      }
    }
    finalCustomerName = finalCustomerName || (isMerchant ? 'ลูกค้า' : 'ผู้ซื้อ');

    // 3. Resolve active order context
    const activeOrder = await resolveActiveOrder(customerId, storeId, orderId);

    // 4. Fetch existing thread if any
    let existingThread = null;
    try {
      const thSnap = await adminDb.collection('chats').doc(chatId).get();
      if (thSnap.exists) existingThread = thSnap.data();
    } catch (e) {
      console.warn('[ChatRoutes] Thread fetch error:', e.message);
    }

    // 5. Construct and Save User/Merchant Message
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const nowIso = new Date().toISOString();

    const userMessageDoc = {
      id: msgId,
      chatId,
      senderId: req.user.uid,
      senderName: isMerchant ? (senderName || storeData.name || 'ร้านค้า') : finalCustomerName,
      senderRole: isMerchant ? 'merchant' : 'customer',
      message: safeMessage,
      timestamp: nowIso,
      read: isMerchant,
      orderId: orderId || activeOrder?.id || null
    };

    await adminDb.collection('chats').doc(chatId).collection('messages').doc(msgId).set(userMessageDoc);

    // 6. Update Parent Thread Document
    const currentMerchantUnread = existingThread?.unreadCountMerchant ?? existingThread?.unreadCount ?? 0;
    const currentCustomerUnread = existingThread?.unreadCountCustomer ?? 0;

    const threadUpdate = {
      id: chatId,
      storeId,
      customerId,
      customerName: !isMerchant ? finalCustomerName : (existingThread?.customerName || finalCustomerName),
      customerAvatar: finalCustomerAvatar || existingThread?.customerAvatar || '',
      customerPhone: finalCustomerPhone || existingThread?.customerPhone || '',
      lastMessage: userMessageDoc.message,
      lastTimestamp: nowIso,
      participantIds: Array.from(new Set([customerId, storeData.ownerId, req.user.uid].filter(Boolean))),
      updatedAt: nowIso
    };

    if (!isMerchant) {
      // Customer message: increment merchant unread
      threadUpdate.unreadCountMerchant = currentMerchantUnread + 1;
      threadUpdate.unreadCount = threadUpdate.unreadCountMerchant;
    } else {
      // Merchant message: clear merchant unread, increment customer unread, silence AI for 30 mins
      threadUpdate.unreadCountMerchant = 0;
      threadUpdate.unreadCount = 0;
      threadUpdate.unreadCountCustomer = currentCustomerUnread + 1;
      threadUpdate.aiSilencedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    }

    if (activeOrder) {
      threadUpdate.queueId = activeOrder.id;
      threadUpdate.queueNumber = activeOrder.queueNumber || activeOrder.orderNumber || '';
      threadUpdate.orderSummary = activeOrder.itemsSummary || activeOrder.items?.map(i => `${i.food?.name || i.name} x${i.quantity}`).join(', ') || '';
      threadUpdate.orderTotal = activeOrder.total || (activeOrder.totalSatang ? activeOrder.totalSatang / 100 : 0);
      threadUpdate.orderStatus = activeOrder.status || '';
    }

    await adminDb.collection('chats').doc(chatId).set(threadUpdate, { merge: true });

    let aiMessageDoc = null;

    // 7. If sent by customer, run AI Assistant Dispatcher
    if (!isMerchant) {
      let menuItems = [];
      try {
        const menuSnap = await adminDb.collection('food_items').where('storeId', '==', storeId).get();
        menuItems = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.warn('[ChatRoutes] Menu fetch fallback:', e.message);
      }

      try {
        const assistantResult = await processAssistantReply({
          message: userMessageDoc.message,
          chatThread: {
            id: chatId,
            storeId,
            customerId,
            aiAutoReply: existingThread?.aiAutoReply !== false,
            aiSilencedUntil: existingThread?.aiSilencedUntil || null
          },
          store: storeData,
          activeOrder,
          menuItems
        });

        if (assistantResult && assistantResult.handled && assistantResult.replyText) {
          const aiMsgId = `msg_ai_${Date.now()}`;
          const aiTimestamp = new Date().toISOString();
          aiMessageDoc = {
            id: aiMsgId,
            chatId,
            senderId: 'ai-assistant',
            senderName: `ผู้ช่วยอัตโนมัติ (${storeData.name || 'ร้านค้า'})`,
            senderRole: 'ai_assistant',
            message: assistantResult.replyText,
            timestamp: aiTimestamp,
            read: false,
            aiMeta: assistantResult.aiMeta
          };

          await adminDb.collection('chats').doc(chatId).collection('messages').doc(aiMsgId).set(aiMessageDoc);
          await adminDb.collection('chats').doc(chatId).set({
            storeName: storeData.name || 'ร้านค้า',
            storeLogo: storeData.logo || storeData.image || '',
            lastMessage: aiMessageDoc.message,
            lastTimestamp: aiTimestamp,
            unreadCountCustomer: (existingThread?.unreadCountCustomer ?? 0) + 1
          }, { merge: true });
        }
      } catch (aiErr) {
        console.warn('[ChatRoutes] AI dispatcher warning:', aiErr.message);
      }

      // Dispatch push notification to store owner/merchant
      if (storeData.ownerId) {
        NotificationEngine.sendChatMessage({
          senderName: userMessageDoc.senderName,
          recipientId: storeData.ownerId,
          chatId,
          messageSnippet: userMessageDoc.message.slice(0, 80),
          schoolId: storeData.schoolId || 'school-default'
        }).catch(err => console.warn('[ChatRoutes] Merchant push warning:', err.message));
      }
    } else {
      // Sent by merchant: Dispatch push notification to customer
      if (customerId) {
        NotificationEngine.sendChatMessage({
          senderName: userMessageDoc.senderName,
          recipientId: customerId,
          chatId,
          messageSnippet: userMessageDoc.message.slice(0, 80),
          schoolId: storeData.schoolId || 'school-default'
        }).catch(err => console.warn('[ChatRoutes] Customer push warning:', err.message));
      }
    }

    return res.status(200).json({
      success: true,
      message: userMessageDoc,
      aiReply: aiMessageDoc,
      thread: {
        ...existingThread,
        ...threadUpdate
      }
    });
  } catch (err) {
    console.error('[ChatRoutes] Error sending message:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. POST /api/chat/mark-read
 * Clears unread badge for merchant or customer and updates messages in thread
 */
chatRouter.post('/mark-read', authenticate, async (req, res) => {
  try {
    const { chatId, role = 'merchant' } = req.body;
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'MISSING_CHAT_ID' });
    }

    const access = await canAccessThread(req.user, chatId);
    if (access.notFound) {
      return res.status(404).json({ success: false, error: 'CHAT_NOT_FOUND' });
    }
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }

    const updates = role === 'customer'
      ? { unreadCountCustomer: 0 }
      : { unreadCountMerchant: 0, unreadCount: 0 };

    await adminDb.collection('chats').doc(chatId).set(updates, { merge: true });

    // Mark individual unread messages as read in subcollection
    try {
      const msgQuerySnap = await adminDb.collection('chats').doc(chatId).collection('messages')
        .where('read', '==', false)
        .get();

      if (!msgQuerySnap.empty) {
        const batch = adminDb.batch();
        for (const doc of msgQuerySnap.docs) {
          const mData = doc.data();
          if (role === 'customer' && mData.senderRole !== 'customer' && mData.senderRole !== 'buyer') {
            batch.update(doc.ref, { read: true });
          } else if (role === 'merchant' && (mData.senderRole === 'customer' || mData.senderRole === 'buyer')) {
            batch.update(doc.ref, { read: true });
          }
        }
        await batch.commit();
      }
    } catch (msgErr) {
      console.warn('[ChatRoutes] Note on updating messages read flag:', msgErr.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[ChatRoutes] Error marking read:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. GET /api/chat/customer-threads/:customerId
 * Returns all chat threads for a specific customer across all stores
 */
chatRouter.get('/customer-threads/:customerId', authenticate, async (req, res) => {
  try {
    const { customerId } = req.params;
    if (!customerId) {
      return res.status(400).json({ success: false, error: 'MISSING_CUSTOMER_ID' });
    }

    // A customer's thread list is their own; admins may inspect any.
    if (customerId !== req.user.uid && !req.user.admin) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You can only list your own chat threads.'
      });
    }

    let docs = [];
    try {
      const snap = await adminDb.collection('chats')
        .where('participantIds', 'array-contains', customerId)
        .get();
      docs = snap.docs;
    } catch (e) {
      console.warn('[ChatRoutes] Error querying participantIds:', e.message);
    }

    if (docs.length === 0) {
      try {
        const fallbackSnap = await adminDb.collection('chats')
          .where('customerId', '==', customerId)
          .get();
        docs = fallbackSnap.docs;
      } catch (e) {
        console.warn('[ChatRoutes] Error querying customerId:', e.message);
      }
    }

    const threads = [];
    for (const doc of docs) {
      const data = doc.data() || {};
      const chatId = doc.id;

      let storeName = data.storeName || 'ร้านค้า';
      let storeLogo = data.storeLogo || '';

      if (data.storeId && (!data.storeName || !data.storeLogo)) {
        try {
          const sSnap = await adminDb.collection('stores').doc(data.storeId).get();
          if (sSnap.exists) {
            const sData = sSnap.data();
            storeName = sData.name || storeName;
            storeLogo = sData.logo || sData.image || storeLogo;
          }
        } catch (e) {}
      }

      // Fetch messages for this thread
      let messages = [];
      try {
        const msgSnap = await adminDb.collection('chats').doc(chatId).collection('messages').get();
        messages = msgSnap.docs.map(m => ({ id: m.id, ...m.data() }));
        messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      } catch (err) {}

      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

      threads.push({
        id: chatId,
        storeId: data.storeId,
        storeName,
        storeLogo,
        customerId: data.customerId || customerId,
        customerName: data.customerName || 'ลูกค้า',
        queueId: data.queueId || data.orderId || '',
        queueNumber: data.queueNumber || '',
        orderSummary: data.orderSummary || '',
        orderTotal: data.orderTotal || 0,
        orderStatus: data.orderStatus || '',
        lastMessage: lastMsg?.message || data.lastMessage || '',
        lastTimestamp: lastMsg?.timestamp || data.lastTimestamp || data.updatedAt || new Date().toISOString(),
        unreadCount: typeof data.unreadCountCustomer === 'number' ? data.unreadCountCustomer : 0,
        unreadCountCustomer: typeof data.unreadCountCustomer === 'number' ? data.unreadCountCustomer : 0,
        messages
      });
    }

    threads.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());

    return res.status(200).json({
      success: true,
      threads
    });
  } catch (err) {
    console.error('[ChatRoutes] Error fetching customer threads:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
