import { adminDb } from '../firebaseAdmin.js';
import { sendPushToDevices } from './pushSender.js';
import { LineNotifyService } from './lineNotifyService.js';

/**
 * Core Notification Engine for QueueUp
 * Enforces validation, idempotency, persistence before push, tenant isolation, and FCM dispatch.
 */
export class NotificationEngine {
  /**
   * Main entry point to send a notification
   */
  static async send({
    recipientId,
    schoolId,
    type,
    title,
    message,
    idempotencyKey,
    deepLink = '/',
    relatedId,
    relatedType,
    metadata = {}
  }) {
    if (!recipientId) {
      throw new Error('[NotificationEngine] recipientId is required');
    }
    if (!type || !title || !message) {
      throw new Error('[NotificationEngine] type, title, and message are required');
    }

    const cleanSchoolId = schoolId || 'school-default';

    // 1. Idempotency Check: Prevent duplicate notifications from same event
    if (idempotencyKey) {
      try {
        const existingSnapshot = await adminDb
          .collection('notifications')
          .where('idempotencyKey', '==', idempotencyKey)
          .limit(1)
          .get();

        if (!existingSnapshot.empty) {
          const existingDoc = existingSnapshot.docs[0];
          console.log(`[NotificationEngine] Idempotency hit for key "${idempotencyKey}". Notification already created (${existingDoc.id}).`);
          return {
            success: true,
            duplicated: true,
            notificationId: existingDoc.id,
            notification: existingDoc.data()
          };
        }
      } catch (err) {
        console.warn('[NotificationEngine] Idempotency check warning:', err.message);
      }
    }

    // 2. Create and commit Notification document in Firestore FIRST
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days retention

    const notificationDoc = {
      notificationId,
      recipientId,
      schoolId: cleanSchoolId,
      type,
      title,
      message,
      relatedId: relatedId || null,
      relatedType: relatedType || null,
      deepLink,
      isRead: false,
      idempotencyKey: idempotencyKey || null,
      metadata,
      createdAt: now,
      expiresAt
    };

    try {
      await adminDb.collection('notifications').doc(notificationId).set(notificationDoc);
      console.log(`[NotificationEngine] Notification committed to Firestore: ${notificationId} for user ${recipientId}`);
    } catch (err) {
      console.error('[NotificationEngine] Failed to commit notification document:', err);
      throw new Error(`Database commit failed: ${err.message}`);
    }

    // 3. Query active user devices (Unified field: uid)
    let userDevices = [];
    try {
      const devicesSnapshot = await adminDb
        .collection('user_devices')
        .where('uid', '==', recipientId)
        .where('isActive', '==', true)
        .get();

      if (!devicesSnapshot.empty) {
        userDevices = devicesSnapshot.docs.map(doc => ({
          deviceId: doc.id,
          ...doc.data()
        }));

        // Tenant isolation: If device has schoolId, enforce match
        if (cleanSchoolId !== 'school-default') {
          userDevices = userDevices.filter(d => !d.schoolId || d.schoolId === cleanSchoolId);
        }
      }
    } catch (err) {
      console.warn('[NotificationEngine] Error querying user_devices:', err.message);
    }

    // 4. Send FCM Push if user has registered active devices
    let pushResult = { successCount: 0, failureCount: 0, total: 0 };
    if (userDevices.length > 0) {
      pushResult = await sendPushToDevices(userDevices, {
        notificationId,
        title,
        message,
        deepLink,
        type,
        schoolId: cleanSchoolId
      });
    } else {
      console.log(`[NotificationEngine] User ${recipientId} has no active push devices registered. In-app inbox will display message.`);
    }

    return {
      success: true,
      notificationId,
      pushResult,
      notification: notificationDoc
    };
  }

  /**
   * Helper: Send Order Ready event (Flagship Event)
   */
  static async sendOrderReady({
    orderId,
    queueNumber,
    storeId,
    storeName,
    customerId,
    recipientId,
    userId,
    schoolId,
    lineNotifyToken
  }) {
    const targetRecipient = recipientId || customerId || userId;
    const res = await this.send({
      recipientId: targetRecipient,
      schoolId,
      type: 'ORDER_READY',
      title: '🔔 อาหารพร้อมรับแล้ว!',
      message: `คิว #${queueNumber} จากร้าน "${storeName}" ปรุงเสร็จเรียบร้อย กรุณาไปรับอาหารที่หน้าร้านค่ะ`,
      idempotencyKey: `order_${orderId}_ORDER_READY`,
      deepLink: `/queue-tracking?orderId=${orderId}`,
      relatedId: orderId,
      relatedType: 'order',
      metadata: {
        orderId,
        queueNumber,
        storeId,
        storeName
      }
    });

    // Optional LINE alert dispatch
    if (lineNotifyToken || process.env.LINE_NOTIFY_TOKEN) {
      LineNotifyService.notifyOrderReady({
        token: lineNotifyToken,
        storeName,
        queueNumber
      }).catch(err => console.warn('[NotificationEngine] LINE alert error:', err.message));
    }

    return res;
  }

