import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path, { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import projectConfig from "../project.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(__dirname, "..");
const { displayName } = projectConfig.brand;
const { pages, theme } = projectConfig.site;
const socialImage = projectConfig.seo.openGraphImage;
const markerPrefix = projectConfig.site.markerPrefix;
const seoStart = `<!-- ${markerPrefix}-seo:start -->`;
const seoEnd = `<!-- ${markerPrefix}-seo:end -->`;
const pwaUiStart = `<!-- ${markerPrefix}-pwa-ui:start -->`;
const pwaUiEnd = `<!-- ${markerPrefix}-pwa-ui:end -->`;

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markerExpression(start, end) {
  return new RegExp(
    `${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`,
    "g",
  );
}

function themeToggleHtml() {
  return '<button class="theme-toggle" type="button" data-theme-toggle aria-label="Current theme: Light. Switch to dark theme."><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" focusable="false" data-theme-icon="light"><path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/></svg><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" focusable="false" data-theme-icon="dark" hidden><path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278"/><path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.73 1.73 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.73 1.73 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.73 1.73 0 0 0 1.097-1.097zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/></svg></button>';
}

function apiPageUrl(relativeFile) {
  const route = relativeFile
    .replaceAll(path.sep, "/")
    .replace(/index\.html$/, "");
  return new URL(route, pages.api.url).href;
}

function normalizeHeadingOrder(html) {
  let previousLevel = 0;
  return html.replace(
    /<h([1-6])(\b[^>]*)>([\s\S]*?)<\/h\1>/gi,
    (_heading, rawLevel, attributes, content) => {
      const level = Number(rawLevel);
      const normalized = previousLevel
        ? Math.min(level, previousLevel + 1)
        : level;
      previousLevel = normalized;
      return `<h${normalized}${attributes}>${content}</h${normalized}>`;
    },
  );
}

function ensurePrimaryApiHeading(html, isIndex) {
  let output = html.replace(
    /<div class="tsd-page-title">[\s\S]*?<\/div>/i,
    (pageTitle) =>
      pageTitle.replace(
        /<h([2-6])(\b[^>]*)>([\s\S]*?)<\/h\1>/i,
        "<h1$2>$3</h1>",
      ),
  );
  if (isIndex) {
    output = output.replace(
      /(<div class="tsd-page-title">[\s\S]*?<\/div>[\s\S]*?)<h1(\b[^>]*)>([\s\S]*?)<\/h1>/i,
      "$1<h2$2>$3</h2>",
    );
  }
  return output;
}

function transformApiHtml(html, relativeFile) {
  const cleanHtml = html
    .replace(markerExpression(seoStart, seoEnd), "")
    .replace(/<nav class="site-project-links"[\s\S]*?<\/nav>/g, "")
    .replace(markerExpression(pwaUiStart, pwaUiEnd), "");
  const isIndex = relativeFile === "index.html";
  const routeName = path.basename(relativeFile, ".html");
  const existingTitle = cleanHtml
    .match(/<title>([^<]+)<\/title>/i)?.[1]
    ?.replace(/ API Reference$/, "")
    .trim();
  if (!existingTitle)
    throw new Error(`Missing TypeDoc title in ${relativeFile}`);

  const isGenericPage = ["hierarchy", "modules"].includes(routeName);
  const title = isIndex
    ? pages.api.title
    : isGenericPage
      ? `${displayName} ${routeName.replace(/^./, (value) => value.toUpperCase())} API Reference`
      : `${existingTitle} API Reference`;
  const description = isIndex
    ? pages.api.description
    : `TypeScript API reference for ${title.replace(/ API Reference$/, "")} in ${displayName}.`;
  const url = apiPageUrl(relativeFile);
  const assetPrefix = "../".repeat(
    relativeFile.replaceAll(path.sep, "/").split("/").length,
  );
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: title,
    description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: displayName,
      url: pages.home.url,
    },
    about: projectConfig.seo.software,
  });
  const metadata = `<title>${escapeAttribute(title)}</title>${[
    seoStart,
    `<meta name="description" content="${escapeAttribute(description)}"/>`,
    `<link rel="canonical" href="${url}"/>`,
    `<link rel="icon" href="${projectConfig.assets.faviconUrl}" type="image/png"/>`,
    `<link rel="manifest" href="${projectConfig.pwa.manifestUrl}"/>`,
    `<meta name="theme-color" content="${theme.colorPrimary}" data-theme-color data-theme-color-light="${theme.colorLight}" data-theme-color-dark="${theme.colorDark}"/>`,
    `<style>:root{--project-theme-primary:${theme.colorPrimary};--project-theme-primary-hover:${theme.primary.light.hover};--project-theme-primary-active:${theme.primary.light.active};--project-theme-primary-soft:${theme.primary.light.soft};--project-theme-primary-rgb:${theme.primary.light.rgb};--project-theme-primary-hover-rgb:${theme.primary.light.hoverRgb};--project-theme-primary-dark:${theme.primary.dark.base};--project-theme-primary-dark-hover:${theme.primary.dark.hover};--project-theme-primary-dark-active:${theme.primary.dark.active};--project-theme-primary-dark-soft:${theme.primary.dark.soft};--project-theme-primary-dark-rgb:${theme.primary.dark.rgb};--project-theme-primary-dark-hover-rgb:${theme.primary.dark.hoverRgb};--project-theme-light:${theme.colorLight};--project-theme-dark:${theme.colorDark}}</style>`,
    `<link rel="stylesheet" href="${assetPrefix}assets/api.css"/>`,
    '<meta property="og:type" content="website"/>',
    `<meta property="og:site_name" content="${escapeAttribute(displayName)}"/>`,
    `<meta property="og:title" content="${escapeAttribute(title)}"/>`,
    `<meta property="og:description" content="${escapeAttribute(description)}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    `<meta property="og:image" content="${socialImage.url}"/>`,
    `<meta property="og:image:type" content="${socialImage.type}"/>`,
    `<meta property="og:image:width" content="${socialImage.width}"/>`,
    `<meta property="og:image:height" content="${socialImage.height}"/>`,
    `<meta property="og:image:alt" content="${escapeAttribute(socialImage.alt)}"/>`,
    '<meta name="twitter:card" content="summary_large_image"/>',
    `<meta name="twitter:title" content="${escapeAttribute(title)}"/>`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}"/>`,
    `<meta name="twitter:image" content="${socialImage.url}"/>`,
    `<meta name="twitter:image:alt" content="${escapeAttribute(socialImage.alt)}"/>`,
    `<script type="application/ld+json">${structuredData}</script>`,
    `<script src="${assetPrefix}assets/api.js" defer></script>`,
    seoEnd,
  ].join("")}`;

  let output = cleanHtml
    .replace(/<title>[^<]*<\/title>/i, "")
    .replace(/<meta name="description"[^>]*>/i, "")
    .replace(/<link rel="canonical"[^>]*>/i, "")
    .replace(/<link rel="icon"[^>]*>/i, "")
    .replace(
      /<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?document\.body\.style\.display(?:(?!<\/script>)[\s\S])*?<\/script>/i,
      "",
    )
    .replace(/<html\b(?![^>]*data-bs-theme)/i, '<html data-bs-theme="light"')
    .replace("</head>", `${metadata}</head>`);

  const toolbar = '<div class="tsd-toolbar-contents container">';
  if (!output.includes(toolbar))
    throw new Error(`Missing TypeDoc toolbar in ${relativeFile}`);
  output = output.replace(
    toolbar,
    `${toolbar}<nav class="site-project-links" aria-label="Project links"><a href="${pages.home.url}">Project home</a><a href="${pages.api.url}">API overview</a><a href="${projectConfig.urls.github}">GitHub</a><a href="${projectConfig.urls.npm}">npm package</a><span class="site-pwa-status" role="status" aria-live="polite" data-pwa-status></span>${themeToggleHtml()}</nav>`,
  );

  const pwaUi = [
    pwaUiStart,
    '<aside class="site-pwa-update" aria-label="Website update" data-pwa-update hidden>',
    `<span>A new version of the ${escapeAttribute(displayName)} website is available.</span>`,
    '<button type="button" data-pwa-update-now>Update now</button>',
    "</aside>",
    pwaUiEnd,
  ].join("");
  output = output.replace("</body>", `${pwaUi}</body>`);
  output = ensurePrimaryApiHeading(output, isIndex);
  return normalizeHeadingOrder(output);
}

function htmlFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    if (statSync(absolute).isDirectory()) return htmlFiles(absolute);
    return absolute.endsWith(".html") ? [absolute] : [];
  });
}

function filesIn(directory) {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? filesIn(file) : [file];
  });
}

function requirePath(file) {
  if (!existsSync(file))
    throw new Error(`Required Pages source is missing: ${file}`);
}

function fingerprintPages(directory, additionalSources = []) {
  const hash = createHash("sha256");
  const files = filesIn(directory)
    .filter(
      (file) => !file.endsWith("service-worker.js") && !file.endsWith(".map"),
    )
    .map((file) => ({
      file,
      name: path.relative(directory, file).replaceAll(path.sep, "/"),
    }))
    .sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
  for (const { file, name } of files) {
    const contents = readFileSync(file);
    hash.update(`${Buffer.byteLength(name)}:${name}${contents.byteLength}:`);
    hash.update(contents);
  }
  for (const { name, contents } of additionalSources) {
    hash.update(
      `${Buffer.byteLength(name)}:${name}${Buffer.byteLength(contents)}:`,
    );
    hash.update(contents);
  }
  return hash.digest("hex").slice(0, 16);
}

function createManifest() {
  return {
    name: projectConfig.pwa.name,
    short_name: projectConfig.pwa.shortName,
    description: projectConfig.pwa.description,
    id: projectConfig.site.basePath,
    start_url: projectConfig.site.basePath,
    scope: projectConfig.site.basePath,
    display: projectConfig.pwa.display,
    background_color: projectConfig.pwa.backgroundColor,
    theme_color: projectConfig.pwa.themeColor,
    icons: projectConfig.pwa.icons.map(({ purpose, sizes, src, type }) => ({
      src,
      sizes,
      type,
      purpose,
    })),
  };
}

function apiAppShellAssets(html) {
  const allowedLinkRelations = new Set([
    "icon",
    "manifest",
    "modulepreload",
    "preload",
    "stylesheet",
  ]);
  const assets = new Set();
  for (const match of html.matchAll(/<(link|script|use)\b[^>]*>/gi)) {
    const tagName = match[1].toLowerCase();
    const attributes = Object.fromEntries(
      [...match[0].matchAll(/([:\w-]+)(?:=["']([^"']*)["'])?/g)].map(
        (attribute) => [attribute[1].toLowerCase(), attribute[2] ?? ""],
      ),
    );
    if (
      tagName === "link" &&
      !String(attributes.rel)
        .toLowerCase()
        .split(/\s+/)
        .some((relation) => allowedLinkRelations.has(relation))
    )
      continue;

    const reference = attributes.src || attributes.href;
    if (!reference) continue;
    const assetUrl = new URL(reference, pages.api.url);
    if (
      assetUrl.origin !== new URL(projectConfig.site.url).origin ||
      !assetUrl.pathname.startsWith(projectConfig.site.basePath)
    )
      continue;

    assetUrl.hash = "";
    assets.add(`${assetUrl.pathname}${assetUrl.search}`);
  }
  return [...assets].sort();
}

function replaceWorkerToken(source, token, value) {
  if (!source.includes(token))
    throw new Error(`Service worker token is missing: ${token}`);
  const escaped = JSON.stringify(value).slice(1, -1);
  return source.replaceAll(token, escaped);
}

function renderServiceWorker(source, cacheVersion, apiAssets = []) {
  return [
    ["__PWA_PROJECT_BASE__", projectConfig.site.basePath],
    ["__PWA_CACHE_PREFIX__", projectConfig.pwa.cachePrefix],
    ["__PWA_CACHE_VERSION__", cacheVersion],
    ["__PWA_API_APP_SHELL__", JSON.stringify(apiAssets)],
  ].reduce(
    (rendered, [token, value]) => replaceWorkerToken(rendered, token, value),
    source,
  );
}

function writeSeoAssets(docs) {
  writeFileSync(
    path.join(docs, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${projectConfig.urls.sitemap}\n`,
  );
  const locations = [pages.home.url, pages.api.url, pages.playground.url]
    .map((url) => `  <url>\n    <loc>${escapeAttribute(url)}</loc>\n  </url>`)
    .join("\n");
  writeFileSync(
    path.join(docs, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations}\n</urlset>\n`,
  );
  writeFileSync(path.join(docs, ".nojekyll"), "");
}

function writePwaAssets(rootDir, docs) {
  const site = path.join(rootDir, "site");
  const images = path.join(rootDir, "images");
  writeFileSync(
    path.join(docs, "manifest.webmanifest"),
    `${JSON.stringify(createManifest(), null, 2)}\n`,
  );
  mkdirSync(path.join(docs, "images"), { recursive: true });
  for (const icon of projectConfig.pwa.icons) {
    cpSync(path.join(images, icon.file), path.join(docs, "images", icon.file));
  }

  const workerSource = readFileSync(
    path.join(site, "service-worker.js"),
    "utf8",
  );
  const apiAssets = apiAppShellAssets(
    readFileSync(path.join(docs, "api", "index.html"), "utf8"),
  );
  for (const asset of apiAssets) {
    const assetUrl = new URL(asset, projectConfig.site.url);
    let relativeAsset;
    try {
      relativeAsset = decodeURIComponent(
        assetUrl.pathname.slice(projectConfig.site.basePath.length),
      );
    } catch {
      throw new Error(`API app-shell asset has invalid encoding: ${asset}`);
    }
    const assetFile = path.resolve(docs, relativeAsset);
    const relativeAssetFile = path.relative(docs, assetFile);
    if (
      relativeAssetFile === ".." ||
      relativeAssetFile.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeAssetFile)
    )
      throw new Error(`API app-shell asset leaves Pages output: ${asset}`);
    requirePath(assetFile);
  }
  const workerInputs = JSON.stringify({
    apiAssets,
    cachePrefix: projectConfig.pwa.cachePrefix,
    projectBase: projectConfig.site.basePath,
    workerSource,
  });
  writeFileSync(
    path.join(docs, "service-worker.js"),
    renderServiceWorker(
      workerSource,
      fingerprintPages(docs, [
        {
          name: "generated/service-worker-inputs.json",
          contents: workerInputs,
        },
      ]),
      apiAssets,
    ),
  );
}

function buildPages({ rootDir = defaultRoot } = {}) {
  const docs = path.join(rootDir, "docs");
  const api = path.join(docs, "api");
  const dist = path.join(rootDir, "dist-dev");
  const site = path.join(rootDir, "site");
  const required = [
    api,
    path.join(dist, "index.html"),
    path.join(dist, "playground", "index.html"),
    path.join(dist, "assets", "api.css"),
    path.join(dist, "assets", "api.js"),
    path.join(dist, "images", socialImage.file),
    path.join(site, "service-worker.js"),
    ...projectConfig.pwa.icons.map((icon) =>
      path.join(rootDir, "images", icon.file),
    ),
  ];
  required.forEach(requirePath);

  mkdirSync(docs, { recursive: true });
  for (const name of readdirSync(docs)) {
    if (name !== "api")
      rmSync(path.join(docs, name), { recursive: true, force: true });
  }
  for (const name of readdirSync(dist)) {
    cpSync(path.join(dist, name), path.join(docs, name), { recursive: true });
  }
  writeSeoAssets(docs);

  for (const file of htmlFiles(api)) {
    const relative = path.relative(api, file);
    writeFileSync(file, transformApiHtml(readFileSync(file, "utf8"), relative));
  }
  writePwaAssets(rootDir, docs);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  buildPages();

export {
  apiAppShellAssets,
  apiPageUrl,
  buildPages,
  createManifest,
  ensurePrimaryApiHeading,
  fingerprintPages,
  normalizeHeadingOrder,
  renderServiceWorker,
  transformApiHtml,
};
