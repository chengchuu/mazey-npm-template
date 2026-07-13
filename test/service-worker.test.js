/** @jest-environment node */

const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pngDimensions } = require("../scripts/validate-pwa");

const root = path.resolve(__dirname, "..");

function evaluateWorker() {
  const listeners = {};
  const deleted = [];
  const runtimeCache = {
    delete: jest.fn(),
    keys: jest.fn(async () => []),
    put: jest.fn(),
  };
  const fetch = jest.fn();
  const caches = {
    delete: jest.fn(async (name) => {
      deleted.push(name);
      return true;
    }),
    keys: jest.fn(async () => [
      "mazey-npm-template-site-old",
      "mazey-npm-template-site-test-version",
      "unrelated-cache",
    ]),
    match: jest.fn(),
    open: jest.fn(async () => runtimeCache),
  };
  const self = {
    addEventListener: (name, listener) => (listeners[name] = listener),
    clients: { claim: jest.fn(async () => undefined) },
    location: { origin: "https://chengchuu.github.io" },
    skipWaiting: jest.fn(),
  };
  const source = readFileSync(
    path.join(root, "site", "service-worker.js"),
    "utf8",
  ).replaceAll("__MAZEY_PWA_CACHE_VERSION__", "test-version");
  vm.runInNewContext(source, {
    URL,
    caches,
    fetch,
    Promise,
    self,
  });
  return { caches, deleted, fetch, listeners, runtimeCache, self };
}

test("manifest icon dimensions match their declarations", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(root, "site", "manifest.webmanifest"), "utf8"),
  );
  expect(manifest.id).toBe("/mazey-npm-template/");
  expect(manifest.start_url).toBe("/mazey-npm-template/");
  expect(manifest.scope).toBe("/mazey-npm-template/");
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const file = path.join(root, icon.src.replace("/mazey-npm-template/", ""));
    const dimensions = pngDimensions(file);
    expect(`${dimensions.width}x${dimensions.height}`).toBe(icon.sizes);
  }
});

test("activation removes only obsolete project caches", async () => {
  const { caches, listeners, self } = evaluateWorker();
  let activation;
  listeners.activate({ waitUntil: (promise) => (activation = promise) });
  await activation;
  expect(caches.delete).toHaveBeenCalledTimes(1);
  expect(caches.delete).toHaveBeenCalledWith("mazey-npm-template-site-old");
  expect(self.clients.claim).toHaveBeenCalledTimes(1);
});

test("fetch handling ignores non-GET, cross-origin, and out-of-scope requests", () => {
  const { listeners } = evaluateWorker();
  const respondWith = jest.fn();
  const request = (url, method = "GET") => ({
    destination: "document",
    method,
    mode: "navigate",
    url,
  });

  listeners.fetch({
    request: request("https://chengchuu.github.io/mazey-npm-template/", "POST"),
    respondWith,
  });
  listeners.fetch({
    request: request("https://cdn.example.com/mazey-npm-template/"),
    respondWith,
  });
  listeners.fetch({
    request: request("https://chengchuu.github.io/another-project/"),
    respondWith,
  });
  expect(respondWith).not.toHaveBeenCalled();
});

test.each([
  ["document", "navigate"],
  ["script", "no-cors"],
])(
  "a failed cache write does not discard a successful %s response",
  async (destination, mode) => {
    const { caches, fetch, listeners, runtimeCache } = evaluateWorker();
    const response = {
      clone: jest.fn(() => ({ cached: true })),
      ok: true,
      status: 200,
      type: "basic",
    };
    caches.match.mockRejectedValue(new Error("Cache unavailable"));
    runtimeCache.put.mockRejectedValue(new Error("Quota exceeded"));
    fetch.mockResolvedValue(response);
    let responsePromise;

    listeners.fetch({
      request: {
        destination,
        method: "GET",
        mode,
        url: `https://chengchuu.github.io/mazey-npm-template/assets/example.${destination === "script" ? "js" : "html"}`,
      },
      respondWith: (promise) => (responsePromise = promise),
    });

    await expect(responsePromise).resolves.toBe(response);
  },
);

test.each([
  ["script", "js"],
  ["style", "css"],
])(
  "unversioned %s assets prefer the network over an older cached response",
  async (destination, extension) => {
    const { caches, fetch, listeners } = evaluateWorker();
    const cachedResponse = { source: "old cache" };
    const networkResponse = {
      clone: jest.fn(() => ({ source: "new cache" })),
      ok: true,
      source: "network",
      status: 200,
      type: "basic",
    };
    caches.match.mockResolvedValue(cachedResponse);
    fetch.mockResolvedValue(networkResponse);
    let responsePromise;

    listeners.fetch({
      request: {
        destination,
        method: "GET",
        mode: "no-cors",
        url: `https://chengchuu.github.io/mazey-npm-template/assets/shared.${extension}`,
      },
      respondWith: (promise) => (responsePromise = promise),
    });

    await expect(responsePromise).resolves.toBe(networkResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

test("local images remain cache-first", async () => {
  const { caches, fetch, listeners } = evaluateWorker();
  const cachedResponse = { source: "cache" };
  caches.match.mockResolvedValue(cachedResponse);
  let responsePromise;

  listeners.fetch({
    request: {
      destination: "image",
      method: "GET",
      mode: "no-cors",
      url: "https://chengchuu.github.io/mazey-npm-template/images/logo-dark-circle-transparent-192x192.png",
    },
    respondWith: (promise) => (responsePromise = promise),
  });

  await expect(responsePromise).resolves.toBe(cachedResponse);
  expect(fetch).not.toHaveBeenCalled();
});
