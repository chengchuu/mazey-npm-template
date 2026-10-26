# AGENTS.md

Guidance for automated coding agents working in `mazey-npm-template`.

## Scope And Goal

This directory is the primary npm package. Improve maintainability, package quality, and developer
experience without making the template specific to one downstream library.

Keep the package generic, browser-friendly, and easy to rename.

## Project Shape

- `src/index.ts`: package entrypoint and public runtime API.
- `src/typing.d.ts`: public TypeScript interfaces and type aliases.
- `types/global.d.ts`: ambient browser type augmentations.
- `test/`: Jest 30 tests for the sample API, React playground, central configuration, theme, SEO,
  PWA, and service-worker behavior.
- `examples`: React 19 playground components, entrypoint, HTML shell, and scoped styles that exercise
  the framework-independent package root API.
- `project.config.js`: central package-derived repository, site, theme, SEO, browser bundle, and PWA
  configuration used by build tooling.
- `scripts/project-config-utils.js`: pure package identity and GitHub repository normalization
  helpers; it contains no editable project settings.
- `site/index.html` and `site/index.ts`: landing-page template and page-specific behavior.
- `site/shared.ts`, `site/navigation.ts`, and `site/theme.ts`: shared Bootstrap, navigation, and theme
  behavior for the website and playground.
- `site/pwa.ts` and `site/runtime-config.ts`: website-only install, registration, installed-state,
  service-worker update behavior, and Webpack-injected runtime configuration.
- `site/service-worker.js`: source caching policy with build-time project, cache-prefix, and version
  tokens.
- `site/api.ts` and `site/api.css`: behavior and styling added to generated TypeDoc pages.
- `images`: source logo, favicon, and PWA icon assets copied or emitted by the site build.
- `scripts/rollup.config.mjs`: production JavaScript and declaration builds.
- `scripts/webpack.config.dev.js`: website/playground build and development server.
- `scripts/build-pages.js`: combines Webpack and TypeDoc output, transforms API HTML, and emits PWA
  files into the final Pages artifact.
- `scripts/preview-pages.js`: project-subpath-aware static server for the generated `docs` artifact.
- `scripts/validate-seo.js`: validates the final generated Pages artifact.
- `scripts/validate-pwa.js`: validates the final manifest, icons, entry pages, and service worker.
- `scripts/validate-package-exports.js`: validates the built package through its ESM, CommonJS, and
  `package.json` export conditions.
- `scripts/change-package-name.js`: automation helper that changes only the package name.
- `guides/CUSTOMIZE.md`: ordered post-fork checklist for replacing package, API, site, PWA, and workflow
  identity before using the template for another library.
- `guides/GITHUB_ACTIONS.md`: copyable npm-based Pages and npm publication workflow examples for
  downstream repositories. These examples are documentation, not workflows executed by this repository.
- `guides/TEMPLATE_BACKPORT_AUDIT.md`: historical record of reusable changes adopted from Mazey; do
  not treat it as the current operational contract when code or this guide differs.
- `eslint.config.mjs`: ESLint flat configuration for browser TypeScript, Node.js scripts, and Jest.
- `pnpm-lock.yaml`: the only tracked dependency lockfile.
- `lib`: generated publish output; do not edit it by hand.
- `dist`, `dist-dev`, `docs`, and `coverage`: ignored generated output.

Keep `src/index.ts` as the clear root entrypoint. As the source grows, use internal modules and
re-export the supported surface from `src/index.ts` rather than making consumers import internal
paths.

## Package Contract

The published package currently provides:

- CommonJS: `lib/index.cjs`
- ES modules: `lib/index.esm.js`
- Browser IIFE: `lib/mazey-npm-template.min.js`
- Root declarations: `lib/index.d.ts`
- Shared declarations: `lib/typing.d.ts`
- Global augmentations: `lib/global.d.ts`

Preserve these formats unless the user requests a packaging change. Keep `package.json` fields,
Rollup outputs, README examples, and generated files aligned.

The package exports only the package root and `./package.json`. `npm run build` regenerates every
publishable artifact and then runs `scripts/validate-package-exports.js`, which imports the package
through both ESM and CommonJS and checks the metadata subpath. Keep that validation aligned with the
sample API when replacing `createGreeting`.

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

