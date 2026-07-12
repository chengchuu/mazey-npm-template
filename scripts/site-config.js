const SITE_URL = "https://chengchuu.github.io/mazey-npm-template/";
const GITHUB_URL = "https://github.com/chengchuu/mazey-npm-template";
const NPM_URL = "https://www.npmjs.com/package/mazey-npm-template";
const ROOT_TITLE = "mazey-npm-template - TypeScript npm Library Template";
const ROOT_DESCRIPTION =
  "A TypeScript npm library template with Rollup builds for ESM, CommonJS, browser IIFE, source maps, declarations, tests, and release workflows.";
const PLAYGROUND_TITLE = "mazey-npm-template Playground - Try the Greeting API";
const PLAYGROUND_DESCRIPTION =
  "Try the mazey-npm-template greeting API, optional punctuation, blank-name fallback, and exported package information in a live browser playground.";
const API_TITLE = "mazey-npm-template API Documentation";
const API_DESCRIPTION =
  "TypeScript API documentation for mazey-npm-template, including createGreeting, packageInfo, options, and public package types.";

const software = {
  "@type": "SoftwareSourceCode",
  name: "mazey-npm-template",
  description: ROOT_DESCRIPTION,
  url: SITE_URL,
  codeRepository: GITHUB_URL,
  downloadUrl: NPM_URL,
  license: `${GITHUB_URL}/blob/main/LICENSE`,
  programmingLanguage: "TypeScript",
};

module.exports = Object.freeze({
  SITE_URL,
  API_URL: `${SITE_URL}api/`,
  PLAYGROUND_URL: `${SITE_URL}playground/`,
  GITHUB_URL,
  NPM_URL,
  README_URL: `${GITHUB_URL}#readme`,
  LICENSE_URL: `${GITHUB_URL}/blob/main/LICENSE`,
  FAVICON_URL:
    "https://i.mazey.net/icon/fav/logo-dark-circle-transparent-32x32.png",
  ROOT_TITLE,
  ROOT_DESCRIPTION,
  PLAYGROUND_TITLE,
  PLAYGROUND_DESCRIPTION,
  API_TITLE,
  API_DESCRIPTION,
  ROOT_JSON_LD: JSON.stringify({
    "@context": "https://schema.org",
    ...software,
  }),
  PLAYGROUND_JSON_LD: JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "mazey-npm-template Greeting API Playground",
    description: PLAYGROUND_DESCRIPTION,
    url: `${SITE_URL}playground/`,
    isPartOf: {
      "@type": "WebSite",
      name: "mazey-npm-template",
      url: SITE_URL,
    },
    about: software,
  }),
});
