// firebase-messaging-sw.js
// Service worker for Firebase Cloud Messaging.
// Must live at the root of the site (/firebase-messaging-sw.js) — Vite serves
// everything in /public at the root, so placing it here is correct.
//
// ⚠️  SETUP REQUIRED — fill in your project values below.
//     Firebase Console → Project Settings → General → Your apps → Web app
//     You need: apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
//     For vapidKey: Firebase Console → Project Settings → Cloud Messaging
//                   → Web Push certificates → Key pair

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyDYIbJ010CGwWqBLtv4j_TqA6l31HJUrEU',   // ← your Web API key (already set)
  authDomain:        'fitconnect-937d0.firebaseapp.com',
  projectId:         'fitconnect-937d0',
  storageBucket:     'fitconnect-937d0.appspot.com',
  messagingSenderId: '44630774148',
  appId:             '1:44630774148:web:3f5a0fea31ca1d3870cdd1',
});

const messaging = firebase.messaging();

// Handle background messages (app is closed or in another tab)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || 'FitConnect', {
    body:    body || '',
    icon:    '/favicon.svg',
    badge:   '/favicon.svg',
    tag:     data.type || 'fitconnect',
    data:    { url: data.link || '/' },
    actions: [{ action: 'open', title: 'Open App' }],
  });
});

// Click on notification → open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
