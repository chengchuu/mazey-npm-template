# Customize This Template

Use this checklist after forking or copying the repository to create a new npm library. Make source
changes first, then regenerate `lib`, `dist-dev`, and `docs`; do not edit generated output by hand.

## 1. Choose The New Identity

Write down these values before replacing anything. They are related, but they are not always the
same string.

| Value                       | Current example                                   | New value example                          |
| --------------------------- | ------------------------------------------------- | ------------------------------------------ |
| npm package name            | `mazey-npm-template`                              | `my-library` or `@my-scope/my-library`     |
| Repository name             | `mazey-npm-template`                              | `my-library`                               |
| Repository owner            | `chengchuu`                                       | `my-account`                               |
| Repository slug             | `chengchuu/mazey-npm-template`                    | `my-account/my-library`                    |
| Browser bundle filename     | `mazey-npm-template.min.js`                       | `my-library.min.js`                        |
| Browser IIFE global         | `MAZEY_NPM_TEMPLATE`                              | `MY_LIBRARY`                               |
| GitHub Pages base path      | `/mazey-npm-template/`                            | `/my-library/`                             |
| GitHub Pages URL            | `https://chengchuu.github.io/mazey-npm-template/` | `https://my-account.github.io/my-library/` |
| Display name                | `mazey-npm-template`                              | `My Library`                               |
| PWA short name              | `mazey template`                                  | `My Library`                               |
| Theme storage key           | `mazey-npm-template-theme`                        | `my-library-theme`                         |
| Service-worker cache prefix | `mazey-npm-template-site-`                        | `my-library-site-`                         |

The Pages base path comes from the **repository name**, not necessarily the npm package name. A
scoped npm package such as `@my-scope/my-library` should still use a filesystem-safe bundle filename,
a valid JavaScript IIFE global, and normally `/my-library/` as its project Pages path.

Most of this table is now derived rather than repeated. `package.json` owns npm metadata, repository,
and homepage fields. The pure `scripts/project-config-utils.js` helper derives package-safe names and
normalizes common GitHub repository forms, while `project.config.js` derives Pages paths, npm/GitHub
URLs, install commands, theme keys, cache prefixes, and generated asset URLs.

## 2. Update Package Metadata

Edit `package.json`:

- Set `name`, `version`, and `description`.
- Replace `keywords`, `author`, `repository`, `bugs`, and `homepage`.
- Keep `main`, `module`, `types`, and conditional `exports` aligned with the Rollup outputs.
- Change `unpkg` and `jsdelivr` to the chosen browser bundle filename.
- Review `license`, `files`, `engines`, dependencies, and peer dependencies for the new library.

The helper below changes only `package.json#name`; it is not a complete template conversion:

```bash
node scripts/change-package-name.js my-library
```

After changing metadata, reinstall with the package manager selected for the project and review any
lockfile changes. Do not expose the package name or version as a hard-coded runtime export from
`src/index.ts`.

Then edit `project.config.js` for values that cannot be derived safely:

- Replace the PWA short name in `const shortName = "mazey template";`. Keep it concise enough for
  installed-app labels; it does not need to match the npm package name exactly.
- Light and dark backgrounds plus the coordinated light/dark primary interaction palette. Review
  base, hover, active, soft, and RGB values together and preserve readable contrast.
- Page titles and descriptions when the new library is not a greeting API.
- Favicon, logo, Open Graph image, or PWA icon filenames when the replacement assets use different
  names. Update `const openGraphImageFile = "logo-dark-circle-open-graph-1200x630.png";` for the
  social preview. Keep that image at 1200x630 unless intentionally changing its configured width and
  height.

Keep `project.config.js` in ESM format. Node scripts import it directly, Webpack injects a
browser-safe subset through `site/runtime-config.ts`, and the Pages build generates static files from
it. Do not import this configuration from the published `src` entrypoint.

## 3. Replace The Sample API

Replace the greeting example with the new library's real public API:

