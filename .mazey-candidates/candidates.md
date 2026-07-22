# Mazey Utility Candidates

## Summary

- Files inspected: 60 current source-controlled or review-relevant project files (55 text/source
  files and five source image headers). Generated Husky internals, ignored local lockfiles,
  dependencies, and generated build output were excluded.
- Helpers inspected: 83 utility-like functions or embedded helper units.
- Strong candidates: 0 outstanding; three original candidates were completed in Mazey 5.1.0.
- Candidates requiring generalization: 6.
- Already available in Mazey: 6 reviewed behaviors.
- Native API preferred: 12.
- Project-specific: 47.
- Rejected: 12.
- Comparison authority: installed `mazey@5.3.1`, its declarations, the refreshed `prefer-mazey` API map, and
  the sibling Mazey source where behavior required confirmation.

## Strong candidates

No strong candidates remain outstanding from this audit.

## Completed in Mazey 5.1.0

### `toJavaScriptGlobalName`

- Previous implementation: `javaScriptGlobal`; the local duplicate was removed.
- Current file: imported at `scripts/project-config-utils.js:1` and called by `packageDetails` at
  line 22; the previous implementation was
  indirectly covered for a scoped package by `test/project-config.test.js:40-47`.
- Proposed purpose: convert arbitrary text to a deterministic uppercase ASCII identifier suitable
  for an IIFE global name.
- Proposed signature: `function toJavaScriptGlobalName(value: string): string`.
- Runtime: universal; no dependencies.
- Existing Mazey equivalent: `toJavaScriptGlobalName` in Mazey 5.1.0.
- Why it is reusable: package names and output filenames regularly need a legal Rollup/Webpack IIFE
  global, and the prefix rule is easy to miss.
- Project-specific logic to remove: none; rename the function and document its intentionally ASCII,
  uppercase semantics.
- Edge cases: empty input returns `_`; leading digits are prefixed; `$` and `_` are preserved;
  punctuation and Unicode code points become underscores; repeated separators remain repeated.
- Security or compatibility considerations: this creates an identifier, not a safe property path or
  an evaluator input. It must not be used to authorize dynamic code execution.
- Proposed Mazey module: the existing Mazey utility module at `../mazey/src/util.ts`.
- Tests required: normal package names, scoped names, empty input, leading digit, `$`/`_`, repeated
  punctuation, Unicode, malformed non-string input, and repeated invocation.
- Documentation example: `toJavaScriptGlobalName("@scope/my-library") // "_SCOPE_MY_LIBRARY"`.
- Migration in this project: completed; build tooling now imports the Mazey function.

### `parseGitHubRepository`

- Current implementation: `repositoryDetails` remains a package-metadata/error adapter around
  `parseGitHubRepository`.
- Current file: `scripts/project-config-utils.js:27-37`; exercised by
  `test/project-config.test.js:62-82`.
- Proposed purpose: parse common GitHub repository shorthands and Git transport URLs into a
  canonical owner, name, slug, and HTTPS URL.
- Proposed signature: `function parseGitHubRepository(value: string): GitHubRepositoryDetails`.
- Runtime: universal; uses the WHATWG `URL` API only.
- Existing Mazey equivalent: `parseGitHubRepository` in Mazey 5.1.0.
- Why it is reusable: package metadata, release automation, documentation links, and CLIs commonly
  receive several equivalent GitHub URL forms.
- Project-specific logic to remove: accept a string in the reusable core; keep extraction from the
  npm `repository` object and package-specific error text in the caller.
- Edge cases: `github:owner/name`, `owner/name`, SCP syntax, `git://`, `git+ssh://`, `git+https://`,
  optional `.git`, `www.github.com`, whitespace, missing owner/name, extra path segments, non-GitHub
  hosts, query/hash, percent encoding, and uppercase hostnames.
- Security or compatibility considerations: parsing is not authorization. Consumers must apply
  their own owner/repository allowlists and should reject credentials, query strings, and fragments
  in the normalized contract.
- Proposed Mazey module: the existing Mazey URL module at `../mazey/src/url.ts`.
- Tests required: every accepted form above, malformed values, Unicode/percent encoding, empty
  input, object inputs rejected by the normalized API, no mutation, and deterministic repeated
  invocation.
- Documentation example: `parseGitHubRepository("git@github.com:acme/widget.git").slug // "acme/widget"`.
- Migration in this project: completed; the thin adapter is retained for npm repository-object
  extraction and package-specific errors.

### `isStandalonePWA`

- Current implementation: `isStandaloneMode`.
- Current file: `site/pwa.ts:52-60`; called at lines 115, 155, and 158 and covered by
  `test/pwa.test.js:130-157`.
- Proposed purpose: detect standard display-mode standalone state and the iOS Safari
  `navigator.standalone` fallback.
- Proposed signature: `function isStandalonePWA(): boolean`.
- Runtime: browser-preferred; the normalized API returns `false` when browser globals are absent.
- Existing Mazey equivalent: `isStandalonePWA` in Mazey 5.1.0.
- Why it is reusable: install UI, navigation, analytics, and layout behavior often need the same
  cross-browser distinction.
- Project-specific logic to remove: injected `windowRef` and `navigatorRef` are useful internally
  for tests but should not be the ordinary public signature.
- Edge cases: Node/SSR, missing `matchMedia`, standard standalone match, iOS boolean fallback,
  browser tab mode, both signals present, and exceptions from host objects.
- Security or compatibility considerations: standalone mode is a presentation hint, not proof of a
  successful install, trusted origin, or service-worker control.
