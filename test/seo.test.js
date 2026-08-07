/** @jest-environment node */
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildPages,
  fingerprintPages,
  normalizeHeadingOrder,
  transformApiHtml,
} from "../scripts/build-pages.js";
import {
  localFragmentError,
  localFragmentErrors,
} from "../scripts/validate-seo.js";
import projectConfig from "../project.config.js";

const { displayName } = projectConfig.brand;
const { pages } = projectConfig.site;

const typeDocHtml = `<!doctype html><html><head><title>${displayName}</title><meta name="description" content="old"><link rel="canonical" href="https://example.com/"><link rel="icon" href="old.png"></head><body><script>document.body.style.display="none"</script><header><div class="tsd-toolbar-contents container"><button id="tsd-search-trigger" aria-label="Search"></button><dialog id="tsd-search"><input id="tsd-search-input"><ul id="tsd-search-results"></ul></dialog></div></header><div class="tsd-page-title"><h1>${displayName}</h1></div><main><h1>${displayName}</h1><h2>API</h2><p>Public API documentation content.</p></main></body></html>`;

function expectNavigationLabel(html, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  expect(html).toMatch(new RegExp(`>\\s*${escapedLabel}\\s*</a>`));
}

test("site navigation and hero styling follow the shared template convention", () => {
  const homeHtml = readFileSync(
    path.join(process.cwd(), "site", "index.html"),
    "utf8",
  );
  const playgroundHtml = readFileSync(
    path.join(process.cwd(), "examples", "index.html"),
    "utf8",
  );

  for (const html of [homeHtml, playgroundHtml]) {
    for (const label of [
      "Home",
      "Playground",
      "Install",
      "Usage",
      "API",
      "GitHub",
      "npm",
    ]) {
      expectNavigationLabel(html, label);
    }
    expect(html).not.toContain(">Installation</a>");
    expect(html).not.toContain(">API/Docs</a>");
    expect(html).not.toContain("localStorage.getItem");
    expect(html).not.toContain("THEME_STORAGE_KEY_JSON");
  }

  expect(homeHtml).toContain('href="#install">Install</a>');
  expect(homeHtml).toContain('id="install"');
  expect(homeHtml).toContain('<h2 id="install-title">Install</h2>');
  expect(homeHtml).toContain('href="#usage">Usage</a>');
  expect(homeHtml).toContain('id="usage"');
  expect(homeHtml).toContain('<h2 id="usage-title">Usage</h2>');
  expect(homeHtml).toContain('id="website-app-help"');
  expect(homeHtml).toContain(
    '<h2 id="website-app-help-title">Website app help</h2>',
  );
  expect(playgroundHtml).toContain('href="../#install">Install</a>');
  expect(playgroundHtml).toContain('href="../#usage">Usage</a>');
  expect(playgroundHtml).toContain(
    'href="../#website-app-help">Website app help</a>',
  );

  for (const html of [homeHtml, playgroundHtml]) {
    expect(html).not.toContain("#installation");
    expect(html).not.toContain("#install-project-website");
  }

  const css = readFileSync(
    path.join(process.cwd(), "site", "site.css"),
    "utf8",
  );
  expect(css).toMatch(
    /\.hero\s*{[\s\S]*?radial-gradient\([\s\S]*?var\(--mn-primary-soft\)[\s\S]*?var\(--mn-surface\);[\s\S]*?}/,
  );
  expect(css).toMatch(
    /\.site-header\s*{[^}]*background:\s*var\(--mn-background\);[^}]*}/,
  );
});

