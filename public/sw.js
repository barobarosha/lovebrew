/* Лавбрю PWA — service worker.
   Навигация (HTML): network-first — иначе клиенты навсегда остаются на старом
   бандле (так уже случилось с настройкой чата менеджера). Офлайн — кэш/оболочка.
   API (/api/*): network-only, данные всегда свежие.
   Хэшированные ассеты Vite (/assets/*): cache-first — имя файла = хэш контента.
   Прочая статика (иконки, картинки): cache-first с докачкой из сети.
   ВАЖНО: при каждом изменении этого файла поднимать версию CACHE —
   тогда activate сносит старые кэши у всех клиентов. */

const CACHE = "lavbrew-shell-v2";
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

function putInCache(request, response) {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // сеть, без кэша

  // Навигация (HTML): всегда сначала сеть — свежий бандл и свежие настройки.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => putInCache(event.request, res))
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match("/app")),
        ),
    );
    return;
  }

  // Хэшированные ассеты и статика: cache-first, промах — сеть и в кэш.
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request)
          .then((res) => putInCache(event.request, res))
          .catch(() => Response.error()),
    ),
  );
});