- Proposed Mazey module: `../mazey/src/browser.ts`, next to `isSafePWAEnv`.
- Tests required: browser and Node contexts, both detection paths, malformed host mocks, repeated
  invocation, and no global mutation.
- Documentation example: `if (isStandalonePWA()) hideInstallInstructions();`.
- Migration in this project: intentionally deferred because the local website helper accepts
  injected browser objects used by deterministic tests, while the public Mazey API reads guarded
  globals.

## Candidates requiring generalization

| Proposed API                                 | Current source                         | Generalization needed                                                                                                                                                     | Mazey comparison                                                                     |
| -------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `getPackageDetails` split into smaller units | `scripts/project-config-utils.js:3-25` | Keep package validation/install-command policy local; use the two completed Mazey utilities above and native scoped-name extraction independently.                        | No composite equivalent.                                                             |
| `fingerprintFiles`                           | `scripts/build-pages.js:215-240`       | Accept logical names plus bytes instead of walking a directory; define ordering, duplicate-name handling, digest/length, caller-name normalization, and symlink behavior. | No equivalent; `genHashCode` is non-cryptographic and unsuitable.                    |
| `readPngDimensions`                          | `scripts/validate-pwa.js:40-62`        | Accept `Uint8Array`/`ArrayBuffer`, remove synchronous filesystem I/O, and define whether full PNG structure and CRC validation belong in scope.                           | No equivalent.                                                                       |
| `validateLocalHtmlFragments`                 | `scripts/validate-seo.js:120-186`      | Separate filesystem resolution from parsed HTML IDs/links, use a real HTML parser, define symlink and percent-decoding policy, and return structured diagnostics.         | No equivalent.                                                                       |
| `validateWebAppManifestMetadata`             | `scripts/validate-pwa.js:16-38`        | Define a standards-based subset, return typed issues, preserve safe unknown-input handling, and remove template-specific wording/defaults.                                | No equivalent.                                                                       |
| `resolvePathWithinRoot`                      | `scripts/preview-pages.js:31-45`       | Remove server/config/file-existence coupling; define encoded separators, platform paths, directory indexes, and realpath/symlink containment.                             | No equivalent; native `path.resolve` is necessary but not sufficient for the policy. |

## Already available in Mazey

Mazey 5.3.1 provides six reviewed behaviors:

- `toJavaScriptGlobalName` now replaces the former local `javaScriptGlobal` helper.
- `parseGitHubRepository` now provides the reusable core inside `repositoryDetails`.
- `isStandalonePWA` matches the standalone detection behavior; the local injected adapter remains
  for testability.
- `isSafePWAEnv({ requireManifest, scope })` completed the proposed generic eligibility extension;
  the local registration predicate still adds project enablement and injected environment policy.
- `resolveThemePreference` replaces the former local preference validation, storage read, and
  system/fallback resolution.
- `setThemePreference` replaces the former project-theme storage write while preserving
  session-only selection when persistence fails.

`project.config.js:1,106-169` also continues to use `deepFreeze` correctly.

Potentially similar APIs were rejected as replacements after source comparison:

- `sanitizeInput` escapes six characters and throws on non-string input; `escapeAttribute` escapes
  a narrower double-quoted HTML attribute set.
- `removeHTML` strips tags but does not remove script/style contents or decode/collapse text as
  `visibleText` attempts to do.
- `isStandalonePWA` and the extended `isSafePWAEnv` are available, but their global-environment
  signatures are not drop-in replacements for every injected local test adapter.

## Native API preferred

Twelve helper units are clearer as local native operations: scoped package basename extraction,
homepage/base-path normalization with `URL`, the two build-config `_resolve` wrappers, `matchAll`
collection, three recursive file walkers, required-path checks, the test `projectUrl` helper, the
zero-delay `settle` helper, and simple response writing in the preview server. Node 22 also supports
recursive `readdirSync`; a Mazey filesystem-walker API would add little stable value.

`escapeRegExp` is not counted as native-preferred because `RegExp.escape` is unavailable in the
project's Node 22 runtime. It remains a correct local one-liner but is rejected as too small to
justify a Mazey API by itself.

## Project-specific and rejected helpers

The complete classification is in `source-map.md`. The main project-specific groups are TypeDoc HTML
rewriting, Pages/SEO/PWA assembly, template validation policy, website UI controllers, service-worker
caching policy, sample greeting behavior, and test-fixture builders.

Regex-based HTML parsing (`attributes`, `findTag`, `visibleText`, `elementIds`, and
`apiAppShellAssets`) is rejected for a reusable public API because valid HTML contains quoting,
entity, raw-text, and malformed-markup cases these expressions cannot model. `hasPwaRuntimeReference`
is also rejected because source-text matching has both false positives and easy false negatives.

## Provenance and licensing

Git history attributes the candidate-bearing files to Cheng in this repository, with no comments
claiming copied implementations and no third-party source URLs attached to candidate code. Closely
related copies also exist in the sibling `mazey` repository's website tooling, so a contribution
must determine the canonical history before choosing commit attribution. The repository is MIT
licensed, but any final Mazey implementation should be independently reviewed and written against
the documented behavior rather than copied from dependencies or generated output.

## Validation checklist

- All source paths and line ranges were checked against the current worktree.
- Mazey comparisons were checked against installed `mazey@5.3.1` declarations and relevant sibling
  source, including the six adopted APIs.
- Generated output, dependencies, and third-party code were excluded from the inventory.
- `candidates.json` was parsed as JSON and checked for allowed enum values and matching summary.
- Markdown files were checked with the repository's formatter.
- The completion update migrated the two exact build-tool helpers; injected PWA adapters were
  retained where behavior or testability differs.
