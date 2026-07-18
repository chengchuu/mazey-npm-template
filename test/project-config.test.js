/** @jest-environment node */

import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deepFreeze } from "mazey";
import pkg from "../package.json" with { type: "json" };
import projectConfig from "../project.config.js";
import { createManifest } from "../scripts/build-pages.js";
import {
  packageDetails,
  repositoryDetails,
} from "../scripts/project-config-utils.js";
import webpackConfig from "../scripts/webpack.config.dev.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("project configuration derives package and deployment identity", () => {
  expect(projectConfig.package.name).toBe(pkg.name);
  expect(projectConfig.package.version).toBe(pkg.version);
  expect(projectConfig.package.installCommand).toBe(`npm install ${pkg.name}`);
  expect(projectConfig.site.url).toBe(new URL(pkg.homepage).href);
  expect(projectConfig.site.basePath).toBe(new URL(pkg.homepage).pathname);
  expect(projectConfig.seo.openGraphImage).toMatchObject({
    file: "logo-purple-circle-open-graph-1200x630.png",
    width: 1200,
    height: 630,
    type: "image/png",
  });
  expect(projectConfig.seo.openGraphImage.url).toBe(
    new URL(`images/${projectConfig.seo.openGraphImage.file}`, pkg.homepage)
      .href,
  );
  expect(projectConfig.pwa.serviceWorkerUrl).toBe(
    `${projectConfig.site.basePath}service-worker.js`,
  );
  expect(pkg.unpkg).toBe(`lib/${projectConfig.package.bundleBaseName}.min.js`);
  expect(pkg.jsdelivr).toBe(pkg.unpkg);
});

test("package identity derivation does not require website metadata", () => {
  expect(packageDetails({ name: "@example/my-library" })).toMatchObject({
    name: "@example/my-library",
    bundleBaseName: "my-library",
    iifeGlobal: "MY_LIBRARY",
    installCommand: "npm install @example/my-library",
  });
});

test("Webpack emits site images from central configuration", () => {
  const configuredFiles = [
    projectConfig.assets.faviconFile,
    projectConfig.assets.logoFile,
    projectConfig.seo.openGraphImage.file,
  ];
  for (const file of configuredFiles) {
    expect(webpackConfig.entry.shared).toContain(
      path.resolve(__dirname, "..", "images", file),
    );
  }
});

test.each([
  "github:example/my-library",
  "example/my-library",
  "git@github.com:example/my-library.git",
  "git://github.com/example/my-library.git",
  "git+ssh://git@github.com/example/my-library.git",
  "git+https://github.com/example/my-library.git",
])("normalizes GitHub repository metadata from %s", (repository) => {
  expect(repositoryDetails(repository)).toEqual({
    name: "my-library",
    owner: "example",
    slug: "example/my-library",
    url: "https://github.com/example/my-library",
  });
});

test("rejects repository metadata that cannot power GitHub links", () => {
  expect(() => repositoryDetails("git@example.com:team/library.git")).toThrow(
    /GitHub repository/,
  );
});

test("generated manifest is driven by project configuration", () => {
  const manifest = createManifest();
  expect(manifest.name).toBe(projectConfig.pwa.name);
  expect(manifest.short_name).toBe(projectConfig.pwa.shortName);
  expect(manifest.id).toBe(projectConfig.site.basePath);
  expect(manifest.theme_color).toBe(projectConfig.site.theme.colorPrimary);
  expect(manifest.icons).toEqual(
    projectConfig.pwa.icons.map(({ purpose, sizes, src, type }) => ({
      src,
      sizes,
      type,
      purpose,
    })),
  );
});

test("project configuration is immutable", () => {
  expect(Object.isFrozen(projectConfig)).toBe(true);
  expect(Object.isFrozen(projectConfig.site.theme)).toBe(true);
  expect(Object.isFrozen(projectConfig.seo.openGraphImage)).toBe(true);
  expect(Object.isFrozen(projectConfig.pwa.icons)).toBe(true);
  expect(projectConfig.site.theme.colorPrimary).toBe(
    projectConfig.site.theme.primary.light.base,
  );
  expect(Object.isFrozen(projectConfig.site.theme.primary.dark)).toBe(true);
});

test("Mazey deep freezing terminates for circular configuration objects", () => {
  const value = { nested: {} };
  value.self = value;

  expect(deepFreeze(value)).toBe(value);
  expect(Object.isFrozen(value)).toBe(true);
  expect(Object.isFrozen(value.nested)).toBe(true);
});
