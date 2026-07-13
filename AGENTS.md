# AGENTS.md

Guidance for automated coding agents working in `mazey-npm-template`.

## Scope And Goal

This directory is the primary npm package. Improve maintainability, package quality, developer experience.

Keep the package generic, browser-friendly, and easy to rename. Preserve the package identity
`mazey-npm-template` unless the user explicitly requests a rename.

## Project Shape

- `src/index.ts`: package entrypoint and public runtime API.
- `src/typing.d.ts`: public TypeScript interfaces and type aliases.
- `types/global.d.ts`: ambient browser type augmentations.
- `test`: Jest tests for public behavior.
- `examples`: lightweight Webpack development demo.
- `site`: source-controlled landing page, Bootstrap theme, and shared browser behavior.
- `scripts/rollup.config.mjs`: production JavaScript and declaration builds.
- `scripts/webpack.config.dev.js`: website/playground build and development server.
- `scripts/build-pages.js`: combines the website, playground, and generated TypeDoc output.
- `scripts/site-config.js`: canonical public URLs and shared SEO metadata.
- `scripts/validate-seo.js`: validates the final generated Pages artifact.
- `scripts/validate-pwa.js`: validates the final manifest, icons, entry pages, and service worker.
- `scripts/change-package-name.js`: automation helper that changes only the package name.
- `lib`: generated publish output; do not edit it by hand.
- `dist-dev`, `docs`, and `coverage`: generated development, documentation, and test output.

Keep `src/index.ts` as the clear root entrypoint. As the source grows, use internal modules and
re-export the supported surface from `src/index.ts` rather than making consumers import internal
paths.

## Package Contract

The published package currently provides:

- CommonJS: `lib/index.cjs.js`
- ES modules: `lib/index.esm.js`
- Browser IIFE: `lib/mazey-npm-template.min.js`
- Root declarations: `lib/index.d.ts`
- Shared declarations: `lib/typing.d.ts`
- Global augmentations: `lib/global.d.ts`

Preserve these formats unless the user requests a packaging change. Keep `package.json` fields,
Rollup outputs, README examples, and generated files aligned.

The package intentionally has no runtime dependencies. Put build, test, lint, and documentation
tools in `devDependencies`. Do not add a runtime dependency unless it provides clear value and the
user accepts the consumer impact.

When changing a public function, value, or type, check all of these together:

- exports and implementation in `src/index.ts`;
- declarations in `src/typing.d.ts` and `types/global.d.ts`;
- tests under `test`;
- usage in `examples` and `README.md`;
- generated declarations and bundles from `npm run build`.

Do not expose package metadata or a hard-coded package version from `src/index.ts`. Package identity
and version metadata belong in `package.json` and release tooling.

## TypeScript

The library targets ES2015 with ESNext modules and bundler-style module resolution. Preserve strict
type checking and browser library support. Avoid weakening strictness globally to accommodate one
implementation detail.

`tsconfig.json` intentionally uses `"types": []`. Library source does not need Node ambient types;
Node-specific JavaScript configuration files are outside the TypeScript program. Add `@types/node`
and opt into Node types only if TypeScript source genuinely starts using Node APIs.

Use `import type` and `export type` for type-only boundaries. Keep declarations suitable for npm
consumers without requiring project-specific path aliases or undeclared type packages.

`lib/index.d.ts` must reference `lib/global.d.ts`. The Rollup declaration output currently adds:

```ts
/// <reference path="./global.d.ts" />
```

If declaration generation is changed, verify that consumers importing the package root still pick
up the global augmentations. Do not publish an unreferenced ambient declaration artifact.

## Module And Build Rules

`package.json` does not declare `"type": "module"`.

- Keep ordinary `.js` scripts in CommonJS syntax.
- Use `.mjs` for ESM configuration, as Rollup does.
- Prefer `node:` specifiers for Node built-ins when touching scripts.
- Do not introduce module-load browser side effects that fail in Node-based tests or bundlers.

Rollup owns production output. Preserve CJS, ESM, IIFE, source maps, declaration generation, the
license banner, and minification controlled by `SCRIPTS_NPM_PACKAGE_DEBUG`. Babel helpers are
bundled, and generated JavaScript must not acquire undeclared runtime helper imports.

Webpack owns the public landing page, local development server, and interactive playground.
`npm run dev` serves the website on port 8080 and the playground at `/playground/`. Keep
`examples/index.ts` small and representative of the public root API. Bootstrap is a build-time
development dependency and must not become a published runtime dependency. Do not couple the npm
package build to Webpack or make development depend on prebuilt `lib` files without a clear reason.

Never edit generated files under `lib`, `dist-dev`, `docs`, or `coverage` as source changes. Rebuild
them through the owning command when verification needs them.

## Tests And Quality Checks

Run commands from this directory. Match verification effort to the change:

