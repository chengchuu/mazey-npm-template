/** @jest-environment node */

import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import projectConfig from "../project.config.js";
import { createManifest, renderServiceWorker } from "../scripts/build-pages.js";
import {
  manifestMetadataFailures,
  pngDimensions,
} from "../scripts/validate-pwa.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const siteOrigin = new URL(projectConfig.site.url).origin;
const projectUrl = (relative = "") =>
  new URL(relative, projectConfig.site.url).href;

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
      `${projectConfig.pwa.cachePrefix}old`,
      `${projectConfig.pwa.cachePrefix}test-version`,
      "unrelated-cache",
    ]),
    match: jest.fn(),
    open: jest.fn(async () => runtimeCache),
  };
  const self = {
    addEventListener: (name, listener) => (listeners[name] = listener),
    clients: { claim: jest.fn(async () => undefined) },
    location: { origin: siteOrigin },
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
  expect(manifest.id).toBe(projectConfig.site.basePath);
  expect(manifest.start_url).toBe(projectConfig.site.basePath);
  expect(manifest.scope).toBe(projectConfig.site.basePath);
  expect(manifest.display).toBe("standalone");
  for (const configuredIcon of projectConfig.pwa.icons) {
    const icon = manifest.icons.find((item) => item.src === configuredIcon.src);
    const file = path.join(root, "images", configuredIcon.file);
    const dimensions = pngDimensions(file);
    expect(`${dimensions.width}x${dimensions.height}`).toBe(icon.sizes);
  }
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
  expect(caches.delete).toHaveBeenCalledTimes(1);
  expect(caches.delete).toHaveBeenCalledWith(
    `${projectConfig.pwa.cachePrefix}old`,
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
      url: projectConfig.pwa.icons[0].src.startsWith("/")
        ? `${siteOrigin}${projectConfig.pwa.icons[0].src}`
        : projectConfig.pwa.icons[0].src,
    },
    respondWith: (promise) => (responsePromise = promise),
  });

  await expect(responsePromise).resolves.toBe(cachedResponse);
  expect(fetch).not.toHaveBeenCalled();
});
