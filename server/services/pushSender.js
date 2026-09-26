import { adminMessaging, adminDb } from '../firebaseAdmin.js';

/**
 * Push Sender Service: Formats and dispatches FCM messages to target device tokens
 * and cleans up invalid/unregistered tokens automatically.
 */
export async function sendPushToDevices(deviceDocs, payload) {
  if (!deviceDocs || deviceDocs.length === 0) {
    return { successCount: 0, failureCount: 0, total: 0 };
  }

  // Filter only active devices with valid fcmToken string
  const validDevices = deviceDocs.filter(d => d && d.fcmToken && d.isActive !== false);
  if (validDevices.length === 0) {
    return { successCount: 0, failureCount: 0, total: 0 };
  }

  const tokens = validDevices.map(d => d.fcmToken);
  const deepLink = payload.deepLink || '/';
  const notificationId = payload.notificationId || `notif_${Date.now()}`;
  const tag = payload.tag || payload.type || notificationId;

  const fcmMessage = {
    tokens,
    notification: {
      title: payload.title || 'QueueUp แจ้งเตือน',
      body: payload.message || ''
    },
    data: {
      title: String(payload.title || 'QueueUp แจ้งเตือน'),
      message: String(payload.message || ''),
      body: String(payload.message || ''),
      deepLink: String(deepLink),
      notificationId: String(notificationId),
      type: String(payload.type || ''),
      tag: String(tag)
    },
    webpush: {
      fcmOptions: {
        link: deepLink
      },
      notification: {
        icon: '/logo.png',
        badge: '/favicon.svg',
        tag: tag
      }
    }
  };

  try {
    const response = await adminMessaging.sendEachForMulticast(fcmMessage);
    console.log(`[PushSender] Sent to ${tokens.length} devices: ${response.successCount} succeeded, ${response.failureCount} failed.`);

    // Token cleanup: Deactivate invalid/unregistered tokens
    if (response.failureCount > 0) {
      const deadDeviceIds = [];

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code || '';
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/mismatched-credential'
          ) {
            deadDeviceIds.push(validDevices[idx].deviceId);
          }
        }
      });

      if (deadDeviceIds.length > 0) {
        console.log(`[PushSender] Cleaning up ${deadDeviceIds.length} invalid/unregistered device tokens.`);
        for (const deviceId of deadDeviceIds) {
          try {
            await adminDb.collection('user_devices').doc(deviceId).update({
              isActive: false,
              deactivatedReason: 'INVALID_TOKEN_RETURNED_BY_FCM',
              deactivatedAt: Date.now()
            });
          } catch (e) {
            console.warn(`[PushSender] Could not deactivate dead device ${deviceId}:`, e.message);
          }
        }
      }
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      total: tokens.length
    };
  } catch (err) {
    console.error('[PushSender] Error dispatching FCM multicast:', err.message);
    return { successCount: 0, failureCount: tokens.length, error: err.message };
  }
}
