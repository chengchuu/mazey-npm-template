const {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const { createHash } = require("node:crypto");
const path = require("node:path");
const projectConfig = require("../project.config");
const {
  normalizeArtifactFile,
  relativeRootFromFile,
} = require("./site-url-utils");

const defaultRoot = path.resolve(__dirname, "..");
const { displayName } = projectConfig.brand;
const { pages, theme } = projectConfig.site;
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

function apiPageUrl(relativeFile) {
  const route = normalizeArtifactFile(relativeFile).replace(/index\.html$/, "");
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

function rewriteProjectUrls(html, siteRoot) {
  const productionRoot = new URL(projectConfig.site.url);
  return html.replace(
    /\b(href|src)=(['"])(https?:\/\/[^'"]+)\2/gi,
    (attribute, name, quote, value) => {
      let url;
      try {
        url = new URL(value);
      } catch {
        return attribute;
      }
      if (
        url.origin !== productionRoot.origin ||
        !url.pathname.startsWith(productionRoot.pathname)
      )
        return attribute;
      const projectPath = url.pathname.slice(productionRoot.pathname.length);
      return `${name}=${quote}${siteRoot}${projectPath}${url.search}${url.hash}${quote}`;
    },
  );
}

function transformApiHtml(html, relativeFile) {
  const normalizedRelativeFile = normalizeArtifactFile(relativeFile);
  const siteRoot = relativeRootFromFile(`api/${normalizedRelativeFile}`);
  const cleanHtml = rewriteProjectUrls(html, siteRoot)
    .replace(markerExpression(seoStart, seoEnd), "")
    .replace(/<nav class="site-project-links"[\s\S]*?<\/nav>/g, "")
    .replace(markerExpression(pwaUiStart, pwaUiEnd), "");
  const isIndex = normalizedRelativeFile === "index.html";
  const routeName = path.posix.basename(normalizedRelativeFile, ".html");
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
  const url = apiPageUrl(normalizedRelativeFile);
  const themeInitializer = `(()=>{try{const k=${JSON.stringify(theme.storageKey)},v=localStorage.getItem(k)||"system",t=v==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):v,r=t==="dark"?"dark":"light",m=document.querySelector('meta[name="theme-color"][data-theme-color]');document.documentElement.dataset.bsTheme=r;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;if(m)m.content=r==="dark"?m.dataset.themeColorDark:m.dataset.themeColorLight;localStorage.setItem("tsd-theme",v==="system"?"os":v)}catch{}})();`;
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
    `<link rel="icon" href="${siteRoot}images/${projectConfig.assets.faviconFile}" type="image/png"/>`,
    `<link rel="manifest" href="${siteRoot}${projectConfig.pwa.manifestFile}"/>`,
    `<meta name="theme-color" content="${theme.colorLight}" data-theme-color data-theme-color-light="${theme.colorLight}" data-theme-color-dark="${theme.colorDark}"/>`,
    `<style>:root{--project-theme-primary:${theme.colorPrimary};--project-theme-primary-hover:${theme.primary.light.hover};--project-theme-primary-active:${theme.primary.light.active};--project-theme-primary-soft:${theme.primary.light.soft};--project-theme-primary-rgb:${theme.primary.light.rgb};--project-theme-primary-hover-rgb:${theme.primary.light.hoverRgb};--project-theme-primary-dark:${theme.primary.dark.base};--project-theme-primary-dark-hover:${theme.primary.dark.hover};--project-theme-primary-dark-active:${theme.primary.dark.active};--project-theme-primary-dark-soft:${theme.primary.dark.soft};--project-theme-primary-dark-rgb:${theme.primary.dark.rgb};--project-theme-primary-dark-hover-rgb:${theme.primary.dark.hoverRgb};--project-theme-light:${theme.colorLight};--project-theme-dark:${theme.colorDark}}</style>`,
    `<link rel="stylesheet" href="${siteRoot}assets/api.css"/>`,
    '<meta property="og:type" content="website"/>',
    `<meta property="og:site_name" content="${escapeAttribute(displayName)}"/>`,
    `<meta property="og:title" content="${escapeAttribute(title)}"/>`,
    `<meta property="og:description" content="${escapeAttribute(description)}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    '<meta name="twitter:card" content="summary"/>',
    `<meta name="twitter:title" content="${escapeAttribute(title)}"/>`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}"/>`,
    `<script type="application/ld+json">${structuredData}</script>`,
    `<script>${themeInitializer}</script>`,
    `<script src="${siteRoot}assets/api.js" defer></script>`,
    seoEnd,
  ].join("")}`;

  let output = cleanHtml
    .replace(/<title>[^<]*<\/title>/i, "")
    .replace(/<meta name="description"[^>]*>/i, "")
    .replace(/<link rel="canonical"[^>]*>/i, "")
    .replace(/<link rel="icon"[^>]*>/i, "")
    .replace(/<script>[^<]*document\.body\.style\.display[^<]*<\/script>/i, "")
    .replace(/<html\b(?![^>]*data-bs-theme)/i, '<html data-bs-theme="light"')
    .replace("</head>", `${metadata}</head>`);

  const toolbar = '<div class="tsd-toolbar-contents container">';
  if (!output.includes(toolbar))
    throw new Error(`Missing TypeDoc toolbar in ${relativeFile}`);
  output = output.replace(
    toolbar,
    `${toolbar}<nav class="site-project-links" aria-label="Project links"><a href="${siteRoot}">Project home</a><a href="${siteRoot}api/">API overview</a><a href="${projectConfig.urls.npm}">npm package</a><a href="${siteRoot}#install-project-website" data-pwa-install-help>Website app help</a><span class="site-pwa-status" role="status" aria-live="polite" data-pwa-status></span><label class="theme-control"><span>Theme</span><select data-theme-select aria-label="Choose API documentation theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></nav>`,
  );

  output = output.replace(
    /<div class="tsd-theme-toggle">[\s\S]*?<\/div>/,
    '<div class="tsd-theme-toggle"><label class="settings-label" for="mazey-api-theme">Theme</label><select id="mazey-api-theme" data-theme-select aria-label="Choose API documentation theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>',
  );

  if (isIndex) {
    output = output.replace(
      new RegExp(
        `<div class="tsd-page-title">\\s*<h1>${escapeRegExp(displayName)}<\\/h1><\\/div>`,
        "i",
      ),
      "",
    );
  }
  const pwaUi = [
    pwaUiStart,
    '<aside class="site-pwa-update" aria-label="Website update" data-pwa-update hidden>',
    `<span>A new version of the ${escapeAttribute(displayName)} website is available.</span>`,
    '<button type="button" data-pwa-update-now>Update now</button>',
    "</aside>",
    pwaUiEnd,
  ].join("");
  return normalizeHeadingOrder(output.replace("</body>", `${pwaUi}</body>`));
}

function htmlFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    if (statSync(absolute).isDirectory()) return htmlFiles(absolute);
    return absolute.endsWith(".html") ? [absolute] : [];
  });
}

