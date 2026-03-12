/**
 * Service Worker for Push Notifications
 * This file should be placed in the public folder
 * 
 * Usage: Register in your app layout or main entry point:
 * 
 * if ('serviceWorker' in navigator) {
 *   navigator.serviceWorker.register('/service-worker.js');
 * }
 */

const SERVICE_WORKER_CODE = `
// Service Worker for HR Management System
const CACHE_NAME = 'hr-management-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(self.clients.claim());
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
  
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = { title: 'Neue Benachrichtigung', body: event.data?.text() || '' };
  }

  const options = {
    body: data.body || data.message || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    tag: data.tag || data.notificationId || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.data || {},
    vibrate: data.vibrate || [200, 100, 200],
    timestamp: data.timestamp || Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Benachrichtigung', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);
  event.notification.close();

  const data = event.notification.data;
  const actionUrl = data?.actionUrl || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a window client is already open, focus it
      for (const client of clientList) {
        if (client.url === actionUrl && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(actionUrl);
      }
    })
  );
});

// Message event (from main app)
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync (for offline functionality)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
});

// Fetch event (for caching)
self.addEventListener('fetch', (event) => {
  // Pass through all requests
  event.respondWith(fetch(event.request));
});
`;

export default SERVICE_WORKER_CODE;
