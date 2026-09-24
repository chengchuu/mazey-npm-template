import { createRequire } from "node:module";
import pkg from "../package.json" with { type: "json" };

const require = createRequire(import.meta.url);
const esmPackage = await import(pkg.name);
const commonJsPackage = require(pkg.name);
const publishedMetadata = require(`${pkg.name}/package.json`);

if (publishedMetadata.name !== pkg.name)
  throw new Error("The package.json subpath does not resolve correctly");

for (const [label, packageExports] of [
  ["ESM", esmPackage],
  ["CommonJS", commonJsPackage],
]) {
  if (typeof packageExports.createGreeting !== "function")
    throw new Error(`${label} package entry does not export createGreeting`);
  if (
    packageExports.createGreeting("package validation") !==
    "Hello, package validation!"
  )
    throw new Error(`${label} package entry returned an unexpected result`);
}

console.log("ESM and CommonJS package entries validated.");