The repository uses TypeScript 6. It targets ES2015 with ESNext modules, bundler-style module
resolution, React's automatic JSX runtime, and the DOM, DOM iterable, and ES2015 libraries. The
single TypeScript program covers `src`, `types`, `examples`, and `site`. Preserve strict type checking
and browser library support. Avoid weakening strictness globally to accommodate one implementation
detail.

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

`package.json` declares `"type": "module"` while conditional package exports preserve both ESM and
CommonJS consumer entry points.

- Keep ordinary `.js` scripts in ESM syntax and include file extensions in relative Node.js imports.
- Existing `.mjs` configuration files remain ESM; use `.cjs` only for an intentional CommonJS
  compatibility boundary.
- Keep the generated CommonJS package entry at `lib/index.cjs`; a `.js` CommonJS bundle would be
  interpreted as ESM inside this package.
- Prefer `node:` specifiers for Node built-ins when touching scripts.
- Do not introduce module-load browser side effects that fail in Node-based tests or bundlers.

`package.json` is authoritative for npm name, version, description, repository, homepage, author, and
license. `scripts/project-config-utils.js` provides package-safe identity derivation without loading
website settings. `project.config.js` derives repository identity, Pages paths, npm/GitHub URLs,
install commands, storage/cache keys, and asset URLs while explicitly owning the complete theme
palette, page metadata, and icon filenames. Keep this configuration build-only and never import it
from `src`.

Rollup owns production output. Preserve CJS, ESM, IIFE, source maps, declaration generation, the
license banner, and minification controlled by `SCRIPTS_NPM_PACKAGE_DEBUG`. Babel helpers are
bundled, and generated JavaScript must not acquire undeclared runtime helper imports.
Rollup may use the pure package helper, but it must not import `project.config.js` or require valid
website/PWA metadata to build the npm package.

TypeScript emits ES2015-oriented input for the build, and Babel's browser query is `> 1%`,
`last 2 versions`, and `android>4.0`. Babel transpiles syntax but does not supply Web Platform or
ECMAScript polyfills. Check the configured browser query and runtime API support before adding a new
native dependency.

Webpack owns the public landing page, local development server, and interactive playground.
`npm run dev` serves the website on port 8080 and the React 19 playground at `/playground/`. Keep
`examples/index.tsx` limited to application bootstrap, keep reusable components under
`examples/components`, and import the representative public API through `../src`. Bootstrap and
React are build-time development dependencies and must not become published runtime dependencies.
Do not couple the npm package build to Webpack or make development depend on prebuilt `lib` files
without a clear reason.

Webpack has two intentional URL modes:

- Ordinary `npm run dev` and `npm run build:dev` use `/` as the asset base and disable service-worker
  registration.
- `npm run build:site` sets `GITHUB_PAGES=true`, emits assets below `/mazey-npm-template/`, and enables
  the website PWA.

Keep `site/shared.ts` limited to behavior shared by the homepage and playground. API documentation
loads its own `site/api.ts` entry after TypeDoc generation. None of these website entries may be
imported by `src/index.ts` or emitted into the npm package.

Webpack serializes the browser-safe subset of `project.config.js` as `__SITE_RUNTIME_CONFIG__`.
Browser modules consume it through `site/runtime-config.ts`; do not reintroduce separate hard-coded
package names, install commands, theme keys, PWA paths, or update labels in browser TypeScript.

Never edit generated files under `lib`, `dist`, `dist-dev`, `docs`, or `coverage` as source changes.
Rebuild them through the owning command when verification needs them.

## Dependencies And Lockfiles

The package has no runtime dependencies. `mazey` is a development-only build and website dependency:
`project.config.js` uses `deepFreeze`, `scripts/project-config-utils.js` uses repository parsing and
JavaScript global-name helpers, and `site/theme.ts` uses the public theme-preference APIs. Verify the
installed Mazey signatures before changing these call sites, and do not copy Mazey into the published
runtime merely because the build uses it.

The repository tracks `pnpm-lock.yaml` and ignores `package-lock.json`, but documented commands and
GitHub Actions use npm and `npm install`. Preserve this mixed policy unless the task explicitly
changes package-manager or lockfile behavior. Do not add, remove, or regenerate a lockfile as an
incidental side effect.

## Tests And Quality Checks

Run commands from this directory. Match verification effort to the change:

```bash
npm run typecheck
npm run lint
npm run build
npm run package:validate
npm run test
npm run format:check
```

For a full pre-release check, run:

