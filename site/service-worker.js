/* global self, caches, fetch, URL */

const PROJECT_BASE = "__PWA_PROJECT_BASE__";
const CACHE_PREFIX = "__PWA_CACHE_PREFIX__";
const CACHE_NAME = `${CACHE_PREFIX}__PWA_CACHE_VERSION__`;
const MAX_CACHE_ENTRIES = 96;
const APP_SHELL = [
  PROJECT_BASE,
  `${PROJECT_BASE}playground/`,
  `${PROJECT_BASE}api/`,
  `${PROJECT_BASE}manifest.webmanifest`,
  `${PROJECT_BASE}assets/shared.css`,
  `${PROJECT_BASE}assets/shared.js`,
  `${PROJECT_BASE}assets/home.js`,
  `${PROJECT_BASE}assets/playground.js`,
  `${PROJECT_BASE}assets/api.css`,
  `${PROJECT_BASE}assets/api.js`,
];

function canCache(response) {
  return (
    response.ok &&
    response.status === 200 &&
    response.type !== "opaque" &&
    response.type !== "opaqueredirect"
  );
}

function isProjectRequest(request) {
  const url = new URL(request.url);
  return (
    request.method === "GET" &&
    url.origin === self.location.origin &&
    url.pathname.startsWith(PROJECT_BASE) &&
    !url.pathname.endsWith(".map")
  );
}

async function trimCache(cache) {
  const keys = await cache.keys();
  await Promise.all(
    keys
      .slice(0, Math.max(0, keys.length - MAX_CACHE_ENTRIES))
      .map((key) => cache.delete(key)),
  );
}

async function cacheResponse(request, response) {
  if (!canCache(response)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
    await trimCache(cache);
  } catch {
    // Cache Storage is best-effort; a valid network response must still win.
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request).catch(() => undefined);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const home = await caches.match(PROJECT_BASE);
      if (home) return home;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request).catch(() => undefined);
  if (cached) return cached;
  const response = await fetch(request);
  await cacheResponse(request, response);
  return response;
}

async function cacheAppShell() {
  try {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(
      APP_SHELL.map(async (url) => {
        const response = await fetch(url, { cache: "reload" });
        if (canCache(response)) await cache.put(url, response);
      }),
    );
  } catch {
    // Installation can continue when storage is unavailable.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isProjectRequest(request)) return;

  const isDocument =
    request.mode === "navigate" || request.destination === "document";
  const needsFreshness = ["script", "style"].includes(request.destination);
  const isCacheFirstAsset = ["font", "image"].includes(request.destination);

  if (isDocument || needsFreshness) event.respondWith(networkFirst(request));
  else if (isCacheFirstAsset) event.respondWith(cacheFirst(request));
});
