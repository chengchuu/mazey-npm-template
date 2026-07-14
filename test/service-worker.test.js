/** @jest-environment node */

const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const projectConfig = require("../project.config");
const {
  createManifest,
  renderServiceWorker,
} = require("../scripts/build-pages");
const {
  manifestMetadataFailures,
  pngDimensions,
} = require("../scripts/validate-pwa");

const root = path.resolve(__dirname, "..");
const siteOrigin = new URL(projectConfig.site.url).origin;
const projectUrl = (relative = "") =>
  new URL(relative, projectConfig.site.url).href;

function evaluateWorker(deploymentUrl = projectConfig.site.url) {
  const listeners = {};
  const deleted = [];
  const runtimeCache = {
    delete: jest.fn(),
    keys: jest.fn(async () => []),
    put: jest.fn(),
  };
  const fetch = jest.fn(async () => ({
    clone: () => ({ cached: true }),
    ok: true,
    status: 200,
    type: "basic",
  }));
  const caches = {
    delete: jest.fn(async (name) => {
      deleted.push(name);
      return true;
    }),
    keys: jest.fn(async () => [
      `${projectConfig.pwa.cachePrefix}0123456789abcdef`,
      `${projectConfig.pwa.cachePrefix}${encodeURIComponent(new URL(deploymentUrl).pathname)}-old`,
      `${projectConfig.pwa.cachePrefix}${encodeURIComponent(new URL(deploymentUrl).pathname)}-test-version`,
      `${projectConfig.pwa.cachePrefix}${encodeURIComponent("/another/")}-old`,
      "unrelated-cache",
    ]),
    match: jest.fn(async () => undefined),
    open: jest.fn(async () => runtimeCache),
  };
  const self = {
    addEventListener: (name, listener) => (listeners[name] = listener),
    clients: { claim: jest.fn(async () => undefined) },
    location: new URL("service-worker.js", deploymentUrl),
    skipWaiting: jest.fn(),
  };
  const source = renderServiceWorker(
    readFileSync(path.join(root, "site", "service-worker.js"), "utf8"),
    "test-version",
  );
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
  const manifest = createManifest();
  expect(manifest).not.toHaveProperty("id");
  expect(manifest.start_url).toBe("./");
  expect(manifest.scope).toBe("./");
  expect(manifest.display).toBe("standalone");
  for (const configuredIcon of projectConfig.pwa.icons) {
    const icon = manifest.icons.find(
      (item) => item.src === `./images/${configuredIcon.file}`,
    );
    const file = path.join(root, "images", configuredIcon.file);
    const dimensions = pngDimensions(file);
    expect(`${dimensions.width}x${dimensions.height}`).toBe(icon.sizes);
  }
});

test.each([
  projectConfig.site.url,
  "https://portable.example/npm-template/",
  "https://portable.example/nested/npm%20template/",
])("manifest resources remain scoped when deployed at %s", (deploymentUrl) => {
  const manifest = createManifest();
  const manifestUrl = new URL("manifest.webmanifest", deploymentUrl);
  expect(new URL(manifest.start_url, manifestUrl).href).toBe(deploymentUrl);
  expect(new URL(manifest.scope, manifestUrl).href).toBe(deploymentUrl);
  for (const icon of manifest.icons)
    expect(new URL(icon.src, manifestUrl).pathname).toMatch(/\/images\//);
});

test("manifest validation rejects invalid metadata independently of configuration", () => {
  const manifest = {
    ...createManifest(),
    short_name: " ",
    display: "native-window",
    theme_color: "purple-ish",
    background_color: "#fff",
  };
  expect(manifestMetadataFailures(manifest)).toEqual(
    expect.arrayContaining([
      "Manifest short_name must be a non-empty string",
      "Manifest display mode is invalid: native-window",
      "Manifest theme_color must be a six-digit hex color",
      "Manifest background_color must be a six-digit hex color",
    ]),
  );
});

test("activation removes only obsolete project caches", async () => {
  const { caches, listeners, self } = evaluateWorker();
  let activation;
  listeners.activate({ waitUntil: (promise) => (activation = promise) });
  await activation;
  expect(caches.delete).toHaveBeenCalledTimes(2);
  expect(caches.delete).toHaveBeenCalledWith(
    `${projectConfig.pwa.cachePrefix}0123456789abcdef`,
  );
  expect(caches.delete).toHaveBeenCalledWith(
    `${projectConfig.pwa.cachePrefix}${encodeURIComponent(projectConfig.site.basePath)}-old`,
  );
  expect(caches.delete).not.toHaveBeenCalledWith(
    `${projectConfig.pwa.cachePrefix}${encodeURIComponent("/another/")}-old`,
  );
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
    request: request(projectConfig.site.url, "POST"),
    respondWith,
  });
  listeners.fetch({
    request: request(`https://cdn.example.com${projectConfig.site.basePath}`),
    respondWith,
  });
  listeners.fetch({
    request: request(`${siteOrigin}/another-project/`),
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
        url: projectUrl(
          `assets/example.${destination === "script" ? "js" : "html"}`,
        ),
      },
      respondWith: (promise) => (responsePromise = promise),
    });

    await expect(responsePromise).resolves.toBe(response);
  },
);

test("failed navigation falls back to the deployment homepage", async () => {
  const deploymentUrl = "https://portable.example/nested/npm%20template/";
  const { caches, fetch, listeners } = evaluateWorker(deploymentUrl);
  const home = { source: "offline home" };
  fetch.mockRejectedValue(new Error("Offline"));
  caches.match.mockImplementation(async (request) =>
    request === deploymentUrl ? home : undefined,
  );
  let responsePromise;

  listeners.fetch({
    request: {
      destination: "document",
      method: "GET",
      mode: "navigate",
      url: new URL("api/", deploymentUrl).href,
    },
    respondWith: (promise) => (responsePromise = promise),
  });

  await expect(responsePromise).resolves.toBe(home);
  expect(caches.match).toHaveBeenCalledWith(deploymentUrl);
});

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
        url: projectUrl(`assets/shared.${extension}`),
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
      url: projectUrl(`images/${projectConfig.pwa.icons[0].file}`),
    },
    respondWith: (promise) => (responsePromise = promise),
  });

  await expect(responsePromise).resolves.toBe(cachedResponse);
  expect(fetch).not.toHaveBeenCalled();
});

test("alternate deployments use their own scope and cache namespace", async () => {
  const deploymentUrl = "https://portable.example/nested/npm%20template/";
  const { caches, listeners } = evaluateWorker(deploymentUrl);
  const respondWith = jest.fn();
  listeners.fetch({
    request: {
      destination: "document",
      method: "GET",
      mode: "navigate",
      url: new URL("playground/", deploymentUrl).href,
    },
    respondWith,
  });
  expect(respondWith).toHaveBeenCalledTimes(1);
  await expect(caches.keys()).resolves.toContain(
    `${projectConfig.pwa.cachePrefix}${encodeURIComponent("/nested/npm%20template/")}-old`,
  );
});
