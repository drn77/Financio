const CACHE_NAME = 'financio-v3';
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

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
