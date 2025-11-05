const CACHE_NAME = "overview-cache-v1";

const ASSETS_TO_CACHE = [
  "/overview/",
  "/overview/index.html",
  "/overview/style.css",
  "/overview/app.js",
  "/overview/content.json",
  "/overview/icon-192.png",
  "/overview/icon-512.png",
  "/overview/manifest.webmanifest"
];

// INSTALL — store assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ACTIVATE — remove old caches if needed
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// FETCH — serve cached fallback offline
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() =>
          caches.match("/overview/index.html")
        )
      );
    })
  );
});
