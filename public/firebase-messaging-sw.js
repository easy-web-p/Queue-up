/* eslint-disable no-undef */
// Service Worker for Firebase Cloud Messaging in QueueUp
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// Kept in sync with firebase-applet-config.json. A service worker pointed at a
// different project registers FCM tokens that the app's Admin SDK cannot reach,
// which silently breaks every push notification.
const firebaseConfig = {
  projectId: "queueup-65e82",
  appId: "1:324920233384:web:4871f18891e27fbc8f219d",
  apiKey: "AIzaSyCWCpdSksHY_mU5rqZWHob1rLRws7RB8nA",
  authDomain: "queueup-65e82.firebaseapp.com",
  storageBucket: "queueup-65e82.firebasestorage.app",
  messagingSenderId: "324920233384"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background message handler (Data-first payload to prevent duplicate notifications)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const data = payload.data || {};
  const notificationTitle = data.title || payload.notification?.title || 'QueueUp แจ้งเตือน';
  const notificationOptions = {
    body: data.message || data.body || payload.notification?.body || 'คุณมีรายการอัปเดตใหม่ใน QueueUp',
    icon: data.icon || payload.notification?.icon || '/logo.png',
    badge: '/favicon.svg',
    tag: data.tag || data.notificationId || 'queueup-alert',
    renotify: true,
    data: {
      deepLink: data.deepLink || '/',
      notificationId: data.notificationId || '',
      type: data.type || ''
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click -> Focus existing tab or open deep link
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const deepLink = (event.notification.data && event.notification.data.deepLink)
    ? event.notification.data.deepLink
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(deepLink);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(deepLink);
      }
    })
  );
});
