const cachePrefix = 'phioffice369-shell-';
const cacheName = cachePrefix + '__SHELL_VERSION__';
const scope = self.registration.scope;
const indexUrl = new URL('./', scope).href;
const shellFiles = new Set(__SHELL_FILES__.map((path) => new URL(path, scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) =>
    cache.addAll([...shellFiles].map((url) => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const entryPage = url.origin === new URL(scope).origin && url.pathname === new URL(scope).pathname;
  if (request.mode === 'navigate' && entryPage) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch {
        // Offline navigation uses the same versioned shell installed earlier.
      }
      const cache = await caches.open(cacheName);
      return (await cache.match(indexUrl)) ?? Response.error();
    })());
  } else if (shellFiles.has(url.href) && url.href !== indexUrl) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      return (await cache.match(request)) ?? fetch(request);
    })());
  }
});
