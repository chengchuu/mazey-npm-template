# Template Backport Audit

## Scope

This audit compares the optimized `mazey` project with `mazey-npm-template` and adopts only changes that solve a reusable template problem. The package API remains the sample `createGreeting` API; generated `lib`, `dist-dev`, `docs`, and `coverage` files remain build outputs rather than source changes.

## Reusable Improvements Adopted

- Hardened light, dark, and system theme initialization against unavailable storage, corrupted stored values, and browsers that expose the legacy `MediaQueryList` listener API.
- Made service-worker installation deterministic: the app shell is precached atomically, partial caches are removed after a failed installation, runtime eviction preserves app-shell entries, and offline lookup is restricted to the current project cache.
- Included the generated TypeDoc entry page's local scripts, styles, icons, and preload dependencies in the PWA app shell.
- Required every discovered TypeDoc app-shell reference to resolve to a file inside the generated Pages artifact before emitting the worker.
- Framed fingerprint inputs unambiguously and included the complete generated service-worker inputs so worker-only caching changes produce a new cache version without colliding with a different Pages artifact.
- Added `.nojekyll` to the assembled Pages artifact.
- Preserved TypeDoc's search dialog and promoted the TypeDoc page title to the single primary heading while keeping later headings in a valid order.
- Removed TypeDoc's body-hiding bootstrap without consuming unrelated inline script blocks that appear before it.
- Validated every detectable local fragment link instead of checking only a fixed required-link list, while ignoring example IDs inside scripts, styles, and comments and resolving project-root links within the configured Pages base path.
- Strengthened final artifact validation for the TypeDoc search dialog, first heading, precached API assets, and `.nojekyll`.
- Rejected manifest icon paths that escape the generated `docs` artifact before reading image files.
- Required a complete, correctly sized PNG IHDR chunk with positive dimensions before trusting manifest icon metadata.
- Kept PWA runtime APIs out of published package source without rejecting inert identifiers such as `serviceWorkerUrl`.
- Updated GitHub workflows to the current stable `actions/setup-node@v6`, limited default publish-workflow permissions to read-only, and scoped write permissions to the publish job.
- Made the publish workflow run the repository's complete `npm run preview` validation before publication.
- Upgraded the `mazey` development dependency to 5.3.1 and reused its cycle-safe `deepFreeze`, package-identity helpers, and public theme preference APIs.

## Improvements Generalized Before Adoption

- Derived TypeDoc app-shell assets from generated API HTML and central site configuration instead of copying target filenames.
- Removed unused package-name and display-name fields from the browser runtime configuration. Website identity remains supplied through build-time templates and the PWA configuration.
- Moved maintained customization documentation to `guides/CUSTOMIZE.md` and updated repository guidance and README links, reserving `docs/` for generated Pages output.

## Target-Specific Changes Rejected

- Mazey package-specific runtime APIs, types, API examples, tests, and package output names.
- Mazey branding, descriptions, URLs, images, colors, global name, and metadata.
- The target's `@latest` CDN policy; the template continues to explain that production consumers should choose an explicit version policy.
- Legacy release helpers and their optional dependencies.
- `prefer-mazey` skill synchronization tooling.
- The target's `docs/v*` Pages branch and release-branch publication policy.
- Target-specific TypeScript/Webpack compatibility configuration, bundle-size thresholds, and host allowlists.
- Target API documentation such as the `formatDate` token table.

## Uncertain or Deferred Differences

- Building Rollup outputs in the Pages workflow before Jest can catch an additional package-build failure, but Pages generation does not consume `lib` and the publish workflow now runs the complete preview pipeline. The extra duplicate build was not adopted.
- The target's shorter homepage and playground copy is useful for Mazey but cannot be generalized without weakening the template's customization guidance.
- Target CSS simplifications and focus colors are tied to its branding and were not adopted without independent contrast and visual evidence.

## Files Added, Modified, Moved, and Removed

Added:

- `guides/TEMPLATE_BACKPORT_AUDIT.md`

Moved:

- `CUSTOMIZE.md` to `guides/CUSTOMIZE.md`

Modified:

- `.github/workflows/pages.yml`
- `.github/workflows/publish-npm.yml`
- `AGENTS.md`
- `README.md`
- `examples/index.html`
- `package.json`
- `scripts/build-pages.js`
- `scripts/validate-pwa.js`
- `scripts/validate-seo.js`
- `scripts/webpack.config.dev.js`
- `site/index.html`
- `site/pwa.ts`
- `site/runtime-config.ts`
- `site/service-worker.js`
- `site/theme.ts`
- `test/project-config.test.js`
- `test/pwa.test.js`
- `test/seo.test.js`
- `test/service-worker.test.js`
- `test/theme.test.js`

No generated output is intended to be committed as part of this backport.

## Dependency Changes

- Upgraded the `mazey` development dependency from 4.13.2 to 5.3.1 for shared configuration, package identity, and website theme preference helpers.
- Added no runtime dependencies.
- No source-controlled lockfile is used or modified; local ignored lockfiles are not part of the
  repository change.

## Compatibility and Migration Impact

- The published ESM, CommonJS, browser IIFE, and TypeScript API contract is unchanged.
- Rollup remains responsible for package output, Webpack for the website and playground, TypeDoc for API HTML, and `scripts/build-pages.js` for the final Pages artifact.
- Bootstrap remains a website-only development dependency.
- GitHub Pages project-subpath behavior and system, light, and dark themes are preserved.
- Existing repository links to `CUSTOMIZE.md` must use `guides/CUSTOMIZE.md`; all links in this repository were updated.
- A service-worker update now fails cleanly instead of activating with an incomplete app shell. Existing users keep the previous worker until a complete replacement installs.

## Commands Run and Results

- `node --check scripts/build-pages.js`, `node --check scripts/validate-pwa.js`, and `node --check scripts/validate-seo.js`: passed.
- Focused Jest regression runs passed: the five-suite backport run covered 47 tests, and the post-review SEO run covered 13 tests.
- `npm run preview`: passed type checking, ESLint, Rollup package builds, package-export validation, all 6 Jest suites and 63 tests, TypeDoc, the production Webpack site build, SEO validation for 3 primary pages and 5 API pages, and PWA validation for 3 entry pages and 3 icons.
- `npm run format:check`: passed.
- `npm pack --dry-run --json`: the first attempt was blocked by pre-existing root-owned files in the user npm cache. Re-running as `npm --cache /private/tmp/mazey-npm-template-npm-cache pack --dry-run --json` passed and reported 12 intended package files with no bundled dependencies.
- `git diff --check`: passed.
- `actionlint`: not installed locally, so workflow linting was not run; the workflow files were still covered by manual diff review.

## Remaining Opportunities

- Exercise installation and update behavior manually in supported desktop and mobile browsers when a release candidate is available; browser install prompts cannot be fully simulated by Jest.
- Revisit the template's development-host allowlist only with a documented local-hosting requirement; the matching target value is project-specific and was intentionally not copied.
- Continue validating stable GitHub Action majors before future upgrades.
