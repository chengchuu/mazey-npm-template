const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const path = require("node:path");
const projectConfig = require("../project.config");
const {
  artifactPathToFile,
  relativeRootFromFile,
  resolveArtifactReference,
} = require("./site-url-utils");

const sitePages = projectConfig.site.pages;

const root = path.resolve(__dirname, "..");
const docs = path.join(root, "docs");
const failures = [];
const portableDeploymentUrls = [
  projectConfig.site.url,
  "https://portable.example/npm-template/",
  "https://portable.example/nested/npm%20template/",
];

function fail(message) {
  failures.push(message);
}

function matches(html, expression) {
  return [...html.matchAll(expression)];
}

function tagAttributes(tag) {
  return Object.fromEntries(
    matches(tag, /([:\w-]+)=["']([^"']*)["']/g).map((item) => [
      item[1].toLowerCase(),
      item[2],
    ]),
  );
}

function attribute(html, tag, name, value) {
  const tags = matches(html, new RegExp(`<${tag}\\b[^>]*>`, "gi"));
  for (const match of tags) {
    const attributes = tagAttributes(match[0]);
    if (attributes[name] === value) return attributes;
  }
  return null;
}

function filesWithExtension(directory, extension) {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory())
      return filesWithExtension(file, extension);
    return file.endsWith(extension) ? [file] : [];
  });
}

function portableHtmlReferences(html) {
  return matches(html, /<(a|img|link|script)\b[^>]*>/gi).flatMap((match) => {
    const tag = match[1].toLowerCase();
    const attributes = tagAttributes(match[0]);
    if (
      tag === "link" &&
      ["canonical", "sitemap"].includes(attributes.rel?.toLowerCase())
    )
      return [];
    const reference =
      tag === "script" || tag === "img" ? attributes.src : attributes.href;
    if (!reference || reference.startsWith("#")) return [];
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) {
      try {
        const url = new URL(reference, projectConfig.site.url);
        const productionRoot = new URL(projectConfig.site.url);
        if (
          url.origin !== productionRoot.origin ||
          !url.pathname.startsWith(productionRoot.pathname)
        )
          return [];
      } catch {
        return [];
      }
    }
    return [{ reference, tag }];
  });
}