```bash
npm run typecheck
npm run lint
npm run build
npm run test
npm run format:check
```

For a full pre-release check, run:

```bash
npm run preview
npm pack --dry-run
```

For narrow script changes, use focused checks such as:

```bash
node --check scripts/change-package-name.js
```

Add or update Jest tests when public behavior changes. Keep tests deterministic and independent of
network services. For packaging changes, inspect the generated `lib` files and the `npm pack`
manifest, not only whether Rollup exits successfully.

Do not run `scripts/change-package-name.js` casually during verification because it mutates
`package.json`. When explicitly testing it, restore the normal package identity or intentionally
keep the requested result.

## Documentation

Update `README.md` when changing:

- public API names, types, or examples;
- installation or development commands;
- package output paths or supported module formats;
- Node.js or TypeScript requirements;
- release or documentation workflows visible to maintainers.

TypeDoc configuration lives in `tsconfig.json`. `npm run docs` generates TypeDoc at `./docs/api`,
builds the Webpack website and playground, runs `scripts/build-pages.js`, and validates the final
artifact. Stable public routes are `/`, `/playground/`, and `/api/` below the project Pages base
path. Keep the TypeDoc hosted URL at
`https://chengchuu.github.io/mazey-npm-template/api/`, preserve the favicon, and keep all canonical
URLs synchronized through `scripts/site-config.js`.

SEO source files live under `site`. Do not edit generated output under `docs`; update source
templates, the deterministic API transformation, or build scripts instead. The final artifact must
include `robots.txt`, `sitemap.xml`, unique page metadata, one primary heading per page, crawlable
content, and working project-subpath links. Keep theme values `system`, `light`, and `dark` stored
under `mazey-npm-template-theme`, and apply the resolved value through Bootstrap's
`data-bs-theme` attribute.

PWA sources live under `site`: `manifest.webmanifest`, `service-worker.js`, and browser-only
registration/install logic. `scripts/build-pages.js` versions and emits the worker at the project
root. Keep the PWA identity, start URL, worker registration, and scope at `/mazey-npm-template/`.
Normal `npm run dev` must not register the production worker; use `npm run pwa:preview` for local
production-like testing. Never move PWA registration into `src` or package output.

## Git Hooks And Formatting

Husky hooks live in `.husky/pre-commit` and `.husky/commit-msg`. Keep them executable and start them
with `#!/usr/bin/env sh`. This project uses Husky 9, so do not add the deprecated `husky.sh`
bootstrap lines that will fail in Husky 10.

The pre-commit hook runs lint-staged. The commit-message hook runs commitlint with the conventional
configuration in `commitlint.config.js`. Preserve these checks when changing hook commands.

Follow the existing Prettier and ESLint configuration. Keep comments sparse and useful. Prefer
small, reversible changes over broad cleanup unrelated to the request.

## Publishing And CI

The npm publishing workflow is `.github/workflows/publish-npm.yml`. It tests before publishing to
npm and GitHub Packages, temporarily scopes the package to
`@${{ github.repository_owner }}/mazey-npm-template`, restores modified files, and creates a version
tag.

- Keep `contents: write` for pushing release tags.
- Keep `packages: write` for GitHub Packages publishing.
- Use `github.repository_owner` for the package scope; `github.actor` may be a bot or contributor.
- Keep `PROJECT_NAME` synchronized with the normal package name.
- Do not expose registry tokens in logs or committed configuration.
- Do not publish, push tags, or trigger releases unless the user explicitly requests it.

The Pages workflow is `.github/workflows/pages.yml`. It deploys on pushes to `main` and manual
`workflow_dispatch` runs. It uses Node.js 22, installs dependencies with `npm install`, builds the
complete Pages site with `npm run docs`, validates SEO, uploads `docs`, and deploys through the
`github-pages` environment.

- Keep its explicit permissions: `contents: read`, `pages: write`, and `id-token: write`.
- Keep the deployment step id as `deployment`; the environment URL reads
  `steps.deployment.outputs.page_url`.
- Keep Pages runs in the `pages` concurrency group with `cancel-in-progress: false` so an active
  deployment is not cancelled by a newer run.
- Keep the uploaded artifact path synchronized with the TypeDoc output directory.

## Package Rename Helper

`scripts/change-package-name.js` must:

- require a new-name argument;
- update only the `name` field in `package.json`;
- preserve two-space JSON formatting and the trailing newline;
- remain CommonJS-compatible.

Do not copy package-specific source code, repository URLs, or API names into this project during a
rename. A broader rename requires checking `package.json`, Rollup output naming, source metadata,
README links, workflows, and tests together.

## Change Discipline

Work with existing user changes and do not revert unrelated modifications. Avoid destructive Git
commands. Do not add dependencies, alter package formats, change the public API, or modify release
behavior as incidental cleanup.

Before finishing, review `git diff`, report the checks that ran, and clearly state any verification
that could not be completed.
