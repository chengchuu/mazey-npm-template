⚠️ Note: The project is a template for npm. Please don't use it directly.

# mazey-npm-template

[![npm version][npm-version-image]][npm-url]
[![license][license-image]][license-url]

[npm-version-image]: https://img.shields.io/npm/v/mazey-npm-template.svg
[npm-url]: https://www.npmjs.com/package/mazey-npm-template
[license-image]: https://img.shields.io/npm/l/mazey-npm-template.svg
[license-url]: https://github.com/chengchuu/mazey-npm-template/blob/main/LICENSE

A TypeScript template for publishing npm packages in CJS, ESM, and browser formats.

## Install

Use mazey-npm-template via [npm](https://www.npmjs.com/package/mazey-npm-template).

```bash
npm install mazey-npm-template --save
```

Of course, you can also download this file and serve it yourself. The file locates at the `lib/mazey-npm-template.min.js`.

## Usage

Import the package in your application code.

```typescript
import { createGreeting, packageInfo } from "mazey-npm-template";

createGreeting("Cheng"); // "Hello, Cheng!"

createGreeting("community", {
  punctuation: ".",
}); // "Hello, community."

packageInfo.name; // "mazey-npm-template"
```

## Contributing

### Development Environment

| Dependency | Version  |
| ---------- | -------- |
| Node.js    | v22.21.1 |
| TypeScript | v5.9.3   |

### Scripts

```bash
# Install dependencies
npm i

# Start the development server
npm run dev

# Build the package
npm run build

# Run tests
npm run test

# Generate documentation
npm run docs
```

## License

This software is released under the terms of the [MIT license](https://github.com/chengchuu/mazey-npm-template/blob/main/LICENSE).
