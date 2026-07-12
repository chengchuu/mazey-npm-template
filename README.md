> **Note:** This package is a working npm library template. Use it as a starting point and replace
> the sample package identity and API before publishing your own library.

# mazey-npm-template

[![npm version][npm-version-image]][npm-url]
[![license][license-image]][license-url]

[npm-version-image]: https://img.shields.io/npm/v/mazey-npm-template.svg
[npm-url]: https://www.npmjs.com/package/mazey-npm-template
[license-image]: https://img.shields.io/npm/l/mazey-npm-template.svg
[license-url]: https://github.com/chengchuu/mazey-npm-template/blob/main/LICENSE

A TypeScript template for publishing npm packages in CJS, ESM, and browser formats.

- [Project website](https://chengchuu.github.io/mazey-npm-template/)
- [Live playground](https://chengchuu.github.io/mazey-npm-template/playground/)
- [API documentation](https://chengchuu.github.io/mazey-npm-template/api/)

## Installation

Use mazey-npm-template via [npm](https://www.npmjs.com/package/mazey-npm-template).

```bash
npm install mazey-npm-template
```

For direct browser usage, load the published `lib/mazey-npm-template.min.js` IIFE bundle.

## Quick Start

```ts
import { createGreeting } from "mazey-npm-template";

const message = createGreeting("Cheng");

console.log(message); // "Hello, Cheng!"
```

## Usage

### ESM And TypeScript

Import runtime values and public types from the package root:

```ts
import {
  createGreeting,
  packageInfo,
  type CreateGreetingOptions,
} from "mazey-npm-template";

const options: CreateGreetingOptions = {
  punctuation: ".",
};

console.log(createGreeting("community", options)); // "Hello, community."
console.log(packageInfo.name); // "mazey-npm-template"
```

### CommonJS

```js
const { createGreeting, packageInfo } = require("mazey-npm-template");

console.log(createGreeting("CommonJS")); // "Hello, CommonJS!"
console.log(packageInfo.version);
```

### Browser Script

Load the IIFE bundle directly from a CDN when a package manager or bundler is not available:

```html
<script src="https://cdn.jsdelivr.net/npm/mazey-npm-template/lib/mazey-npm-template.min.js"></script>
<script>
  const { createGreeting } = MAZEY_NPM_TEMPLATE;

  document.querySelector("#message").textContent = createGreeting("browser");
</script>
```

Pin an exact package version in the CDN URL for production applications.

## API Reference

### `createGreeting(name, options?)`

Creates a greeting and returns it as a string.

| Parameter             | Type                    | Description                                    |
| --------------------- | ----------------------- | ---------------------------------------------- |
| `name`                | `string`                | Name included in the greeting.                 |
| `options`             | `CreateGreetingOptions` | Optional output formatting.                    |
| `options.punctuation` | `string`                | Final punctuation. Defaults to an exclamation. |

Whitespace is trimmed from `name`. A blank name falls back to `"friend"`.

```ts
createGreeting("Cheng"); // "Hello, Cheng!"
createGreeting("  team  ", { punctuation: "." }); // "Hello, team."
createGreeting("   "); // "Hello, friend!"
```

### `packageInfo`

Exposes the package name and version:

```ts
interface PackageInfo {
  name: string;
  version: string;
}
```

The generated [API documentation](https://chengchuu.github.io/mazey-npm-template/api/)
describes the complete public surface.

## Package Formats

| Consumer           | Package field | Published file                  |
| ------------------ | ------------- | ------------------------------- |
| ESM and bundlers   | `module`      | `lib/index.esm.js`              |
| Node.js CommonJS   | `main`        | `lib/index.cjs.js`              |
| Browser/CDN        | `unpkg`       | `lib/mazey-npm-template.min.js` |
| TypeScript tooling | `types`       | `lib/index.d.ts`                |

Source maps are generated for all JavaScript bundles. The root declarations also load the
published browser type augmentations from `lib/global.d.ts`.

## Development

Repository workflows use Node.js 22. Install dependencies and start the example development server:

```bash
npm install
npm run dev
```

The project website is served at <http://localhost:8080/>. The playground is available at
<http://localhost:8080/playground/> and imports the public API directly from `src`.

Generate the complete GitHub Pages artifact, including the website, playground, API documentation,
`robots.txt`, and `sitemap.xml`:

```bash
npm run docs
npm run seo:validate
```

The deployed crawler files are
[`/mazey-npm-template/robots.txt`](https://chengchuu.github.io/mazey-npm-template/robots.txt)
and
[`/mazey-npm-template/sitemap.xml`](https://chengchuu.github.io/mazey-npm-template/sitemap.xml).

## License

This project is released under the [MIT License][license-url].
