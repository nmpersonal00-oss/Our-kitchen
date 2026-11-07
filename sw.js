/* Offline shell for The Little Kitchen. IndexedDB groceries and outbox remain untouched. */
const CACHE = 'little-kitchen-v30-recipe-images';
const CORE = [
  './index.html',
  './v2/index.html',
  './v2/kitchen.css?v=2.9-recipe-images',
  './v2/kitchen.js?v=3.1-recipe-images',
  // The original sample covers and matching backup art must work offline,
  // including previously installed phones that haven't opened each recipe.
  './exact-pumpkin-soup.webp',
  './exact-herb-pasta.webp',
  './exact-chai-latte.webp',
  './exact-spiced-cider.webp',
  './exact-cinnamon-rolls.webp',
  './exact-apple-crumble.webp',
  './exact-strawberry-cake.webp',
  './exact-brownies.webp',
  './reference-recipe-pumpkin-soup.webp',
  './reference-recipe-herb-pasta.webp',
  './reference-recipe-chai-latte.webp',
  './reference-recipe-spiced-cider.webp',
  './reference-recipe-cinnamon-rolls.webp',
  './reference-recipe-apple-crumble.webp',
  './reference-recipe-strawberry.webp',
  './reference-recipe-brownie.webp'
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
    // Prefer fresh HTML when connected: an installed app must not stay pinned
    // to a previous UI release just because an earlier shell is cached.
    // Bound network lookup for no-signal supermarkets and fall back offline.
    event.respondWith((async () => {
      const abort = new AbortController();
      const deadline = setTimeout(() => abort.abort(), 1200);
      try {
        const response = await fetch(request, {signal:abort.signal, cache:'no-store'});
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(shell, copy)).catch(() => {}));
          return response;
        }
      } catch (_) { /* No network: display the installed app immediately. */ }
      finally { clearTimeout(deadline); }
      return await caches.match(shell) || Response.error();
    })());
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