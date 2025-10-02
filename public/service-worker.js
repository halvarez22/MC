const CACHE_NAME = 'afiliados-cache-v1';
// Lista de archivos a cachear. En una app real, esto se generaría dinámicamente.
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.css',
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
  // No interceptar peticiones que comiencen con @ o sean archivos de desarrollo
  if (event.request.url.includes('@') ||
      event.request.url.includes('vite') ||
      event.request.url.includes('node_modules') ||
      event.request.url.includes('.tsx') ||
      event.request.url.includes('.ts')) {
    return; // Dejar que pase sin cache
  }

  // Intercepta las peticiones de red solo para recursos estáticos.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el recurso está en el caché, lo devuelve.
        if (response) {
          return response;
        }
        // Si no, realiza la petición a la red.
        return fetch(event.request);
      })
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