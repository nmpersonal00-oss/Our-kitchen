/* Little Kitchen V8: same-origin app and artwork offline cache. */
const CACHE = 'little-kitchen-v14-restored-last-working-layout';
const SHELL = ['./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(async cache => { await cache.add('./index.html'); await Promise.allSettled(SHELL.slice(1).map(path => cache.add(path))); })
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('little-kitchen-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}); }
      return response;
    }).catch(async () => await caches.match(request) || await caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}); }
    return response;
  }).catch(() => caches.match(request)));
});
