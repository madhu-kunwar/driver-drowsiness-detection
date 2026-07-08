/* DrowsyShield Service Worker — v1 */
const CACHE = "drowsyshield-v1";

const PRECACHE = [
  "/",
  "/login",
  "/dashboard",
  "/monitor",
  "/insurer",
  "/offline",
];

/* ── Install: precache shell routes ─────────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(PRECACHE).catch(() => {})
      )
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: delete stale caches ──────────────────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ── Fetch strategy ─────────────────────────────────────────── */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip: non-GET, cross-origin, WebSocket, API */
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.protocol.startsWith("ws")
  ) {
    return;
  }

  /* Static assets: cache-first, populate on miss */
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/lottie/") ||
    url.pathname.startsWith("/fonts/")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  /* HTML navigation: network-first, fall back to cache or offline page */
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ?? caches.match("/offline") ?? new Response("Offline", { status: 503 })
          )
        )
    );
    return;
  }
});
