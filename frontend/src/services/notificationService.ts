// notificationService.ts — Notification + Badge API calls

import { API } from '../config';

// ─── Notifications ─────────────────────────────────────────────────────────────

export const getNotifications = async (uid: string) => {
  const res = await fetch(`${API}/users/${uid}/notifications`);
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
};

export const markNotificationRead = async (notifId: string) => {
  const res = await fetch(`${API}/notifications/${notifId}/read`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to mark as read');
  return res.json();
};

export const markAllNotificationsRead = async (uid: string) => {
  const res = await fetch(`${API}/users/${uid}/notifications/read-all`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to mark all as read');
  return res.json();
};

// ─── Badges ───────────────────────────────────────────────────────────────────

export const getUserBadges = async (uid: string) => {
  const res = await fetch(`${API}/users/${uid}/badges`);
  if (!res.ok) throw new Error('Failed to fetch badges');
  return res.json();
};

/** Check for post-count-based badges. Call after every new post. */
export const checkPostBadges = async (uid: string) => {
  const res = await fetch(`${API}/users/${uid}/check-badges`, { method: 'POST' });
  if (!res.ok) return;
  return res.json();
};

/**
 * Check streak and send protection reminder if needed.
 * Call on app load.
 */
export const checkStreak = async (uid: string, streakDays: number, hasPostedToday: boolean) => {
  const localHour = new Date().getHours();
  const res = await fetch(`${API}/users/${uid}/check-streak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, streakDays, hasPostedToday, localHour }),
  });
  if (!res.ok) return;
  return res.json();
};

// ─── Firebase Cloud Messaging (Push Notifications) ────────────────────────────
//
// ⚠️  THREE VALUES TO FILL IN before push notifications will work:
//
//  1. messagingSenderId  — Firebase Console → Project Settings → Cloud Messaging → Sender ID
//  2. appId              — Firebase Console → Project Settings → Your apps → App ID
//  3. VAPID_KEY          — Firebase Console → Project Settings → Cloud Messaging
//                          → Web Push certificates → Key pair (the long base64 string)
//
// Also paste the same messagingSenderId and appId into:
//   frontend/public/firebase-messaging-sw.js  (two REPLACE_WITH_ placeholders there too)

const FCM_CONFIG = {
  apiKey:            'AIzaSyDYIbJ010CGwWqBLtv4j_TqA6l31HJUrEU',
  authDomain:        'fitconnect-937d0.firebaseapp.com',
  projectId:         'fitconnect-937d0',
  storageBucket:     'fitconnect-937d0.appspot.com',
  messagingSenderId: '44630774148',
  appId:             '1:44630774148:web:3f5a0fea31ca1d3870cdd1',
};

const VAPID_KEY = 'BKER95mliVeFwuVypcDgknuFvERv5x82OmgLZ4s6pZnzqqKeaBWtvIYKkwSwo6uGFRLMV_crmVeAU7cMji2JJVO';


function isConfigured(): boolean {
  return (
    !VAPID_KEY.startsWith('REPLACE') &&
    !FCM_CONFIG.messagingSenderId.startsWith('REPLACE') &&
    !FCM_CONFIG.appId.startsWith('REPLACE')
  );
}

/**
 * initPushNotifications — call once after the user logs in.
 *
 * What it does:
 *  1. Registers /firebase-messaging-sw.js as a service worker
 *  2. Asks the user for notification permission
 *  3. Gets the FCM token for this browser
 *  4. Saves it to the backend (POST /api/users/:uid/fcm-token)
 *  5. Wires up a foreground message handler via onForegroundMessage callback
 *
 * @param userId           - The logged-in user's UID
 * @param onForeground     - Optional callback for messages received while app is open.
 *                           Receives { notification: { title, body }, data } payload.
 *                           If omitted, falls back to the browser Notification API.
 */
export async function initPushNotifications(
  userId: string,
  onForeground?: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void
): Promise<void> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (Notification.permission === 'denied') return;

  if (!isConfigured()) {
    console.info(
      '[FCM] Push notifications not configured yet.\n' +
      'Fill in messagingSenderId, appId, and VAPID_KEY in notificationService.ts\n' +
      'and in public/firebase-messaging-sw.js to enable push notifications.'
    );
    return;
  }

  try {
    // Dynamically import firebase/messaging so the rest of the app
    // doesn't break if the package isn't installed yet.
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getMessaging, getToken, onMessage }  = await import('firebase/messaging');

    const fbApp    = getApps().length ? getApp() : initializeApp(FCM_CONFIG);
    const messaging = getMessaging(fbApp);

    // Register service worker
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Ask for permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Get FCM token
    const fcmToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!fcmToken) return;

    // Save token to backend
    await fetch(`${API}/users/${userId}/fcm-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: fcmToken }),
    });

    // Handle foreground messages (app tab is currently open)
    onMessage(messaging, (payload: any) => {
      if (onForeground) {
        onForeground(payload);
      } else if (Notification.permission === 'granted') {
        const { title, body } = payload.notification || {};
        new Notification(title || 'Flex', { body: body || '', icon: '/favicon.svg' });
      }
    });

    console.info('[FCM] Push notifications enabled ✅');
  } catch (e) {
    console.warn('[FCM] Setup failed:', e);
  }
}

/**
 * removePushToken — call on sign-out so this device stops receiving pushes.
 */
export async function removePushToken(userId: string): Promise<void> {
  try {
    await fetch(`${API}/users/${userId}/fcm-token`, {
      method: 'DELETE',
      });
  } catch (e) {
    console.warn('[FCM] Failed to remove token:', e);
  }
}