  /**
   * Helper: Send Queue Approaching event (e.g. 2 queues remaining)
   */
  static async sendQueueApproaching({
    orderId,
    queueNumber,
    storeId,
    storeName,
    customerId,
    recipientId,
    userId,
    schoolId,
    remainingQueues = 2,
    lineNotifyToken
  }) {
    const targetRecipient = recipientId || customerId || userId;
    const res = await this.send({
      recipientId: targetRecipient,
      schoolId,
      type: 'QUEUE_APPROACHING',
      title: '⏳ ใกล้ถึงคิวของคุณแล้ว!',
      message: `คิว #${queueNumber} ร้าน "${storeName}" เหลืออีก ${remainingQueues} คิวจะถึงตาคุณแล้ว กรุณาเตรียมตัวนะคะ`,
      idempotencyKey: `order_${orderId}_QUEUE_APPROACHING`,
      deepLink: `/queue-tracking?orderId=${orderId}`,
      relatedId: orderId,
      relatedType: 'order',
      metadata: {
        orderId,
        queueNumber,
        storeId,
        storeName,
        remainingQueues
      }
    });

    // Optional LINE alert dispatch
    if (lineNotifyToken || process.env.LINE_NOTIFY_TOKEN) {
      LineNotifyService.notifyQueueApproaching({
        token: lineNotifyToken,
        storeName,
        queueNumber,
        remainingQueues
      }).catch(err => console.warn('[NotificationEngine] LINE alert error:', err.message));
    }

    return res;
  }

  /**
   * Helper: Send Order Status Change event
   */
  static async sendOrderStatusChange({
    orderId,
    queueNumber,
    storeName,
    customerId,
    recipientId,
    userId,
    schoolId,
    status
  }) {
    const targetRecipient = recipientId || customerId || userId;
    const statusMap = {
      PREPARING: {
        type: 'ORDER_PREPARING',
        title: '🍳 กำลังปรุงอาหาร',
        message: `ร้าน "${storeName}" เริ่มปรุงออเดอร์คิว #${queueNumber} แล้วค่ะ`
      },
      MERCHANT_ACCEPTED: {
        type: 'ORDER_ACCEPTED',
        title: '✅ ร้านรับออเดอร์แล้ว',
        message: `ร้าน "${storeName}" ยืนยันรับออเดอร์คิว #${queueNumber} เรียบร้อยแล้ว`
      },
      COMPLETED: {
        type: 'ORDER_COMPLETED',
        title: '✨ ออเดอร์เสร็จสมบูรณ์',
        message: `ส่งมอบอาหารคิว #${queueNumber} เรียบร้อย ขอบคุณที่ใช้บริการ QueueUp ค่ะ`
      },
      CANCELLED: {
        type: 'ORDER_CANCELLED',
        title: '⚠️ ออเดอร์ถูกยกเลิก',
        message: `ออเดอร์คิว #${queueNumber} จากร้าน "${storeName}" ถูกยกเลิกเรียบร้อยแล้ว`
      },
      MERCHANT_REJECTED: {
        type: 'ORDER_CANCELLED',
        title: '❌ ร้านค้าปฏิเสธออเดอร์',
        message: `ร้าน "${storeName}" ไม่สามารถทำออเดอร์คิว #${queueNumber} ได้ ระบบคืนเงินให้เรียบร้อยแล้วค่ะ`
      }
    };

    const config = statusMap[status];
    if (!config) return null;

    return this.send({
      recipientId: targetRecipient,
      schoolId,
      type: config.type,
      title: config.title,
      message: config.message,
      idempotencyKey: `order_${orderId}_${status}`,
      deepLink: `/queue-tracking?orderId=${orderId}`,
      relatedId: orderId,
      relatedType: 'order',
      metadata: { orderId, queueNumber, status }
    });
  }

  /**
   * Helper: Send Chat Message event
   */
  static async sendChatMessage({
    senderName,
    recipientId,
    chatId,
    messageSnippet,
    schoolId
  }) {
    return this.send({
      recipientId,
      schoolId,
      type: 'CHAT_MESSAGE',
      title: `💬 ข้อความใหม่จาก ${senderName}`,
      message: messageSnippet || 'ส่งข้อความถึงคุณ',
      deepLink: `/chat`,
      relatedId: chatId,
      relatedType: 'chat'
    });
  }
}
