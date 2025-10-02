// Script para limpiar Service Worker registrado
// Ejecuta esto en la consola del navegador para desregistrar SW

navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Encontrados', registrations.length, 'Service Workers');
  registrations.forEach(reg => {
    console.log('Desregistrando:', reg.scope);
    reg.unregister().then(success => {
      console.log('Service Worker desregistrado:', success);
    });
  });
});

// También limpiar cachés
caches.keys().then(names => {
  names.forEach(name => {
    console.log('Eliminando caché:', name);
    caches.delete(name);
  });
});

console.log('Service Worker cleanup completado. Recarga la página.');
