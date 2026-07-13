const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const path = require("node:path");
const {
  MANIFEST_URL,
  PWA_BASE_PATH,
  SERVICE_WORKER_URL,
} = require("./site-config");

const defaultRoot = path.resolve(__dirname, "..");

function pngDimensions(file) {
  const contents = readFileSync(file);
  const signature = "89504e470d0a1a0a";
  if (contents.subarray(0, 8).toString("hex") !== signature)
    throw new Error(`${file}: expected a PNG signature`);
  if (contents.subarray(12, 16).toString("ascii") !== "IHDR")
    throw new Error(`${file}: missing PNG IHDR chunk`);
  return {
    width: contents.readUInt32BE(16),
    height: contents.readUInt32BE(20),
  };
}

function htmlAttributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([:\w-]+)(?:=["']([^"']*)["'])?/g)].map((match) => [
      match[1].toLowerCase(),
      match[2] ?? "",
    ]),
  );
}

function findTag(html, tagName, attributeName, value) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))]
    .map((match) => htmlAttributes(match[0]))
    .find((attributes) => attributes[attributeName] === value);
}

function filesIn(directory) {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? filesIn(file) : [file];
  });
}

function validatePwa({ rootDir = defaultRoot } = {}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const docs = path.join(rootDir, "docs");
  const manifestFile = path.join(docs, "manifest.webmanifest");
  const workerFile = path.join(docs, "service-worker.js");

  if (!existsSync(manifestFile)) fail("Manifest is missing from docs");
  let manifest;
  if (existsSync(manifestFile)) {
    try {
      manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    } catch (error) {
      fail(`Manifest is invalid JSON: ${error.message}`);
    }
  }

  if (manifest) {
    for (const field of ["name", "short_name"]) {
      if (typeof manifest[field] !== "string" || !manifest[field].trim())
        fail(`Manifest ${field} must be a non-empty string`);
    }
    for (const field of ["id", "start_url", "scope"]) {
      if (manifest[field] !== PWA_BASE_PATH)
        fail(`Manifest ${field} must be ${PWA_BASE_PATH}`);
    }
    if (manifest.display !== "standalone")
      fail('Manifest display must be "standalone"');
    for (const field of ["theme_color", "background_color"]) {
      if (!/^#[0-9a-f]{6}$/i.test(manifest[field] ?? ""))
        fail(`Manifest ${field} must be a six-digit hex color`);
    }

    const requiredSizes = new Set(["192x192", "512x512"]);
    let hasMaskable = false;
    for (const icon of manifest.icons ?? []) {
      if (!icon.src?.startsWith(PWA_BASE_PATH)) {
        fail(`Manifest icon URL must start with ${PWA_BASE_PATH}: ${icon.src}`);
        continue;
      }
      if (icon.type !== "image/png")
        fail(`Manifest icon must use image/png: ${icon.src}`);
      const iconFile = path.join(docs, icon.src.slice(PWA_BASE_PATH.length));
      if (!existsSync(iconFile)) {
        fail(`Manifest icon is missing: ${icon.src}`);
        continue;
      }
      const [declaredWidth, declaredHeight] = String(icon.sizes)
        .split("x")
        .map(Number);
      const actual = pngDimensions(iconFile);
      if (actual.width !== declaredWidth || actual.height !== declaredHeight) {
        fail(
          `Manifest icon dimensions do not match ${icon.src}: declared ${icon.sizes}, actual ${actual.width}x${actual.height}`,
        );
      }
      requiredSizes.delete(icon.sizes);
      if (String(icon.purpose).split(/\s+/).includes("maskable"))
        hasMaskable = true;
    }
    for (const size of requiredSizes)
      fail(`Manifest is missing a ${size} icon`);
    if (!hasMaskable) fail("Manifest is missing a maskable icon");
  }

  const pages = [
    ["Homepage", path.join(docs, "index.html"), true],
    ["Playground", path.join(docs, "playground", "index.html"), true],
    ["API documentation", path.join(docs, "api", "index.html"), false],
  ];
  for (const [label, file, requiresInstallButton] of pages) {
    if (!existsSync(file)) {
      fail(`${label} HTML is missing`);
      continue;
    }
    const html = readFileSync(file, "utf8");
    if (findTag(html, "link", "rel", "manifest")?.href !== MANIFEST_URL)
      fail(`${label} must link ${MANIFEST_URL}`);
    const themeColor = findTag(html, "meta", "name", "theme-color");
    if (!themeColor?.content || !("data-theme-color" in themeColor))
      fail(`${label} is missing dynamic theme-color metadata`);
    if (!findTag(html, "meta", "name", "description"))
      fail(`${label} lost its SEO description`);
    if (!findTag(html, "link", "rel", "canonical"))
      fail(`${label} lost its canonical URL`);
    if (
      requiresInstallButton &&
      !/<button\b[^>]*data-pwa-install[^>]*>[\s\S]*?Install app[\s\S]*?<\/button>/i.test(
        html,
      )
    )
      fail(`${label} is missing an accessible Install app button`);
    if (
      !/<button\b[^>]*data-pwa-update-now[^>]*>[\s\S]*?Update now[\s\S]*?<\/button>/i.test(
        html,
      )
    )
      fail(`${label} is missing an accessible Update now button`);
    if (!/data-pwa-status[^>]*|[^>]*data-pwa-status/.test(html))
      fail(`${label} is missing a PWA live status region`);
    const hiddenHelpBlocks = [
      ...html.matchAll(
        /<([a-z][\w-]*)\b[^>]*data-pwa-install-help[^>]*>([\s\S]*?)<\/\1>/gi,
      ),
    ];
    if (hiddenHelpBlocks.some((match) => /data-pwa-status/.test(match[2])))
      fail(`${label} hides its PWA live status region in installed mode`);
  }

  if (!existsSync(workerFile)) fail("Service worker is missing from docs");
  else {
    const worker = readFileSync(workerFile, "utf8");
    if (worker.includes("__MAZEY_PWA_CACHE_VERSION__"))
      fail("Service worker contains an unresolved cache version token");
    if (!worker.includes(`const PROJECT_BASE = "${PWA_BASE_PATH}"`))
      fail(`Service worker project base must be ${PWA_BASE_PATH}`);
    if (!worker.includes('request.method === "GET"'))
      fail("Service worker must ignore non-GET requests");
    if (!worker.includes("url.origin === self.location.origin"))
      fail("Service worker must ignore cross-origin requests");
    if (!worker.includes('event.data?.type === "SKIP_WAITING"'))
      fail("Service worker updates must require an explicit message");
  }

  const scriptDirectory = path.join(docs, "assets");
  if (existsSync(scriptDirectory)) {
    const browserCode = filesIn(scriptDirectory)
      .filter((file) => file.endsWith(".js") && !file.endsWith(".map"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    if (!browserCode.includes(SERVICE_WORKER_URL))
      fail(`Compiled registration must use ${SERVICE_WORKER_URL}`);
    if (!browserCode.includes(PWA_BASE_PATH))
      fail(`Compiled registration must use scope ${PWA_BASE_PATH}`);
  }

  const sourceDirectory = path.join(rootDir, "src");
  const packageSource = filesIn(sourceDirectory)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  if (
    /serviceWorker|beforeinstallprompt|manifest\.webmanifest/.test(
      packageSource,
    )
  )
    fail("Published package source must not contain PWA runtime behavior");

  if (failures.length)
    throw new Error(`PWA validation failed:\n- ${failures.join("\n- ")}`);
  return { icons: manifest.icons.length, pages: pages.length };
}

if (require.main === module) {
  try {
    const result = validatePwa();
    console.log(
      `PWA validation passed for ${result.pages} entry pages and ${result.icons} manifest icons.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { pngDimensions, validatePwa };
