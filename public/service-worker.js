const CACHE_NAME = 'hr-chat-v1';
const STATIC_ASSETS = [
  '/',
  '/chat',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Skip waiting
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Claim clients
  self.clients.claim();
});

// Fetch Event - Cache Strategy: Network First, Fallback to Cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip API requests
  if (request.url.includes('/api/')) return;
  
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone response before caching
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // If no cache, return offline page for navigation
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          
          throw new Error('No cache available');
        });
      })
  );
});

// Message Queue Sync - Process offline messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'chat-messages-sync') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  // This will be triggered when connection is restored
  // The actual sync logic is handled by the useOfflineSync hook
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_TRIGGERED',
      timestamp: new Date().toISOString(),
    });
  });
}

// Background sync for queued messages
self.addEventListener('message', (event) => {
  if (event.data?.type === 'QUEUE_MESSAGE') {
    // Register for sync
    self.registration.sync.register('chat-messages-sync').catch(() => {
      // Silent fail - retry on next connection
    });
  }
});