```bash
npm run preview
npm pack --dry-run
```

`npm run preview` is a verification pipeline and exits after all checks; it does not start a web
server. For an installable, production-like local Pages preview, run:

```bash
npm run pwa:preview
```

This rebuilds `docs` and serves it at
`http://127.0.0.1:4173/mazey-npm-template/`. Use the project-prefixed homepage, playground, and API
routes when testing this server. A previously installed worker may require unregistering the worker
or clearing site data before retesting lifecycle changes.

For narrow script changes, use focused checks such as:

```bash
node --check scripts/change-package-name.js
```

Jest runs as ESM through Node.js with `--experimental-vm-modules`. Most tests import maintained
TypeScript source directly; package-format verification belongs to `npm run build` and
`npm run package:validate`. Add or update Jest tests when public behavior changes. Keep tests
deterministic and independent of network services. For packaging changes, inspect the generated
`lib` files and the `npm pack` manifest, not only whether Rollup exits successfully.

The test suites have these responsibilities:

- `test/example.test.js`: public `createGreeting` behavior.
- `test/playground.test.tsx`: controlled React form behavior, errors, announcements, and shared
  theme/PWA integration.
- `test/project-config.test.js`: package/repository derivation, configured assets, manifest identity,
  and immutable central configuration.
- `test/seo.test.js`: API HTML transformation, canonical metadata, favicon paths, headings, and
  repeatable Pages assembly.
- `test/theme.test.js`: light/dark preference, one-time OS fallback, TypeDoc synchronization, and
  dynamic browser theme-color behavior.
- `test/pwa.test.js`: registration guards, install prompt behavior, installed state, and update UX.
- `test/service-worker.test.js`: manifest icons, scoped requests, cache cleanup, cache failures, and
  network-first versus cache-first behavior.

When modifying site metadata, PWA files, TypeDoc integration, or Pages assembly, run `npm run docs`
so `seo:validate` and `pwa:validate` inspect the final artifact rather than only source templates.

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

Update `guides/CUSTOMIZE.md` when identity-bearing files, generated outputs, Pages/PWA paths, or release
steps change. Keep it explicit that the npm package name, repository name, Pages base path, browser
bundle filename, and IIFE global can be different values.

Update `guides/GITHUB_ACTIONS.md` when the reusable downstream workflow examples or their stated
requirements change. Do not make that guide silently imply that its simplified npm-only publication
example matches this repository's npm, GitHub Packages, and tagging workflow.

TypeDoc configuration lives in `tsconfig.json`. `npm run docs` generates TypeDoc at `./docs/api`,
builds the Webpack website and playground into `dist-dev`, runs `scripts/build-pages.js`, and
validates the final artifact. The Pages assembly copies Webpack output, preserves the TypeDoc API
tree, deterministically transforms every API HTML page, generates the manifest and crawler files,
and replaces service-worker configuration tokens plus the content fingerprint. Stable public routes are `/`,
`/playground/`, and `/api/` below the project Pages base path. Keep the TypeDoc hosted URL at
`https://chengchuu.github.io/mazey-npm-template/api/`, preserve the favicon, and keep all canonical
URLs synchronized through `project.config.js`.

SEO metadata comes from `project.config.js`, while page content lives under `site` and `examples`.
Do not edit generated output under `docs`; update source templates, central configuration, the
deterministic API transformation, or build scripts instead. The final artifact must
include `robots.txt`, `sitemap.xml`, unique page metadata, one primary heading per page, crawlable
content, and working project-subpath links. Store only explicit `light` and `dark` values under
`mazey-npm-template-theme`, and apply the resolved value through Bootstrap's `data-bs-theme`
attribute. When no explicit value exists, resolve the OS preference once during initialization;
do not persist it or follow later color-scheme changes. The Home, Playground, and TypeDoc project
navbars expose a two-state light/dark button. TypeDoc's native Settings selector remains in place
with only its `Light` and `Dark` options. `site/theme.ts` keeps both controls, browser theme-color
metadata, and TypeDoc's concrete `tsd-theme` preference synchronized.

Canonical URLs, Open Graph URLs, and structured data should use the production site URL. Assets
that the browser must load from the current deployment, including the favicon, manifest, worker,
and PWA icons, must use the project-root `/mazey-npm-template/` base path instead of a hard-coded
`https://chengchuu.github.io` origin. This keeps both GitHub Pages and
`http://127.0.0.1:4173/mazey-npm-template/` working. Webpack may override image URLs with its current
`pagesBase` for ordinary port-8080 development.