function requirePath(file) {
  if (!existsSync(file))
    throw new Error(`Required Pages source is missing: ${file}`);
}

function fingerprintPages(directory) {
  const hash = createHash("sha256");
  const files = readdirSync(directory)
    .flatMap((name) => {
      const file = path.join(directory, name);
      return statSync(file).isDirectory() ? htmlAndAssetFiles(file) : [file];
    })
    .filter(
      (file) => !file.endsWith("service-worker.js") && !file.endsWith(".map"),
    )
    .sort();
  for (const file of files) {
    hash.update(path.relative(directory, file));
    hash.update("\0");
    hash.update(readFileSync(file));
  }
  return hash.digest("hex").slice(0, 16);
}

function htmlAndAssetFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? htmlAndAssetFiles(file) : [file];
  });
}

function createManifest() {
  return {
    name: projectConfig.pwa.name,
    short_name: projectConfig.pwa.shortName,
    description: projectConfig.pwa.description,
    start_url: "./",
    scope: "./",
    display: projectConfig.pwa.display,
    background_color: projectConfig.pwa.backgroundColor,
    theme_color: projectConfig.pwa.themeColor,
    icons: projectConfig.pwa.icons.map(({ file, purpose, sizes, type }) => ({
      src: `./images/${file}`,
      sizes,
      type,
      purpose,
    })),
  };
}

function replaceWorkerToken(source, token, value) {
  if (!source.includes(token))
    throw new Error(`Service worker token is missing: ${token}`);
  const escaped = JSON.stringify(value).slice(1, -1);
  return source.replaceAll(token, escaped);
}

function renderServiceWorker(source, cacheVersion) {
  return [
    ["__PWA_CACHE_PREFIX__", projectConfig.pwa.cachePrefix],
    ["__PWA_CACHE_VERSION__", cacheVersion],
    ["__PWA_MANIFEST_FILE__", projectConfig.pwa.manifestFile],
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
}

function writePwaAssets(rootDir, docs) {
  const site = path.join(rootDir, "site");
  const images = path.join(rootDir, "images");
  writeFileSync(
    path.join(docs, projectConfig.pwa.manifestFile),
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
  writeFileSync(
    path.join(docs, projectConfig.pwa.serviceWorkerFile),
    renderServiceWorker(workerSource, fingerprintPages(docs)),
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
    path.join(site, projectConfig.pwa.serviceWorkerFile),
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

if (require.main === module) buildPages();

module.exports = {
  apiPageUrl,
  buildPages,
  createManifest,
  fingerprintPages,
  normalizeHeadingOrder,
  renderServiceWorker,
  transformApiHtml,
};
