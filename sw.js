/* Like Wifey & Hubby, do not intercept or cache HTML, JavaScript or artwork.
   The recipe diary's IndexedDB content is separate from this cache. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('little-kitchen-')).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));
