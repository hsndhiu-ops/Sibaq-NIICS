// Service Worker for DHIU Arts Fest PWA with Web Push Notifications
const CACHE_NAME = 'dhiu-arts-fest-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network fetch handler with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ---------------------------------------------------------------------------
// WEB PUSH NOTIFICATION HANDLERS
// ---------------------------------------------------------------------------

// 1. Handle incoming push messages from Web Push Server
self.addEventListener('push', (event) => {
  let payload = {
    title: 'DHIU Arts Fest',
    body: 'You have a new update.',
    url: '/',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'arts-fest-notification',
  };

  if (event.data) {
    try {
      const json = event.data.json();
      payload = { ...payload, ...json };
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    // Mobile vibration pattern (200ms buzz, 100ms pause, 200ms buzz - similar to messaging apps)
    vibrate: [200, 100, 200],
    tag: payload.tag || 'arts-fest-notification',
    renotify: true,
    requireInteraction: false,
    data: {
      url: payload.url || (payload.data && payload.data.url) || '/',
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'open',
        title: 'Open App',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

// 2. Handle notification clicks (focus existing window or open app)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // If an app window is already open, focus it and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            if (client.url && 'navigate' in client && client.url.includes(self.location.origin)) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        // If no active window exists, open a new window with target URL
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// 3. Handle push subscription refresh from browser push service
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((subscription) => {
        return fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription }),
        });
      })
      .catch((err) => {
        console.error('[SW] Failed to renew push subscription:', err);
      })
  );
});
