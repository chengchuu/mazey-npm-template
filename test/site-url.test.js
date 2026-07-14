/** @jest-environment node */

const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveRequest } = require("../scripts/preview-pages");
const {
  relativeRootFromFile,
  resolveArtifactReference,
} = require("../scripts/site-url-utils");
const { validateArtifactReferences } = require("../scripts/validate-seo");

test.each([
  ["index.html", "./"],
  ["playground/index.html", "../"],
  ["api/index.html", "../"],
  ["api/functions/create.html", "../../"],
  ["api\\functions\\create.html", "../../"],
])("derives the artifact root for %s", (file, expected) => {
  expect(relativeRootFromFile(file)).toBe(expected);
});

test.each([
  "https://example.test/npm-template/",
  "https://example.test/nested/npm%20template/",
])("document-relative resources stay within %s", (deploymentUrl) => {
  expect(
    resolveArtifactReference(
      "../../assets/api.css",
      "api/functions/create.html",
      deploymentUrl,
    ).artifactPath,
  ).toBe("assets/api.css");
  expect(
    resolveArtifactReference(
      "../images/logo.png",
      "assets/shared.css",
      deploymentUrl,
    ).artifactPath,
  ).toBe("images/logo.png");
});

test("preview routing supports alternate encoded base paths", () => {
  const docs = mkdtempSync(path.join(os.tmpdir(), "portable-preview-"));
  try {
    writeFileSync(path.join(docs, "index.html"), "home");
    expect(
      resolveRequest("/nested/npm%20template/", {
        basePath: "/nested/npm template/",
        docs,
      }),
    ).toBe(path.join(docs, "index.html"));
    expect(
      resolveRequest("/another/", {
        basePath: "/nested/npm template/",
        docs,
      }),
    ).toBeNull();
    expect(
      resolveRequest("/nested/npm%20template/%2e%2e/secret", {
        basePath: "/nested/npm template/",
        docs,
      }),
    ).toBeNull();
  } finally {
    rmSync(docs, { recursive: true, force: true });
  }
});

test("artifact validation reports root-relative and missing resources", () => {
  const artifactRoot = mkdtempSync(path.join(os.tmpdir(), "portable-site-"));
  try {
    mkdirSync(path.join(artifactRoot, "assets"));
    writeFileSync(
      path.join(artifactRoot, "index.html"),
      '<link rel="stylesheet" href="./assets/site.css"><img src="/fixed/logo.png">',
    );
    writeFileSync(
      path.join(artifactRoot, "assets/site.css"),
      'body { background: url("../images/missing.png"); }',
    );
    expect(
      validateArtifactReferences({
        artifactRoot,
        deploymentUrls: ["https://example.test/nested/site/"],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("must not use root-relative URL"),
        expect.stringContaining("images/missing.png"),
      ]),
    );
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("artifact validation rejects same-project production links after relocation", () => {
  const artifactRoot = mkdtempSync(path.join(os.tmpdir(), "portable-site-"));
  try {
    writeFileSync(
      path.join(artifactRoot, "index.html"),
      '<a href="https://chengchuu.github.io/mazey-npm-template/playground/">Playground</a>',
    );
    expect(
      validateArtifactReferences({
        artifactRoot,
        deploymentUrls: ["https://example.test/nested/site/"],
      }),
    ).toEqual([expect.stringContaining("escapes deployment")]);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