- Implement and export runtime values from `src/index.ts`.
- Define public interfaces and type aliases in `src/typing.d.ts`, or move them into source modules
  and re-export them from `src/index.ts`.
- Update `types/global.d.ts` if the library intentionally augments browser globals. If global
  declarations are unnecessary, remove `globalDtsConf` and the `indexDtsConf` reference banner from
  `scripts/rollup.config.mjs` together; do not edit generated declarations in `lib`.
- Replace tests in `test/example.test.js` and add focused tests for the new behavior.
- Update `examples/index.ts` so the playground imports the package root API through `../src`.
- Replace API names, descriptions, and code samples in `README.md`, `site/index.html`, and
  `examples/index.html`.

Keep `src/index.ts` as the clear public entrypoint. Consumers should not need to import private
source paths.

## 4. Configure Rollup Outputs

Review `scripts/rollup.config.mjs`:

- Keep the CJS, ESM, IIFE, source-map, and declaration outputs that the new package supports.
- Keep `package.json#main`, `module`, `types`, `unpkg`, and `jsdelivr` synchronized with those files.
- Add real external dependencies to `external`; do not accidentally bundle peer dependencies.

`scripts/project-config-utils.js` derives a filesystem-safe bundle name from the final segment of
`pkg.name` and a valid uppercase IIFE global from that bundle name. This also handles scoped packages
without making Rollup evaluate website configuration. The banner derives its owner, package URL, and
license from `package.json`. Update `package.json#unpkg` and `package.json#jsdelivr` to the derived
filename; the configuration tests fail when those fields drift.

## 5. Update Documentation And Branding

Replace the template-facing content in these source files:

- `README.md`: badges, install commands, imports, CDN URL, IIFE global, API reference, output table,
  website links, and package description.
- `LICENSE`: copyright holder and year where appropriate. Preserve notices required by the selected
  license.
- `AGENTS.md`: package contract, output names, URLs, commands, and project-specific agent guidance.
- `site/index.html`: navigation, headings, install snippets, API examples, package formats, and
  footer.
- `examples/index.html`: playground title, descriptions, labels, fallback content, and footer.
- `site/index.ts` and `site/pwa.ts`: page behavior or generic user-facing messages when the new
  project needs different interactions. Package identity and the install command are injected.

Replace the files under `images` with the new branding. Either retain the existing filenames or
update every reference. PWA images must remain real square PNG files with declared dimensions of
192x192 and 512x512; keep important artwork inside the maskable icon's safe area.

## 6. Update Website, SEO, And PWA Identity

The public website is a GitHub Pages project site. Update all of these together:

- `package.json#repository` supplies the GitHub owner and repository.
- `package.json#homepage` supplies the production site URL and its Pages base path.
- `project.config.js` supplies branding, page metadata, theme colors, icon filenames, manifest
  settings, and all derived website/PWA URLs.
- `site/index.html` and `examples/index.html` contain page-specific prose and API examples; identity,
  install commands, bundle names, theme values, and update messages are injected automatically.
- `site/service-worker.js` contains caching policy and build tokens. The Pages build replaces its
  project base, cache prefix, and cache version from central configuration.
- `scripts/build-pages.js` generates `manifest.webmanifest`, `robots.txt`, and `sitemap.xml`, then
  transforms TypeDoc pages using central metadata.
- Validators and tests consume `project.config.js`; update their behavior only when changing a
  contract rather than merely renaming the project.

Canonical and social URLs should use the production Pages URL. Browser-loaded project assets such as
the favicon, manifest, worker, and PWA icons should use the current origin with the project base path,
for example `/my-library/images/favicon.png`. Do not hard-code the production origin for those local
assets, because that breaks the local Pages preview.

If the site is hosted at a user or organization root instead of a project path, changing the scope to
`/` is a deliberate architecture change. Review the manifest, worker, Webpack public path, validators,
tests, preview server, and all internal links together.

## 7. Review Development And Release Automation

Update `.github/workflows/publish-npm.yml`:

