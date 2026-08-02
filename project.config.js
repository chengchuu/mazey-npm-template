import { deepFreeze } from "mazey";
import pkg from "./package.json" with { type: "json" };
import {
  packageDetails,
  repositoryDetails,
} from "./scripts/project-config-utils.js";

const shortName = "mazey template";
const packageConfig = packageDetails(pkg);
const repository = repositoryDetails(pkg.repository);
const siteUrl = new URL(pkg.homepage);
const basePath = siteUrl.pathname.endsWith("/")
  ? siteUrl.pathname
  : `${siteUrl.pathname}/`;
siteUrl.pathname = basePath;
siteUrl.search = "";
siteUrl.hash = "";
const displayName = pkg.name;
const githubUrl = repository.url;
const npmUrl = `https://www.npmjs.com/package/${pkg.name}`;
const faviconFile = "logo-32x32.png";
const logoFile = "logo-192x192.png";
const openGraphImageFile = "logo-open-graph-1200x630.png";
const primaryPalette = {
  light: {
    base: "#4d8ffb",
    hover: "#256fd8",
    active: "#185aaa",
    soft: "#eaf2ff",
    rgb: "77, 143, 251",
    hoverRgb: "37, 111, 216",
    activeRgb: "24, 90, 170",
  },
  dark: {
    base: "#5089e8",
    hover: "#6198ee",
    active: "#74a5f3",
    soft: "#1b3155",
    rgb: "80, 137, 232",
    hoverRgb: "97, 152, 238",
    activeRgb: "116, 165, 243",
  },
};
const theme = {
  storageKey: `${packageConfig.bundleBaseName}-theme`,
  colorPrimary: primaryPalette.light.base,
  colorLight: "#f7f8fc",
  colorDark: "#0d1220",
  primary: primaryPalette,
};
const pages = {
  home: {
    title: `${displayName} - TypeScript npm Library Template`,
    description:
      "A TypeScript npm library template with Rollup builds for ESM, CommonJS, browser IIFE, source maps, declarations, tests, and release workflows.",
    url: siteUrl.href,
  },
  playground: {
    title: `${displayName} Playground - Try the Greeting API`,
    description: `Try the ${displayName} greeting API, optional punctuation, and blank-name fallback in a live browser playground.`,
    url: new URL("playground/", siteUrl).href,
  },
  api: {
    title: `${displayName} API Documentation`,
    description: `TypeScript API documentation for ${displayName}, including createGreeting, its options, and public package types.`,
    url: new URL("api/", siteUrl).href,
  },
};
const pwaIcons = [
  {
    file: "logo-192x192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    file: "logo-512x512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
  {
    file: "logo-maskable-512x512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];
const software = {
  "@type": "SoftwareSourceCode",
  name: displayName,
  description: pages.home.description,
  url: pages.home.url,
  codeRepository: githubUrl,
  downloadUrl: npmUrl,
  license: `${githubUrl}/blob/main/LICENSE`,
  programmingLanguage: "TypeScript",
};
const openGraphImage = {
  file: openGraphImageFile,
  url: new URL(`images/${openGraphImageFile}`, siteUrl).href,
  width: 1200,
  height: 630,
  type: "image/png",
  alt: `The ${displayName} logo over purple and teal abstract technology graphics.`,
};

export default deepFreeze({
  package: packageConfig,
  repository,
  brand: {
    displayName,
    shortName,
  },
  urls: {
    github: githubUrl,
    npm: npmUrl,
    license: `${githubUrl}/blob/main/LICENSE`,
    sitemap: new URL("sitemap.xml", siteUrl).href,
  },
  assets: {
    faviconFile,
    faviconUrl: `${basePath}images/${faviconFile}`,
    logoFile,
    logoUrl: `${basePath}images/${logoFile}`,
  },
  site: {
    url: siteUrl.href,
    basePath,
    markerPrefix: packageConfig.bundleBaseName,
    pages,
    theme,
  },
  seo: {
    openGraphImage,
    software,
    rootJsonLd: {
      "@context": "https://schema.org",
      ...software,
    },
    playgroundJsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${displayName} Greeting API Playground`,
      description: pages.playground.description,
      url: pages.playground.url,
      isPartOf: {
        "@type": "WebSite",
        name: displayName,
        url: pages.home.url,
      },
      about: software,
    },
  },
  pwa: {
    name: displayName,
    shortName,
    display: "standalone",
    backgroundColor: theme.colorLight,
    themeColor: theme.colorPrimary,
    manifestUrl: `${basePath}manifest.webmanifest`,
    serviceWorkerUrl: `${basePath}service-worker.js`,
    cachePrefix: `${packageConfig.bundleBaseName}-site-`,
    description: `Project website, playground, and TypeScript API documentation for the ${displayName} npm library template.`,
    icons: pwaIcons.map(({ file, ...icon }) => ({
      ...icon,
      file,
      src: `${basePath}images/${file}`,
    })),
  },
});
