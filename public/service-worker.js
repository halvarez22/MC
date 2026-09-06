const CACHE_NAME = 'afiliados-cache-v1';
// Lista de archivos a cachear. En una app real, esto se generaría dinámicamente.
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
  // Realiza la instalación: abre el caché y añade los recursos principales.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  // Nunca cachear assets de Vite/dev ni CSS/JS dinámicos (rompe estilos en local)
  if (
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
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  // Limpia cachés antiguos si es necesario.
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});