- Keep the GitHub Packages name derived from `package.json` through
  `scripts/project-config-utils.js#packageDetails`.
- Review branch triggers before enabling publishing. The current workflow publishes only for push
  events after tests pass.
- Add the new repository's `NPM_TOKEN` secret before npm publishing.
- Keep `contents: write` when the workflow creates release tags.
- Keep `packages: write` for GitHub Packages.
- Keep `github.repository_owner` for the GitHub Packages scope.

If the npm package itself is scoped, review whether publishing a second package under the GitHub
repository owner is still desired. The workflow uses the derived unscoped bundle base for the GitHub
Packages name and does not nest the original npm scope.

Review `.github/workflows/pages.yml`:

- Confirm pushes to `main` should deploy the website.
- Keep `contents: read`, `pages: write`, and `id-token: write`.
- Configure GitHub Pages to use **GitHub Actions** as its source.
- Confirm the `github-pages` environment allows the deployment branch.

Do not publish, create tags, or deploy merely to test the rename. Use local builds and dry runs first.

## 8. Find Remaining Template Strings

Search source-controlled files after making the replacements:

```bash
rg -n --hidden \
  --glob '!node_modules/**' \
  --glob '!lib/**' \
  --glob '!dist-dev/**' \
  --glob '!docs/**' \
  --glob '!coverage/**' \
  --glob '!.git/**' \
  'mazey-npm-template|chengchuu|mazeyqian@gmail\.com|createGreeting|CreateGreetingOptions|MAZEY_NPM_TEMPLATE' .
```

Review every remaining match. Some build markers and test fixtures may intentionally remain only
until their corresponding build logic is renamed; do not replace one side without the other.

Also search separately for the old Pages base path and theme/cache identifiers:

```bash
rg -n --hidden \
  --glob '!node_modules/**' \
  --glob '!lib/**' \
  --glob '!dist-dev/**' \
  --glob '!docs/**' \
  --glob '!coverage/**' \
  --glob '!.git/**' \
  '/mazey-npm-template/|mazey-npm-template-theme|mazey-npm-template-site-' .
```

## 9. Regenerate And Verify

Run the complete verification pipeline:

```bash
npm install
npm run preview
npm pack --dry-run
npm publish --dry-run --access public
```

`npm run preview` checks types and lint, builds the package, runs Jest, generates the website and API
documentation, and validates SEO and PWA output.

Inspect the generated package:

- Confirm `lib/index.cjs`, `lib/index.esm.js`, declarations, and the IIFE bundle exist.
- Confirm generated banners, declarations, source maps, and browser globals use the new identity.
- Confirm `npm pack --dry-run` includes only intended consumer files and has a reasonable size.
- Confirm no website or service-worker runtime is present in `src` or the npm package output.

Test the production-like website locally:

```bash
npm run pwa:preview
```

Open the project-prefixed homepage, playground, and API routes. Check navigation, favicon, theme,
manifest, install behavior where supported, update UI, and service-worker scope. Clear old site data
when testing a renamed worker or cache.

## 10. Final Release Checklist

- [ ] The package name is available on the intended npm registry.
- [ ] The version is appropriate for the new package.
- [ ] Package metadata, author, repository, license, and links are correct.
- [ ] The public API, types, tests, examples, and README agree.
- [ ] CJS, ESM, IIFE, declarations, and package fields resolve to the intended files.
- [ ] The IIFE global is a valid JavaScript identifier.
- [ ] The Pages URL and base path use the repository name.
- [ ] Canonical URLs, sitemap, robots file, favicon, and social metadata are correct.
- [ ] Manifest identity, icons, worker scope, cache prefix, and theme storage key are unique.
- [ ] GitHub workflow triggers and permissions were reviewed.
- [ ] `NPM_TOKEN` is configured only as a repository secret.
- [ ] `npm run preview`, `npm pack --dry-run`, and the local Pages preview pass.
- [ ] No old template identity or sample API remains unintentionally.
