const CACHE_NAME = 'afiliados-cache-v3';
// No precachear index.html ni `/`: tras un redeploy Vite cambia los hashes
// de /assets/* y un HTML viejo en caché provoca 404 en JS/CSS.
const URLS_TO_CACHE = [
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache abierto', CACHE_NAME);
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log('[SW] Eliminando caché antiguo:', cacheName);
              return caches.delete(cacheName);
            }
            return undefined;
          })
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

  // Shell SPA: siempre red (evita HTML con hashes obsoletos tras redeploy).
  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.endsWith('/') ||
    url.includes('/index.html')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // No interceptar assets hasheados ni módulos (red directa).
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
