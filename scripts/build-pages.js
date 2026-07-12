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
const path = require("node:path");
const {
  API_DESCRIPTION,
  API_TITLE,
  API_URL,
  FAVICON_URL,
  GITHUB_URL,
  NPM_URL,
  SITE_URL,
} = require("./site-config");

const defaultRoot = path.resolve(__dirname, "..");

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function apiPageUrl(relativeFile) {
  const route = relativeFile
    .replaceAll(path.sep, "/")
    .replace(/index\.html$/, "");
  return new URL(route, API_URL).href;
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

function transformApiHtml(html, relativeFile) {
  const cleanHtml = html
    .replace(
      /<!-- mazey-npm-template-seo:start -->[\s\S]*?<!-- mazey-npm-template-seo:end -->/g,
      "",
    )
    .replace(/<nav class="mazey-project-links"[\s\S]*?<\/nav>/g, "");
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
    ? API_TITLE
    : isGenericPage
      ? `mazey-npm-template ${routeName.replace(/^./, (value) => value.toUpperCase())} API Reference`
      : `${existingTitle} API Reference`;
  const description = isIndex
    ? API_DESCRIPTION
    : `TypeScript API reference for ${title.replace(/ API Reference$/, "")} in mazey-npm-template.`;
  const url = apiPageUrl(relativeFile);
  const assetPrefix = "../".repeat(
    relativeFile.replaceAll(path.sep, "/").split("/").length,
  );
  const themeInitializer =
    '(()=>{try{const k="mazey-npm-template-theme",v=localStorage.getItem(k)||"system",t=v==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):v,r=t==="dark"?"dark":"light";document.documentElement.dataset.bsTheme=r;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;localStorage.setItem("tsd-theme",v==="system"?"os":v)}catch{}})();';
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: title,
    description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: "mazey-npm-template",
      url: SITE_URL,
    },
    about: {
      "@type": "SoftwareSourceCode",
      name: "mazey-npm-template",
      codeRepository: GITHUB_URL,
      downloadUrl: NPM_URL,
      programmingLanguage: "TypeScript",
    },
  });
  const metadata = `<title>${escapeAttribute(title)}</title>${[
    "<!-- mazey-npm-template-seo:start -->",
    `<meta name="description" content="${escapeAttribute(description)}"/>`,
    `<link rel="canonical" href="${url}"/>`,
    `<link rel="icon" href="${FAVICON_URL}" type="image/png"/>`,
    `<link rel="stylesheet" href="${assetPrefix}assets/api.css"/>`,
    '<meta property="og:type" content="website"/>',
    '<meta property="og:site_name" content="mazey-npm-template"/>',
    `<meta property="og:title" content="${escapeAttribute(title)}"/>`,
    `<meta property="og:description" content="${escapeAttribute(description)}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    '<meta name="twitter:card" content="summary"/>',
    `<meta name="twitter:title" content="${escapeAttribute(title)}"/>`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}"/>`,
    `<script type="application/ld+json">${structuredData}</script>`,
    `<script>${themeInitializer}</script>`,
    `<script src="${assetPrefix}assets/api.js" defer></script>`,
    "<!-- mazey-npm-template-seo:end -->",
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
    `${toolbar}<nav class="mazey-project-links" aria-label="Project links"><a href="${SITE_URL}">Project home</a><a href="${API_URL}">API overview</a><a href="${NPM_URL}">npm package</a><label class="theme-control"><span>Theme</span><select data-theme-select aria-label="Choose API documentation theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></nav>`,
  );

  output = output.replace(
    /<div class="tsd-theme-toggle">[\s\S]*?<\/div>/,
    '<div class="tsd-theme-toggle"><label class="settings-label" for="mazey-api-theme">Theme</label><select id="mazey-api-theme" data-theme-select aria-label="Choose API documentation theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>',
  );

  if (isIndex) {
    output = output.replace(
      /<div class="tsd-page-title">\s*<h1>mazey-npm-template<\/h1><\/div>/i,
      "",
    );
  }
  return normalizeHeadingOrder(output);
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
    path.join(site, "robots.txt"),
    path.join(site, "sitemap.xml"),
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
  for (const name of ["robots.txt", "sitemap.xml"]) {
    cpSync(path.join(site, name), path.join(docs, name));
  }

  for (const file of htmlFiles(api)) {
    const relative = path.relative(api, file);
    writeFileSync(file, transformApiHtml(readFileSync(file, "utf8"), relative));
  }
}

if (require.main === module) buildPages();

module.exports = {
  apiPageUrl,
  buildPages,
  normalizeHeadingOrder,
  transformApiHtml,
};
