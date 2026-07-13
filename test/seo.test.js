/** @jest-environment node */
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  buildPages,
  normalizeHeadingOrder,
  transformApiHtml,
} = require("../scripts/build-pages");
const projectConfig = require("../project.config");

const { displayName } = projectConfig.brand;
const { pages } = projectConfig.site;

const typeDocHtml = `<!doctype html><html><head><title>${displayName}</title><meta name="description" content="old"><link rel="canonical" href="https://example.com/"><link rel="icon" href="old.png"></head><body><script>document.body.style.display="none"</script><header><div class="tsd-toolbar-contents container"></div></header><div class="tsd-page-title"><h1>${displayName}</h1></div><main><h1>${displayName}</h1><h2>API</h2><p>Public API documentation content.</p></main></body></html>`;

test("API metadata transformation is complete and idempotent", () => {
  const transformed = transformApiHtml(typeDocHtml, "index.html");
  expect(transformApiHtml(transformed, "index.html")).toBe(transformed);
  expect(transformed).toContain(
    `<link rel="canonical" href="${pages.api.url}"/>`,
  );
  expect(transformed).toContain(
    `<link rel="icon" href="${projectConfig.assets.faviconUrl}" type="image/png"/>`,
  );
  expect(transformed).toContain(`<a href="${pages.home.url}">Project home</a>`);
  expect(transformed).toContain('href="../assets/api.css"');
  expect(transformed).toContain('src="../assets/api.js"');
  expect(transformed).not.toMatch(/<button\b[^>]*data-pwa-install\b/);
  expect(transformed.match(/<h1\b/g)).toHaveLength(1);
  expect(transformed).not.toContain('document.body.style.display="none"');
  expect(() =>
    JSON.parse(
      transformed.match(
        /<script type="application\/ld\+json">([^<]+)<\/script>/,
      )[1],
    ),
  ).not.toThrow();
});

test("API subpages receive self-referencing canonical URLs", () => {
  const source = `<html><head><title>createGreeting | ${displayName}</title></head><body><header><div class="tsd-toolbar-contents container"></div></header><main><h1>createGreeting</h1></main></body></html>`;
  const transformed = transformApiHtml(source, "functions/createGreeting.html");
  expect(transformed).toContain(
    `href="${new URL("functions/createGreeting.html", pages.api.url).href}"`,
  );
  expect(transformed).toContain('href="../../assets/api.css"');
  expect(transformed).toContain(
    `createGreeting | ${displayName} API Reference`,
  );
});

test("generated TypeDoc headings are normalized without changing content", () => {
  expect(
    normalizeHeadingOrder(
      '<main><h1 id="entry">Entry</h1><h4 id="signature">Signature</h4><h5>Returns</h5></main>',
    ),
  ).toBe(
    '<main><h1 id="entry">Entry</h1><h2 id="signature">Signature</h2><h3>Returns</h3></main>',
  );
});

test("Pages assembly fails clearly for missing sources", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "mazey-pages-missing-"));
  try {
    expect(() => buildPages({ rootDir })).toThrow(
      /Required Pages source is missing/,
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("Pages assembly is repeatable without duplicating API metadata", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "mazey-pages-repeat-"));
  const files = {
    "docs/api/index.html": typeDocHtml,
    "dist-dev/index.html": "<html><body><h1>Home</h1></body></html>",
    "dist-dev/playground/index.html":
      "<html><body><h1>Playground</h1></body></html>",
    "dist-dev/assets/api.css": "body {}",
    "dist-dev/assets/api.js": "void 0;",
    "site/service-worker.js":
      'const base = "__PWA_PROJECT_BASE__"; const prefix = "__PWA_CACHE_PREFIX__"; const version = "__PWA_CACHE_VERSION__";\n',
    ...Object.fromEntries(
      projectConfig.pwa.icons.map((icon) => [
        `images/${icon.file}`,
        icon.sizes,
      ]),
    ),
  };
  try {
    for (const [relative, contents] of Object.entries(files)) {
      const file = path.join(rootDir, relative);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, contents);
    }
    buildPages({ rootDir });
    const first = readFileSync(
      path.join(rootDir, "docs/api/index.html"),
      "utf8",
    );
    const firstWorker = readFileSync(
      path.join(rootDir, "docs/service-worker.js"),
      "utf8",
    );
    buildPages({ rootDir });
    const second = readFileSync(
      path.join(rootDir, "docs/api/index.html"),
      "utf8",
    );
    expect(second).toBe(first);
    expect(
      readFileSync(path.join(rootDir, "docs/service-worker.js"), "utf8"),
    ).toBe(firstWorker);
    expect(
      second.match(
        new RegExp(`${projectConfig.site.markerPrefix}-seo:start`, "g"),
      ),
    ).toHaveLength(1);
    expect(
      second.match(
        new RegExp(`${projectConfig.site.markerPrefix}-pwa-ui:start`, "g"),
      ),
    ).toHaveLength(1);
    expect(firstWorker).not.toMatch(/__PWA_[A-Z_]+__/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