test("generated cross-page fragment links resolve inside the Pages artifact", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "mazey-fragments-"));
  const homeFile = path.join(rootDir, "index.html");
  const playgroundFile = path.join(rootDir, "playground", "index.html");

  try {
    mkdirSync(path.dirname(playgroundFile), { recursive: true });
    writeFileSync(homeFile, '<section id="install"><h2>Install</h2></section>');
    writeFileSync(playgroundFile, "<main></main>");

    expect(
      localFragmentError(playgroundFile, "../#install", rootDir),
    ).toBeNull();
    expect(
      localFragmentError(playgroundFile, "../?view=compact#install", rootDir),
    ).toBeNull();
    expect(
      localFragmentError(
        playgroundFile,
        "mailto:docs@example.com#install",
        rootDir,
      ),
    ).toBeNull();
    expect(localFragmentError(playgroundFile, "../#missing", rootDir)).toBe(
      "fragment target #missing is missing for ../#missing",
    );

    writeFileSync(homeFile, '<section data-id="install"></section>');
    expect(localFragmentError(playgroundFile, "../#install", rootDir)).toBe(
      "fragment target #install is missing for ../#install",
    );

    writeFileSync(
      homeFile,
      "<script>const example = '<section id=\"install\"></section>';</script>",
    );
    expect(localFragmentError(playgroundFile, "../#install", rootDir)).toBe(
      "fragment target #install is missing for ../#install",
    );
    expect(
      localFragmentErrors(
        playgroundFile,
        '<a href="../#install">Install</a><a href="#">Menu</a>',
        rootDir,
      ),
    ).toEqual(["fragment target #install is missing for ../#install"]);
    expect(
      localFragmentErrors(
        playgroundFile,
        '<script>const link = \'<a href="../#install">Install</a>\';</script><style>.example::after { content: \'<a href="../#install">\'; }</style><!-- <a href="../#install"> -->',
        rootDir,
      ),
    ).toEqual([]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("API metadata transformation is complete and idempotent", () => {
  const transformed = transformApiHtml(typeDocHtml, "index.html");
  const theme = projectConfig.site.theme;
  expect(transformApiHtml(transformed, "index.html")).toBe(transformed);
  expect(transformed).toContain(
    `<link rel="canonical" href="${pages.api.url}"/>`,
  );
  expect(transformed).toContain(
    `<link rel="icon" href="${projectConfig.assets.faviconUrl}" type="image/png"/>`,
  );
  expect(transformed).toContain(`<a href="${pages.home.url}">Project home</a>`);
  expect(transformed).toContain(`<a href="${pages.api.url}">API overview</a>`);
  expect(transformed).toContain(
    `<a href="${projectConfig.urls.github}">GitHub</a>`,
  );
  expect(transformed).toContain(
    `<a href="${projectConfig.urls.npm}">npm package</a>`,
  );
  expect(transformed).not.toContain("Website app help");
  expect(transformed).toContain(
    `<meta property="og:image" content="${projectConfig.seo.openGraphImage.url}"/>`,
  );
  expect(transformed).toContain(
    '<meta name="twitter:card" content="summary_large_image"/>',
  );
  expect(transformed).toContain('href="../assets/api.css"');
  expect(transformed).toContain('src="../assets/api.js"');
  expect(transformed).toContain(
    `<meta name="theme-color" content="${theme.colorPrimary}" data-theme-color data-theme-color-light="${theme.colorLight}" data-theme-color-dark="${theme.colorDark}"/>`,
  );
  expect(transformed).not.toMatch(/<button\b[^>]*data-pwa-install\b/);
  expect(transformed.match(/<h1\b/g)).toHaveLength(1);
  expect(transformed.match(/<h([1-6])\b/i)?.[1]).toBe("1");
  expect(transformed).toContain('id="tsd-search-trigger"');
  expect(transformed).toContain('<dialog id="tsd-search"');
  expect(transformed).not.toContain('document.body.style.display="none"');
  expect(transformed).not.toContain("localStorage.getItem");
  expect(transformed).not.toContain('localStorage.setItem("tsd-theme"');
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

test("Pages assembly rejects missing TypeDoc app-shell assets", () => {
  const rootDir = mkdtempSync(
    path.join(os.tmpdir(), "mazey-pages-missing-api-asset-"),
  );
  const files = {
    "docs/api/index.html": typeDocHtml.replace(
      "</head>",
      '<script src="assets/missing.js"></script></head>',
    ),
    "dist-dev/index.html": "<html><body><h1>Home</h1></body></html>",
    "dist-dev/playground/index.html":
      "<html><body><h1>Playground</h1></body></html>",
    "dist-dev/assets/api.css": "body {}",
    "dist-dev/assets/api.js": "void 0;",
    [`dist-dev/images/${projectConfig.assets.faviconFile}`]: "favicon",
    [`dist-dev/images/${projectConfig.seo.openGraphImage.file}`]:
      "open graph image",
    "site/service-worker.js":
      'const base = "__PWA_PROJECT_BASE__"; const prefix = "__PWA_CACHE_PREFIX__"; const version = "__PWA_CACHE_VERSION__"; const api = JSON.parse("__PWA_API_APP_SHELL__");\n',
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

    expect(() => buildPages({ rootDir })).toThrow(
      /Required Pages source is missing: .*api[/\\]assets[/\\]missing\.js/,
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
    [`dist-dev/images/${projectConfig.assets.faviconFile}`]: "favicon",
    [`dist-dev/images/${projectConfig.seo.openGraphImage.file}`]:
      "open graph image",
    "site/service-worker.js":
      'const base = "__PWA_PROJECT_BASE__"; const prefix = "__PWA_CACHE_PREFIX__"; const version = "__PWA_CACHE_VERSION__"; const api = JSON.parse("__PWA_API_APP_SHELL__");\n',
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

test("Pages fingerprint changes when the service worker source changes", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "mazey-pages-worker-"));
  try {
    writeFileSync(path.join(directory, "index.html"), "same page");
    const first = fingerprintPages(directory, [
      { name: "site/service-worker.js", contents: "worker version one" },
    ]);
    const second = fingerprintPages(directory, [
      { name: "site/service-worker.js", contents: "worker version two" },
    ]);
    expect(second).not.toBe(first);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("project-root fragment links resolve inside the Pages artifact", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "mazey-root-fragments-"));
  const homeFile = path.join(rootDir, "index.html");
  const playgroundFile = path.join(rootDir, "playground", "index.html");

  try {
    mkdirSync(path.dirname(playgroundFile), { recursive: true });
    writeFileSync(homeFile, '<section id="install"><h2>Install</h2></section>');
    writeFileSync(playgroundFile, "<main></main>");

    expect(
      localFragmentError(
        playgroundFile,
        `${projectConfig.site.basePath}#install`,
        rootDir,
      ),
    ).toBeNull();
    expect(
      localFragmentError(playgroundFile, "/another-project/#install", rootDir),
    ).toBe(
      "fragment link leaves the Pages artifact: /another-project/#install",
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("API transformation preserves unrelated inline scripts", () => {
  const source = typeDocHtml.replace(
    '<script>document.body.style.display="none"</script>',
    '<script>window.keepMe = true;</script><script>\n  document.body.style.display = "none";\n</script>',
  );
  const transformed = transformApiHtml(source, "index.html");

  expect(transformed).toContain("window.keepMe = true;");
  expect(transformed).not.toContain("document.body.style.display");
});

test("Pages fingerprints frame filenames and contents unambiguously", () => {
  const firstDirectory = mkdtempSync(
    path.join(os.tmpdir(), "mazey-pages-frame-a-"),
  );
  const secondDirectory = mkdtempSync(
    path.join(os.tmpdir(), "mazey-pages-frame-b-"),
  );

  try {
    writeFileSync(path.join(firstDirectory, "a"), "bc");
    writeFileSync(path.join(firstDirectory, "d"), "e");
    writeFileSync(path.join(secondDirectory, "a"), "b");
    writeFileSync(path.join(secondDirectory, "cd"), "e");

    expect(fingerprintPages(firstDirectory)).not.toBe(
      fingerprintPages(secondDirectory),
    );
  } finally {
    rmSync(firstDirectory, { recursive: true, force: true });
    rmSync(secondDirectory, { recursive: true, force: true });
  }
});
