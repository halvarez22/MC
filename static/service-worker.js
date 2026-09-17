const CACHE_NAME = 'afiliados-cache-v4';
// Mirror de public/service-worker.js (Vite sirve public/ → dist).
const URLS_TO_CACHE = [
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) =>
            cacheWhitelist.includes(cacheName) ? undefined : caches.delete(cacheName)
          )
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // APO-FIELD-HANG: APIs siempre red directa (POST /api/* no debe pasar por Cache).
  try {
    const path = new URL(url).pathname;
    if (path.startsWith('/api/')) {
      return;
    }
  } catch {
    /* ignore bad URL */
  }

  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.endsWith('/') ||
    url.includes('/index.html')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (
    url.includes('/assets/') ||
    url.includes('@') ||
    url.includes('vite') ||
    url.includes('node_modules') ||
    url.includes('.tsx') ||
    url.includes('.ts') ||
    url.includes('.css') ||
    url.includes('.js') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1')
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => response || fetch(request))
  );
});
