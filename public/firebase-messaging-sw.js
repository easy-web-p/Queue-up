/* eslint-disable no-undef */
// Service Worker for Firebase Cloud Messaging in QueueUp
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "numeric-citron-7mn89",
  appId: "1:342098953506:web:32a00e3f979498a57e517b",
  apiKey: "AIzaSyDkk9woQ_y_qviXSA6XRutef3CoZyAddKw",
  authDomain: "numeric-citron-7mn89.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-queueup-ca15cbf8-a12a-45c9-92ff-2fa662c472b6",
  storageBucket: "numeric-citron-7mn89.firebasestorage.app",
  messagingSenderId: "342098953506"
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