function portableCssReferences(css) {
  return matches(css, /url\(\s*(["']?)([^"')]+)\1\s*\)/gi)
    .map((match) => match[2].trim())
    .filter(
      (reference) =>
        reference &&
        !reference.startsWith("#") &&
        !/^(?:data:|[a-z][a-z\d+.-]*:|\/\/)/i.test(reference),
    );
}

function validateArtifactReferences({
  artifactRoot = docs,
  deploymentUrls = portableDeploymentUrls,
} = {}) {
  const referenceFailures = [];
  const validateReference = (reference, sourceFile, kind) => {
    if (reference.startsWith("/")) {
      referenceFailures.push(
        `${sourceFile}: ${kind} must not use root-relative URL ${reference}`,
      );
      return;
    }
    for (const deploymentUrl of deploymentUrls) {
      const resolved = resolveArtifactReference(
        reference,
        sourceFile,
        deploymentUrl,
      );
      if (!resolved.isLocal) {
        referenceFailures.push(
          `${sourceFile}: ${reference} escapes deployment ${deploymentUrl}`,
        );
        continue;
      }
      const target = artifactPathToFile(artifactRoot, resolved.artifactPath);
      if (!existsSync(target) || !statSync(target).isFile())
        referenceFailures.push(
          `${sourceFile}: ${reference} resolves to missing ${resolved.artifactPath}`,
        );
    }
  };

  for (const file of filesWithExtension(artifactRoot, ".html")) {
    const relative = path
      .relative(artifactRoot, file)
      .replaceAll(path.sep, "/");
    const html = readFileSync(file, "utf8");
    for (const { reference, tag } of portableHtmlReferences(html))
      validateReference(reference, relative, `<${tag}> URL`);
  }
  for (const file of filesWithExtension(artifactRoot, ".css")) {
    const relative = path
      .relative(artifactRoot, file)
      .replaceAll(path.sep, "/");
    const css = readFileSync(file, "utf8");
    for (const reference of portableCssReferences(css))
      validateReference(reference, relative, "CSS URL");
  }
  return [...new Set(referenceFailures)];
}

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validateHeadingOrder(label, html) {
  const levels = matches(html, /<h([1-6])\b/gi).map((match) =>
    Number(match[1]),
  );
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] > levels[index - 1] + 1) {
      fail(
        `${label}: heading level jumps from h${levels[index - 1]} to h${levels[index]}`,
      );
    }
  }
}

function validateJsonLd(label, html, expectedUrl) {
  const blocks = matches(
    html,
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (blocks.length !== 1) {
    fail(
      `${label}: expected exactly one JSON-LD block, found ${blocks.length}`,
    );
    return;
  }
  try {
    const data = JSON.parse(blocks[0][1]);
    if (data.url !== expectedUrl)
      fail(`${label}: JSON-LD url must be ${expectedUrl}`);
  } catch (error) {
    fail(`${label}: JSON-LD is invalid JSON (${error.message})`);
  }
}

function validatePage({
  label,
  file,
  canonical,
  requiredLinks,
  expectedTitle,
  expectedDescription,
  expectedCss,
  expectedScripts,
  expectedSitemap,
  requireNavigationToggle = false,
}) {
  if (!existsSync(file)) {
    fail(`${label}: missing generated file ${file}`);
    return null;
  }
  const html = readFileSync(file, "utf8");
  const titles = matches(html, /<title>([^<]*)<\/title>/gi);
  if (titles.length !== 1 || !titles[0][1].trim())
    fail(`${label}: expected exactly one non-empty title`);
  const description = attribute(html, "meta", "name", "description");
  if (!description?.content?.trim()) fail(`${label}: missing meta description`);
  if (titles[0]?.[1]?.trim() !== expectedTitle)
    fail(`${label}: title does not match shared site configuration`);
  if (description?.content?.trim() !== expectedDescription)
    fail(`${label}: description does not match shared site configuration`);
  const canonicalTag = attribute(html, "link", "rel", "canonical");
  if (canonicalTag?.href !== canonical)
    fail(`${label}: canonical must be ${canonical}`);
  if (!attribute(html, "link", "rel", "icon"))
    fail(`${label}: missing favicon`);
  if (
    expectedSitemap &&
    attribute(html, "link", "rel", "sitemap")?.href !== expectedSitemap
  )
    fail(`${label}: sitemap link must be ${expectedSitemap}`);
  if (!attribute(html, "html", "data-bs-theme", "light"))
    fail(`${label}: missing Bootstrap color-mode default`);
  for (const property of [
    "og:type",
    "og:site_name",
    "og:title",
    "og:description",
    "og:url",
  ]) {
    if (!attribute(html, "meta", "property", property)?.content)
      fail(`${label}: missing ${property}`);
  }
  if (attribute(html, "meta", "property", "og:url")?.content !== canonical)
    fail(`${label}: og:url must match canonical`);
  if (
    attribute(html, "meta", "property", "og:title")?.content !==
    titles[0]?.[1]?.trim()
  )
    fail(`${label}: og:title must match the page title`);
  if (
    attribute(html, "meta", "property", "og:description")?.content !==
    description?.content?.trim()
  )
    fail(`${label}: og:description must match the meta description`);
  for (const name of ["twitter:card", "twitter:title", "twitter:description"]) {
    if (!attribute(html, "meta", "name", name)?.content)
      fail(`${label}: missing ${name}`);
  }
  const h1s = matches(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi);
  if (h1s.length !== 1 || !visibleText(h1s[0][1]))
    fail(`${label}: expected exactly one non-empty h1, found ${h1s.length}`);
  if (visibleText(html).length < 220)
    fail(`${label}: initial HTML does not contain enough crawlable text`);
  validateHeadingOrder(label, html);
  validateJsonLd(label, html, canonical);
  for (const href of requiredLinks) {
    if (!attribute(html, "a", "href", href))
      fail(`${label}: missing crawlable link to ${href}`);
  }
  if (!attribute(html, "link", "href", expectedCss))
    fail(`${label}: missing generated stylesheet ${expectedCss}`);
  for (const script of expectedScripts) {
    if (!attribute(html, "script", "src", script))
      fail(`${label}: missing generated script ${script}`);
  }
  if (!/<select\b[^>]*data-theme-select/.test(html))
    fail(`${label}: missing accessible theme selector`);
  if (
    requireNavigationToggle &&
    !/<button\b[^>]*aria-expanded="false"[^>]*data-nav-toggle/.test(html)
  )
    fail(`${label}: missing collapsed mobile navigation control`);
  return {
    title: titles[0]?.[1]?.trim(),
    description: description?.content?.trim(),
  };
}

function findHtml(directory) {
  return filesWithExtension(directory, ".html");
}

function validateApiPages() {
  const apiDirectory = path.join(docs, "api");
  if (!existsSync(apiDirectory)) return new Set();
  const canonicals = new Set();
  const titles = new Set();
  for (const file of findHtml(apiDirectory)) {
    const html = readFileSync(file, "utf8");
    const relative = path
      .relative(apiDirectory, file)
      .replaceAll(path.sep, "/");
    const siteRoot = relativeRootFromFile(`api/${relative}`);
    const canonical = attribute(html, "link", "rel", "canonical")?.href;
    if (
      !canonical?.startsWith(sitePages.api.url) ||
      !canonical.startsWith("https://")
    )
      fail(`API ${relative}: invalid canonical ${canonical ?? "(missing)"}`);
    if (canonicals.has(canonical))
      fail(`API ${relative}: duplicate canonical ${canonical}`);
    canonicals.add(canonical);
    if (!attribute(html, "meta", "name", "description"))
      fail(`API ${relative}: missing description`);
    if (attribute(html, "meta", "property", "og:url")?.content !== canonical)
      fail(`API ${relative}: Open Graph URL does not match canonical`);
    if (
      attribute(html, "link", "rel", "icon")?.href !==
      `${siteRoot}images/${projectConfig.assets.faviconFile}`
    )
      fail(`API ${relative}: favicon is not site-root relative`);
    if (
      attribute(html, "link", "rel", "manifest")?.href !==
      `${siteRoot}${projectConfig.pwa.manifestFile}`
    )
      fail(`API ${relative}: manifest link is not site-root relative`);
    if (!attribute(html, "a", "href", siteRoot))
      fail(`API ${relative}: project-home link is not depth-correct`);
    if (!attribute(html, "link", "href", `${siteRoot}assets/api.css`))
      fail(`API ${relative}: missing API theme stylesheet`);
    if (!attribute(html, "script", "src", `${siteRoot}assets/api.js`))
      fail(`API ${relative}: missing API theme script`);
    const h1s = matches(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi);
    if (h1s.length !== 1 || !visibleText(h1s[0][1]))
      fail(`API ${relative}: expected exactly one non-empty h1`);
    validateHeadingOrder(`API ${relative}`, html);
    validateJsonLd(`API ${relative}`, html, canonical);
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    if (!title) fail(`API ${relative}: missing title`);
    else if (titles.has(title))
      fail(`API ${relative}: duplicate title ${title}`);
    else titles.add(title);
  }
  return titles;
}

function validateStaticFiles() {
  const robotsPath = path.join(docs, "robots.txt");
  const sitemapPath = path.join(docs, "sitemap.xml");
  for (const asset of [
    "assets/shared.css",
    "assets/shared.js",
    "assets/home.js",
    "assets/playground.js",
    "assets/api.css",
    "assets/api.js",
    `images/${projectConfig.assets.faviconFile}`,
    `images/${projectConfig.assets.logoFile}`,
  ]) {
    if (!existsSync(path.join(docs, asset)))
      fail(`${asset}: missing from Pages artifact`);
  }
  const homeCss = path.join(docs, "assets", "shared.css");
  if (
    existsSync(homeCss) &&
    !/Bootstrap\s+v5\.3\.8/.test(readFileSync(homeCss, "utf8"))
  )
    fail(
      "assets/shared.css: Bootstrap 5.3.8 was not included in the site build",
    );

  if (!existsSync(robotsPath)) fail("robots.txt: missing from Pages artifact");
  else {
    const robots = readFileSync(robotsPath, "utf8");
    if (!robots.includes("User-agent: *") || !robots.includes("Allow: /"))
      fail("robots.txt: crawler policy is incomplete");
    if (!robots.includes(projectConfig.urls.sitemap))
      fail("robots.txt: canonical sitemap URL is missing");
  }
  if (!existsSync(sitemapPath)) {
    fail("sitemap.xml: missing from Pages artifact");
    return;
  }
  const sitemap = readFileSync(sitemapPath, "utf8");
  if (!/^<\?xml[^?]*\?>/.test(sitemap) || !/<urlset\b/.test(sitemap))
    fail("sitemap.xml: invalid XML envelope");
  const locations = matches(sitemap, /<loc>([^<]+)<\/loc>/g).map(
    (match) => match[1],
  );
  for (const url of [
    sitePages.home.url,
    sitePages.api.url,
    sitePages.playground.url,
  ]) {
    if (!locations.includes(url)) fail(`sitemap.xml: missing ${url}`);
  }
  if (new Set(locations).size !== locations.length)
    fail("sitemap.xml: contains duplicate loc entries");
  for (const url of locations) {
    if (!url.startsWith("https://")) fail(`sitemap.xml: non-HTTPS URL ${url}`);
  }
}

function validateSite() {
  failures.length = 0;
  const validatedPages = [
    validatePage({
      label: "Root page",
      file: path.join(docs, "index.html"),
      canonical: sitePages.home.url,
      requiredLinks: [
        "#installation",
        "#usage",
        "./api/",
        "./playground/",
        "./sitemap.xml",
        projectConfig.urls.github,
        projectConfig.urls.npm,
      ],
      expectedTitle: sitePages.home.title,
      expectedDescription: sitePages.home.description,
      expectedCss: "assets/shared.css",
      expectedScripts: ["assets/shared.js", "assets/home.js"],
      expectedSitemap: projectConfig.urls.sitemap,
      requireNavigationToggle: true,
    }),
    validatePage({
      label: "Playground",
      file: path.join(docs, "playground", "index.html"),
      canonical: sitePages.playground.url,
      requiredLinks: [
        "../",
        "../#installation",
        "../#usage",
        "../api/",
        projectConfig.urls.github,
        projectConfig.urls.npm,
      ],
      expectedTitle: sitePages.playground.title,
      expectedDescription: sitePages.playground.description,
      expectedCss: "../assets/shared.css",
      expectedScripts: ["../assets/shared.js", "../assets/playground.js"],
      requireNavigationToggle: true,
    }),
    validatePage({
      label: "API documentation",
      file: path.join(docs, "api", "index.html"),
      canonical: sitePages.api.url,
      requiredLinks: ["../"],
      expectedTitle: sitePages.api.title,
      expectedDescription: sitePages.api.description,
      expectedCss: "../assets/api.css",
      expectedScripts: ["../assets/api.js"],
    }),
  ].filter(Boolean);
  const titles = validatedPages.map((page) => page.title);
  const descriptions = validatedPages.map((page) => page.description);
  if (new Set(titles).size !== titles.length)
    fail("Primary page titles must be unique");
  if (new Set(descriptions).size !== descriptions.length)
    fail("Primary page descriptions must be unique");
  const apiTitles = validateApiPages();
  for (const title of titles) {
    if (title !== sitePages.api.title && apiTitles.has(title))
      fail(`Primary title duplicates an API page title: ${title}`);
  }
  validateStaticFiles();
  validateArtifactReferences().forEach(fail);
  if (failures.length)
    throw new Error(`SEO validation failed:\n- ${failures.join("\n- ")}`);
  return {
    apiPages: findHtml(path.join(docs, "api")).length,
    pages: validatedPages.length,
  };
}

if (require.main === module) {
  try {
    const result = validateSite();
    console.log(
      `SEO validation passed for ${result.pages} primary pages and ${result.apiPages} API pages.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  attribute,
  portableDeploymentUrls,
  validateArtifactReferences,
  validateSite,
  visibleText,
};
