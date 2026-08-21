import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import projectConfig from "../project.config.js";
import { pngDimensions } from "./validate-pwa.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sitePages = projectConfig.site.pages;

const root = path.resolve(__dirname, "..");
const docs = path.join(root, "docs");
const failures = [];

function fail(message) {
  failures.push(message);
}

function matches(html, expression) {
  return [...html.matchAll(expression)];
}

function attributes(tag) {
  return Object.fromEntries(
    matches(tag, /([:\w-]+)(?:=["']([^"']*)["'])?/g).map((item) => [
      item[1].toLowerCase(),
      item[2] ?? "",
    ]),
  );
}

function attribute(html, tag, name, value) {
  const tags = matches(html, new RegExp(`<${tag}\\b[^>]*>`, "gi"));
  for (const match of tags) {
    const values = attributes(match[0]);
    if (values[name] === value) return values;
  }
  return null;
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

const embeddedMarkupExpression =
  /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi;

function elementIds(html) {
  const markup = html.replace(embeddedMarkupExpression, "");
  return matches(markup, /<[a-z][^>]*>/gi).flatMap((match) => {
    const values = attributes(match[0]);
    return Object.hasOwn(values, "id") ? [values.id] : [];
  });
}

function validateSocialImage(label, html) {
  const image = projectConfig.seo.openGraphImage;
  const openGraphValues = {
    "og:image": image.url,
    "og:image:type": image.type,
    "og:image:width": String(image.width),
    "og:image:height": String(image.height),
    "og:image:alt": image.alt,
  };
  for (const [property, expected] of Object.entries(openGraphValues)) {
    if (attribute(html, "meta", "property", property)?.content !== expected)
      fail(`${label}: ${property} must be ${expected}`);
  }
  if (
    attribute(html, "meta", "name", "twitter:card")?.content !==
    "summary_large_image"
  )
    fail(`${label}: twitter:card must be summary_large_image`);
  if (attribute(html, "meta", "name", "twitter:image")?.content !== image.url)
    fail(`${label}: twitter:image must be ${image.url}`);
  if (
    attribute(html, "meta", "name", "twitter:image:alt")?.content !== image.alt
  )
    fail(`${label}: twitter:image:alt must match the Open Graph image alt`);
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

function validateThemeToggle(label, html) {
  const buttons = matches(
    html,
    /<button\b[^>]*data-theme-toggle[^>]*>[\s\S]*?<\/button>/gi,
  );
  if (buttons.length !== 1) {
    fail(`${label}: expected exactly one navbar theme button`);
    return;
  }

  const buttonAttributes = attributes(
    buttons[0][0].match(/<button\b[^>]*>/i)[0],
  );
  if (buttonAttributes.type !== "button")
    fail(`${label}: navbar theme button must use type=button`);
  if (!buttonAttributes.class?.split(/\s+/).includes("theme-toggle"))
    fail(`${label}: navbar theme button must use the theme-toggle class`);
  if (
    buttonAttributes["aria-label"] !==
    "Current theme: Light. Switch to dark theme."
  )
    fail(`${label}: navbar theme button has an invalid accessible label`);
  if (Object.hasOwn(buttonAttributes, "aria-pressed"))
    fail(`${label}: navbar theme button must not use aria-pressed`);

  const icons = matches(buttons[0][0], /<svg\b[^>]*>/gi).map((match) =>
    attributes(match[0]),
  );
  for (const theme of ["light", "dark"]) {
    const matchingIcons = icons.filter(
      (icon) => icon["data-theme-icon"] === theme,
    );
    if (matchingIcons.length !== 1) {
      fail(`${label}: expected one ${theme} theme icon`);
      continue;
    }
    const icon = matchingIcons[0];
    if (icon["aria-hidden"] !== "true" || icon.focusable !== "false")
      fail(`${label}: ${theme} theme icon must be decorative`);
    if (icon.width !== "14" || icon.height !== "14")
      fail(`${label}: ${theme} theme icon must be 14 by 14 pixels`);
    if (theme === "light" && Object.hasOwn(icon, "hidden"))
      fail(`${label}: initial light theme icon must be visible`);
    if (theme === "dark" && !Object.hasOwn(icon, "hidden"))
      fail(`${label}: initial dark theme icon must be hidden`);
  }

  if (/<select\b[^>]*data-theme-select/i.test(html))
    fail(`${label}: obsolete navbar theme selector is present`);
}

function validateTypeDocThemeSelector(label, html) {
  const selectors = matches(
    html,
    /<select\b[^>]*id=["']tsd-theme["'][^>]*>([\s\S]*?)<\/select>/gi,
  );
  if (selectors.length !== 1) {
    fail(`${label}: expected exactly one native TypeDoc theme selector`);
    return;
  }
  const options = matches(
    selectors[0][1],
    /<option\b[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi,
  ).map((match) => [match[1], visibleText(match[2])]);
  if (
    JSON.stringify(options) !==
    JSON.stringify([
      ["os", "OS"],
      ["light", "Light"],
      ["dark", "Dark"],
    ])
  )
    fail(`${label}: native TypeDoc theme options must remain OS, Light, Dark`);
}

function localFragmentError(sourceFile, href, outputRoot = docs) {
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) return null;

  const pathPart = href.slice(0, hashIndex);
  if (/^[a-z][a-z\d+.-]*:/i.test(pathPart) || pathPart.startsWith("//"))
    return null;
  const queryIndex = pathPart.indexOf("?");
  const pathnamePart =
    queryIndex === -1 ? pathPart : pathPart.slice(0, queryIndex);

  let fragment;
  let targetPath;
  try {
    fragment = decodeURIComponent(href.slice(hashIndex + 1));
    const decodedPath = decodeURIComponent(pathnamePart);
    if (
      decodedPath.startsWith("/") &&
      !decodedPath.startsWith(projectConfig.site.basePath)
    )
      return `fragment link leaves the Pages artifact: ${href}`;
    targetPath = decodedPath
      ? decodedPath.startsWith("/")
        ? path.resolve(
            outputRoot,
            decodedPath.slice(projectConfig.site.basePath.length),
          )
        : path.resolve(path.dirname(sourceFile), decodedPath)
      : sourceFile;
  } catch {
    return `invalid encoded fragment link ${href}`;
  }

  if (!fragment) return `empty fragment link ${href}`;
  if (existsSync(targetPath) && statSync(targetPath).isDirectory())
    targetPath = path.join(targetPath, "index.html");

  const relativeTarget = path.relative(outputRoot, targetPath);
  if (
    relativeTarget === ".." ||
    relativeTarget.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeTarget)
  )
    return `fragment link leaves the Pages artifact: ${href}`;
  if (!existsSync(targetPath))
    return `fragment document is missing for ${href}`;

  const targetHtml = readFileSync(targetPath, "utf8");
  const ids = elementIds(targetHtml);
  if (!ids.includes(fragment))
    return `fragment target #${fragment} is missing for ${href}`;

  return null;
}

function localFragmentErrors(sourceFile, html, outputRoot = docs) {
  const markup = html.replace(embeddedMarkupExpression, "");
  const hrefs = new Set(
    matches(markup, /<a\b[^>]*>/gi)
      .map((match) => attributes(match[0]).href)
      .filter((href) => href?.includes("#") && href !== "#"),
  );

  return [...hrefs]
    .map((href) => localFragmentError(sourceFile, href, outputRoot))
    .filter(Boolean);
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
  validateSocialImage(label, html);
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
    if (!attribute(html, "a", "href", href)) {
      fail(`${label}: missing crawlable link to ${href}`);
      continue;
    }
  }
  for (const fragmentError of localFragmentErrors(file, html))
    fail(`${label}: ${fragmentError}`);
  const expectedStylesheets = Array.isArray(expectedCss)
    ? expectedCss
    : [expectedCss];
  for (const stylesheet of expectedStylesheets) {
    if (!attribute(html, "link", "href", stylesheet))
      fail(`${label}: missing generated stylesheet ${stylesheet}`);
  }
  for (const script of expectedScripts) {
    if (!attribute(html, "script", "src", script))
      fail(`${label}: missing generated script ${script}`);
  }
  validateThemeToggle(label, html);
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
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) return findHtml(file);
    return file.endsWith(".html") ? [file] : [];
  });
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
    const assetPrefix = "../".repeat(relative.split("/").length);
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
    validateSocialImage(`API ${relative}`, html);
    if (!attribute(html, "link", "rel", "icon"))
      fail(`API ${relative}: missing favicon`);
    if (!attribute(html, "link", "href", `${assetPrefix}assets/api.css`))
      fail(`API ${relative}: missing API theme stylesheet`);
    if (!attribute(html, "script", "src", `${assetPrefix}assets/api.js`))
      fail(`API ${relative}: missing API theme script`);
    validateThemeToggle(`API ${relative}`, html);
    validateTypeDocThemeSelector(`API ${relative}`, html);
    for (const control of [
      'id="tsd-search-trigger"',
      '<dialog id="tsd-search"',
      'id="tsd-search-input"',
      'id="tsd-search-results"',
    ]) {
      if (!html.includes(control))
        fail(`API ${relative}: missing search dialog control ${control}`);
    }
    const h1s = matches(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi);
    if (h1s.length !== 1 || !visibleText(h1s[0][1]))
      fail(`API ${relative}: expected exactly one non-empty h1`);
    const firstHeading = html.match(/<h([1-6])\b/i);
    if (firstHeading?.[1] !== "1")
      fail(`API ${relative}: first heading must be h1`);
    validateHeadingOrder(`API ${relative}`, html);
    validateJsonLd(`API ${relative}`, html, canonical);
    if (relative !== "index.html") {
      for (const fragmentError of localFragmentErrors(file, html))
        fail(`API ${relative}: ${fragmentError}`);
    }
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
  if (!existsSync(path.join(docs, ".nojekyll")))
    fail(".nojekyll: missing from Pages artifact");
  for (const asset of [
    "assets/shared.css",
    "assets/shared.js",
    "assets/home.js",
    "assets/playground.js",
    "assets/playground.css",
    "assets/api.css",
    "assets/api.js",
    `images/${projectConfig.assets.faviconFile}`,
    `images/${projectConfig.assets.logoFile}`,
    `images/${projectConfig.seo.openGraphImage.file}`,
  ]) {
    if (!existsSync(path.join(docs, asset)))
      fail(`${asset}: missing from Pages artifact`);
  }
  const openGraphImagePath = path.join(
    docs,
    "images",
    projectConfig.seo.openGraphImage.file,
  );
  if (existsSync(openGraphImagePath)) {
    const dimensions = pngDimensions(openGraphImagePath);
    if (
      dimensions.width !== projectConfig.seo.openGraphImage.width ||
      dimensions.height !== projectConfig.seo.openGraphImage.height
    )
      fail(
        `Open Graph image dimensions must be ${projectConfig.seo.openGraphImage.width}x${projectConfig.seo.openGraphImage.height}, found ${dimensions.width}x${dimensions.height}`,
      );
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
        "#install",
        "#usage",
        "./api/",
        "./playground/",
        "./sitemap.xml",
        projectConfig.urls.github,
        projectConfig.urls.npm,
      ],
      expectedTitle: sitePages.home.title,
      expectedDescription: sitePages.home.description,
      expectedCss: `${projectConfig.site.basePath}assets/shared.css`,
      expectedScripts: [
        `${projectConfig.site.basePath}assets/shared.js`,
        `${projectConfig.site.basePath}assets/home.js`,
      ],
      expectedSitemap: projectConfig.urls.sitemap,
      requireNavigationToggle: true,
    }),
    validatePage({
      label: "Playground",
      file: path.join(docs, "playground", "index.html"),
      canonical: sitePages.playground.url,
      requiredLinks: [
        "../",
        "../#install",
        "../#usage",
        "../#website-app-help",
        "../api/",
        projectConfig.urls.github,
        projectConfig.urls.npm,
      ],
      expectedTitle: sitePages.playground.title,
      expectedDescription: sitePages.playground.description,
      expectedCss: [
        `${projectConfig.site.basePath}assets/shared.css`,
        `${projectConfig.site.basePath}assets/playground.css`,
      ],
      expectedScripts: [
        `${projectConfig.site.basePath}assets/shared.js`,
        `${projectConfig.site.basePath}assets/playground.js`,
      ],
      requireNavigationToggle: true,
    }),
    validatePage({
      label: "API documentation",
      file: path.join(docs, "api", "index.html"),
      canonical: sitePages.api.url,
      requiredLinks: [
        sitePages.home.url,
        sitePages.api.url,
        projectConfig.urls.github,
        projectConfig.urls.npm,
      ],
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
  if (failures.length)
    throw new Error(`SEO validation failed:\n- ${failures.join("\n- ")}`);
  return {
    apiPages: findHtml(path.join(docs, "api")).length,
    pages: validatedPages.length,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
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

export {
  attribute,
  localFragmentError,
  localFragmentErrors,
  validateSite,
  visibleText,
};
