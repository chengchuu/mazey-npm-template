/** @jest-environment node */

import { jest } from "@jest/globals";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import projectConfig from "../project.config.js";
import {
  apiAppShellAssets,
  createManifest,
  renderServiceWorker,
} from "../scripts/build-pages.js";
import {
  hasPwaRuntimeReference,
  manifestMetadataFailures,
  pngDimensions,
  validatePwa,
} from "../scripts/validate-pwa.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const siteOrigin = new URL(projectConfig.site.url).origin;
const projectUrl = (relative = "") =>
  new URL(relative, projectConfig.site.url).href;

const apiAssets = [
  `${projectConfig.site.basePath}api/assets/icons.svg`,
  `${projectConfig.site.basePath}api/assets/main.js`,
  `${projectConfig.site.basePath}api/assets/style.css`,
];

function evaluateWorker({ discoveredApiAssets = [] } = {}) {
  const listeners = {};
  const deleted = [];
  const runtimeCache = {
    delete: jest.fn(),
    keys: jest.fn(async () => []),
    match: jest.fn(),
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
    discoveredApiAssets,
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

test("API app-shell assets include local TypeDoc dependencies", () => {
  const html = `
    <link rel="canonical" href="${projectConfig.site.pages.api.url}">
    <link rel="stylesheet" href="assets/style.css">
    <script src="assets/main.js"></script>
    <svg><use href="assets/icons.svg#icon-search"></use></svg>
    <script src="https://cdn.example.com/external.js"></script>
  `;

  expect(apiAppShellAssets(html)).toEqual(apiAssets);
});

test("package-source validation detects PWA runtime access", () => {
  expect(hasPwaRuntimeReference("navigator.serviceWorker.ready")).toBe(true);
  expect(hasPwaRuntimeReference('navigator["serviceWorker"].controller')).toBe(
    true,
  );
  expect(hasPwaRuntimeReference("const serviceWorkerUrl = '/worker.js';")).toBe(
    false,
  );
});

test("app-shell installation precaches TypeDoc dependencies", async () => {
  const { fetch, listeners, runtimeCache } = evaluateWorker({
    discoveredApiAssets: apiAssets,
  });
  fetch.mockResolvedValue({ ok: true, status: 200, type: "basic" });
  let installation;

  listeners.install({ waitUntil: (promise) => (installation = promise) });
  await installation;

  const fetchedUrls = fetch.mock.calls.map(([url]) => url);
  expect(fetchedUrls).toContain(
    `${projectConfig.site.basePath}assets/playground.css`,
  );
  for (const asset of apiAssets) {
    expect(fetchedUrls).toContain(asset);
    expect(runtimeCache.put).toHaveBeenCalledWith(
      asset,
      expect.objectContaining({ ok: true }),
    );
  }
});

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

test("PNG validation reports a truncated IHDR without a RangeError", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "mazey-png-header-"));
  const file = path.join(rootDir, "truncated.png");
  try {
    writeFileSync(file, Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"));
    expect(() => pngDimensions(file)).toThrow(/truncated PNG IHDR chunk/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("PNG validation rejects incomplete and invalid IHDR data", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "mazey-png-ihdr-"));
  const file = path.join(rootDir, "invalid.png");
  const contents = Buffer.alloc(33);
  Buffer.from("89504e470d0a1a0a", "hex").copy(contents);
  contents.writeUInt32BE(13, 8);
  contents.write("IHDR", 12, "ascii");
  contents.writeUInt32BE(192, 16);
  contents.writeUInt32BE(192, 20);
  try {
    writeFileSync(file, contents.subarray(0, 24));
    expect(() => pngDimensions(file)).toThrow(/truncated PNG IHDR chunk/);

    contents.writeUInt32BE(12, 8);
    writeFileSync(file, contents);
    expect(() => pngDimensions(file)).toThrow(/invalid PNG IHDR length 12/);

    contents.writeUInt32BE(13, 8);
    contents.writeUInt32BE(0, 16);
    writeFileSync(file, contents);
    expect(() => pngDimensions(file)).toThrow(
      /PNG dimensions must be positive/,
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
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
  expect(manifestMetadataFailures(null)).toEqual([
    "Manifest must be a JSON object",
  ]);
  expect(
    manifestMetadataFailures({ ...createManifest(), icons: {} }),
  ).toContain("Manifest icons must be an array");
});

test.each([
  ["a non-object manifest", "null", /Manifest must be a JSON object/],
  [
    "a malformed icon entry",
    JSON.stringify({ ...createManifest(), icons: [null] }),
    /Manifest icons must contain objects/,
  ],
  [
    "a non-string icon URL",
    JSON.stringify({ ...createManifest(), icons: [{ src: 42 }] }),
    /Manifest icon URL must start/,
  ],
])("PWA validation reports %s without crashing", (_label, contents, error) => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "mazey-pwa-manifest-"));
  try {
    mkdirSync(path.join(rootDir, "docs"), { recursive: true });
    mkdirSync(path.join(rootDir, "src"), { recursive: true });
    writeFileSync(path.join(rootDir, "docs", "manifest.webmanifest"), contents);

    expect(() => validatePwa({ rootDir })).toThrow(error);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("PWA validation rejects manifest icon paths outside docs", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "mazey-pwa-icon-path-"));
  try {
    mkdirSync(path.join(rootDir, "docs"), { recursive: true });
    mkdirSync(path.join(rootDir, "src"), { recursive: true });
    writeFileSync(
      path.join(rootDir, "outside.png"),
      readFileSync(path.join(root, "images", projectConfig.pwa.icons[0].file)),
    );
    const manifest = createManifest();
    manifest.icons[0] = {
      ...manifest.icons[0],
      src: `${projectConfig.site.basePath}../outside.png`,
    };
    writeFileSync(
      path.join(rootDir, "docs", "manifest.webmanifest"),
      JSON.stringify(manifest),
    );

    expect(() => validatePwa({ rootDir })).toThrow(
      /Manifest icon must stay inside docs/,
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
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
  const { fetch, listeners, runtimeCache } = evaluateWorker();
  const cachedResponse = { source: "cache" };
  runtimeCache.match.mockResolvedValue(cachedResponse);
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

test("runtime cache trimming preserves precached app-shell entries", async () => {
  const { fetch, listeners, runtimeCache } = evaluateWorker();
  const shellRequest = { url: projectConfig.site.url };
  const runtimeRequests = Array.from({ length: 97 }, (_, index) => ({
    url: new URL(`api/functions/example-${index}.html`, projectConfig.site.url)
      .href,
  }));
  runtimeCache.keys.mockResolvedValue([shellRequest, ...runtimeRequests]);
  fetch.mockResolvedValue({
    clone: jest.fn(() => ({ cached: true })),
    ok: true,
    status: 200,
    type: "basic",
  });
  let responsePromise;

  listeners.fetch({
    request: {
      destination: "document",
      method: "GET",
      mode: "navigate",
      url: runtimeRequests.at(-1).url,
    },
    respondWith: (promise) => (responsePromise = promise),
  });
  await responsePromise;

  expect(runtimeCache.delete).toHaveBeenCalledWith(runtimeRequests[0]);
  expect(runtimeCache.delete).not.toHaveBeenCalledWith(shellRequest);
});

test("failed app-shell precaching aborts installation and removes partial cache", async () => {
  const { caches, fetch, listeners } = evaluateWorker();
  fetch.mockRejectedValue(new Error("Network unavailable"));
  let installation;

  listeners.install({ waitUntil: (promise) => (installation = promise) });

  await expect(installation).rejects.toThrow("Network unavailable");
  expect(caches.delete).toHaveBeenCalledWith(
    `${projectConfig.pwa.cachePrefix}test-version`,
  );
});

test("offline responses come only from the current project cache", async () => {
  const { caches, fetch, listeners, runtimeCache } = evaluateWorker();
  const currentResponse = { source: "current project cache" };
  runtimeCache.match.mockResolvedValue(currentResponse);
  caches.match.mockResolvedValue({ source: "unrelated cache" });
  fetch.mockRejectedValue(new Error("Offline"));
  let responsePromise;
  const request = {
    destination: "script",
    method: "GET",
    mode: "no-cors",
    url: projectUrl("assets/shared.js"),
  };

  listeners.fetch({
    request,
    respondWith: (promise) => (responsePromise = promise),
  });

  await expect(responsePromise).resolves.toBe(currentResponse);
  expect(runtimeCache.match).toHaveBeenCalledWith(request);
  expect(caches.match).not.toHaveBeenCalled();
});
