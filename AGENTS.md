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
- `scripts/rollup.config.mjs`: production JavaScript and declaration builds.
- `scripts/webpack.config.dev.js`: development/demo build and dev server.
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

`packageInfo.version` is currently a literal value in `src/index.ts`. Keep it synchronized with
`package.json` when changing the version unless the version source is deliberately redesigned.

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

Webpack owns only the local example and development server. `npm run dev` serves the example on
port 8080. Keep `examples/index.ts` small and representative of the public root API. Do not couple
the publish build to Webpack or make development depend on prebuilt `lib` files without a clear
reason.

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

TypeDoc generates `docs` from `src/index.ts`. Keep public TSDoc useful and concise. Generated docs
are output, not hand-maintained source.

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

The Pages workflow builds TypeDoc with Node.js 22 and deploys `docs` using GitHub Pages actions.
Keep its explicit permissions: `contents: read`, `pages: write`, and `id-token: write`.

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
