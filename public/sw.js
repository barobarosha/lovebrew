/* Лавбрю PWA — минимальный service worker.
   Статика: cache-first. API (/api/*): network-only (данные всегда свежие). */

const CACHE = "lavbrew-shell-v1";
const SHELL = ["/app", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return; // сеть, без кэша

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request)
          .then((res) => {
            if (res.ok && url.origin === self.location.origin) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(event.request, copy));
            }
            return res;
          })
          .catch(() => {
            // офлайн: для навигации отдаём оболочку приложения
            if (event.request.mode === "navigate") {
              return caches.match("/app");
            }
            return Response.error();
          }),
    ),
  );
});