PWA source behavior lives under `site`: `service-worker.js` and browser-only registration/install
logic. `scripts/build-pages.js` generates the manifest, injects worker configuration, versions the
cache, and emits both at the project root. Keep the PWA identity, start URL, worker registration, and
scope at `/mazey-npm-template/`.
Normal `npm run dev` must not register the production worker; use `npm run pwa:preview` for local
production-like testing. Never move PWA registration into `src` or package output.

Preserve the current PWA behavior:

- The generated manifest provides 192x192 and 512x512 PNG icons plus a padded maskable 512x512 icon.
- The homepage and playground may expose an accessible `Install app` button only after the browser
  fires `beforeinstallprompt`; TypeDoc API pages intentionally do not show an install button.
- All three entry experiences keep an update notice, explicit `Update now` action, and live status
  region. A waiting worker activates only after the user's action and reloads once after
  `controllerchange`.
- Standalone mode hides install controls. Unsupported browsers receive guidance without a broken or
  automatic prompt.
- Service-worker registration is delayed until page load/idle time, allowed only when enabled, on
  HTTPS or localhost, and within the project scope.

The handwritten service worker only handles same-origin GET requests below the project base and
ignores source maps. Documents, scripts, and styles are network-first so fresh HTML is not paired
with stale unversioned bundles. Local images and fonts are cache-first. Keep caches bounded, reject
opaque or failed responses, delete only obsolete project caches, and retain offline fallbacks. Do
not unconditionally call `skipWaiting()` or broaden interception to cross-origin or non-GET traffic.

## Git Hooks And Formatting

Husky hooks live in `.husky/pre-commit` and `.husky/commit-msg`. Keep them executable and start them
with `#!/usr/bin/env sh`. This project uses Husky 9, so do not add the deprecated `husky.sh`
bootstrap lines that will fail in Husky 10.

The pre-commit hook runs lint-staged. `.lintstagedrc` formats JavaScript, TypeScript, JSON, Markdown,
and YAML files and applies ESLint fixes to JavaScript and TypeScript. The commit-message hook runs
commitlint with the conventional configuration in `commitlint.config.js`. Preserve these checks when
changing hook commands.

Follow the existing Prettier and ESLint configuration. Keep comments sparse and useful. Prefer
small, reversible changes over broad cleanup unrelated to the request.

## Publishing And CI

The npm publishing workflow is `.github/workflows/publish-npm.yml`. Pull requests targeting `main`
or `release/v*` and manual dispatches run its validation job without publishing. Pushes to
`release/v*` run `npm run preview`, then publish to npm and GitHub Packages, derive the filename-safe
package base from `package.json` through the pure configuration helper, temporarily scope the package
to the repository owner, restore modified files, and create a version tag.

- Keep `contents: write` for pushing release tags.
- Keep `packages: write` for GitHub Packages publishing.
- Use `github.repository_owner` for the package scope; `github.actor` may be a bot or contributor.
- Keep the GitHub Packages name derived through `scripts/project-config-utils.js`; do not add a
  duplicate workflow constant or load website configuration during package publishing.
- Do not expose registry tokens in logs or committed configuration.
- Do not publish, push tags, or trigger releases unless the user explicitly requests it.

The Pages workflow is `.github/workflows/pages.yml`. It deploys on pushes to `main` and `release/v*`
and on manual `workflow_dispatch` runs. It uses Node.js 22, installs dependencies with `npm install`,
checks types and lint, runs Jest serially, builds and validates the complete Pages site with
`npm run docs`, uploads `docs`, and deploys through the `github-pages` environment.

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
- remain ESM-compatible.

Do not copy package-specific source code, repository URLs, or API names into this project during a
rename. A broader rename requires checking `package.json`, Rollup output naming, source metadata,
README links, workflows, and tests together. Follow `guides/CUSTOMIZE.md`; most identity and deployment
values should flow from `package.json` and `project.config.js` rather than manual replacements.

## Change Discipline

Work with existing user changes and do not revert unrelated modifications. Avoid destructive Git
commands. Do not add dependencies, alter package formats, change the public API, or modify release
behavior as incidental cleanup.

Before finishing, review `git diff`, report the checks that ran, and clearly state any verification
that could not be completed.
