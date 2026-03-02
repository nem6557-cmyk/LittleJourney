const CACHE_NAME = 'littlejourney-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install — cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first with cache fallback for offline support
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API / Supabase calls — always network
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) return;

  // Network-first: try network, fall back to cache for offline support
  event.respondWith(
    fetch(request).then((response) => {
      // Cache successful responses for offline use
      if (response.ok && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => {
      // Offline fallback — serve from cache
      return caches.match(request).then((cached) => {
        if (cached) return cached;
        // Last resort for navigation — return cached index
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
