import { adminDb } from '../firebaseAdmin.js';
import { NotificationEngine } from './notificationEngine.js';

let workerInterval = null;

/**
 * Pickup Reminder Scheduler (Phase 8)
 * Checks active orders in status 'READY' that haven't been picked up within 5 minutes.
 * Uses pickupReminderSent flag and NotificationEngine idempotency to guarantee zero duplicates.
 */
export async function runPickupReminderCheck() {
  try {
    const readyOrdersSnapshot = await adminDb
      .collection('orders')
      .where('status', '==', 'READY')
      .get();

    if (readyOrdersSnapshot.empty) return;

    const now = Date.now();
    const REMINDER_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    for (const doc of readyOrdersSnapshot.docs) {
      const order = doc.data();
      order.id = doc.id;

      // 1. Skip if reminder was already sent
      if (order.pickupReminderSent) continue;

      // 2. Check elapsed time since order was marked ready
      const readyTime = order.readyAt || order.updatedAt || order.createdAt;
      const readyMs = typeof readyTime === 'number'
        ? readyTime
        : (readyTime?.toMillis ? readyTime.toMillis() : new Date(readyTime).getTime());

      if (!readyMs || isNaN(readyMs)) continue;

      const elapsed = now - readyMs;
      if (elapsed >= REMINDER_THRESHOLD_MS) {
        console.log(`[PickupReminderWorker] Order #${order.queueNumber || order.id} ready for ${Math.round(elapsed / 60000)}m without pickup. Sending reminder...`);

        // 3. Mark flag FIRST in Firestore to prevent race conditions
        await doc.ref.update({
          pickupReminderSent: true,
          pickupReminderSentAt: now
        });

        // 4. Send notification with idempotency key
        const recipientId = order.userId || order.customerId;
        if (recipientId) {
          await NotificationEngine.send({
            recipientId,
            schoolId: order.schoolId || 'school-default',
            type: 'PICKUP_REMINDER',
            title: `⚠️ แจ้งเตือน: คิว #${order.queueNumber} อาหารปรุงเสร็จแล้ว`,
            message: `อาหารของคุณที่ร้าน ${order.storeName || 'ร้านค้า'} ปรุงเสร็จกว่า 5 นาทีแล้ว กรุณาไปรับก่อนอาหารจะเย็นนะคะ`,
            deepLink: `/queue-tracking?orderId=${order.id}`,
            idempotencyKey: `PICKUP_REMINDER:${order.id}`,
            data: {
              orderId: order.id,
              queueNumber: order.queueNumber,
              storeId: order.storeId,
              type: 'PICKUP_REMINDER'
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn('[PickupReminderWorker] Error running reminder check:', err.message);
  }
}

/**
 * Start the background pickup reminder worker
 * @param {number} intervalMs - Poll interval in milliseconds (default 60s)
 */
export function startPickupReminderWorker(intervalMs = 60000) {
  if (workerInterval) clearInterval(workerInterval);

  console.log(`[PickupReminderWorker] Scheduler started (interval: ${intervalMs / 1000}s)`);
  // Run once on startup after 10s delay, then on interval
  setTimeout(() => {
    runPickupReminderCheck();
  }, 10000);

  workerInterval = setInterval(() => {
    runPickupReminderCheck();
  }, intervalMs);

  return workerInterval;
}

export function stopPickupReminderWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[PickupReminderWorker] Scheduler stopped.');
  }
}
