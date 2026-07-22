// DishCovered service worker — offline support.
//
// Strategy:
//  - Static build assets (/_next/static, icons, manifest): cache-first, since
//    they're content-hashed / immutable.
//  - Page navigations: network-first, falling back to the last cached copy of
//    that page, and finally to a friendly /offline page. This is what lets a
//    shopping list you opened while online still open in the store on bad Wi-Fi.
//  - Everything else (APIs, image proxy, RSC data fetches): straight to the
//    network, never cached — they're per-request and often auth-sensitive.
const STATIC_CACHE = "dishcovered-static-v3";
const PAGE_CACHE = "dishcovered-pages-v3";
const KEEP = [STATIC_CACHE, PAGE_CACHE];

const CORE_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // addAll is all-or-nothing; add individually so one 404 (e.g. /offline
      // during an odd deploy) can't abort the whole precache.
      .then((cache) => Promise.all(CORE_ASSETS.map((url) => cache.add(url).catch(() => null))))
      .catch(() => null),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !KEEP.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    CORE_ASSETS.includes(url.pathname) ||
    url.pathname.startsWith("/icon")
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    // Only cache real, non-redirected page bodies — a cached redirect can't be
    // replayed and an opaque/partial response is useless offline.
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match("/offline");
    if (offline) return offline;
    return new Response("You're offline.", {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page loads (address bar, home-screen launch, reloads).
  if (request.mode === "navigate") {
    // Don't cache auth flows — a stale sign-in page is only confusing.
    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/auth")) return;
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // APIs, image proxy, RSC payloads: network only.
});
