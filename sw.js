/* Offline shell for The Little Kitchen. IndexedDB groceries and outbox remain untouched. */
const CACHE = 'little-kitchen-v26-inline-quantity';
const CORE = [
  './index.html',
  './v2/index.html',
  './v2/kitchen.css?v=2.5-inline-quantity',
  './v2/kitchen.js?v=2.7-inline-quantity'
];
const EXTRAS = [
  './manifest.webmanifest?v=20261103-bunny-cooking',
  './v2/manifest.webmanifest?v=20261103-bunny-cooking',
  './v2/settings-bunny.webp?v=2',
  './v2/groceries-bunny.webp?v=2',
  './reference-grocery.png',
  './reference-recipes.png',
  './reference-food.png',
  './reference-drink.png',
  './reference-dessert.png',
  './reference-settings.png',
  './little-kitchen-cooking-icon-192.png',
  './little-kitchen-cooking-icon-512.png',
  './little-kitchen-cooking-apple-touch.png'
];
const CACHE_FIRST = new Set([...CORE,
  './reference-grocery.png', './reference-recipes.png', './reference-food.png',
  './reference-drink.png', './reference-dessert.png', './reference-settings.png',
  './v2/groceries-bunny.webp?v=2', './v2/settings-bunny.webp?v=2']
  .map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    // Never activate without the HTML, JS and CSS needed to open the checklist offline.
    await cache.addAll(CORE);
    await Promise.allSettled(EXTRAS.map(path => cache.add(path)));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith('little-kitchen-') && key !== CACHE)
      .map(key => caches.delete(key)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const shell = url.pathname.includes('/v2/') ? './v2/index.html' : './index.html';
    event.respondWith(caches.match(shell).then(cached => cached || fetch(request)));
    return;
  }

  if (CACHE_FIRST.has(url.href)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
    return;
  }

  event.respondWith(fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
    }
    return response;
  }).catch(() => caches.match(request)));
});