const CACHE_NAME = 'financio-v4';
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24h
const STATIC_ASSETS = [
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Listen for manual cache clear messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache static assets (images, fonts, css, js files)
  // Never cache HTML pages or API requests
  if (
    request.method !== 'GET' ||
    request.url.includes('/api/') ||
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html')
  ) {
    return;
  }

  // Only cache files with known static extensions
  const staticExts = /\.(js|css|svg|png|jpg|jpeg|ico|woff2?|ttf|json)$/;
  if (!staticExts.test(url.pathname)) {
    return;
  }

  // Don't use cache fallback for Next.js chunks — always prefer network
  const isNextChunk = url.pathname.startsWith('/_next/');

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // For Next.js chunks, don't serve stale cache — let it fail so the app can reload
        if (isNextChunk) {
          return new Response('', { status: 504, statusText: 'Network error' });
        }
        return caches.match(request);
      })
  );
});
