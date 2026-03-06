const CACHE_NAME = "menuz-static-v1";
const OFFLINE_URL = "/offline.html";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/topo.css",
  "/topo.js",
  "/site.css",
  "/app.js",
  "/ar.js",
  "/favicon.svg",
  OFFLINE_URL
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key === CACHE_NAME) return Promise.resolve();
          return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

function isCacheableAsset(requestUrl) {
  return /\.(?:css|js|svg|png|jpg|jpeg|webp|gif|ico|woff2?)$/i.test(requestUrl.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith("/api/")) return;
  if (requestUrl.pathname.startsWith("/uploads/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  if (!isCacheableAsset(requestUrl)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
