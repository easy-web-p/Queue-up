import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { app, auth } from '../config/firebase';
import { UserDevice } from '../types';

const DEVICE_ID_KEY = 'queueup_device_id_v1';
const FCM_TOKEN_KEY = 'queueup_fcm_token_v1';

// Optional Web Push VAPID key (can be supplied via env or firebase-applet-config)
const VAPID_KEY = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || undefined;

let messagingInstance: Messaging | null = null;
let foregroundUnsubscribe: (() => void) | null = null;

/**
 * Gets or creates a persistent device ID unique to this browser instance
 */
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_' + Date.now();
  }
}

/**
 * Detect current platform for push analytics and token management
 */
export function detectPlatform(): 'android' | 'ios' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'desktop';
}

/**
 * Check if the app is currently running in PWA standalone display mode
 */
export function isPwaMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

/**
 * Initialize Firebase Messaging client instance safely
 */
export async function getMessagingClient(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isSupported();
    if (supported && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.warn('[PushTokenService] Firebase Messaging not supported in this environment:', err);
  }
  return null;
}

/**
 * Registers the Service Worker and retrieves the FCM registration token
 */
export async function requestFcmToken(): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('[PushTokenService] Browser does not support Web Push notifications.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[PushTokenService] Notification permission was not granted:', permission);
      return null;
    }

    const messaging = await getMessagingClient();
    if (!messaging) return null;

    // Register or ensure service worker is active
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });

    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      vapidKey: VAPID_KEY
    });

    if (token) {
      try {
        localStorage.setItem(FCM_TOKEN_KEY, token);
      } catch {}
      console.log('[PushTokenService] FCM registration token acquired successfully.');
      return token;
    } else {
      console.warn('[PushTokenService] No registration token available.');
      return null;
    }
  } catch (err) {
    console.error('[PushTokenService] Error retrieving FCM token:', err);
    return null;
  }
}

/**
 * Register current device and FCM token with the QueueUp backend.
 * Rule: Identity (uid, schoolId) MUST be derived by backend from Firebase ID Token, NOT sent in body.
 */
export async function registerDeviceWithBackend(fcmToken: string): Promise<UserDevice | null> {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('[PushTokenService] User not authenticated; token stored locally until sign-in.');
      return null;
    }

    const idToken = await user.getIdToken();
    const deviceId = getOrCreateDeviceId();
    const platform = detectPlatform();
    const isPWA = isPwaMode();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        deviceId,
        fcmToken,
        platform,
        isPWA,
        userAgent
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn('[PushTokenService] Failed to register device on backend:', errData);
      return null;
    }

    const data = await res.json();
    return data.device as UserDevice;
  } catch (err) {
    console.warn('[PushTokenService] Error registering device with backend:', err);
    return null;
  }
}

/**
 * High-level helper: Enable notifications, fetch token and register device in one call
 */
export async function enablePushNotifications(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    const token = await requestFcmToken();
    if (!token) {
      return { success: false, error: 'PERMISSION_DENIED_OR_UNSUPPORTED' };
    }

    await registerDeviceWithBackend(token);
    return { success: true, token };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'UNKNOWN_ERROR' };
  }
}

/**
 * Setup foreground push message listener when the app is actively open
 */
export async function setupForegroundPushListener(
  onNotificationReceived: (payload: {
    title: string;
    message: string;
    deepLink?: string;
    notificationId?: string;
    type?: string;
  }) => void
): Promise<(() => void) | null> {
  const messaging = await getMessagingClient();
  if (!messaging) return null;

  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }

  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    console.log('[PushTokenService] Foreground FCM message received:', payload);
    const data = payload.data || {};
    const title = data.title || payload.notification?.title || 'QueueUp แจ้งเตือน';
    const message = data.message || data.body || payload.notification?.body || '';
    const deepLink = data.deepLink;
    const notificationId = data.notificationId;
    const type = data.type;

    onNotificationReceived({
      title,
      message,
      deepLink,
      notificationId,
      type
    });
  });

  return foregroundUnsubscribe;
}

/**
 * Deactivates device token on backend when user signs out or disables notifications
 */
export async function deactivateCurrentDevice(): Promise<void> {
  try {
    const user = auth.currentUser;
    const deviceId = getOrCreateDeviceId();
    if (!user) return;

    const idToken = await user.getIdToken();
    await fetch(`/api/devices/${deviceId}/deactivate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });
    console.log('[PushTokenService] Device deactivated on backend.');
  } catch (err) {
    console.warn('[PushTokenService] Failed to deactivate device:', err);
  }
}

/**
 * Automatically syncs & refreshes FCM token on app load if notification permission is already granted.
 * Prevents rotating FCM tokens from expiring silently over weeks.
 */
export async function syncPushTokenOnBoot(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!auth.currentUser) return;

    // Check last sync time (1-hour cooldown) to prevent redundant network calls
    const lastSyncStr = localStorage.getItem('queueup_push_last_sync');
    const now = Date.now();
    if (lastSyncStr && now - parseInt(lastSyncStr, 10) < 60 * 60 * 1000) {
      return;
    }

    const token = await requestFcmToken();
    if (token) {
      await registerDeviceWithBackend(token);
      localStorage.setItem('queueup_push_last_sync', String(now));
      console.log('[PushTokenService] Push token successfully auto-synced on app boot.');
    }
  } catch (err) {
    console.warn('[PushTokenService] Auto-sync on boot error:', err);
  }
}
